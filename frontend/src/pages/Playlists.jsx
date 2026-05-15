import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Library, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBytes } from '@/lib/formatBytes'

export default function PlaylistsPage() {
  const { t } = useTranslation()
  const [parents, setParents] = useState([])
  const [children, setChildren] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loadingParents, setLoadingParents] = useState(true)
  const [loadingChildren, setLoadingChildren] = useState(false)

  const loadParents = useCallback(async () => {
    setLoadingParents(true)
    try {
      const res = await api.get('/downloads/', {
        params: { playlist_parents_only: '1', page_size: 100 },
      })
      const list = res.data.results ?? res.data
      setParents(Array.isArray(list) ? list : [])
    } catch {
      toast.error(t('playlists.loadParentsFailed'))
    } finally {
      setLoadingParents(false)
    }
  }, [t])

  const loadChildren = useCallback(
    async (parentId) => {
      if (!parentId) {
        setChildren([])
        return
      }
      setLoadingChildren(true)
      try {
        const res = await api.get('/downloads/', {
          params: { playlist_parent: parentId, page_size: 200, sort: 'queue' },
        })
        const list = res.data.results ?? res.data
        setChildren(Array.isArray(list) ? list : [])
      } catch {
        toast.error(t('playlists.loadChildrenFailed'))
        setChildren([])
      } finally {
        setLoadingChildren(false)
      }
    },
    [t],
  )

  useEffect(() => {
    loadParents()
  }, [loadParents])

  useEffect(() => {
    if (selectedId) loadChildren(selectedId)
    else setChildren([])
  }, [selectedId, loadChildren])

  const selected = parents.find((p) => p.id === selectedId) || null

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Library className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h5 className="text-2xl font-bold tracking-tight text-foreground">{t('playlists.pageTitle')}</h5>
          <p className="text-pretty text-muted-foreground">{t('playlists.pageDescription')}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg">{t('playlists.parentsTitle')}</CardTitle>
            <CardDescription>{t('playlists.parentsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-3 flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => loadParents()} disabled={loadingParents}>
                {loadingParents ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('queue.refresh')}
              </Button>
            </div>
            {loadingParents ? (
              <p className="text-sm text-muted-foreground">{t('playlists.loading')}</p>
            ) : parents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('playlists.emptyParents')}</p>
            ) : (
              <div className="-mx-1 max-h-[420px] overflow-auto rounded-lg border sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dashboard.recent.colTitle')}</TableHead>
                      <TableHead>{t('dashboard.recent.colStatus')}</TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parents.map((p) => (
                      <TableRow
                        key={p.id}
                        className={selectedId === p.id ? 'bg-muted/60' : 'cursor-pointer'}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <TableCell className="max-w-[200px] truncate font-medium">{p.title || p.url}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                            <Link to={`/jobs/${p.id}`}>{t('playlists.details')}</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg">{t('playlists.childrenTitle')}</CardTitle>
            <CardDescription>
              {selected ? selected.title || selected.url : t('playlists.selectParent')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">{t('playlists.selectParent')}</p>
            ) : loadingChildren ? (
              <p className="text-sm text-muted-foreground">{t('playlists.loading')}</p>
            ) : children.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('playlists.emptyChildren')}</p>
            ) : (
              <div className="-mx-1 max-h-[420px] overflow-auto rounded-lg border sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dashboard.recent.colTitle')}</TableHead>
                      <TableHead>{t('dashboard.recent.colSize')}</TableHead>
                      <TableHead>{t('dashboard.recent.colStatus')}</TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {children.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-[180px] truncate">{c.title || c.url}</TableCell>
                        <TableCell className="text-muted-foreground">{formatBytes(c.file_size || 0)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/jobs/${c.id}`}>{t('playlists.details')}</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
