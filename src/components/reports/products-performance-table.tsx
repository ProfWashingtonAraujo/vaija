import { productsPerformance } from '@/data/mock-reports'

export function ProductsPerformanceTable() {
  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <h3 className="font-heading text-xl font-bold text-slate-900">Performance de produtos</h3>
      <div className="mt-4 overflow-x-auto rounded-[24px] border border-orange-100 bg-white/80 px-4">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-3">Produto</th><th className="pb-3">Categoria</th><th className="pb-3">Quantidade vendida</th><th className="pb-3">Receita</th><th className="pb-3">Ticket médio</th><th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {productsPerformance.map((item) => (
              <tr key={item.product} className="border-t border-orange-50">
                <td className="py-4 font-semibold text-slate-900">{item.product}</td>
                <td className="py-4">{item.category}</td>
                <td className="py-4">{item.quantity}</td>
                <td className="py-4 font-mono">{item.revenue}</td>
                <td className="py-4 font-mono">{item.averageTicket}</td>
                <td className="py-4">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
