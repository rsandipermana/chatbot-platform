import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-border-subtle bg-surface-card p-6',
        hover && 'cursor-pointer transition-all duration-200 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5',
        className,
      )}
    >
      {children}
    </div>
  )
}
