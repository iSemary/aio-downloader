import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

  const [tg, setTg] = useState({ bot_token: '', chat_id: '', auto_send: false, enabled: true })
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
      await api.patch('/integrations/telegram/', tg)
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
      <div className="flex flex-col gap-2">
        <h5 className="text-2xl font-bold tracking-tight">{t('settings.pageTitle')}</h5>
        <p className="text-muted-foreground">{t('settings.pageDescription')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
          <CardDescription>Bot token is encrypted at rest. Max upload via Bot API is 50 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={saveTelegram}>
            <div className="grid gap-2">
              <Label htmlFor="bot_token">Bot token</Label>
              <Input
                id="bot_token"
                type="password"
                autoComplete="off"
                placeholder="123456789:ABC… (from @BotFather)"
                value={tg.bot_token}
                onChange={(e) => setTg({ ...tg, bot_token: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chat_id">Chat / channel ID</Label>
              <Input
                id="chat_id"
                placeholder="-1001234567890 or @channelusername"
                value={tg.chat_id}
                onChange={(e) => setTg({ ...tg, chat_id: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Enabled</div>
                <div className="text-sm text-muted-foreground">Allow Telegram actions</div>
              </div>
              <Switch checked={tg.enabled} onCheckedChange={(v) => setTg({ ...tg, enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Auto-send</div>
                <div className="text-sm text-muted-foreground">Send each completed download automatically</div>
              </div>
              <Switch checked={tg.auto_send} onCheckedChange={(v) => setTg({ ...tg, auto_send: v })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="outline" onClick={testTelegram}>
                Test connection
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.accountCardTitle')}</CardTitle>
          <CardDescription>{t('settings.accountCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form className="grid gap-3" onSubmit={saveProfile}>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>First name</Label>
                <Input
                  placeholder="Jane"
                  value={user?.first_name || ''}
                  onChange={(e) => setUser({ first_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Last name</Label>
                <Input
                  placeholder="Doe"
                  value={user?.last_name || ''}
                  onChange={(e) => setUser({ last_name: e.target.value })}
                />
              </div>
            </div>
            <Separator />
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Default format</Label>
                <Select value={user?.default_format || 'mp4'} onValueChange={(v) => setUser({ default_format: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Default download format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp4">mp4</SelectItem>
                    <SelectItem value="mp3">mp3</SelectItem>
                    <SelectItem value="webm">webm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Default quality</Label>
                <Select value={user?.default_quality || 'best'} onValueChange={(v) => setUser({ default_quality: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Default quality" />
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
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="retention_days">{t('settings.retentionLabel')}</Label>
              <Input
                id="retention_days"
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
              <p className="text-sm text-muted-foreground">{t('settings.retentionDescription')}</p>
            </div>
            <Button type="submit">Save profile</Button>
          </form>

          <Separator />

          <form className="grid gap-3" onSubmit={changePassword}>
            <div className="grid gap-2">
              <Label>Current password</Label>
              <Input
                type="password"
                placeholder="Current password"
                value={pwd.old_password}
                onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>New password</Label>
              <Input
                type="password"
                placeholder="New password (min 8 characters)"
                value={pwd.new_password}
                onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Confirm new password</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={pwd.new_password_confirm}
                onChange={(e) => setPwd({ ...pwd, new_password_confirm: e.target.value })}
              />
            </div>
            <Button type="submit" variant="secondary">
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
