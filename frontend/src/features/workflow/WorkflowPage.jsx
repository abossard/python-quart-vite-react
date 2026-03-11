/**
 * WorkflowPage — Interactive support workflow canvas editor.
 *
 * Purely browser-side: no API calls. Uses HTML Canvas for drawing
 * nodes, connections, and animations. Editable via drag-and-drop,
 * double-click to rename, right-click to delete, toolbar to add nodes.
 */

import {
  Button,
  Caption1,
  Card,
  Input,
  Subtitle2,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowReset24Regular,
  Delete24Regular,
  Play24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// DATA: default support workflow
// ============================================================================

const NODE_TYPES = {
  start:    { color: '#0ea5e9', label: 'Start',    shape: 'pill' },
  end:      { color: '#22c55e', label: 'End',      shape: 'pill' },
  action:   { color: '#6366f1', label: 'Action',   shape: 'rect' },
  decision: { color: '#f59e0b', label: 'Decision', shape: 'diamond' },
  wait:     { color: '#8b5cf6', label: 'Wait',     shape: 'rect' },
}

let _nextId = 100

function makeId() { return `n${_nextId++}` }

const DEFAULT_NODES = [
  { id: 'n1', type: 'start',    x: 80,   y: 200, label: 'Ticket Created' },
  { id: 'n2', type: 'action',   x: 240,  y: 200, label: 'Auto-Classify' },
  { id: 'n3', type: 'decision', x: 410,  y: 200, label: 'Priority?' },
  { id: 'n4', type: 'action',   x: 590,  y: 100, label: 'Escalate to L2' },
  { id: 'n5', type: 'action',   x: 590,  y: 310, label: 'Assign to L1' },
  { id: 'n6', type: 'wait',     x: 770,  y: 100, label: 'Await Response' },
  { id: 'n7', type: 'action',   x: 770,  y: 310, label: 'Troubleshoot' },
  { id: 'n8', type: 'decision', x: 940,  y: 200, label: 'Resolved?' },
  { id: 'n9', type: 'action',   x: 1100, y: 100, label: 'Reopen / Escalate' },
  { id: 'n10', type: 'end',     x: 1100, y: 310, label: 'Close Ticket' },
]

const DEFAULT_EDGES = [
  { from: 'n1', to: 'n2', label: '' },
  { from: 'n2', to: 'n3', label: '' },
  { from: 'n3', to: 'n4', label: 'High/Critical' },
  { from: 'n3', to: 'n5', label: 'Medium/Low' },
  { from: 'n4', to: 'n6', label: '' },
  { from: 'n5', to: 'n7', label: '' },
  { from: 'n6', to: 'n8', label: '' },
  { from: 'n7', to: 'n8', label: '' },
  { from: 'n8', to: 'n9', label: 'No' },
  { from: 'n8', to: 'n10', label: 'Yes' },
  { from: 'n9', to: 'n6', label: '' },
]

// ============================================================================
// DRAWING: pure canvas rendering functions
// ============================================================================

const NODE_W = 160
const NODE_H = 56
const DIAMOND_R = 48
const PILL_W = 150
const PILL_H = 44

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawDiamond(ctx, cx, cy, r) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r * 1.3, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r * 1.3, cy)
  ctx.closePath()
}

function drawPill(ctx, cx, cy, w, h) {
  const r = h / 2
  ctx.beginPath()
  ctx.moveTo(cx - w / 2 + r, cy - h / 2)
  ctx.lineTo(cx + w / 2 - r, cy - h / 2)
  ctx.arc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(cx - w / 2 + r, cy + h / 2)
  ctx.arc(cx - w / 2 + r, cy, r, Math.PI / 2, -Math.PI / 2)
  ctx.closePath()
}

function getNodeBounds(node) {
  const t = NODE_TYPES[node.type] || NODE_TYPES.action
  if (t.shape === 'diamond') {
    return { x: node.x - DIAMOND_R * 1.3, y: node.y - DIAMOND_R, w: DIAMOND_R * 2.6, h: DIAMOND_R * 2 }
  }
  if (t.shape === 'pill') {
    return { x: node.x - PILL_W / 2, y: node.y - PILL_H / 2, w: PILL_W, h: PILL_H }
  }
  return { x: node.x - NODE_W / 2, y: node.y - NODE_H / 2, w: NODE_W, h: NODE_H }
}

