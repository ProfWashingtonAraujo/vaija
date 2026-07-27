import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { authJwtSecret, authRefreshDays } from '../lib/env.js'
import { createUser, findUserById, findUserWithPasswordByEmail, findUserWithPasswordById, listUsers, updateUserPassword } from '../repositories/users-repository.js'
import { getPermissionsForRole } from '../lib/permissions.js'
import { pool } from '../lib/db.js'

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      roleKey: user.roleKey,
    },
    authJwtSecret,
    { expiresIn: '15m' },
  )
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function ensureSessionsTable() {
  await pool.query(`
    create table if not exists auth_sessions (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      refresh_token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `)
}

async function createRefreshSession(userId) {
  await ensureSessionsTable()

  const refreshToken = crypto.randomBytes(48).toString('hex')
  await pool.query(
    'insert into auth_sessions (user_id, refresh_token_hash, expires_at) values ($1, $2, $3)',
    [userId, hashRefreshToken(refreshToken), new Date(Date.now() + authRefreshDays * 24 * 60 * 60 * 1000)],
  )

  return refreshToken
}

function getRoleLabel(roleKey) {
  return roleKey === 'admin' ? 'Administrador' : roleKey === 'manager' ? 'Gerente' : 'Operador'
}

function toProfile(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    roleKey: user.roleKey ?? user.role_key,
    shift: user.shift,
    email: user.email,
    permissions: getPermissionsForRole(user.roleKey ?? user.role_key),
  }
}

export async function loginWithEmailAndPassword(email, password) {
  const user = await findUserWithPasswordByEmail(email)
  if (!user) {
    return null
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    return null
  }

  const profile = toProfile(user)
  const refreshToken = await createRefreshSession(profile.id)

  return {
    accessToken: signAccessToken(profile),
    refreshToken,
    user: profile,
  }
}

export async function getAuthenticatedUser(userId) {
  return findUserById(userId)
}

export async function refreshSession(refreshToken) {
  await ensureSessionsTable()

  const session = await pool.query(
    `
      select s.id, s.expires_at, u.id as user_id_full, u.name, u.role, u.role_key, u.shift, u.email
      from auth_sessions s
      join users u on u.id = s.user_id
      where s.refresh_token_hash = $1
      limit 1
    `,
    [hashRefreshToken(refreshToken)],
  )

  const row = session.rows[0]
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    return null
  }

  await pool.query('delete from auth_sessions where id = $1', [row.id])

  const user = toProfile({
    id: row.user_id_full,
    name: row.name,
    role: row.role,
    role_key: row.role_key,
    shift: row.shift,
    email: row.email,
  })

  return {
    accessToken: signAccessToken(user),
    refreshToken: await createRefreshSession(user.id),
    user,
  }
}

export async function logoutSession(refreshToken) {
  if (!refreshToken) {
    return
  }

  await ensureSessionsTable()
  await pool.query('delete from auth_sessions where refresh_token_hash = $1', [hashRefreshToken(refreshToken)])
}

export async function getAllUsers() {
  return listUsers()
}

export async function createUserAccount({ name, roleKey, shift, email, password }) {
  if (!['admin', 'manager', 'operator'].includes(roleKey)) {
    throw new Error('invalid_role')
  }

  if (String(password).length < 6) {
    throw new Error('password_too_short')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  return createUser({ name, role: getRoleLabel(roleKey), roleKey, shift, email, passwordHash })
}

export async function updateOwnPassword(userId, currentPassword, nextPassword) {
  if (String(nextPassword).length < 6) {
    throw new Error('password_too_short')
  }

  const user = await findUserWithPasswordById(userId)
  if (!user) {
    throw new Error('user_not_found')
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash)
  if (!passwordMatches) {
    throw new Error('invalid_current_password')
  }

  await updateUserPassword(userId, await bcrypt.hash(nextPassword, 10))
}
