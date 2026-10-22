import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { courierErrorMessage, createCourier, deleteCourier, fetchCouriers, formatPhone, updateCourier, type Courier } from '@/lib/couriers-api'
import { cn } from '@/lib/utils'

type FormState = { id: number | null; name: string; phone: string; active: boolean; payPercent: string }

const emptyForm: FormState = { id: null, name: '', phone: '', active: true, payPercent: '' }

/** Campo vazio = usa o padrão da loja; número de 0 a 100 = repasse só deste entregador. */
function parsePercent(value: string): number | null | undefined {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : undefined
}
const fieldClass = 'h-10 rounded-lg border-sa-border focus:translate-y-0 focus:ring-2'

/** Cadastro de entregadores: nome e WhatsApp. O acesso do entregador continua sendo o link de cada entrega. */
export function CouriersPanel({ canEdit }: { canEdit: boolean }) {
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchCouriers()
      .then(setCouriers)
      .catch(() => toast.error('Não foi possível carregar os entregadores.'))
      .finally(() => setLoaded(true))
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    const name = form.name.trim()
    if (!name) {
      toast.error('Informe o nome do entregador.')
      return
    }
    const payPercent = parsePercent(form.payPercent)
    if (payPercent === undefined) {
      toast.error('O repasse deve ser um número de 0 a 100, ou ficar vazio para usar o padrão da loja.')
      return
    }
    setSaving(true)
    try {
      const input = { name, phone: form.phone, active: form.active, payPercent }
      const saved = form.id === null ? await createCourier(input) : await updateCourier(form.id, input)
      setCouriers((current) => (form.id === null ? [...current, saved] : current.map((item) => item.id === saved.id ? saved : item))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setForm(null)
      toast.success(form.id === null ? 'Entregador cadastrado.' : 'Entregador atualizado.')
    } catch (error) {
      toast.error(courierErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (courier: Courier) => {
    try {
      const saved = await updateCourier(courier.id, { name: courier.name, phone: courier.phone, active: !courier.active, payPercent: courier.payPercent })
      setCouriers((current) => current.map((item) => item.id === saved.id ? saved : item))
    } catch (error) {
      toast.error(courierErrorMessage(error))
    }
  }

  const remove = async (courier: Courier) => {
    try {
      await deleteCourier(courier.id)
      setCouriers((current) => current.filter((item) => item.id !== courier.id))
      toast.success('Entregador removido.')
    } catch (error) {
      toast.error(courierErrorMessage(error))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sa-border py-4">
        <p className="max-w-md text-sm text-sa-muted">Cadastre quem faz as entregas. Ao despachar um pedido, você escolhe o entregador na lista e o link vai direto para o WhatsApp dele.</p>
        {canEdit && form === null ? <Button type="button" variant="outline" className="rounded-lg border-sa-border" onClick={() => setForm(emptyForm)}>Adicionar entregador</Button> : null}
      </div>

      {form !== null ? (
        <form onSubmit={save} className="grid gap-3 border-b border-sa-border py-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-sa-text-2">
            Nome
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={60} placeholder="Ex: João Silva" className={fieldClass} autoFocus />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-sa-text-2">
            WhatsApp <span className="font-normal text-sa-soft">(opcional)</span>
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={30} placeholder="(88) 99999-9999" inputMode="tel" className={fieldClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-sa-text-2 sm:col-span-2">
            Repasse próprio (%) <span className="font-normal text-sa-soft">(opcional)</span>
            <Input value={form.payPercent} onChange={(event) => setForm({ ...form, payPercent: event.target.value })} maxLength={6} placeholder="Vazio = usa o padrão da loja" inputMode="decimal" className={cn(fieldClass, 'sm:max-w-xs')} />
            <span className="text-xs font-normal text-sa-muted">Parte da taxa de entrega que este entregador recebe. Vale para as próximas entregas dele.</span>
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving} className="rounded-lg shadow-none hover:translate-y-0">{saving ? 'Salvando...' : form.id === null ? 'Cadastrar' : 'Salvar'}</Button>
            <Button type="button" variant="ghost" className="rounded-lg" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </form>
      ) : null}

      {!loaded ? <div className="my-4 h-16 animate-pulse rounded-xl bg-sa-hover" /> : couriers.length === 0 ? (
        <p className="py-8 text-center text-sm text-sa-muted">Nenhum entregador cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-sa-border">
          {couriers.map((courier) => (
            <li key={courier.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-semibold', courier.active ? 'text-sa-text' : 'text-sa-soft')}>{courier.name}</p>
                <p className="text-xs text-sa-muted">{courier.phone ? formatPhone(courier.phone) : 'Sem WhatsApp'}{courier.payPercent !== null ? ` · Repasse ${String(courier.payPercent).replace('.', ',')}%` : ''}{courier.active ? '' : ' · Inativo'}</p>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void toggleActive(courier)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-sa-text-2 hover:bg-sa-hover">{courier.active ? 'Desativar' : 'Ativar'}</button>
                  <button type="button" onClick={() => setForm({ id: courier.id, name: courier.name, phone: courier.phone, active: courier.active, payPercent: courier.payPercent === null ? '' : String(courier.payPercent).replace('.', ',') })} aria-label={`Editar ${courier.name}`} className="rounded-lg p-2 text-sa-soft hover:bg-sa-hover hover:text-sa-accent-text"><Pencil className="h-4 w-4" /></button>
                  <ConfirmDialog
                    trigger={<button type="button" aria-label={`Remover ${courier.name}`} className="rounded-lg p-2 text-sa-soft hover:bg-sa-hover hover:text-sa-accent-text"><Trash2 className="h-4 w-4" /></button>}
                    title="Remover entregador"
                    description={`${courier.name} sai da lista de entregadores. As entregas já feitas continuam com o nome dele. Se for só uma pausa, use Desativar.`}
                    confirmLabel="Remover"
                    onConfirm={() => void remove(courier)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
