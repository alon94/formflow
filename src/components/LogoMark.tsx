interface LogoMarkProps {
  size?: number
  textColor?: string
  subColor?: string
  markColor?: string
  withText?: boolean
}

/* Placeholder brand mark for "שווה עסקים 360" — replace with the official SVG asset */
export function LogoArrow({ size = 20, color = 'var(--sky)' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M4 19c0-8 5-13 13-13"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M11.5 5.2h6.3v6.3"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function LogoMark({
  size = 20,
  textColor = 'var(--heading)',
  subColor,
  markColor = 'var(--sky)',
  withText = true,
}: LogoMarkProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      <LogoArrow size={size} color={markColor} />
      {withText && (
        <>
          <span
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: size * 0.85,
              color: textColor,
            }}
          >
            שווה
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: size * 0.525,
              lineHeight: 1.15,
              color: subColor ?? textColor,
            }}
          >
            מועדון
            <br />
            עסקים 360
          </span>
        </>
      )}
    </span>
  )
}
