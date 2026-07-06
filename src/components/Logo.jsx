import { useState } from 'react'

// Café Ali brand mark.
// Uses the real logo image at /logo.png (place your file in the `public/` folder).
// If that image is missing, it falls back to an SVG "CA" monogram so the app never breaks.
function FallbackMark({ size }) {
  return (
    <svg viewBox="0 0 64 64" width={size * 0.66} height={size * 0.66}>
      <defs>
        <linearGradient id="ca-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E0C463" />
          <stop offset="55%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#8C6F1A" />
        </linearGradient>
      </defs>
      <path d="M30 8c3 3-3 5 0 8M37 8c3 3-3 5 0 8" stroke="url(#ca-gold)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M28 22a13 13 0 1 0 0 22" stroke="url(#ca-gold)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M32 46l7-22 7 22M35 39h8" stroke="url(#ca-gold)" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 33c4-3 9-3 12 0" stroke="url(#ca-gold)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo({ size = 44, showText = true }) {
  const [imgOk, setImgOk] = useState(true)

  return (
    <div className="flex items-center gap-3">
      <div
        className="grid place-items-center overflow-hidden rounded-xl bg-ink ring-1 ring-gold/40 shadow-gold"
        style={{ width: size, height: size }}
      >
        {imgOk ? (
          <img
            src="/logo.png"
            alt="Café Ali"
            className="h-full w-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <FallbackMark size={size} />
        )}
      </div>
      {showText && (
        <div className="leading-tight">
          <div className="font-serif text-lg font-semibold tracking-wide text-gold-gradient">
            Dua Restaurant
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-cream-dim">Café Ali</div>
        </div>
      )}
    </div>
  )
}
