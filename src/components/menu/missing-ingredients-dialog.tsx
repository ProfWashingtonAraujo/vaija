import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/search-input'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { addIngredient, deleteIngredient, fetchIngredients, setIngredientMissing, type IngredientRecord } from '@/lib/catalog-api'
import { cn } from '@/lib/utils'

type MissingIngredientsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado após marcar/desmarcar, adicionar ou excluir um ingrediente, para a tela recarregar os produtos. */
  onChanged: () => void
}

function sortByName(list: IngredientRecord[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function MissingIngredientsDialog({ open, onOpenChange, onChanged }: MissingIngredientsDialogProps) {
  const [ingredients, setIngredients] = useState<IngredientRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setQuery('')
    setNewName('')
    void fetchIngredients()
      .then(setIngredients)
      .catch(() => toast.error('Não foi possível carregar os ingredientes.'))
      .finally(() => setLoading(false))
  }, [open])

  const visible = useMemo(
    () => ingredients.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [ingredients, query],
  )
  const missingCount = ingredients.filter((item) => item.missing).length

  const toggle = async (item: IngredientRecord) => {
    const missing = !item.missing
    setIngredients((current) => current.map((entry) => entry.name === item.name ? { ...entry, missing } : entry))
    try {
      await setIngredientMissing(item.name, missing)
      onChanged()
    } catch {
      setIngredients((current) => current.map((entry) => entry.name === item.name ? { ...entry, missing: item.missing } : entry))
      toast.error('Não foi possível atualizar o ingrediente. Tente novamente.')
    }
  }

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newName.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (ingredients.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Esse ingrediente já está na lista.')
      return
    }
    setAdding(true)
    try {
      const created = await addIngredient(name)
      setIngredients((current) => sortByName([...current, created]))
      setNewName('')
      setQuery('')
      toast.success('Ingrediente adicionado. Informe-o nos itens do Cardápio que o usam.')
    } catch {
      toast.error('Não foi possível adicionar o ingrediente. Tente novamente.')
    } finally {
      setAdding(false)
    }
  }

  const remove = async (item: IngredientRecord) => {
    try {
      await deleteIngredient(item.name)
      setIngredients((current) => current.filter((entry) => entry.name !== item.name))
      onChanged()
      toast.success('Ingrediente excluído.')
    } catch {
      toast.error('Não foi possível excluir o ingrediente. Tente novamente.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div>
          <h3 className="font-heading text-2xl font-bold text-slate-900">Ingredientes</h3>
          <p className="mt-2 text-sm text-slate-500">
            Toque no ingrediente que acabou. Todos os produtos que o usam saem do cardápio e do PDV, e os pedidos com eles são recusados, até você desmarcar.
          </p>
        </div>
        <form onSubmit={(event) => void add(event)} className="mt-4 flex gap-2">
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} placeholder="Novo ingrediente (ex.: Mussarela)" />
          <Button type="submit" disabled={adding || !newName.trim()} className="shrink-0"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
        </form>
        <div className="mt-3"><SearchInput placeholder="Buscar ingrediente" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <p className="mt-3 text-xs font-semibold text-slate-500">{missingCount === 0 ? 'Nenhum ingrediente em falta.' : `${missingCount} em falta`}</p>
        <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
          {loading ? <p className="py-6 text-center text-sm text-slate-500">Carregando...</p> : null}
          {!loading && ingredients.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 p-6 text-center text-sm text-slate-500">
              Nenhum ingrediente cadastrado. Adicione acima e depois informe-o nos itens do Cardápio que o usam.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {visible.map((item) => (
              <div
                key={item.name}
                className={cn(
                  'flex items-center rounded-full border text-sm font-semibold transition',
                  item.missing
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-orange-100 bg-white text-slate-700 hover:border-orange-300',
                )}
              >
                <button type="button" aria-pressed={item.missing} onClick={() => void toggle(item)} className="rounded-l-full py-2 pl-4 pr-2">
                  {item.missing ? 'Em falta: ' : ''}{item.name}
                  <span className="ml-2 text-xs font-medium text-slate-400">{item.productCount} {item.productCount === 1 ? 'item' : 'itens'}</span>
                </button>
                <ConfirmDialog
                  trigger={<button type="button" aria-label={`Excluir ${item.name}`} className="rounded-r-full py-2 pl-1 pr-3 text-slate-400 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>}
                  title={`Excluir ${item.name}?`}
                  description={item.productCount > 0
                    ? `O ingrediente sai da lista e também de ${item.productCount} ${item.productCount === 1 ? 'item' : 'itens'} do Cardápio que o usam. Isso não pode ser desfeito.`
                    : 'O ingrediente sai da lista. Isso não pode ser desfeito.'}
                  confirmLabel="Excluir"
                  onConfirm={() => void remove(item)}
                />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
