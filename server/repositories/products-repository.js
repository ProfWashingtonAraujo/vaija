import { pool } from '../lib/db.js'
import { initialCategories, initialProducts } from '../data/mock-products.js'

function mapCategory(row) {
  return {
    name: row.name,
    menuEnabled: row.menu_enabled,
    posEnabled: row.pos_enabled,
    tenantId: row.tenant_id,
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
    tenantId: row.tenant_id,
  }
}

async function upsertCategory(client, category, index, tenantId) {
  await client.query(
    `
      insert into categories (name, tenant_id, menu_enabled, pos_enabled, sort_index)
      values ($1, $2, $3, $4, $5)
      on conflict (name, tenant_id) do update set
        menu_enabled = excluded.menu_enabled,
        pos_enabled = excluded.pos_enabled,
        sort_index = excluded.sort_index
    `,
    [category.name, tenantId, category.menu_enabled, category.pos_enabled, index],
  )
}

async function upsertProduct(client, product, index, tenantId) {
  await client.query(
    `
      insert into products (id, tenant_id, name, price, category_name, description, image, available, sort_index)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (id, tenant_id) do update set
        name = excluded.name,
        price = excluded.price,
        category_name = excluded.category_name,
        description = excluded.description,
        image = excluded.image,
        available = excluded.available,
        sort_index = excluded.sort_index,
        updated_at = now()
    `,
    [product.id, tenantId, product.name, product.price, product.category, product.description, product.image, product.available, index],
  )
}

export async function initializeCatalogTables() {
  await pool.query(`
    create table if not exists categories (
      name text not null,
      tenant_id text not null default 'default',
      menu_enabled boolean not null default false,
      pos_enabled boolean not null default false,
      sort_index integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (name, tenant_id)
    )
  `)

  await pool.query(`
    create table if not exists products (
      id text not null,
      tenant_id text not null default 'default',
      name text not null,
      price numeric(10, 2) not null,
      category_name text not null,
      description text not null,
      image text not null,
      available boolean not null default true,
      sort_index integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (id, tenant_id)
    )
  `)

  await pool.query('create index if not exists categories_sort_index_idx on categories (sort_index)')
  await pool.query('create index if not exists categories_tenant_idx on categories (tenant_id)')
  await pool.query('create index if not exists products_sort_index_idx on products (sort_index)')
  await pool.query('create index if not exists products_tenant_idx on products (tenant_id)')

  const existingCategories = await pool.query('select count(*)::int as count from categories')
  const existingProducts = await pool.query('select count(*)::int as count from products')

  if (existingCategories.rows[0]?.count > 0 && existingProducts.rows[0]?.count > 0) {
    return
  }

  const client = await pool.connect()
  const defaultTenantId = 'default'

  try {
    await client.query('begin')

    for (const [index, category] of initialCategories.entries()) {
      await upsertCategory(client, category, index, defaultTenantId)
    }

    for (const [index, product] of initialProducts.entries()) {
      await upsertProduct(client, product, index, defaultTenantId)
    }

    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function listCategories(tenantId = 'default') {
  const result = await pool.query(
    'select name, menu_enabled, pos_enabled, tenant_id from categories where tenant_id = $1 order by sort_index asc, name asc',
    [tenantId],
  )
  return result.rows.map(mapCategory)
}

export async function listProducts(tenantId = 'default') {
  const result = await pool.query(
    `
      select id, name, price, category_name, description, image, available, tenant_id
      from products
      where tenant_id = $1
      order by sort_index asc, id asc
    `,
    [tenantId],
  )
  return result.rows.map(mapProduct)
}

export async function replaceProducts(nextProducts, tenantId = 'default') {
  const client = await pool.connect()

  try {
    await client.query('begin')

    for (const [index, product] of nextProducts.entries()) {
      await upsertProduct(client, product, index, tenantId)
    }

    if (nextProducts.length > 0) {
      await client.query(
        'delete from products where tenant_id = $1 and not (id = any($2::text[]))',
        [tenantId, nextProducts.map((product) => product.id)],
      )
    } else {
      await client.query('delete from products where tenant_id = $1', [tenantId])
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

export async function replaceCategories(nextCategories, tenantId = 'default') {
  const client = await pool.connect()

  try {
    await client.query('begin')

    for (const [index, category] of nextCategories.entries()) {
      await upsertCategory(client, category, index, tenantId)
    }

    if (nextCategories.length > 0) {
      await client.query(
        'delete from categories where tenant_id = $1 and not (name = any($2::text[]))',
        [tenantId, nextCategories.map((category) => category.name)],
      )
    } else {
      await client.query('delete from categories where tenant_id = $1', [tenantId])
    }

    await client.query('commit')
    return nextCategories
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
