import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Boxes, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { fetchInventory, saveInventory, type InventoryCategory, type InventoryItem } from '@/lib/inventory-api'
import { fetchProducts, saveProducts } from '@/lib/catalog-api'
import type { Product, ProductCategory } from '@/data/mock-products'

type InventoryFormValues = {
  name: string
  category: InventoryCategory
  unit: string
  quantity: string
  minQuantity: string
  cost: string
  salePrice: string
  menuCategory: ProductCategory
  description: string
  image: string
  usedInProductIds: string[]
}

const emptyForm: InventoryFormValues = {
  name: '',
  category: 'Produtos prontos',
  unit: 'UN',
  quantity: '',
  minQuantity: '',
  cost: '',
  salePrice: '',
  menuCategory: 'Pizzas Especiais',
  description: '',
  image: '',
  usedInProductIds: [],
}

const menuCategories: ProductCategory[] = ['Pizzas Tradicionais', 'Pizzas Especiais', 'Premium', 'Pizzas Doces', 'Esfira Premium', 'Esfira Tradicional', 'Esfira Doce', 'Hamburgueres', 'Batatas Fritas', 'Bebidas', 'Adicionais']
const inventoryCategories: InventoryCategory[] = ['Ingredientes', 'Bebidas', 'Embalagens', 'Produtos prontos']
const unitOptions = ['UN', 'Grama', 'Litro']

