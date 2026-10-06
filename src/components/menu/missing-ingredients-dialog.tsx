import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SearchInput } from '@/components/shared/search-input'
import { fetchIngredients, setIngredientMissing, type IngredientRecord } from '@/lib/catalog-api'
import { cn } from '@/lib/utils'

type MissingIngredientsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado após marcar/desmarcar um ingrediente, para a tela recarregar os produtos. */
  onChanged: () => void
}

export function MissingIngredientsDialog({ open, onOpenChange, onChanged }: MissingIngredientsDialogProps) {
  const [ingredients, setIngredients] = useState<IngredientRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setQuery('')
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div>
          <h3 className="font-heading text-2xl font-bold text-slate-900">Ingredientes em falta</h3>
          <p className="mt-2 text-sm text-slate-500">
            Toque no ingrediente que acabou. Todos os produtos que o usam saem do cardápio e do PDV até você desmarcar.
          </p>
        </div>
        <div className="mt-4"><SearchInput placeholder="Buscar ingrediente" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <p className="mt-3 text-xs font-semibold text-slate-500">{missingCount === 0 ? 'Nenhum ingrediente em falta.' : `${missingCount} em falta`}</p>
        <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
          {loading ? <p className="py-6 text-center text-sm text-slate-500">Carregando...</p> : null}
          {!loading && ingredients.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 p-6 text-center text-sm text-slate-500">
              Nenhum ingrediente cadastrado. Edite um item no Cardápio e informe os ingredientes dele.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {visible.map((item) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={item.missing}
                onClick={() => void toggle(item)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  item.missing
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-orange-100 bg-white text-slate-700 hover:border-orange-300',
                )}
              >
                {item.missing ? 'Em falta: ' : ''}{item.name}
                <span className="ml-2 text-xs font-medium text-slate-400">{item.productCount} {item.productCount === 1 ? 'item' : 'itens'}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
