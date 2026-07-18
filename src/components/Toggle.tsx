interface ToggleProps {
  on: boolean
  onChange: (next: boolean) => void
  small?: boolean
  label: string
}

export default function Toggle({ on, onChange, small, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? ' on' : ''}${small ? ' sm' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="knob" />
    </button>
  )
}
