import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getHomePathForUser } from '@/lib/navigation'

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(6, 'Informe sua senha'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const loggedUser = await login(values.email, values.password)
      toast.success('Login realizado com sucesso.')
      navigate(location.state?.from?.pathname ?? getHomePathForUser(loggedUser), { replace: true })
    } catch {
      toast.error('E-mail ou senha inválidos.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(255,178,107,0.22),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,107,0,0.12),_transparent_28%),#fffdf8] px-4 py-10">
      <div className="w-full max-w-5xl overflow-hidden rounded-[36px] border border-orange-200 bg-white shadow-[0_30px_80px_rgba(255,107,0,0.12)] lg:grid lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden bg-[linear-gradient(180deg,#fffaf5_0%,#fff4e8_100%)] p-10 lg:block">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 font-heading text-lg font-bold text-white shadow-[0_10px_24px_rgba(255,107,0,0.3)]">V</div>
          <p className="mt-6 font-heading text-4xl font-extrabold text-slate-900">Vaija</p>
          <p className="mt-3 text-orange-700">Sistema de Gestão Gastronômica</p>
          <div className="mt-10 space-y-4">
            {['Operação clara para delivery, salão e balcão', 'Visual premium com foco em produtividade', 'Demonstração pronta para apresentação comercial'].map((item) => <div key={item} className="rounded-2xl border border-orange-100 bg-white/90 px-4 py-4 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">{item}</div>)}
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 font-heading font-bold text-white shadow-[0_10px_24px_rgba(255,107,0,0.3)]">V</div>
            <div>
              <p className="font-heading text-2xl font-bold text-slate-900">Vaija</p>
              <p className="text-sm text-orange-700">Sistema de Gestão Gastronômica</p>
            </div>
          </div>
          <div className="mt-8 rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-1 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <form onSubmit={handleSubmit(onSubmit)} className="rounded-[28px] bg-white/90 p-6 sm:p-8">
              <h1 className="font-heading text-3xl font-extrabold text-slate-900">Bem-vindo de volta</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">Acesse com um usuário cadastrado em Configurações para gerenciar seu restaurante.</p>
              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">E-mail corporativo</label>
                  <Input {...register('email')} placeholder="seuemail@empresa.com" />
                  {errors.email ? <p className="mt-2 text-xs text-rose-600">{errors.email.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Senha segura</label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} {...register('password')} className="pr-12" placeholder="Digite sua senha" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password ? <p className="mt-2 text-xs text-rose-600">{errors.password.message}</p> : null}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <a href="#" className="font-medium text-orange-700">Esqueci minha senha</a>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"><LockKeyhole className="h-3 w-3" />Ambiente seguro</div>
              </div>
              <Button type="submit" disabled={isSubmitting} className="mt-8 w-full shadow-[0_16px_30px_rgba(255,107,0,0.22)]">{isSubmitting ? 'Entrando...' : 'Entrar no Sistema'}</Button>
              <div className="my-6 flex items-center gap-4 text-sm text-slate-400"><div className="h-px flex-1 bg-orange-100" />ou<div className="h-px flex-1 bg-orange-100" /></div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-orange-200 bg-white/90"
                onClick={() => window.open('https://wa.me/5588998838079?text=Ol%C3%A1%21%20Conheci%20a%20Vaija%20e%20gostaria%20de%20falar%20com%20um%20consultor.', '_blank', 'noopener,noreferrer')}
              >
                Falar com consultor
              </Button>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4 text-orange-500" />Ambiente seguro e protegido</div>
              <p className="mt-6 text-center text-sm text-slate-500">Voltar para a <Link to="/" className="font-semibold text-orange-700">Página Inicial</Link></p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
