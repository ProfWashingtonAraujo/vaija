import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { menuCategories, products as initialProducts, type Product, type ProductCategory } from '@/data/mock-products'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { MenuProductCard } from '@/components/menu/menu-product-card'

function matchesFilters(product: Product, category: string, query: string, availability: 'all' | 'available' | 'unavailable') {
  return (category === 'Todas' ? true : product.category === category)
    && product.name.toLowerCase().includes(query.toLowerCase())
    && (availability === 'all' ? true : availability === 'available' ? product.available : !product.available)
}

export function MenuPage() {
  const [products, setProducts] = useState(initialProducts)
  const [category, setCategory] = useState('Todas')
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState<'all' | 'available' | 'unavailable'>('all')
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null)
  const [dropTargetProductId, setDropTargetProductId] = useState<string | null>(null)
  const [dropTargetCategory, setDropTargetCategory] = useState<string | null>(null)

  const filtered = useMemo(
    () => products.filter((product) => matchesFilters(product, category, query, availability)),
    [products, category, query, availability],
  )

  const resetDragState = () => {
    setDraggedProductId(null)
    setDropTargetProductId(null)
    setDropTargetCategory(null)
  }

  const handleReorderProducts = (draggedId: string, targetId?: string) => {
    if (targetId === draggedId) {
      resetDragState()
      return
    }

    setProducts((current) => {
      const draggedProduct = current.find((product) => product.id === draggedId)
      if (!draggedProduct) {
        return current
      }

      const remainingProducts = current.filter((product) => product.id !== draggedId)

      if (targetId) {
        const targetIndex = remainingProducts.findIndex((product) => product.id === targetId)
        if (targetIndex >= 0) {
          remainingProducts.splice(targetIndex, 0, draggedProduct)
          return remainingProducts
        }
      }

      const visibleIds = current
        .filter((product) => product.id !== draggedId && matchesFilters(product, category, query, availability))
        .map((product) => product.id)

      const lastVisibleId = visibleIds.at(-1)
      if (!lastVisibleId) {
        return [...remainingProducts, draggedProduct]
      }

      const insertAfterIndex = remainingProducts.findIndex((product) => product.id === lastVisibleId)
      remainingProducts.splice(insertAfterIndex + 1, 0, draggedProduct)
      return remainingProducts
    })

    resetDragState()
    toast.success('Ordem do cardápio atualizada.')
  }

  const handleMoveToCategory = (draggedId: string, nextCategory: ProductCategory) => {
    setProducts((current) => {
      const draggedProduct = current.find((product) => product.id === draggedId)
      if (!draggedProduct || draggedProduct.category === nextCategory) {
        return current
      }

      return current.map((product) => (product.id === draggedId ? { ...product, category: nextCategory } : product))
    })

    resetDragState()
    toast.success('Categoria do item atualizada.')
  }

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
        <div className="mt-5">
          <CategoryTabs
            categories={menuCategories}
            value={category}
            onChange={setCategory}
            dropTargetCategory={dropTargetCategory}
            onDragEnterCategory={(nextCategory) => setDropTargetCategory(nextCategory === 'Todas' ? null : nextCategory)}
            onDropCategory={(nextCategory) => {
              const productId = draggedProductId
              if (!productId || nextCategory === 'Todas') {
                resetDragState()
                return
              }

              handleMoveToCategory(productId, nextCategory as ProductCategory)
            }}
          />
        </div>
      </div>
      <div
        className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()

          const productId = event.dataTransfer.getData('text/plain')
          if (productId) {
            handleReorderProducts(productId)
          }
        }}
      >
        {filtered.map((product) => (
          <MenuProductCard
            key={product.id}
            product={product}
            dragging={draggedProductId === product.id}
            dropTarget={dropTargetProductId === product.id}
            onDragStart={() => setDraggedProductId(product.id)}
            onDragEnd={resetDragState}
            onDragEnter={() => setDropTargetProductId(product.id)}
            onDrop={() => handleReorderProducts(draggedProductId ?? product.id, product.id)}
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
