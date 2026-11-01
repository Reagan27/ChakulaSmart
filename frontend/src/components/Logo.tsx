import { Link } from 'react-router-dom'

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#166534" />
      <path d="M32 12c-9 0-15 6.5-15 15 0 10 7.5 15 15 24 7.500-9 15-14 15-24 0-8.500-6-15-15-15z" fill="#DCFCE7" />
      <path d="M32 21v21M32 30c-4.500-1-6.500-4.500-6.500-8M32 35c4.500-1 6.500-4.500 6.500-8" stroke="#166534" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="47" cy="17" r="5" fill="#F59E0B" />
    </svg>
  )
}

export default function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="ChakulaSmart home">
      <LogoMark />
      <span className={`font-display text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-forest'}`}>
        Chakula<span className="text-sun">Smart</span>
      </span>
    </Link>
  )
}
