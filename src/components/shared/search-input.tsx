import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
      <Input className="border-orange-200 bg-[#fffaf5] pl-10 pr-4 shadow-[0_10px_24px_rgba(255,107,0,0.07)] placeholder:text-slate-400 focus:bg-white" {...props} />
    </div>
  )
}
