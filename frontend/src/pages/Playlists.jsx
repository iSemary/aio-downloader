import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Library, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
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
      const res = await api.get('/downloads/playlists/', { params: { page_size: 100 } })
      const list = res.data.results ?? res.data
      setParents(Array.isArray(list) ? list : [])
    } catch {
      toast.error(t('playlists.loadParentsFailed'))
    } finally {
      setLoadingParents(false)
    }
  }, [t])

  const loadChildren = useCallback(
    async (playlistId) => {
      if (!playlistId) {
        setChildren([])
        return
      }
      setLoadingChildren(true)
      try {
        const res = await api.get('/downloads/', {
          params: { playlist: playlistId, page_size: 200, sort: 'queue' },
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

  const childColumns = useMemo(() => [
    {
      accessorKey: 'title',
      header: t('dashboard.recent.colTitle'),
      cell: (info) => info.getValue() || info.row.original.source_url || info.row.original.url || '—',
    },
    {
      accessorKey: 'file_size',
      header: t('dashboard.recent.colSize'),
      cell: (info) => formatBytes(info.getValue() || 0),
    },
    {
      accessorKey: 'status',
      header: t('dashboard.recent.colStatus'),
      cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      meta: { disableSorting: true },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/jobs/${row.original.id}`}>{t('playlists.details')}</Link>
        </Button>
      ),
    },
  ], [t])

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
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="h-10 px-2 text-left align-middle font-medium">{t('dashboard.recent.colTitle')}</th>
                      <th className="h-10 px-2 text-left align-middle font-medium">{t('playlists.childrenTitle')}</th>
                      <th className="h-10 px-2 text-left align-middle font-medium">{t('dashboard.recent.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parents.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b transition-colors hover:bg-muted/50 cursor-pointer ${selectedId === p.id ? 'bg-muted/60' : ''}`}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <td className="max-w-[200px] truncate p-2 align-middle font-medium">{p.title || p.source_url}</td>
                        <td className="p-2 align-middle text-muted-foreground tabular-nums">{p.total_count ?? p.job_count ?? 0}</td>
                        <td className="p-2 align-middle"><Badge variant="secondary">{p.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-lg">{t('playlists.childrenTitle')}</CardTitle>
            <CardDescription>
              {selected ? selected.title || selected.source_url : t('playlists.selectParent')}
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
              <DataTable
                columns={childColumns}
                fetchData={(params) => api.get('/downloads/', { params: { ...params, playlist: selectedId, sort: 'queue' } })}
                searchPlaceholder={t('table.searchPlaceholder')}
                pageSize={15}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