function parseNumber(value: string) {
  return Number(value.replace(',', '.')) || 0
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<InventoryFormValues>(emptyForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  useEffect(() => {
    void fetchInventory()
      .then((loadedItems) => {
        setItems(loadedItems)
        void syncMenuAvailability(loadedItems)
      })
      .catch(() => toast.error('Não foi possível carregar o estoque.'))
    void fetchProducts()
      .then(setProducts)
      .catch(() => toast.error('Não foi possível carregar o cardápio.'))
  }, [])

  const metrics = useMemo(() => {
    const totalCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0)
    const lowStock = items.filter((item) => item.quantity <= item.minQuantity).length
    const linkedToMenu = items.filter((item) => item.linkedProductId).length

    return { totalCost, lowStock, linkedToMenu }
  }, [items])

  const persistInventory = (nextItems: InventoryItem[]) => {
    setItems(nextItems)
    void saveInventory(nextItems)
      .then(() => syncMenuAvailability(nextItems))
      .catch(() => toast.error('Não foi possível salvar o estoque.'))
  }

  const syncMenuAvailability = async (inventoryItems: InventoryItem[]) => {
    const products = await fetchProducts()
    const nextProducts = products.map((product) => {
      const relatedItems = inventoryItems.filter((item) => item.linkedProductId === product.id || item.usedInProductIds?.includes(product.id))

      if (relatedItems.length === 0) {
        return product
      }

      const hasBlockedStock = relatedItems.some((item) => item.quantity <= item.minQuantity)
      return { ...product, available: !hasBlockedStock }
    })

    await saveProducts(nextProducts)
    setProducts(nextProducts)
  }

  const handleSaveItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = form.name.trim()
    const description = form.description.trim()
    const image = form.image.trim()
    const quantity = parseNumber(form.quantity)
    const minQuantity = parseNumber(form.minQuantity)
    const cost = parseNumber(form.cost)
    const salePrice = parseNumber(form.salePrice)
    const isIngredient = form.category === 'Ingredientes'

    if (!name || quantity < 0 || minQuantity < 0 || cost < 0 || (!isIngredient && (!description || !image || salePrice <= 0))) {
      toast.error(isIngredient ? 'Preencha nome, quantidades e custo válido.' : 'Preencha nome, descrição, imagem, quantidades e preço de venda válido.')
      return
    }

    const existingItem = items.find((item) => item.id === editingItemId)
    const nextItem: InventoryItem = {
      id: existingItem?.id ?? `stock-${Date.now()}`,
      name,
      category: form.category,
      unit: form.unit.trim() || 'UN',
      quantity,
      minQuantity,
      cost,
      salePrice: isIngredient ? 0 : salePrice,
      menuCategory: form.menuCategory,
      description: isIngredient ? '' : description,
      image: isIngredient ? '' : image,
      linkedProductId: isIngredient ? undefined : existingItem?.linkedProductId,
      usedInProductIds: isIngredient ? form.usedInProductIds : undefined,
    }

    persistInventory(existingItem ? items.map((item) => item.id === existingItem.id ? nextItem : item) : [nextItem, ...items])
    setForm(emptyForm)
    setEditingItemId(null)
    toast.success(existingItem ? 'Item de estoque atualizado.' : 'Item adicionado ao estoque.')
  }

  const editItem = (item: InventoryItem) => {
    setEditingItemId(item.id)
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: String(item.quantity).replace('.', ','),
      minQuantity: String(item.minQuantity).replace('.', ','),
      cost: String(item.cost).replace('.', ','),
      salePrice: String(item.salePrice).replace('.', ','),
      menuCategory: item.menuCategory as ProductCategory,
      description: item.description,
      image: item.image,
      usedInProductIds: item.usedInProductIds ?? [],
    })
  }

  const cancelEdit = () => {
    setEditingItemId(null)
    setForm(emptyForm)
  }

  const handleLinkToMenu = async (item: InventoryItem) => {
    if (item.category === 'Ingredientes') {
      toast.error('Ingredientes são insumos internos e não entram no cardápio.')
      return
    }

    const products = await fetchProducts()
    const existingProduct = item.linkedProductId ? products.find((product) => product.id === item.linkedProductId) : undefined
    const product: Product = {
      id: existingProduct?.id ?? `prod-${Date.now()}`,
      name: item.name,
      price: item.salePrice,
      category: item.menuCategory as ProductCategory,
      description: item.description,
      image: item.image,
      available: item.quantity > item.minQuantity,
    }
    const nextProducts = existingProduct
      ? products.map((current) => current.id === existingProduct.id ? product : current)
      : [product, ...products]

    await saveProducts(nextProducts)
    persistInventory(items.map((current) => current.id === item.id ? { ...current, linkedProductId: product.id } : current))
    toast.success(existingProduct ? 'Cardápio atualizado pelo estoque.' : 'Item criado no cardápio.')
  }

  const updateQuantity = (id: string, amount: number) => {
    persistInventory(items.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item))
  }

  const deleteItem = (item: InventoryItem) => {
    if (!window.confirm(`Excluir ${item.name} do estoque?`)) {
      return
    }

    persistInventory(items.filter((current) => current.id !== item.id))
    toast.success('Item removido do estoque.')
  }

  const toggleUsedInProduct = (productId: string) => {
    setForm((current) => ({
      ...current,
      usedInProductIds: current.usedInProductIds.includes(productId)
        ? current.usedInProductIds.filter((id) => id !== productId)
        : [...current.usedInProductIds, productId],
    }))
  }

  return (
    <AdminLayout title="Estoque" description="Controle insumos e produtos prontos, com envio automático para o cardápio.">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><p className="text-sm text-slate-500">Valor em estoque</p><p className="mt-2 font-heading text-3xl font-bold text-slate-900">{formatCurrency(metrics.totalCost)}</p></div>
        <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><p className="text-sm text-slate-500">Estoque baixo</p><p className="mt-2 font-heading text-3xl font-bold text-slate-900">{metrics.lowStock}</p></div>
        <div className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><p className="text-sm text-slate-500">Itens no cardápio</p><p className="mt-2 font-heading text-3xl font-bold text-slate-900">{metrics.linkedToMenu}</p></div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={handleSaveItem} className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Boxes className="h-5 w-5 text-orange-500" /><h3 className="font-heading text-xl font-bold text-slate-900">{editingItemId ? 'Editar item de estoque' : 'Novo item de estoque'}</h3></div>
            {editingItemId ? <Button type="button" variant="ghost" onClick={cancelEdit}>Cancelar</Button> : null}
          </div>
          <div className="mt-5 grid gap-3">
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome do item" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as InventoryCategory }))} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">{inventoryCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              <select value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Quantidade" inputMode="decimal" />
              <Input value={form.minQuantity} onChange={(event) => setForm((current) => ({ ...current, minQuantity: event.target.value }))} placeholder="Estoque mínimo" inputMode="decimal" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={form.cost} onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))} placeholder="Custo" inputMode="decimal" />
              {form.category !== 'Ingredientes' ? <Input value={form.salePrice} onChange={(event) => setForm((current) => ({ ...current, salePrice: event.target.value }))} placeholder="Preço no cardápio" inputMode="decimal" /> : null}
            </div>
            {form.category !== 'Ingredientes' ? (
              <>
                <select value={form.menuCategory} onChange={(event) => setForm((current) => ({ ...current, menuCategory: event.target.value as ProductCategory }))} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">{menuCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                <Input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} placeholder="URL da imagem" />
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descrição para o cardápio" className="min-h-24 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
              </>
            ) : null}
            {form.category === 'Ingredientes' ? (
              <div className="rounded-2xl border border-orange-100 bg-white/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Onde esse ingrediente é usado?</p>
                <p className="mt-1 text-xs text-slate-500">Marque os itens do cardápio que consomem esse ingrediente.</p>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {products.length === 0 ? <p className="text-sm text-slate-400">Nenhum item no cardápio ainda.</p> : null}
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      <span>{product.name}</span>
                      <input type="checkbox" checked={form.usedInProductIds.includes(product.id)} onChange={() => toggleUsedInProduct(product.id)} className="h-4 w-4 accent-orange-500" />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <Button type="submit"><Plus className="mr-2 h-4 w-4" />{editingItemId ? 'Salvar alterações' : 'Adicionar ao estoque'}</Button>
          </div>
        </form>

        <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <h3 className="font-heading text-xl font-bold text-slate-900">Itens cadastrados</h3>
          <div className="mt-5 grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="grid gap-4 rounded-[24px] border border-orange-100 bg-white/90 p-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{item.name}</p><span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">{item.category}</span>{item.quantity <= item.minQuantity ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Estoque baixo</span> : null}</div>
                  <p className="mt-2 text-sm text-slate-500">{item.quantity} {item.unit} em estoque · mínimo {item.minQuantity} · custo {formatCurrency(item.cost)}</p>
                  {item.category !== 'Ingredientes' ? <p className="mt-1 text-sm text-slate-500">Preço no cardápio: <span className="font-mono font-semibold text-slate-900">{formatCurrency(item.salePrice)}</span></p> : null}
                  {item.category === 'Ingredientes' && item.usedInProductIds?.length ? <p className="mt-2 text-sm text-slate-500">Usado em: {item.usedInProductIds.map((productId) => products.find((product) => product.id === productId)?.name).filter(Boolean).join(', ')}</p> : null}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-end gap-2"><Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateQuantity(item.id, -1)}>-</Button><Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateQuantity(item.id, 1)}>+</Button></div>
                  <Button type="button" variant="outline" onClick={() => editItem(item)}>Editar</Button>
                  <Button type="button" variant="outline" className="border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-800" onClick={() => deleteItem(item)}>Excluir</Button>
                  {item.category !== 'Ingredientes' ? <Button type="button" variant={item.linkedProductId ? 'secondary' : 'default'} onClick={() => void handleLinkToMenu(item)}><RefreshCw className="mr-2 h-4 w-4" />{item.linkedProductId ? 'Atualizar cardápio' : 'Enviar ao cardápio'}</Button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
