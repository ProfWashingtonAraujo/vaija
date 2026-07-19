import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const colors = ['#ff6b00', '#ffb26b', '#ffd4ad', '#fed7aa']

export function CategoryChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={3}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
