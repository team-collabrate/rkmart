/**
 * Where the brand logo goes. Until RK's real logo is ready this shows a plain "RK" mark.
 * To use the real logo, put the image in `public/` and set LOGO_SRC to its path, for example
 * '/brand-logo.png'. Nothing else needs to change.
 */
const LOGO_SRC: string | null = null

export function BrandLogo({ size = 44 }: { size?: number }) {
  const box = { width: size, height: size }
  if (LOGO_SRC) {
    return (
      <img
        src={LOGO_SRC}
        alt="RK Grocery"
        style={box}
        className="shrink-0 rounded-2xl object-contain"
      />
    )
  }
  return (
    <svg
      role="img"
      aria-label="RK Grocery"
      viewBox="0 0 48 48"
      style={box}
      className="shrink-0"
      focusable="false"
    >
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="14"
        fill="#e8f7ec"
        stroke="#16a34a"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="19"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        fill="#166534"
      >
        RK
      </text>
    </svg>
  )
}
