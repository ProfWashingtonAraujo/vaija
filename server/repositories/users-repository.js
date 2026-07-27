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
    permissions: getPermissionsForRole(row.role_key),
  }
}

export async function initializeUsersTable() {
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      name text not null,
      role text not null,
      role_key text not null default 'operator',
      shift text not null,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)

  await pool.query("alter table users add column if not exists role_key text not null default 'operator'")
  await pool.query("update users set role_key = 'admin', role = 'Administrador' where lower(email) = lower('contato@taperaspizzaria.com.br') and role_key = 'operator'")

  const existing = await pool.query('select count(*)::int as count from users')
  if (existing.rows[0]?.count > 0) {
    return
  }

  for (const user of initialUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10)
    await pool.query(
      `
        insert into users (name, role, role_key, shift, email, password_hash)
        values ($1, $2, $3, $4, $5, $6)
      `,
      [user.name, user.role, user.role_key, user.shift, user.email, passwordHash],
    )
  }
}

export async function findUserWithPasswordByEmail(email) {
  const result = await pool.query(
    `
      select id, name, role, role_key, shift, email, password_hash
      from users
      where lower(email) = lower($1)
      limit 1
    `,
    [email],
  )

  return result.rows[0] ?? null
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      select id, name, role, role_key, shift, email
      from users
      where id = $1
      limit 1
    `,
    [id],
  )

  if (!result.rows[0]) {
    return null
  }

  return mapRowToUser(result.rows[0])
}

export async function listUsers() {
  const result = await pool.query('select id, name, role, role_key, shift, email from users order by id asc')
  return result.rows.map(mapRowToUser)
}

export async function createUser({ name, role, roleKey, shift, email, passwordHash }) {
  const result = await pool.query(
    `
      insert into users (name, role, role_key, shift, email, password_hash)
      values ($1, $2, $3, $4, $5, $6)
      returning id, name, role, role_key, shift, email
    `,
    [name, role, roleKey, shift, email, passwordHash],
  )

  return mapRowToUser(result.rows[0])
}

export async function updateUserPassword(userId, passwordHash) {
  await pool.query('update users set password_hash = $2, updated_at = now() where id = $1', [userId, passwordHash])
}

export async function findUserWithPasswordById(userId) {
  const result = await pool.query(
    'select id, name, role, role_key, shift, email, password_hash from users where id = $1 limit 1',
    [userId],
  )

  return result.rows[0] ?? null
}
