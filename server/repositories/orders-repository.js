import { pool } from '../lib/db.js'
import { initialOrders } from '../data/mock-orders.js'

function mapRowToOrder(row) {
  return {
    id: row.id,
    customer: row.customer,
    phone: row.phone,
    address: row.address,
    items: row.items,
    elapsed: row.elapsed,
    value: Number(row.value),
    status: row.status,
    payment: row.payment,
    time: row.time,
  }
}

async function upsertOrder(client, order, index) {
  await client.query(
    `
      insert into orders (
        id,
        customer,
        phone,
        address,
        items,
        elapsed,
        value,
        status,
        payment,
        time,
        sort_index
      )
      values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
      on conflict (id) do update set
        customer = excluded.customer,
        phone = excluded.phone,
        address = excluded.address,
        items = excluded.items,
        elapsed = excluded.elapsed,
        value = excluded.value,
        status = excluded.status,
        payment = excluded.payment,
        time = excluded.time,
        sort_index = excluded.sort_index,
        updated_at = now()
    `,
    [
      order.id,
      order.customer,
      order.phone,
      order.address,
      JSON.stringify(order.items),
      order.elapsed,
      order.value,
      order.status,
      order.payment,
      order.time,
      index,
    ],
  )
}

export async function initializeOrdersTable() {
  await pool.query(`
    create table if not exists orders (
      id integer primary key,
      customer text not null,
      phone text not null,
      address text not null,
      items jsonb not null,
      elapsed text not null,
      value numeric(10, 2) not null,
      status text not null,
      payment text not null,
      time text not null,
      sort_index integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pool.query('create index if not exists orders_sort_index_idx on orders (sort_index)')

  const existing = await pool.query('select count(*)::int as count from orders')
  if (existing.rows[0]?.count > 0) {
    return
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    for (const [index, order] of initialOrders.entries()) {
      await upsertOrder(client, order, index)
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function listOrders() {
  const result = await pool.query(`
    select id, customer, phone, address, items, elapsed, value, status, payment, time
    from orders
    order by sort_index asc, id desc
  `)

  return result.rows.map(mapRowToOrder)
}

export async function replaceOrders(nextOrders) {
  const client = await pool.connect()

  try {
    await client.query('begin')

    const previous = await client.query('select id, status from orders')
    const previousStatusById = new Map(previous.rows.map((row) => [row.id, row.status]))

    for (const [index, order] of nextOrders.entries()) {
      await upsertOrder(client, order, index)
    }

    if (nextOrders.length > 0) {
      await client.query('delete from orders where not (id = any($1::int[]))', [nextOrders.map((order) => order.id)])
    } else {
      await client.query('delete from orders')
    }

    await client.query('commit')

    const changedOrders = nextOrders.filter((order) => previousStatusById.get(order.id) !== order.status)
    return { orders: nextOrders, changedOrders }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
