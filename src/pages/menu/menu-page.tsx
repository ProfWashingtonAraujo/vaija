import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp, Plus, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { products as initialProducts, type Product, type ProductCategory } from '@/data/mock-products'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { MenuProductCard } from '@/components/menu/menu-product-card'
import { fetchCategories, fetchProducts, saveCategories, saveProducts, type CategoryRecord } from '@/lib/catalog-api'

type ProductFormValues = {
  name: string
  category: ProductCategory
  price: string
  description: string
  image: string
  available: boolean
}

const emptyProductForm: ProductFormValues = {
  name: '',
  category: '',
  price: '',
  description: '',
  image: '',
  available: true,
}

function matchesFilters(product: Product, category: string, query: string, availability: 'all' | 'available' | 'unavailable') {
  return (category === 'Todas' ? true : product.category === category)
    && product.name.toLowerCase().includes(query.toLowerCase())
    && (availability === 'all' ? true : availability === 'available' ? product.available : !product.available)
}

export function MenuPage() {
  const [products, setProducts] = useState(initialProducts)
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [category, setCategory] = useState('Todas')
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState<'all' | 'available' | 'unavailable'>('all')
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null)
  const [dropTargetProductId, setDropTargetProductId] = useState<string | null>(null)
  const [dropTargetCategory, setDropTargetCategory] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductFormValues>(emptyProductForm)

  const filtered = useMemo(
    () => products.filter((product) => matchesFilters(product, category, query, availability)),
    [products, category, query, availability],
  )

  const availableCount = products.filter((product) => product.available).length
  const unavailableCount = products.length - availableCount
  const averagePrice = products.length ? products.reduce((sum, product) => sum + product.price, 0) / products.length : 0

  const menuCategories = useMemo(
    () => ['Todas', ...categories.filter((item) => item.menuEnabled).map((item) => item.name)],
    [categories],
  )

  useEffect(() => {
    void Promise.all([fetchProducts(), fetchCategories()])
      .then(([loadedProducts, loadedCategories]) => {
        setProducts(loadedProducts)
        setCategories(loadedCategories)
      })
      .catch(() => {
        toast.error('Não foi possível carregar o cardápio do backend.')
      })
  }, [])

  const resetDragState = () => {
    setDraggedProductId(null)
    setDropTargetProductId(null)
    setDropTargetCategory(null)
  }

  const persistProducts = (nextProducts: Product[]) => {
    setProducts(nextProducts)

    void saveProducts(nextProducts).catch(() => {
      toast.error('Produtos atualizados localmente, mas o backend falhou ao salvar.')
    })
  }

  const handleReorderProducts = (draggedId: string, targetId?: string) => {
    if (targetId === draggedId) {
      resetDragState()
      return
    }

    const draggedProduct = products.find((product) => product.id === draggedId)
    if (!draggedProduct) {
      resetDragState()
      return
    }

    const remainingProducts = products.filter((product) => product.id !== draggedId)

    if (targetId) {
      const targetIndex = remainingProducts.findIndex((product) => product.id === targetId)
      if (targetIndex >= 0) {
        remainingProducts.splice(targetIndex, 0, draggedProduct)
        persistProducts(remainingProducts)
        resetDragState()
        toast.success('Ordem do cardápio atualizada.')
        return
      }
    }

    const visibleIds = products
        .filter((product) => product.id !== draggedId && matchesFilters(product, category, query, availability))
        .map((product) => product.id)

    const lastVisibleId = visibleIds.at(-1)
    if (!lastVisibleId) {
      persistProducts([...remainingProducts, draggedProduct])
      resetDragState()
      toast.success('Ordem do cardápio atualizada.')
      return
    }

    const insertAfterIndex = remainingProducts.findIndex((product) => product.id === lastVisibleId)
    remainingProducts.splice(insertAfterIndex + 1, 0, draggedProduct)
    persistProducts(remainingProducts)

    resetDragState()
    toast.success('Ordem do cardápio atualizada.')
  }

  const handleMoveToCategory = (draggedId: string, nextCategory: ProductCategory) => {
    const draggedProduct = products.find((product) => product.id === draggedId)
    if (!draggedProduct || draggedProduct.category === nextCategory) {
      resetDragState()
      return
    }

    persistProducts(products.map((product) => (product.id === draggedId ? { ...product, category: nextCategory } : product)))

    resetDragState()
    toast.success('Categoria do item atualizada.')
  }

  const openCreateProductForm = () => {
    const nextCategory = category !== 'Todas'
      ? category
      : categories[0]?.name

    if (!nextCategory) {
      toast.error('Crie uma categoria antes de adicionar itens.')
      setIsCategoryFormOpen(true)
      return
    }

    setEditingProductId(null)
    setProductForm({ ...emptyProductForm, category: nextCategory })
    setIsFormOpen(true)
  }

  const openEditProductForm = (product: Product) => {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name,
      category: product.category,
      price: String(product.price).replace('.', ','),
      description: product.description,
      image: product.image,
      available: product.available,
    })
    setIsFormOpen(true)
  }

  const handleSaveProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = productForm.name.trim()
    const description = productForm.description.trim()
    const image = productForm.image.trim()
    const price = Number(productForm.price.replace(',', '.'))

    if (!name || !description || !image || Number.isNaN(price) || price < 0) {
      toast.error('Preencha nome, descrição, imagem e preço válido.')
      return
    }

    const existingProduct = editingProductId ? products.find((product) => product.id === editingProductId) : undefined
    const nextProduct: Product = {
      id: editingProductId ?? `prod-${Date.now()}`,
      name,
      price,
      sizePrices: existingProduct?.sizePrices,
      category: productForm.category,
      description,
      image,
      available: productForm.available,
    }

    const nextProducts = editingProductId
      ? products.map((product) => product.id === editingProductId ? nextProduct : product)
      : [nextProduct, ...products]

    persistProducts(nextProducts)
    setCategory(productForm.category)
    setAvailability('all')
    setQuery('')
    setIsFormOpen(false)
    toast.success(editingProductId ? 'Item atualizado com sucesso.' : 'Novo item adicionado ao cardápio.')
  }

  const handleDeleteProduct = (product: Product) => {
    if (!window.confirm(`Excluir ${product.name} do cardápio?`)) {
      return
    }

    persistProducts(products.filter((item) => item.id !== product.id))
    toast.success('Item removido do cardápio.')
  }

  const persistCategories = async (nextCategories: CategoryRecord[], message: string) => {
    try {
      await saveCategories(nextCategories)
      setCategories(nextCategories)
      if (category !== 'Todas' && !nextCategories.some((item) => item.name === category && item.menuEnabled)) setCategory('Todas')
      toast.success(message)
      return true
    } catch {
      toast.error('Não foi possível salvar as categorias.')
      return false
    }
  }

  const handleCreateCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newCategoryName.trim()
    if (!name) {
      toast.error('Informe o nome da categoria.')
      return
    }
    if (categories.some((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      toast.error('Já existe uma categoria com esse nome.')
      return
    }
    void persistCategories([...categories, { name, menuEnabled: true, posEnabled: true }], 'Categoria criada.').then((saved) => {
      if (saved) setNewCategoryName('')
    })
  }

  const handleToggleCategory = (categoryName: string, field: 'menuEnabled' | 'posEnabled') => {
    const nextCategories = categories.map((item) => item.name === categoryName ? { ...item, [field]: !item[field] } : item)
    void persistCategories(nextCategories, 'Visibilidade da categoria atualizada.')
  }

  const handleMoveCategory = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= categories.length) return
    const nextCategories = [...categories]
    const [movedCategory] = nextCategories.splice(index, 1)
    nextCategories.splice(nextIndex, 0, movedCategory)
    void persistCategories(nextCategories, 'Ordem das categorias atualizada.')
  }

  const handleDeleteCategory = (categoryName: string) => {
    if (products.some((product) => product.category === categoryName)) {
      toast.error('Mova ou exclua os itens desta categoria antes de removê-la.')
      return
    }
    void persistCategories(categories.filter((item) => item.name !== categoryName), 'Categoria removida.')
  }

  return (
    <AdminLayout title="Cardápio Digital" description="Gerencie itens, disponibilidade e categorias com controle visual simples.">
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-[26px] border border-orange-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Itens</p>
          <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{products.length}</p>
        </div>
        <div className="rounded-[26px] border border-emerald-100 bg-emerald-50/60 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Disponíveis</p>
          <p className="mt-2 font-heading text-2xl font-bold text-emerald-800">{availableCount}</p>
        </div>
        <div className="rounded-[26px] border border-rose-100 bg-rose-50/60 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Indisponíveis</p>
          <p className="mt-2 font-heading text-2xl font-bold text-rose-800">{unavailableCount}</p>
        </div>
        <div className="rounded-[26px] border border-orange-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Preço médio</p>
          <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(averagePrice)}</p>
        </div>
      </div>
      <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1"><SearchInput placeholder="Buscar item" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select value={availability} onChange={(event) => setAvailability(event.target.value as 'all' | 'available' | 'unavailable')} className="h-11 rounded-2xl border border-orange-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_24px_rgba(255,107,0,0.05)] focus:border-orange-300">
              <option value="all">Todas as disponibilidades</option>
              <option value="available">Disponíveis</option>
              <option value="unavailable">Indisponíveis</option>
            </select>
            <Button type="button" variant="outline" onClick={() => setIsCategoryFormOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Categorias</Button>
            <Button onClick={openCreateProductForm}><Plus className="mr-2 h-4 w-4" />Adicionar Item</Button>
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

               handleMoveToCategory(productId, nextCategory)
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
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-[30px] border border-dashed border-orange-200 bg-orange-50/40 p-10 text-center">
            <p className="font-heading text-2xl font-bold text-slate-900">Nenhum item encontrado</p>
            <p className="mt-2 text-sm text-slate-500">Ajuste a busca, categoria ou disponibilidade para ver outros produtos.</p>
          </div>
        ) : null}
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
              persistProducts(products.map((item) => item.id === product.id ? { ...item, available: !item.available } : item))
              toast.success('Disponibilidade atualizada.')
            }}
            onEdit={() => openEditProductForm(product)}
            onDelete={() => handleDeleteProduct(product)}
          />
        ))}
      </div>
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSaveProduct} className="grid gap-4">
            <div>
              <h3 className="font-heading text-2xl font-bold text-slate-900">{editingProductId ? 'Editar item' : 'Adicionar item'}</h3>
              <p className="mt-2 text-sm text-slate-500">Personalize as informações do produto que aparece no cardápio.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Nome
                <Input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Pizza Portuguesa" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Categoria
                <select value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  {categories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Preço
                <Input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} placeholder="Ex: 49,90" inputMode="decimal" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                URL da imagem
                <Input value={productForm.image} onChange={(event) => setProductForm((current) => ({ ...current, image: event.target.value }))} placeholder="https://..." />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Descrição
              <textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descreva ingredientes e diferenciais do item" className="min-h-24 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/40 px-4 py-3 text-sm font-semibold text-slate-700">
              Item disponível
              <input type="checkbox" checked={productForm.available} onChange={(event) => setProductForm((current) => ({ ...current, available: event.target.checked }))} className="h-4 w-4 accent-orange-500" />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
        <DialogContent className="max-w-2xl">
          <div>
            <h3 className="font-heading text-2xl font-bold text-slate-900">Categorias do cardápio</h3>
            <p className="mt-2 text-sm text-slate-500">Organize as seções exibidas no cardápio digital e no PDV.</p>
          </div>
          <form onSubmit={handleCreateCategory} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ex: Pratos executivos" className="flex-1" />
            <Button type="submit"><Plus className="mr-2 h-4 w-4" />Nova categoria</Button>
          </form>
          <div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {categories.map((item, index) => (
              <div key={item.name} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 truncate font-semibold text-slate-900">{item.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={item.menuEnabled} onChange={() => handleToggleCategory(item.name, 'menuEnabled')} className="accent-orange-500" />Cardápio</label>
                    <label className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={item.posEnabled} onChange={() => handleToggleCategory(item.name, 'posEnabled')} className="accent-orange-500" />PDV</label>
                    <button type="button" aria-label={`Mover ${item.name} para cima`} disabled={index === 0} onClick={() => handleMoveCategory(index, -1)} className="rounded-xl border border-orange-100 bg-white p-2 text-slate-500 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Mover ${item.name} para baixo`} disabled={index === categories.length - 1} onClick={() => handleMoveCategory(index, 1)} className="rounded-xl border border-orange-100 bg-white p-2 text-slate-500 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Excluir ${item.name}`} onClick={() => handleDeleteCategory(item.name)} className="rounded-xl border border-rose-100 bg-white p-2 text-rose-500 hover:border-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
            {categories.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 p-6 text-center text-sm text-slate-500">Nenhuma categoria cadastrada.</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
