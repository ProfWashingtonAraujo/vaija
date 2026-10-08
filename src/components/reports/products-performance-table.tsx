import type { ReportData } from '@/lib/reports'

export function ProductsPerformanceTable({ products }: { products: ReportData['products'] }) {
  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <h3 className="font-heading text-xl font-bold text-slate-900">Performance de produtos</h3>
      <div className="mt-4 overflow-x-auto rounded-[24px] border border-orange-100 bg-white/80 px-4">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-3 pt-4">Produto</th><th className="pb-3 pt-4">Categoria</th><th className="pb-3 pt-4">Quantidade vendida</th><th className="pb-3 pt-4">% das vendas</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr className="border-t border-orange-50"><td colSpan={4} className="py-6 text-center text-slate-500">Nenhuma venda no período.</td></tr>
            )}
            {products.map((item) => (
              <tr key={item.product} className="border-t border-orange-50">
                <td className="py-4 font-semibold text-slate-900">{item.product}</td>
                <td className="py-4">{item.category}</td>
                <td className="py-4">{item.quantity}</td>
                <td className="py-4 font-mono">{item.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
