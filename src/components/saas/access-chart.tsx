import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type AccessUser = { roleKey: string; restaurantId?: string }
type AccessTenant = { id: string; restaurantName: string }

// Cor fixa por papel (a cor segue a entidade, não a posição).
const roles = [
  { key: 'admin', label: 'Administrador', color: '#2a78d6' },
  { key: 'manager', label: 'Gerente', color: '#eb6834' },
  { key: 'operator', label: 'Operador', color: '#1baf7a' },
] as const

export function AccessChart({ tenants, users }: { tenants: AccessTenant[]; users: AccessUser[] }) {
  const data = tenants.map((tenant) => {
    const tenantUsers = users.filter((user) => user.restaurantId === tenant.id)
    return {
      name: tenant.restaurantName,
      total: tenantUsers.length,
      ...Object.fromEntries(roles.map((role) => [role.key, tenantUsers.filter((user) => user.roleKey === role.key).length])),
    }
  })
  const totalByRole = roles.map((role) => ({ ...role, total: users.filter((user) => user.roleKey === role.key).length }))

  if (!data.length) {
    return <p className="rounded-xl border border-dashed border-sa-border p-6 text-center text-sm font-medium text-sa-muted">Nenhum cliente cadastrado.</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
      <div style={{ height: Math.max(180, data.length * 64 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--sa-border)" strokeDasharray="3 4" />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--sa-muted)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false} tick={{ fill: 'var(--sa-text)', fontSize: 13 }} />
            <Tooltip
              cursor={{ fill: 'var(--sa-hover)' }}
              contentStyle={{ background: 'var(--sa-surface)', border: '1px solid var(--sa-border)', borderRadius: 12, color: 'var(--sa-text)' }}
              labelStyle={{ color: 'var(--sa-muted)' }}
              itemStyle={{ color: 'var(--sa-text)' }}
            />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: 'var(--sa-muted)' }} />
            {roles.map((role) => (
              <Bar key={role.key} dataKey={role.key} name={role.label} stackId="roles" fill={role.color} stroke="var(--sa-surface)" strokeWidth={2} barSize={26} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid content-start gap-2.5">
        {totalByRole.map((role) => (
          <div key={role.key} className="flex items-center justify-between rounded-xl border border-sa-border bg-sa-surface-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-sa-text-2"><span className="h-3 w-3 rounded-sm" style={{ background: role.color }} />{role.label}</span>
            <span className="font-mono text-lg font-bold text-sa-text">{role.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
