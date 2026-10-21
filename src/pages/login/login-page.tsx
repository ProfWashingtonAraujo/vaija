import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
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
  username: z.string().trim().min(1, 'Informe seu usuário'),
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
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const loggedUser = await login(values.username, values.password)
      toast.success('Login realizado com sucesso.')
      navigate(location.state?.from?.pathname ?? getHomePathForUser(loggedUser), { replace: true })
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'invalid_credentials'
        ? 'Usuário ou senha inválidos.'
        : 'Servidor indisponível. Tente novamente em alguns instantes.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white sm:items-center sm:justify-center sm:bg-[#fff8f1] sm:px-4 sm:py-10">
      <div className="flex w-full flex-1 flex-col overflow-hidden bg-white sm:max-w-md sm:flex-none sm:rounded-[36px] sm:shadow-[0_30px_80px_rgba(255,107,0,0.16)]">
        <header className="relative bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700 px-6 pb-14 pt-[max(2.5rem,env(safe-area-inset-top))] text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white font-heading text-xl font-extrabold text-orange-600 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">V</div>
            <p className="font-heading text-3xl font-extrabold tracking-tight">Vaija<span className="text-white/70">.</span></p>
          </div>
          <p className="mt-5 max-w-[16rem] text-base font-medium leading-snug text-white/90">Pedidos, entregas e caixa em um só lugar.</p>
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-4 right-16 h-20 w-20 rounded-full bg-white/10" />
        </header>
        <form onSubmit={handleSubmit(onSubmit)} className="-mt-8 flex flex-1 flex-col rounded-t-[32px] bg-white px-6 pb-8 pt-8">
          <h1 className="font-heading text-3xl font-extrabold text-slate-900">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Entre com seu usuário para acessar o painel, as entregas ou o caixa.</p>
          <div className="mt-7 space-y-4">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">Usuário</label>
              <Input id="username" {...register('username')} placeholder="seu.usuario" autoComplete="username" autoCapitalize="none" />
              {errors.username ? <p className="mt-2 text-xs text-rose-600">{errors.username.message}</p> : null}
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Senha</label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} {...register('password')} className="pr-12" placeholder="Digite sua senha" autoComplete="current-password" />
                <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? <p className="mt-2 text-xs text-rose-600">{errors.password.message}</p> : null}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><LockKeyhole className="h-3.5 w-3.5 text-orange-500" />Ambiente seguro</span>
            <button type="button" onClick={() => toast.info('Peça ao administrador da sua loja para redefinir a senha.')} className="font-semibold text-orange-700">Esqueci a senha</button>
          </div>
          <Button type="submit" disabled={isSubmitting} className="mt-7 w-full rounded-full py-3.5 text-base shadow-[0_16px_30px_rgba(255,107,0,0.22)]">{isSubmitting ? 'Entrando...' : 'Entrar'}</Button>
          <div className="my-6 flex items-center gap-4 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" />ainda não tem conta?<div className="h-px flex-1 bg-slate-200" /></div>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full py-3"
            onClick={() => window.open('https://wa.me/5588998838079?text=Ol%C3%A1%21%20Conheci%20a%20Vaija%20e%20gostaria%20de%20falar%20com%20um%20consultor.', '_blank', 'noopener,noreferrer')}
          >
            Falar com consultor
          </Button>
          <p className="mt-auto pt-8 text-center text-sm text-slate-500">Voltar para a <Link to="/" className="font-semibold text-orange-700">página inicial</Link></p>
        </form>
      </div>
    </div>
  )
}
