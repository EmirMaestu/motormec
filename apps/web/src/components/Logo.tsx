/** Marca Momec (la "M" chartreuse sobre verde bosque). Escala por `size`. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-label="Momec">
      <rect width="64" height="64" rx="15" fill="#043f2e" />
      <path
        d="M14 47 V17 L32 35 L50 17 V47"
        fill="none"
        stroke="#c8f169"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
