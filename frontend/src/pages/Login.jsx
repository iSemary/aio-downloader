import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, LogIn, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/useAuthStore'

export default function LoginPage() {
  const { t } = useTranslation()
  const access = useAuthStore((s) => s.access)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (access) return <Navigate to="/dashboard" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login/', { email, password })
      setAuth({ access: data.access, refresh: data.refresh, user: null })
      const me = await api.get('/auth/me/')
      useAuthStore.getState().setUser(me.data)
      toast.success('Signed in')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4 py-8">
      <Card className="w-full max-w-md overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-4 border-b bg-muted/30 pb-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
              <LogIn className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('auth.signInTitle')}</CardTitle>
              <CardDescription className="text-pretty">{t('auth.signInDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form className="grid gap-5" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                {t('auth.email')}
              </Label>
              <Input
                id="email"
                className="min-h-11"
                type="email"
                autoComplete="email"
                placeholder="test@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                {t('auth.password')}
              </Label>
              <Input
                id="password"
                className="min-h-11"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="min-h-11 w-full gap-2" disabled={loading}>
              <LogIn className="size-4 shrink-0" aria-hidden />
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.noAccount')}{' '}
              <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/register">
                {t('auth.registerLink')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
