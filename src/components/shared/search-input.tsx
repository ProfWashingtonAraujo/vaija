import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
      <Input className="border-sa-border bg-sa-surface-2 pl-10 pr-4 shadow-sa placeholder:text-sa-soft focus:bg-white" {...props} />
    </div>
  )
}
