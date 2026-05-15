import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { applyTheme, useThemeStore } from '@/store/useThemeStore'
import './index.css'
import App from './App.jsx'

function Boot() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => applyTheme('system')
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [theme])
  return (
    <TooltipProvider>
      <App />
      <Toaster richColors closeButton />
    </TooltipProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
)
