import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  KeyRound,
  Repeat2,
  Save,
  Send,
  Settings2,
  User,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/useAuthStore'

export default function SettingsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [tg, setTg] = useState({
    bot_token: '',
    chat_id: '',
    auto_send: false,
    enabled: true,
    bot_configured: false,
  })

  const isOwner = user?.role === 'owner'
  const [pwd, setPwd] = useState({ old_password: '', new_password: '', new_password_confirm: '' })

  const load = async () => {
    try {
      const [me, tc] = await Promise.all([api.get('/auth/me/'), api.get('/integrations/telegram/')])
      setUser(me.data)
      setTg((t) => ({
        ...t,
        chat_id: tc.data.chat_id || '',
        auto_send: !!tc.data.auto_send,
        enabled: tc.data.enabled !== false,
        bot_configured: !!tc.data.bot_configured,
      }))
    } catch {
      toast.error(t('settings.loadFailed'))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function saveTelegram(e) {
    e.preventDefault()
    try {
      const payload = {
        chat_id: tg.chat_id,
        enabled: tg.enabled,
        auto_send: tg.auto_send,
      }
      if (isOwner && tg.bot_token) {
        payload.bot_token = tg.bot_token
      }
      await api.patch('/integrations/telegram/', payload)
      toast.success('Telegram settings saved')
      setTg((t) => ({ ...t, bot_token: '' }))
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    }
  }

  async function testTelegram() {
    try {
      const res = await api.post('/integrations/telegram/test/')
      toast.success(res.data.message || 'OK')
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Test failed')
    }
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!user) return
    try {
      const { data } = await api.patch('/auth/me/', {
        first_name: user.first_name,
        last_name: user.last_name,
        default_format: user.default_format,
        default_quality: user.default_quality,
        storage_retention_days: user.storage_retention_days ?? 7,
      })
      setUser(data)
      toast.success('Preferences saved')
    } catch {
      toast.error('Could not save profile')
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    try {
      await api.post('/auth/me/password/', pwd)
      setPwd({ old_password: '', new_password: '', new_password_confirm: '' })
      toast.success('Password updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password change failed')
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Settings2 className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('settings.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('settings.pageDescription')}</p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-400">
                <Send className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-xl">{t('settings.telegramCardTitle')}</CardTitle>
                <CardDescription className="text-pretty">{t('settings.telegramCardDescription')}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form className="grid gap-6" onSubmit={saveTelegram}>
            {!isOwner && (
              <p className="text-sm text-muted-foreground">{t('settings.telegramBotTokenOwnerHint')}</p>
            )}
            {!isOwner && !tg.bot_configured && (
              <p className="text-sm text-amber-600 dark:text-amber-500">{t('settings.telegramBotNotConfigured')}</p>
            )}
            <div className={`grid gap-4 ${isOwner ? 'sm:grid-cols-2' : ''}`}>
              {isOwner ? (
                <div className="grid gap-2">
                  <Label htmlFor="bot_token">{t('settings.telegramBotToken')}</Label>
                  <Input
                    id="bot_token"
                    className="min-h-11 font-mono text-sm"
                    type="password"
                    autoComplete="off"
                    placeholder={t('settings.telegramBotTokenPlaceholder')}
                    value={tg.bot_token}
                    onChange={(e) => setTg({ ...tg, bot_token: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="chat_id">{t('settings.telegramChatId')}</Label>
                <Input
                  id="chat_id"
                  className="min-h-11 font-mono text-sm"
                  placeholder={t('settings.telegramChatIdPlaceholder')}
                  value={tg.chat_id}
                  onChange={(e) => setTg({ ...tg, chat_id: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
                <div className="flex min-w-0 gap-3">
                  <Zap className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-medium leading-none">{t('settings.telegramEnabled')}</div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{t('settings.telegramEnabledHint')}</p>
                  </div>
                </div>
                <Switch
                  className="shrink-0"
                  checked={tg.enabled}
                  onCheckedChange={(v) => setTg({ ...tg, enabled: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
                <div className="flex min-w-0 gap-3">
                  <Repeat2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-medium leading-none">{t('settings.telegramAutoSend')}</div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{t('settings.telegramAutoSendHint')}</p>
                  </div>
                </div>
                <Switch
                  className="shrink-0"
                  checked={tg.auto_send}
                  onCheckedChange={(v) => setTg({ ...tg, auto_send: v })}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
              <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto">
                <Save className="size-4 shrink-0" aria-hidden />
                {t('settings.saveTelegram')}
              </Button>
              <Button type="button" variant="outline" className="min-h-11 w-full gap-2 sm:w-auto" onClick={testTelegram}>
                <Send className="size-4 shrink-0" aria-hidden />
                {t('settings.testTelegram')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-400">
              <User className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl">{t('settings.accountCardTitle')}</CardTitle>
              <CardDescription className="text-pretty">{t('settings.accountCardDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="size-4 text-muted-foreground" aria-hidden />
              {t('settings.profileSectionTitle')}
            </h3>
            <form className="grid gap-6" onSubmit={saveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">{t('settings.firstName')}</Label>
                  <Input
                    id="first_name"
                    className="min-h-11"
                    placeholder={t('settings.firstNamePlaceholder')}
                    value={user?.first_name || ''}
                    onChange={(e) => setUser({ first_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">{t('settings.lastName')}</Label>
                  <Input
                    id="last_name"
                    className="min-h-11"
                    placeholder={t('settings.lastNamePlaceholder')}
                    value={user?.last_name || ''}
                    onChange={(e) => setUser({ last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t('settings.defaultFormat')}</Label>
                  <Select value={user?.default_format || 'mp4'} onValueChange={(v) => setUser({ default_format: v })}>
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue placeholder={t('settings.defaultFormat')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp4">mp4</SelectItem>
                      <SelectItem value="mp3">mp3</SelectItem>
                      <SelectItem value="webm">webm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t('settings.defaultQuality')}</Label>
                  <Select value={user?.default_quality || 'best'} onValueChange={(v) => setUser({ default_quality: v })}>
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue placeholder={t('settings.defaultQuality')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="best">best</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="480p">480p</SelectItem>
                      <SelectItem value="audio_only">audio only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3 lg:items-end">
                <div className="grid gap-2 lg:col-span-1">
                  <Label htmlFor="retention_days" className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    {t('settings.retentionLabel')}
                  </Label>
                  <Input
                    id="retention_days"
                    className="min-h-11"
                    type="number"
                    min={0}
                    max={3650}
                    inputMode="numeric"
                    value={user?.storage_retention_days ?? 7}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setUser({
                        storage_retention_days: Number.isFinite(v) ? Math.min(3650, Math.max(0, v)) : 7,
                      })
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground lg:col-span-2 lg:pb-2.5">{t('settings.retentionDescription')}</p>
              </div>
              <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto">
                <Save className="size-4 shrink-0" aria-hidden />
                {t('settings.saveProfile')}
              </Button>
            </form>
          </div>

          <Separator />

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              {t('settings.passwordSectionTitle')}
            </h3>
            <form className="grid gap-4" onSubmit={changePassword}>
              <div className="grid gap-2">
                <Label htmlFor="old_password">{t('settings.currentPassword')}</Label>
                <Input
                  id="old_password"
                  className="min-h-11"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  value={pwd.old_password}
                  onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="new_password">{t('settings.newPassword')}</Label>
                  <Input
                    id="new_password"
                    className="min-h-11"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('settings.newPasswordPlaceholder')}
                    value={pwd.new_password}
                    onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new_password_confirm">{t('settings.confirmPassword')}</Label>
                  <Input
                    id="new_password_confirm"
                    className="min-h-11"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('settings.confirmPasswordPlaceholder')}
                    value={pwd.new_password_confirm}
                    onChange={(e) => setPwd({ ...pwd, new_password_confirm: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary" className="min-h-11 w-full gap-2 sm:w-auto">
                <KeyRound className="size-4 shrink-0" aria-hidden />
                {t('settings.changePassword')}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