function pointInNode(px, py, node) {
  const b = getNodeBounds(node)
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h
}

function getEdgePoint(node, targetX, targetY) {
  const b = getNodeBounds(node)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const dx = targetX - cx
  const dy = targetY - cy
  const angle = Math.atan2(dy, dx)

  // Simple edge intersection
  const hw = b.w / 2
  const hh = b.h / 2
  const tanA = Math.abs(dy / (dx || 0.001))

  let ex, ey
  if (tanA <= hh / hw) {
    ex = dx > 0 ? cx + hw : cx - hw
    ey = cy + (dx > 0 ? 1 : -1) * hw * Math.tan(angle)
  } else {
    ey = dy > 0 ? cy + hh : cy - hh
    ex = cx + (dy > 0 ? 1 : -1) * hh / Math.tan(angle)
  }
  return { x: ex, y: ey }
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const headLen = 10
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4))
  ctx.stroke()
}

function renderCanvas(ctx, canvas, nodes, edges, selectedId, hoveredId, connectingFrom, mousePos, animProgress) {
  const dpr = window.devicePixelRatio || 1
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.scale(dpr, dpr)

  // Background grid
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 0.5
  for (let x = 0; x < canvas.width / dpr; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height / dpr); ctx.stroke()
  }
  for (let y = 0; y < canvas.height / dpr; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width / dpr, y); ctx.stroke()
  }

  // Edges
  const nodeMap = {}
  nodes.forEach((n) => { nodeMap[n.id] = n })

  edges.forEach((edge) => {
    const fromNode = nodeMap[edge.from]
    const toNode = nodeMap[edge.to]
    if (!fromNode || !toNode) return

    const p1 = getEdgePoint(fromNode, toNode.x, toNode.y)
    const p2 = getEdgePoint(toNode, fromNode.x, fromNode.y)

    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    drawArrow(ctx, p1.x, p1.y, p2.x, p2.y)

    // Edge label
    if (edge.label) {
      const mx = (p1.x + p2.x) / 2
      const my = (p1.y + p2.y) / 2
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#fff'
      const tw = ctx.measureText(edge.label).width + 8
      drawRoundedRect(ctx, mx - tw / 2, my - 9, tw, 18, 4)
      ctx.fillStyle = '#f1f5f9'
      ctx.fill()
      ctx.fillStyle = '#475569'
      ctx.fillText(edge.label, mx, my + 4)
    }

    // Animation dot
    if (animProgress != null) {
      const t = ((animProgress + edges.indexOf(edge) * 0.15) % 1)
      const ax = p1.x + (p2.x - p1.x) * t
      const ay = p1.y + (p2.y - p1.y) * t
      ctx.beginPath()
      ctx.arc(ax, ay, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#3b82f6'
      ctx.fill()
    }
  })

  // Connecting line (while dragging a new edge)
  if (connectingFrom && mousePos) {
    const fromNode = nodeMap[connectingFrom]
    if (fromNode) {
      const p1 = getEdgePoint(fromNode, mousePos.x, mousePos.y)
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(mousePos.x, mousePos.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Nodes
  nodes.forEach((node) => {
    const t = NODE_TYPES[node.type] || NODE_TYPES.action
    const isSelected = node.id === selectedId
    const isHovered = node.id === hoveredId

    // Shadow
    ctx.shadowColor = isSelected ? t.color + '66' : 'rgba(0,0,0,0.1)'
    ctx.shadowBlur = isSelected ? 16 : 8
    ctx.shadowOffsetY = 2

    // Shape
    ctx.fillStyle = '#ffffff'
    if (t.shape === 'diamond') {
      drawDiamond(ctx, node.x, node.y, DIAMOND_R)
    } else if (t.shape === 'pill') {
      drawPill(ctx, node.x, node.y, PILL_W, PILL_H)
    } else {
      drawRoundedRect(ctx, node.x - NODE_W / 2, node.y - NODE_H / 2, NODE_W, NODE_H, 12)
    }
    ctx.fill()

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Border
    ctx.strokeStyle = isSelected ? t.color : isHovered ? t.color + 'aa' : '#cbd5e1'
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.stroke()

    // Top color bar (for rect nodes)
    if (t.shape === 'rect') {
      ctx.save()
      ctx.beginPath()
      drawRoundedRect(ctx, node.x - NODE_W / 2, node.y - NODE_H / 2, NODE_W, 6, 0)
      ctx.clip()
      drawRoundedRect(ctx, node.x - NODE_W / 2, node.y - NODE_H / 2, NODE_W, 12, 12)
      ctx.fillStyle = t.color
      ctx.fill()
      ctx.restore()
    }

    // Icon dot for pill shapes
    if (t.shape === 'pill') {
      ctx.beginPath()
      ctx.arc(node.x - PILL_W / 2 + 20, node.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = t.color
      ctx.fill()
    }

    // Label
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#1e293b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(node.label, node.x + (t.shape === 'pill' ? 8 : 0), node.y + (t.shape === 'rect' ? 4 : 0), t.shape === 'diamond' ? DIAMOND_R * 1.8 : NODE_W - 20)

    // Type badge (for rect nodes)
    if (t.shape === 'rect') {
      ctx.font = '10px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(t.label, node.x, node.y - NODE_H / 2 + 18)
    }
  })

  ctx.restore()
}

// ============================================================================
// STYLES
// ============================================================================

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  canvasWrap: {
    borderRadius: tokens.borderRadiusLarge,
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: '#f8fafc',
    cursor: 'default',
  },
  nodeTypeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  colorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  editOverlay: {
    position: 'absolute',
    zIndex: 10,
  },
})

// ============================================================================
// COMPONENT
// ============================================================================

export default function WorkflowPage() {
  const styles = useStyles()
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  const [nodes, setNodes] = useState(DEFAULT_NODES)
  const [edges, setEdges] = useState(DEFAULT_EDGES)
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [dragging, setDragging] = useState(null) // { nodeId, offsetX, offsetY }
  const [connecting, setConnecting] = useState(null) // source node id (shift+drag)
  const [mousePos, setMousePos] = useState(null)
  const [editing, setEditing] = useState(null) // { nodeId, x, y }
  const [editText, setEditText] = useState('')
  const [animating, setAnimating] = useState(false)
  const animRef = useRef(null)
  const [animProgress, setAnimProgress] = useState(null)
  const [canvasReady, setCanvasReady] = useState(0) // increment to trigger re-render after resize

  // Canvas sizing
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    const h = 440
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    setCanvasReady((c) => c + 1)
  }, [])

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvasReady) return
    const ctx = canvas.getContext('2d')
    renderCanvas(ctx, canvas, nodes, edges, selectedId, hoveredId, connecting, mousePos, animProgress)
  }, [nodes, edges, selectedId, hoveredId, connecting, mousePos, animProgress, canvasReady])

  // Animation
  useEffect(() => {
    if (!animating) { setAnimProgress(null); return }
    let running = true
    const tick = () => {
      if (!running) return
      setAnimProgress((p) => ((p || 0) + 0.004) % 1)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [animating])

  // Mouse helpers
  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const findNode = (x, y) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (pointInNode(x, y, nodes[i])) return nodes[i]
    }
    return null
  }

  // Event handlers
  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e)
    const node = findNode(pos.x, pos.y)

    if (node) {
      setSelectedId(node.id)
      if (e.shiftKey) {
        // Shift+click starts connecting
        setConnecting(node.id)
        setMousePos(pos)
      } else {
        setDragging({ nodeId: node.id, offsetX: pos.x - node.x, offsetY: pos.y - node.y })
      }
    } else {
      setSelectedId(null)
    }
  }

  const handleMouseMove = (e) => {
    const pos = getCanvasPos(e)
    setMousePos(pos)

    if (dragging) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging.nodeId
            ? { ...n, x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY }
            : n,
        ),
      )
    } else {
      const node = findNode(pos.x, pos.y)
      setHoveredId(node?.id || null)
    }
  }

  const handleMouseUp = (e) => {
    if (connecting) {
      const pos = getCanvasPos(e)
      const targetNode = findNode(pos.x, pos.y)
      if (targetNode && targetNode.id !== connecting) {
        // Add edge if not duplicate
        const exists = edges.some((e) => e.from === connecting && e.to === targetNode.id)
        if (!exists) {
          setEdges((prev) => [...prev, { from: connecting, to: targetNode.id, label: '' }])
        }
      }
      setConnecting(null)
      setMousePos(null)
    }
    setDragging(null)
  }

  const handleDoubleClick = (e) => {
    const pos = getCanvasPos(e)
    const node = findNode(pos.x, pos.y)
    if (node) {
      const rect = canvasRef.current.getBoundingClientRect()
      setEditing({ nodeId: node.id, x: e.clientX - rect.left, y: e.clientY - rect.top })
      setEditText(node.label)
    }
  }

  const commitEdit = () => {
    if (editing && editText.trim()) {
      setNodes((prev) =>
        prev.map((n) => (n.id === editing.nodeId ? { ...n, label: editText.trim() } : n)),
      )
    }
    setEditing(null)
  }

  const addNode = (type) => {
    const id = makeId()
    setNodes((prev) => [
      ...prev,
      { id, type, x: 200 + Math.random() * 400, y: 200 + Math.random() * 200, label: NODE_TYPES[type].label },
    ])
    setSelectedId(id)
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setNodes((prev) => prev.filter((n) => n.id !== selectedId))
    setEdges((prev) => prev.filter((e) => e.from !== selectedId && e.to !== selectedId))
    setSelectedId(null)
  }

  const resetWorkflow = () => {
    setNodes(DEFAULT_NODES)
    setEdges(DEFAULT_EDGES)
    setSelectedId(null)
    setAnimating(false)
  }

  return (
    <div className={styles.container} data-testid="workflow-page">
      <div className={styles.header}>
        <div>
          <Subtitle2>Support Workflow</Subtitle2>
          <Caption1 style={{ display: 'block', marginTop: '2px' }}>
            Drag nodes to move · Shift+drag to connect · Double-click to rename
          </Caption1>
        </div>
        <div className={styles.toolbar}>
          <Button
            appearance={animating ? 'primary' : 'outline'}
            icon={<Play24Regular />}
            onClick={() => setAnimating(!animating)}
            data-testid="workflow-animate"
          >
            {animating ? 'Stop' : 'Animate'}
          </Button>
          <Button
            appearance="subtle"
            icon={<ArrowReset24Regular />}
            onClick={resetWorkflow}
            data-testid="workflow-reset"
          >
            Reset
          </Button>
        </div>
      </div>

      <Card>
        <div className={styles.toolbar} style={{ padding: `${tokens.spacingVerticalXS} 0` }}>
          <Text size={200} weight="semibold" style={{ marginRight: '4px' }}>Add:</Text>
          {Object.entries(NODE_TYPES).map(([key, cfg]) => (
            <Tooltip key={key} content={`Add ${cfg.label} node`} relationship="label">
              <Button
                size="small"
                appearance="subtle"
                onClick={() => addNode(key)}
                data-testid={`workflow-add-${key}`}
              >
                <span className={styles.nodeTypeBtn}>
                  <span className={styles.colorDot} style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </span>
              </Button>
            </Tooltip>
          ))}
          <div style={{ flex: 1 }} />
          {selectedId && (
            <Button
              size="small"
              appearance="subtle"
              icon={<Delete24Regular />}
              onClick={deleteSelected}
              data-testid="workflow-delete-node"
            >
              Delete
            </Button>
          )}
          <Caption1>{nodes.length} nodes · {edges.length} edges</Caption1>
        </div>
      </Card>

      <div className={styles.canvasWrap} ref={wrapRef} style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setDragging(null); setConnecting(null); setHoveredId(null) }}
          onDoubleClick={handleDoubleClick}
          style={{ display: 'block' }}
          data-testid="workflow-canvas"
        />

        {editing && (
          <div
            className={styles.editOverlay}
            style={{ left: editing.x - 80, top: editing.y - 16 }}
          >
            <Input
              autoFocus
              value={editText}
              onChange={(_, d) => setEditText(d.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
              onBlur={commitEdit}
              style={{ width: '160px' }}
              data-testid="workflow-edit-input"
            />
          </div>
        )}
      </div>
    </div>
  )
}
