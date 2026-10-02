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
    return <p className="mt-5 rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhum cliente cadastrado.</p>
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div style={{ height: Math.max(180, data.length * 64 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="#f1ece6" />
            <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontSize: 13 }} />
            <Tooltip cursor={{ fill: 'rgba(249,115,22,0.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #fed7aa' }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: '#475569' }} />
            {roles.map((role) => (
              <Bar key={role.key} dataKey={role.key} name={role.label} stackId="roles" fill={role.color} stroke="#ffffff" strokeWidth={2} barSize={26} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid content-start gap-3">
        {totalByRole.map((role) => (
          <div key={role.key} className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/30 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="h-3 w-3 rounded-sm" style={{ background: role.color }} />{role.label}</span>
            <span className="font-mono text-lg font-bold text-slate-900">{role.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
