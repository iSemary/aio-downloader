import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const loginMethodLabels = {
  cookie: 'Cookie Injection',
  header: 'Header Auth',
  basic: 'Basic Auth',
  form: 'Form POST',
}

const initialForm = {
  name: '',
  site_url: '',
  username: '',
  password_encrypted: '',
  cookies: '',
  headers: '',
  login_url: '',
  login_method: 'cookie',
  notes: '',
  is_active: true,
}

export default function SitesManagerPage() {
  const { t } = useTranslation()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [tab, setTab] = useState('credentials')

  const fetchSites = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const { data } = await api.get('/grabber/sites/', { params: q ? { search: q } : {} })
      setSites(data.results || data)
    } catch {
      toast.error(t('sites.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  useEffect(() => {
    const timer = setTimeout(() => fetchSites(search), 300)
    return () => clearTimeout(timer)
  }, [search, fetchSites])

  const openCreate = () => {
    setEditingId(null)
    setForm(initialForm)
    setTab('credentials')
    setFormOpen(true)
  }

  const openEdit = (site) => {
    setEditingId(site.id)
    setForm({
      name: site.name,
      site_url: site.site_url,
      username: site.username || '',
      password_encrypted: '',
      cookies: site.cookies ? JSON.stringify(site.cookies, null, 2) : '',
      headers: site.headers ? JSON.stringify(site.headers, null, 2) : '',
      login_url: site.login_url || '',
      login_method: site.login_method || 'cookie',
      notes: site.notes || '',
      is_active: site.is_active,
    })
    setTab('credentials')
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let cookies = {}
      let headers = {}
      try { cookies = form.cookies ? JSON.parse(form.cookies) : {} } catch { toast.error(t('sites.invalidJson', { field: 'cookies' })); setSaving(false); return }
      try { headers = form.headers ? JSON.parse(form.headers) : {} } catch { toast.error(t('sites.invalidJson', { field: 'headers' })); setSaving(false); return }

      const payload = {
        name: form.name,
        site_url: form.site_url,
        username: form.username,
        login_method: form.login_method,
        login_url: form.login_url,
        cookies,
        headers,
        notes: form.notes,
        is_active: form.is_active,
      }
      if (form.password_encrypted) payload.password_encrypted = form.password_encrypted

      if (editingId) {
        await api.patch(`/grabber/sites/${editingId}/`, payload)
        toast.success(t('sites.updated'))
      } else {
        await api.post('/grabber/sites/', payload)
        toast.success(t('sites.created'))
      }
      setFormOpen(false)
      fetchSites(search)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('sites.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.delete(`/grabber/sites/${deleteId}/`)
      toast.success(t('sites.deleted'))
      setDeleteId(null)
      fetchSites(search)
    } catch {
      toast.error(t('sites.deleteFailed'))
    }
  }

  const FormField = ({ label, children }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Globe className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('sites.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('sites.pageDescription')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('sites.searchPlaceholder')}
            className="max-w-xs pl-8"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" /> {t('sites.addSite')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : sites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Globe className="size-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-lg font-medium">{t('sites.noSites')}</p>
              <p className="text-sm text-muted-foreground">{t('sites.noSitesDesc')}</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 size-4" /> {t('sites.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sites.name')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('sites.siteUrl')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('sites.loginMethod')}</TableHead>
                <TableHead>{t('sites.status')}</TableHead>
                <TableHead className="text-right">{t('sites.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{site.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:table-cell">
                    {site.site_url}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {loginMethodLabels[site.login_method] || site.login_method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={site.is_active ? 'active' : 'inactive'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(site)}>
                        {t('sites.edit')}
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setDeleteId(site.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('sites.count', { count: sites.length })}
      </p>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? t('sites.editSite') : t('sites.addSite')}</DialogTitle>
              <DialogDescription>
                {editingId ? t('sites.editDesc') : t('sites.addDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 flex gap-2 border-b">
              {['credentials', 'auth', 'extra'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    tab === k
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`sites.tab${k.charAt(0).toUpperCase() + k.slice(1)}`)}
                </button>
              ))}
            </div>

            {tab === 'credentials' && (
              <div className="space-y-3">
                <FormField label={t('sites.name')}>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('sites.namePlaceholder')}
                    required
                  />
                </FormField>
                <FormField label={t('sites.siteUrl')}>
                  <Input
                    value={form.site_url}
                    onChange={(e) => setForm({ ...form, site_url: e.target.value })}
                    placeholder="https://example.com"
                    required
                  />
                </FormField>
                <FormField label={t('sites.username')}>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="user@example.com"
                  />
                </FormField>
                <FormField label={t('sites.password')}>
                  <Input
                    type="password"
                    value={form.password_encrypted}
                    onChange={(e) => setForm({ ...form, password_encrypted: e.target.value })}
                    placeholder={editingId ? t('sites.passwordLeaveBlank') : ''}
                  />
                </FormField>
              </div>
            )}

            {tab === 'auth' && (
              <div className="space-y-3">
                <FormField label={t('sites.loginMethod')}>
                  <Select
                    value={form.login_method}
                    onValueChange={(v) => setForm({ ...form, login_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cookie">{t('sites.methodCookie')}</SelectItem>
                      <SelectItem value="header">{t('sites.methodHeader')}</SelectItem>
                      <SelectItem value="basic">{t('sites.methodBasic')}</SelectItem>
                      <SelectItem value="form">{t('sites.methodForm')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                {form.login_method === 'form' && (
                  <FormField label={t('sites.loginUrl')}>
                    <Input
                      value={form.login_url}
                      onChange={(e) => setForm({ ...form, login_url: e.target.value })}
                      placeholder="https://example.com/login"
                    />
                  </FormField>
                )}
                <FormField label={t('sites.cookies')}>
                  <Textarea
                    value={form.cookies}
                    onChange={(e) => setForm({ ...form, cookies: e.target.value })}
                    placeholder='{"sessionid": "abc123", "csrftoken": "xyz"}'
                    className="min-h-[80px] font-mono text-xs"
                  />
                </FormField>
                <FormField label={t('sites.headers')}>
                  <Textarea
                    value={form.headers}
                    onChange={(e) => setForm({ ...form, headers: e.target.value })}
                    placeholder='{"Authorization": "Bearer mytoken"}'
                    className="min-h-[80px] font-mono text-xs"
                  />
                </FormField>
              </div>
            )}

            {tab === 'extra' && (
              <div className="space-y-3">
                <FormField label={t('sites.notes')}>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder={t('sites.notesPlaceholder')}
                  />
                </FormField>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-medium">{t('sites.isActive')}</Label>
                    <p className="text-xs text-muted-foreground">{t('sites.isActiveHint')}</p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {t('sites.cancel')}
              </Button>
              <Button type="submit" disabled={saving || !form.name || !form.site_url}>
                {saving ? t('sites.saving') : (editingId ? t('sites.save') : t('sites.add'))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sites.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('sites.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sites.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t('sites.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
