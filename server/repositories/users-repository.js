import bcrypt from 'bcryptjs'
import { pool } from '../lib/db.js'
import { initialUsers } from '../data/mock-users.js'
import { getPermissionsForRole } from '../lib/permissions.js'

function mapRowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    roleKey: row.role_key,
    shift: row.shift,
    email: row.email,
    tenantId: row.tenant_id,
    permissions: getPermissionsForRole(row.role_key),
  }
}

export async function initializeUsersTable() {
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      tenant_id text not null default 'default',
      name text not null,
      role text not null,
      role_key text not null default 'operator',
      shift text not null,
      email text not null,
      password_hash text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pool.query('create index if not exists users_tenant_idx on users (tenant_id)')

  await pool.query("alter table users add column if not exists role_key text not null default 'operator'")
  await pool.query("update users set role_key = 'admin', role = 'Administrador' where lower(email) = lower('contato@taperaspizzaria.com.br') and role_key = 'operator'")

  const existing = await pool.query('select count(*)::int as count from users')
  if (existing.rows[0]?.count > 0) {
    return
  }

  const defaultTenantId = 'default'

  for (const user of initialUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10)
    await pool.query(
      `
        insert into users (tenant_id, name, role, role_key, shift, email, password_hash)
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [defaultTenantId, user.name, user.role, user.role_key, user.shift, user.email, passwordHash],
    )
  }
}

export async function findUserWithPasswordByEmail(email, tenantId = 'default') {
  const result = await pool.query(
    `
      select id, tenant_id, name, role, role_key, shift, email, password_hash
      from users
      where lower(email) = lower($1) and tenant_id = $2
      limit 1
    `,
    [email, tenantId],
  )

  return result.rows[0] ?? null
}

export async function findUserById(id, tenantId = 'default') {
  const result = await pool.query(
    `
      select id, tenant_id, name, role, role_key, shift, email
      from users
      where id = $1 and tenant_id = $2
      limit 1
    `,
    [id, tenantId],
  )

  if (!result.rows[0]) {
    return null
  }

  return mapRowToUser(result.rows[0])
}

export async function listUsers(tenantId = 'default') {
  const result = await pool.query(
    'select id, tenant_id, name, role, role_key, shift, email from users where tenant_id = $1 order by id asc',
    [tenantId],
  )
  return result.rows.map(mapRowToUser)
}

export async function createUser({ name, role, roleKey, shift, email, passwordHash, tenantId = 'default' }) {
  const result = await pool.query(
    `
      insert into users (tenant_id, name, role, role_key, shift, email, password_hash)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, tenant_id, name, role, role_key, shift, email
    `,
    [tenantId, name, role, roleKey, shift, email, passwordHash],
  )

  return mapRowToUser(result.rows[0])
}

export async function updateUserPassword(userId, passwordHash, tenantId = 'default') {
  await pool.query(
    'update users set password_hash = $2, updated_at = now() where id = $1 and tenant_id = $3',
    [userId, passwordHash, tenantId],
  )
}

export async function findUserWithPasswordById(userId, tenantId = 'default') {
  const result = await pool.query(
    'select id, tenant_id, name, role, role_key, shift, email, password_hash from users where id = $1 and tenant_id = $2 limit 1',
    [userId, tenantId],
  )

  return result.rows[0] ?? null
}

export async function findUserByEmailGlobal(email) {
  const result = await pool.query(
    `
      select id, tenant_id, name, role, role_key, shift, email, password_hash
      from users
      where lower(email) = lower($1)
      limit 1
    `,
    [email],
  )

  return result.rows[0] ?? null
}
