import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatCurrency } from '@/lib/formatters'

export function RevenueChart({ data }: { data: Array<{ day: string; revenue: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="#fde7d1" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} />
        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} cursor={{ fill: '#fff7ed' }} />
        <Bar dataKey="revenue" radius={[12, 12, 0, 0]} fill="#ff6b00" />
      </BarChart>
    </ResponsiveContainer>
  )
}
