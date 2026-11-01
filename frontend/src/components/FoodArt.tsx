/** Hand-drawn SVG "plate" so the site looks great even before you add real photographs. */
export function PlateArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 440" className={className} role="img" aria-label="A plate of ugali, sukuma wiki, beans and tomato">
      <defs>
        <radialGradient id="plate" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#E5F5EA" /></radialGradient>
        <linearGradient id="ugali" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF7E0" /><stop offset="1" stopColor="#F6E3A8" /></linearGradient>
      </defs>
      <ellipse cx="220" cy="410" rx="150" ry="14" fill="#000" opacity=".12" />
      <circle cx="220" cy="215" r="200" fill="url(#plate)" stroke="#DCFCE7" strokeWidth="6" />
      <circle cx="220" cy="215" r="160" fill="none" stroke="#BBF7D0" strokeWidth="2" strokeDasharray="4 8" />
      {/* ugali */}
      <path d="M130 215c-6-48 30-82 80-80 46 2 70 36 60 76-8 36-44 52-82 46-34-6-54-20-58-42z" fill="url(#ugali)" stroke="#E8CD7A" strokeWidth="3" />
      <path d="M160 180c20-14 52-16 76-4" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".7" fill="none" />
      {/* sukuma wiki */}
      <g>
        <path d="M262 150c30-20 80-8 92 28 8 26-10 54-40 62-34 9-62-14-66-42-2-20 4-38 14-48z" fill="#16A34A" />
        <path d="M278 168c20-6 40 0 50 14M274 196c26-8 50 2 60 18M286 222c18-4 34 2 42 12" stroke="#166534" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="300" cy="190" r="5" fill="#4ADE80" /><circle cx="326" cy="214" r="4" fill="#4ADE80" /><circle cx="290" cy="228" r="4" fill="#4ADE80" />
      </g>
      {/* beans */}
      <g fill="#B45309">
        <ellipse cx="170" cy="290" rx="14" ry="9" transform="rotate(-20 170 290)" /><ellipse cx="196" cy="304" rx="14" ry="9" transform="rotate(15 196 304)" />
        <ellipse cx="222" cy="292" rx="14" ry="9" transform="rotate(-10 222 292)" /><ellipse cx="184" cy="322" rx="14" ry="9" transform="rotate(25 184 322)" />
        <ellipse cx="236" cy="320" rx="14" ry="9" transform="rotate(-25 236 320)" /><ellipse cx="156" cy="312" rx="13" ry="8" transform="rotate(5 156 312)" />
      </g>
      <g fill="#92400E" opacity=".55"><ellipse cx="170" cy="288" rx="6" ry="3" transform="rotate(-20 170 288)" /><ellipse cx="222" cy="290" rx="6" ry="3" /></g>
      {/* tomato slices */}
      <g>
        <circle cx="300" cy="298" r="26" fill="#EF4444" /><circle cx="300" cy="298" r="18" fill="#F87171" />
        <path d="M300 280v36M282 298h36" stroke="#FCA5A5" strokeWidth="3" />
        <circle cx="338" cy="262" r="16" fill="#EF4444" /><circle cx="338" cy="262" r="10" fill="#F87171" />
      </g>
      {/* lemon wedge + herbs */}
      <path d="M96 150c14-18 36-22 52-12-6 22-26 34-52 12z" fill="#FDE047" stroke="#EAB308" strokeWidth="3" />
      <g stroke="#15803D" strokeWidth="4" strokeLinecap="round"><path d="M110 250l16-14M118 262l20-8M106 238l8-18" /></g>
    </svg>
  )
}

export function Leaf({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d="M12 88C8 40 40 10 90 10c0 50-30 82-78 78z" fill="currentColor" />
      <path d="M12 88C34 62 56 44 80 24" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}
