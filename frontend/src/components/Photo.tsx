import { useState } from 'react'

/**
 * Shows a photograph from /public/images/<name> if you have added one; otherwise a tasteful
 * gradient with an emoji so the layout never looks broken. See README ("Adding photographs").
 */
export default function Photo({ src, alt, emoji = '🍽️', className = '' }: { src: string; alt: string; emoji?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-gradient-to-br from-forest-100 via-forest-50 to-sun-100 text-7xl ${className}`}>{emoji}</div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
}
