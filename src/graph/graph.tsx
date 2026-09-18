import { useMemo } from 'react'
import {
  edgeKindMeta,
  statusMeta,
  type GraphDataset,
  type GraphEdge,
  type GraphNode,
  type StatusMeta,
} from './model'
import { computeLayout, edgePath } from './layout'

// For pairs of nodes connected by multiple edges, give each edge its own
// bow offset so they don't overlap. We hash the unordered (a,b) pair and
// assign symmetric offsets (-bow, +bow, -2*bow, +2*bow, …).
function edgeBowMap(EDGES: readonly GraphEdge[]): Map<number, number> {
  const map = new Map<number, number>()
  const seen = new Map<string, number[]>()
  EDGES.forEach((e, i) => {
    const key = [e.from, e.to].sort().join('|')
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(i)
  })
  for (const [, idxs] of seen) {
    if (idxs.length === 1) {
      map.set(idxs[0], 18)
      continue
    }
    idxs.forEach((idx, i) => {
      // 0 → 24, 1 → -24, 2 → 48, 3 → -48, …
      const step = Math.floor(i / 2) + 1
      const sign = i % 2 === 0 ? 1 : -1
      map.set(idx, step * 28 * sign)
    })
  }
  return map
}

export type GraphProps = {
  dataset: GraphDataset
  selectedId: string | null
  hoveredId: string | null
  edgeFilter: ReadonlySet<string>
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

export function Graph({
  dataset,
  selectedId,
  hoveredId,
  edgeFilter,
  onSelect,
  onHover,
}: GraphProps) {
  const { nodes: NODES, edges: EDGES } = dataset
  const layout = useMemo(() => computeLayout(NODES, EDGES), [NODES, EDGES])
  const bows = useMemo(() => edgeBowMap(EDGES), [EDGES])

  const focusId = hoveredId ?? selectedId
  // Connected = nodes reachable from focus in one hop (either direction).
  const connectedIds = useMemo(() => {
    if (!focusId) return null
    const ids = new Set<string>([focusId])
    for (const e of EDGES) {
      if (e.from === focusId) ids.add(e.to)
      if (e.to === focusId) ids.add(e.from)
    }
    return ids
  }, [focusId, EDGES])

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={dataset.title}
    >
      <defs>
        {Object.entries(dataset.edgeKinds).map(([kind, meta]) => (
          <marker
            key={kind}
            id={`arrow-${kind}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={meta.stroke} />
          </marker>
        ))}
      </defs>

      {/* Edges */}
      <g>
        {EDGES.map((e, i) => {
          if (!edgeFilter.has(e.kind)) return null
          const from = layout.nodes[e.from]
          const to = layout.nodes[e.to]
          if (!from || !to) return null
          const meta = edgeKindMeta(dataset, e.kind)
          const bow = bows.get(i) ?? 18
          const d = edgePath(from, to, bow)
          const involved =
            !connectedIds ||
            (connectedIds.has(e.from) && connectedIds.has(e.to) &&
              (e.from === focusId || e.to === focusId))
          const opacity = !connectedIds ? 0.6 : involved ? 1 : 0.07
          return (
            <g key={i} opacity={opacity} style={{ transition: 'opacity 150ms' }}>
              <path
                d={d}
                fill="none"
                stroke={meta.stroke}
                strokeWidth={involved && connectedIds ? 2 : 1.4}
                strokeDasharray={meta.dash}
                markerEnd={`url(#arrow-${e.kind})`}
              />
              {involved && connectedIds && e.label && (
                <EdgeLabel
                  d={d}
                  label={e.label}
                  stroke={meta.stroke}
                />
              )}
            </g>
          )
        })}
      </g>

      {/* Nodes */}
      <g>
        {Object.values(layout.nodes).map((box) => {
          const isFocused = focusId === box.node.id
          const isConnected = connectedIds?.has(box.node.id) ?? false
          const dim = connectedIds ? !isConnected : false
          return (
            <NodeChip
              key={box.node.id}
              box={box}
              status={statusMeta(dataset, box.node.status)}
              isFocused={isFocused}
              isSelected={selectedId === box.node.id}
              dim={dim}
              onClick={() => onSelect(box.node.id)}
              onMouseEnter={() => onHover(box.node.id)}
              onMouseLeave={() => onHover(null)}
            />
          )
        })}
      </g>
    </svg>
  )
}

function EdgeLabel({
  d,
  label,
  stroke,
}: {
  d: string
  label: string
  stroke: string
}) {
  // Place the label at the midpoint of the path. Without a real path-length
  // calc we approximate by parsing the bézier control points: midpoint of
  // start and end is good enough for labels.
  const match = d.match(
    /^M\s*([-\d.]+)\s+([-\d.]+).+?([-\d.]+)\s+([-\d.]+)\s*$/,
  )
  if (!match) return null
  const x1 = parseFloat(match[1])
  const y1 = parseFloat(match[2])
  const x2 = parseFloat(match[3])
  const y2 = parseFloat(match[4])
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g>
      <rect
        x={mx - label.length * 3.4 - 6}
        y={my - 9}
        width={label.length * 6.8 + 12}
        height={18}
        rx={9}
        fill="#0a0a0a"
        stroke={stroke}
        strokeOpacity={0.4}
      />
      <text
        x={mx}
        y={my + 4}
        textAnchor="middle"
        fill={stroke}
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </text>
    </g>
  )
}

function NodeChip({
  box,
  status,
  isFocused,
  isSelected,
  dim,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  box: { node: GraphNode; x: number; y: number; width: number; height: number }
  status: StatusMeta
  isFocused: boolean
  isSelected: boolean
  dim: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const { node: product, x, y, width, height } = box
  // We render the chip as a foreignObject so we can use real HTML/CSS — much
  // cleaner than hand-laying out text inside <text> elements, and gives us
  // truncation/wrapping for free.
  return (
    <g
      style={{
        cursor: 'pointer',
        transition: 'opacity 150ms',
        opacity: dim ? 0.22 : 1,
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={14}
        fill={isFocused ? 'rgba(168,85,247,0.10)' : 'rgba(255,255,255,0.025)'}
        stroke={
          isSelected
            ? '#e879f9'
            : isFocused
              ? 'rgba(217,70,239,0.55)'
              : 'rgba(255,255,255,0.10)'
        }
        strokeWidth={isSelected ? 2 : 1}
      />
      <foreignObject x={x} y={y} width={width} height={height}>
        <div
          // Inline styles only — we can't easily reach Tailwind inside
          // foreignObject content without a custom root, and these chips are
          // simple enough that inline CSS keeps things deterministic.
          style={{
            width: '100%',
            height: '100%',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily:
              '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
            color: '#fafafa',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.name}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid currentColor',
                color: status.hex,
                opacity: 0.85,
                flexShrink: 0,
                alignSelf: 'flex-start',
              }}
            >
              {status.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#a3a3a3',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.summary}
          </div>
          {product.deadline && (
            <div
              style={{
                fontSize: 10,
                color: '#737373',
                letterSpacing: '0.04em',
                fontFamily:
                  '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
              }}
            >
              ► {product.deadline}
            </div>
          )}
        </div>
      </foreignObject>
    </g>
  )
}
