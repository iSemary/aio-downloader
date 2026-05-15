import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, Mail, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/useAuthStore'

export default function RegisterPage() {
  const { t } = useTranslation()
  const access = useAuthStore((s) => s.access)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  if (access) return <Navigate to="/dashboard" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register/', {
        email,
        password,
        password_confirm: passwordConfirm,
      })
      setAuth({
        access: data.tokens.access,
        refresh: data.tokens.refresh,
        user: data.user,
      })
      toast.success('Account created')
      navigate('/dashboard')
    } catch (err) {
      const d = err.response?.data
      toast.error(typeof d === 'string' ? d : d?.detail || d?.email?.[0] || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4 py-8">
      <Card className="w-full max-w-lg overflow-hidden border-border/80 shadow-sm sm:border-l-4 sm:border-l-emerald-500">
        <CardHeader className="space-y-4 border-b bg-muted/30 pb-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
              <UserPlus className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('auth.registerTitle')}</CardTitle>
              <CardDescription className="text-pretty">{t('auth.registerDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form className="grid gap-5" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  className="min-h-11"
                  type="email"
                  placeholder="you@example.com"
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
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password2" className="flex items-center gap-2">
                  <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                  {t('auth.confirmPassword')}
                </Label>
                <Input
                  id="password2"
                  className="min-h-11"
                  type="password"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <Button type="submit" className="min-h-11 w-full gap-2" disabled={loading}>
              <UserPlus className="size-4 shrink-0" aria-hidden />
              {loading ? t('auth.creating') : t('auth.createAccount')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.haveAccount')}{' '}
              <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/login">
                {t('auth.signInLink')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
