import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { menuCategories, products as initialProducts } from '@/data/mock-products'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { MenuProductCard } from '@/components/menu/menu-product-card'

export function MenuPage() {
  const [products, setProducts] = useState(initialProducts)
  const [category, setCategory] = useState('Todas')
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState<'all' | 'available' | 'unavailable'>('all')

  const filtered = useMemo(
    () => products.filter((product) => (category === 'Todas' ? true : product.category === category) && product.name.toLowerCase().includes(query.toLowerCase()) && (availability === 'all' ? true : availability === 'available' ? product.available : !product.available)),
    [products, category, query, availability],
  )

  return (
    <AdminLayout title="Cardápio Digital" description="Gerencie itens, disponibilidade e categorias com controle visual simples.">
      <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1"><SearchInput placeholder="Buscar item" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select value={availability} onChange={(event) => setAvailability(event.target.value as 'all' | 'available' | 'unavailable')} className="h-11 rounded-2xl border border-orange-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_24px_rgba(255,107,0,0.05)] focus:border-orange-300">
              <option value="all">Todas as disponibilidades</option>
              <option value="available">Disponíveis</option>
              <option value="unavailable">Indisponíveis</option>
            </select>
            <Button onClick={() => toast.success('Novo item simulado com sucesso.')}><Plus className="mr-2 h-4 w-4" />Adicionar Item</Button>
          </div>
        </div>
        <div className="mt-5"><CategoryTabs categories={menuCategories} value={category} onChange={setCategory} /></div>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((product) => (
          <MenuProductCard
            key={product.id}
            product={product}
            onToggle={() => {
              setProducts((current) => current.map((item) => item.id === product.id ? { ...item, available: !item.available } : item))
              toast.success('Disponibilidade atualizada.')
            }}
          />
        ))}
      </div>
    </AdminLayout>
  )
}
