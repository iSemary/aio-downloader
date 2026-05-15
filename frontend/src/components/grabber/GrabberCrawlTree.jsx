import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleX, Clock, Globe, Loader2 } from 'lucide-react'
import { Tree } from 'react-arborist'
import { Badge } from '@/components/ui/badge'

const statusIcons = {
  pending: Clock,
  crawling: Loader2,
  done: CircleCheck,
  error: CircleX,
  skipped: CircleX,
}

const statusColors = {
  pending: 'text-muted-foreground',
  crawling: 'text-blue-500 animate-spin',
  done: 'text-green-500',
  error: 'text-red-500',
  skipped: 'text-amber-500',
}

function Node({ node, style, dragHandle }) {
  const Icon = statusIcons[node.data.status] || Globe
  const colorClass = statusColors[node.data.status] || ''

  return (
    <div
      ref={dragHandle}
      style={style}
      className={`flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent/50 ${node.isSelected ? 'bg-accent' : ''}`}
      onClick={() => node.toggle()}
    >
      <span className="shrink-0 text-xs text-muted-foreground">{node.data.depth > 0 && '└'}</span>
      <Icon className={`size-3.5 shrink-0 ${colorClass}`} />
      <span className="min-w-0 flex-1 truncate">{node.data.title || node.data.url}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">L{node.data.depth}</span>
      {node.data.http_status && (
        <Badge variant="outline" className="text-[10px]">{node.data.http_status}</Badge>
      )}
      <span className="shrink-0 text-xs text-muted-foreground">
        {node.children?.length || 0} children · {node.data.files_count || 0} files
      </span>
    </div>
  )
}

export default function GrabberCrawlTree({ tasks = [], onNodeClick }) {
  const { t } = useTranslation()

  const buildTree = useCallback(() => {
    const roots = tasks.filter((t) => !t.parent_id)
    const children = tasks.filter((t) => t.parent_id)

    function attachChildren(node) {
      const kids = children.filter((c) => c.parent_id === node.id)
      node.children = kids.map((k) => ({ ...k, children: [] }))
      for (const kid of node.children) {
        attachChildren(kid)
      }
    }

    const tree = roots.map((r) => ({ ...r, children: [] }))
    for (const root of tree) {
      attachChildren(root)
    }
    return tree
  }, [tasks])

  const treeData = buildTree()

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
        <Globe className="size-8" />
        <p>{t('grabber.noCrawlTasks')}</p>
      </div>
    )
  }

  return (
    <Tree
      data={treeData}
      openByDefault={false}
      width="100%"
      height={400}
      indent={20}
      rowHeight={36}
      overscanCount={10}
    >
      {Node}
    </Tree>
  )
}
