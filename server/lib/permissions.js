export const rolePermissions = {
  admin: ['users:read', 'users:create', 'users:update', 'users:change-password', 'catalog:write', 'orders:write'],
  manager: ['users:read', 'users:change-password', 'catalog:write', 'orders:write'],
  operator: ['users:change-password', 'catalog:write', 'orders:write'],
}

export function getPermissionsForRole(roleKey) {
  return rolePermissions[roleKey] ?? []
}

export function hasPermission(roleKey, permission) {
  return getPermissionsForRole(roleKey).includes(permission)
}
