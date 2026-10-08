import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ReportData } from '@/lib/reports'

const pageSize = 10

export function ProductsPerformanceTable({ products }: { products: ReportData['products'] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = products.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => setPage(1), [products.length])

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
            {visible.map((item) => (
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
      {products.length > pageSize && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, products.length)} de {products.length}</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
            <span className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">{currentPage} / {totalPages}</span>
            <Button type="button" variant="outline" aria-label="Próxima página" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  )
}
