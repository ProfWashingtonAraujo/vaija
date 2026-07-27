import { pool } from '../lib/db.js'
import { initialCategories, initialProducts } from '../data/mock-products.js'

function mapCategory(row) {
  return {
    name: row.name,
    menuEnabled: row.menu_enabled,
    posEnabled: row.pos_enabled,
  }
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    category: row.category_name,
    description: row.description,
    image: row.image,
    available: row.available,
  }
}

async function upsertCategory(client, category, index) {
  await client.query(
    `
      insert into categories (name, menu_enabled, pos_enabled, sort_index)
      values ($1, $2, $3, $4)
      on conflict (name) do update set
        menu_enabled = excluded.menu_enabled,
        pos_enabled = excluded.pos_enabled,
        sort_index = excluded.sort_index
    `,
    [category.name, category.menu_enabled, category.pos_enabled, index],
  )
}

async function upsertProduct(client, product, index) {
  await client.query(
    `
      insert into products (id, name, price, category_name, description, image, available, sort_index)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (id) do update set
        name = excluded.name,
        price = excluded.price,
        category_name = excluded.category_name,
        description = excluded.description,
        image = excluded.image,
        available = excluded.available,
        sort_index = excluded.sort_index,
        updated_at = now()
    `,
    [product.id, product.name, product.price, product.category, product.description, product.image, product.available, index],
  )
}

export async function initializeCatalogTables() {
  await pool.query(`
    create table if not exists categories (
      name text primary key,
      menu_enabled boolean not null default false,
      pos_enabled boolean not null default false,
      sort_index integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pool.query(`
    create table if not exists products (
      id text primary key,
      name text not null,
      price numeric(10, 2) not null,
      category_name text not null references categories(name) on update cascade,
      description text not null,
      image text not null,
      available boolean not null default true,
      sort_index integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pool.query('create index if not exists categories_sort_index_idx on categories (sort_index)')
  await pool.query('create index if not exists products_sort_index_idx on products (sort_index)')

  const existingCategories = await pool.query('select count(*)::int as count from categories')
  const existingProducts = await pool.query('select count(*)::int as count from products')

  if (existingCategories.rows[0]?.count > 0 && existingProducts.rows[0]?.count > 0) {
    return
  }

  const client = await pool.connect()

  try {
    await client.query('begin')

    for (const [index, category] of initialCategories.entries()) {
      await upsertCategory(client, category, index)
    }

    for (const [index, product] of initialProducts.entries()) {
      await upsertProduct(client, product, index)
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function listCategories() {
  const result = await pool.query('select name, menu_enabled, pos_enabled from categories order by sort_index asc, name asc')
  return result.rows.map(mapCategory)
}

export async function listProducts() {
  const result = await pool.query(`
    select id, name, price, category_name, description, image, available
    from products
    order by sort_index asc, id asc
  `)
  return result.rows.map(mapProduct)
}

export async function replaceProducts(nextProducts) {
  const client = await pool.connect()

  try {
    await client.query('begin')

    for (const [index, product] of nextProducts.entries()) {
      await upsertProduct(client, product, index)
    }

    if (nextProducts.length > 0) {
      await client.query('delete from products where not (id = any($1::text[]))', [nextProducts.map((product) => product.id)])
    } else {
      await client.query('delete from products')
    }

    await client.query('commit')
    return nextProducts
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
