import { Moon, Sun } from 'lucide-react'

export type ThemeMode = 'dark' | 'light'

export function AppearanceControl({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  return <div className="appearance-control" role="group" aria-label="Background appearance">
    <button type="button" aria-label="Dark background" title="Use dark background" aria-pressed={theme === 'dark'} onClick={() => onChange('dark')}>
      <Moon size={12} /> <span>Dark</span>
    </button>
    <button type="button" aria-label="Light background" title="Use light background" aria-pressed={theme === 'light'} onClick={() => onChange('light')}>
      <Sun size={12} /> <span>Light</span>
    </button>
  </div>
}
