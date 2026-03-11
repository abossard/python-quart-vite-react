/**
 * WorkflowPage — Interactive metro-map style workflow editor.
 *
 * Inspired by "Incident & Problem Solving" methodology:
 * - Multiple workflow presets (Incident Solving, Problem Solving, Change Mgmt)
 * - Colored paths (edges inherit outgoing node color)
 * - Click a node to assign an example agent + pick color
 * - Drag to move, double-click to rename, shift+drag to connect
 * - Purely browser-side, no API calls.
 */

import {
  Badge,
  Button,
  Caption1,
  Card,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Option,
  Subtitle2,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Add24Regular,
  ArrowReset24Regular,
  Dismiss24Regular,
  Play24Regular,
} from '@fluentui/react-icons'
import { useCallback, useEffect, useRef, useState } from 'react'

const PALETTE = [
  { name: 'Red', hex: '#dc2626' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Slate', hex: '#475569' },
]

const AGENT_PRESETS = [
  { id: 'none', name: '(none)', description: '' },
  { id: 'auto-classify', name: 'Auto-Classify Agent', description: 'Classify tickets by category and priority' },
  { id: 'kba-search', name: 'KBA Search Agent', description: 'Search Knowledge Base for known resolutions' },
  { id: 'root-cause', name: 'Root Cause Analyzer', description: 'Analyze patterns to find root causes' },
  { id: 'next-step', name: 'Next Step Advisor', description: 'Recommend the best next action' },
  { id: 'escalation', name: 'Escalation Router', description: 'Route to the right L2/L3 team' },
  { id: 'kba-writer', name: 'KBA Writer Agent', description: 'Generate KB articles from resolved tickets' },
  { id: 'stats', name: 'Statistics Agent', description: 'Analyze worklog activity and produce reports' },
  { id: 'sla-monitor', name: 'SLA Monitor Agent', description: 'Check tickets at risk of SLA breach' },
  { id: 'change-assess', name: 'Change Assessor', description: 'Evaluate risk and impact of changes' },
]

let _nid = 200

const WORKFLOWS = {
  incident: {
    name: 'Incident Solving',
    description: 'Recovery through known actions & investigation',
    nodes: [
      { id: 'i1', x: 80, y: 160, label: '! Incident', color: '#dc2626', agent: 'none' },
      { id: 'i2', x: 240, y: 100, label: 'Geklärte\nSymptome', color: '#dc2626', agent: 'auto-classify' },
      { id: 'i3', x: 430, y: 160, label: 'Kurzfristige\nKorrektive Aktionen', color: '#ea580c', agent: 'kba-search' },
      { id: 'i4', x: 680, y: 160, label: 'Weiterdenken', color: '#16a34a', agent: 'next-step' },
      { id: 'i5', x: 930, y: 160, label: 'Permanente\nKorrektive Aktionen', color: '#16a34a', agent: 'kba-writer' },
      { id: 'i6', x: 240, y: 290, label: 'Fakten', color: '#ea580c', agent: 'stats' },
      { id: 'i7', x: 380, y: 290, label: 'Ursachen', color: '#ea580c', agent: 'root-cause' },
      { id: 'i8', x: 560, y: 290, label: 'Ziele', color: '#2563eb', agent: 'none' },
      { id: 'i9', x: 740, y: 290, label: 'Kausalität', color: '#2563eb', agent: 'root-cause' },
      { id: 'i10', x: 930, y: 290, label: 'Optionen', color: '#2563eb', agent: 'next-step' },
    ],
    edges: [
      { from: 'i1', to: 'i2' }, { from: 'i2', to: 'i3' },
      { from: 'i3', to: 'i4' }, { from: 'i4', to: 'i5' },
      { from: 'i2', to: 'i6' }, { from: 'i6', to: 'i7' },
      { from: 'i7', to: 'i3' }, { from: 'i3', to: 'i8' },
      { from: 'i8', to: 'i9' }, { from: 'i9', to: 'i10' },
      { from: 'i10', to: 'i5' },
    ],
  },
  problem: {
    name: 'Problem Solving',
    description: 'Structured root cause analysis and permanent fix',
    nodes: [
      { id: 'p1', x: 80, y: 200, label: 'Problem\nDetected', color: '#2563eb', agent: 'sla-monitor' },
      { id: 'p2', x: 260, y: 200, label: 'Gather\nFacts', color: '#2563eb', agent: 'stats' },
      { id: 'p3', x: 440, y: 120, label: 'Known Error\nMatch?', color: '#16a34a', agent: 'kba-search' },
      { id: 'p4', x: 440, y: 300, label: 'Root Cause\nAnalysis', color: '#7c3aed', agent: 'root-cause' },
      { id: 'p5', x: 640, y: 120, label: 'Apply Known\nFix', color: '#16a34a', agent: 'kba-search' },
      { id: 'p6', x: 640, y: 300, label: 'Propose\nSolution', color: '#7c3aed', agent: 'next-step' },
      { id: 'p7', x: 830, y: 200, label: 'Validate\n& Test', color: '#d97706', agent: 'none' },
      { id: 'p8', x: 1010, y: 120, label: 'Write KBA', color: '#16a34a', agent: 'kba-writer' },
      { id: 'p9', x: 1010, y: 300, label: 'Close\nProblem', color: '#475569', agent: 'none' },
    ],
    edges: [
      { from: 'p1', to: 'p2' }, { from: 'p2', to: 'p3' },
      { from: 'p2', to: 'p4' }, { from: 'p3', to: 'p5' },
      { from: 'p4', to: 'p6' }, { from: 'p5', to: 'p7' },
      { from: 'p6', to: 'p7' }, { from: 'p7', to: 'p8' },
      { from: 'p7', to: 'p9' }, { from: 'p8', to: 'p9' },
    ],
  },
  change: {
    name: 'Change Management',
    description: 'Risk assessment, approval, and implementation',
    nodes: [
      { id: 'c1', x: 80, y: 200, label: 'Change\nRequest', color: '#2563eb', agent: 'none' },
      { id: 'c2', x: 260, y: 200, label: 'Impact\nAssessment', color: '#2563eb', agent: 'change-assess' },
      { id: 'c3', x: 450, y: 120, label: 'Low Risk\nAuto-Approve', color: '#16a34a', agent: 'none' },
      { id: 'c4', x: 450, y: 300, label: 'CAB\nReview', color: '#d97706', agent: 'none' },
      { id: 'c5', x: 650, y: 200, label: 'Schedule\nImplementation', color: '#4f46e5', agent: 'none' },
      { id: 'c6', x: 840, y: 120, label: 'Implement\nChange', color: '#4f46e5', agent: 'next-step' },
      { id: 'c7', x: 840, y: 300, label: 'Rollback\nPlan', color: '#dc2626', agent: 'none' },
      { id: 'c8', x: 1020, y: 200, label: 'Post-Review\n& Close', color: '#475569', agent: 'kba-writer' },
    ],
    edges: [
      { from: 'c1', to: 'c2' }, { from: 'c2', to: 'c3' },
      { from: 'c2', to: 'c4' }, { from: 'c3', to: 'c5' },
      { from: 'c4', to: 'c5' }, { from: 'c5', to: 'c6' },
      { from: 'c5', to: 'c7' }, { from: 'c6', to: 'c8' },
      { from: 'c7', to: 'c6' },
    ],
  },
}

// ============================================================================
// DRAWING
// ============================================================================

const NODE_R = 22
const EDGE_W = 8

function pointInNode(px, py, node) {
  const dx = px - node.x, dy = py - node.y
  return dx * dx + dy * dy <= (NODE_R + 10) * (NODE_R + 10)
}

function edgePt(node, tx, ty) {
  const dx = tx - node.x, dy = ty - node.y, d = Math.sqrt(dx * dx + dy * dy) || 1
  return { x: node.x + (dx / d) * (NODE_R + 2), y: node.y + (dy / d) * (NODE_R + 2) }
}

function renderCanvas(ctx, canvas, nodes, edges, selectedId, hoveredId, connecting, mousePos, animProgress) {
  const dpr = window.devicePixelRatio || 1
  const W = canvas.width / dpr, H = canvas.height / dpr
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#e2e8f0'
  for (let x = 20; x < W; x += 40)
    for (let y = 20; y < H; y += 40) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill()
    }

  const nm = {}
  nodes.forEach((n) => { nm[n.id] = n })

  edges.forEach((edge, idx) => {
    const fn = nm[edge.from], tn = nm[edge.to]
    if (!fn || !tn) return
    const p1 = edgePt(fn, tn.x, tn.y), p2 = edgePt(tn, fn.x, fn.y)
    ctx.strokeStyle = fn.color || '#94a3b8'
    ctx.lineWidth = EDGE_W; ctx.lineCap = 'round'; ctx.globalAlpha = 0.7
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
    ctx.globalAlpha = 1.0
    if (animProgress != null) {
      const t = ((animProgress * 2 + idx * 0.12) % 1)
      const ax = p1.x + (p2.x - p1.x) * t, ay = p1.y + (p2.y - p1.y) * t
      ctx.beginPath(); ctx.arc(ax, ay, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
      ctx.strokeStyle = fn.color || '#333'; ctx.lineWidth = 2; ctx.stroke()
    }
  })

  if (connecting && mousePos && nm[connecting]) {
    const fn = nm[connecting], p1 = edgePt(fn, mousePos.x, mousePos.y)
    ctx.strokeStyle = fn.color; ctx.lineWidth = EDGE_W; ctx.lineCap = 'round'
    ctx.globalAlpha = 0.4; ctx.setLineDash([12, 8])
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke()
    ctx.setLineDash([]); ctx.globalAlpha = 1.0
  }

  nodes.forEach((node) => {
    const isSel = node.id === selectedId, isHov = node.id === hoveredId
    ctx.beginPath(); ctx.arc(node.x, node.y, NODE_R + 4, 0, Math.PI * 2)
    ctx.fillStyle = isSel ? node.color : isHov ? node.color + 'cc' : '#cbd5e1'; ctx.fill()
    ctx.beginPath(); ctx.arc(node.x, node.y, NODE_R, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'; ctx.fill()
    ctx.beginPath(); ctx.arc(node.x, node.y, NODE_R - 6, 0, Math.PI * 2)
    ctx.fillStyle = node.color + '22'; ctx.fill()
    if (node.agent && node.agent !== 'none') {
      ctx.beginPath(); ctx.arc(node.x + NODE_R - 2, node.y - NODE_R + 2, 6, 0, Math.PI * 2)
      ctx.fillStyle = node.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
    }
    const lines = (node.label || '').split('\n')
    ctx.font = 'bold 12px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    lines.forEach((line, i) => ctx.fillText(line, node.x, node.y + NODE_R + 10 + i * 15))
  })
  ctx.restore()
}

// ============================================================================
// STYLES
// ============================================================================

const useStyles = makeStyles({
  container: { padding: tokens.spacingVerticalL, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  toolbar: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  canvasWrap: { borderRadius: tokens.borderRadiusLarge, overflow: 'hidden', border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: '#f8fafc', cursor: 'default', position: 'relative' },
  wfBtn: { minWidth: '140px' },
  colorPicker: { display: 'flex', gap: '4px', alignItems: 'center' },
  colorDot: { width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', border: '2px solid transparent', transition: 'transform 0.1s', ':hover': { transform: 'scale(1.2)' } },
  colorDotSelected: { border: `2px solid ${tokens.colorNeutralForeground1}`, transform: 'scale(1.2)' },
  editOverlay: { position: 'absolute', zIndex: 10 },
  legend: { display: 'flex', gap: tokens.spacingHorizontalL, flexWrap: 'wrap', padding: `${tokens.spacingVerticalXS} 0` },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  legendLine: { width: '24px', height: '6px', borderRadius: '3px' },
  dialogSurface: { maxWidth: '500px' },
})

// ============================================================================
// COMPONENT
// ============================================================================

export default function WorkflowPage() {
  const styles = useStyles()
  const canvasRef = useRef(null), wrapRef = useRef(null)
  const [activeWf, setActiveWf] = useState('incident')
  const [nodes, setNodes] = useState(WORKFLOWS.incident.nodes.map((n) => ({ ...n })))
  const [edges, setEdges] = useState(WORKFLOWS.incident.edges.map((e) => ({ ...e })))
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [connecting, setConnecting] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editText, setEditText] = useState('')
  const [animating, setAnimating] = useState(false)
  const animRef = useRef(null)
  const [animProgress, setAnimProgress] = useState(null)
  const [nodeDialog, setNodeDialog] = useState(null)
  const [canvasReady, setCanvasReady] = useState(0)

  const switchWf = (key) => {
    const wf = WORKFLOWS[key]; if (!wf) return
    setActiveWf(key); setNodes(wf.nodes.map((n) => ({ ...n }))); setEdges(wf.edges.map((e) => ({ ...e })))
    setSelectedId(null); setAnimating(false); setNodeDialog(null)
  }

  const resize = useCallback(() => {
    const c = canvasRef.current, w = wrapRef.current; if (!c || !w) return
    const dpr = window.devicePixelRatio || 1, ww = w.clientWidth
    c.width = ww * dpr; c.height = 460 * dpr
    c.style.width = ww + 'px'; c.style.height = '460px'
    setCanvasReady((v) => v + 1)
  }, [])

  useEffect(() => { resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [resize])
  useEffect(() => { const c = canvasRef.current; if (!c || !canvasReady) return; renderCanvas(c.getContext('2d'), c, nodes, edges, selectedId, hoveredId, connecting, mousePos, animProgress) }, [nodes, edges, selectedId, hoveredId, connecting, mousePos, animProgress, canvasReady])
  useEffect(() => { if (!animating) { setAnimProgress(null); return }; let ok = true; const t = () => { if (!ok) return; setAnimProgress((p) => ((p || 0) + 0.003) % 1); animRef.current = requestAnimationFrame(t) }; animRef.current = requestAnimationFrame(t); return () => { ok = false; cancelAnimationFrame(animRef.current) } }, [animating])

  const gp = (e) => { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const fn = (x, y) => { for (let i = nodes.length - 1; i >= 0; i--) if (pointInNode(x, y, nodes[i])) return nodes[i]; return null }

  const onDown = (e) => { const p = gp(e), n = fn(p.x, p.y); if (n) { setSelectedId(n.id); e.shiftKey ? (setConnecting(n.id), setMousePos(p)) : setDragging({ id: n.id, ox: p.x - n.x, oy: p.y - n.y }) } else setSelectedId(null) }
  const onMove = (e) => { const p = gp(e); setMousePos(p); dragging ? setNodes((prev) => prev.map((n) => n.id === dragging.id ? { ...n, x: p.x - dragging.ox, y: p.y - dragging.oy } : n)) : setHoveredId(fn(p.x, p.y)?.id || null) }
  const onUp = (e) => { if (connecting) { const t = fn(gp(e).x, gp(e).y); if (t && t.id !== connecting && !edges.some((x) => x.from === connecting && x.to === t.id)) setEdges((p) => [...p, { from: connecting, to: t.id }]); setConnecting(null) }; setDragging(null) }
  const onClick = (e) => { if (!dragging) { const n = fn(gp(e).x, gp(e).y); if (n) setNodeDialog(n.id) } }
  const onDbl = (e) => { const p = gp(e), n = fn(p.x, p.y); if (n) { const r = canvasRef.current.getBoundingClientRect(); setEditing({ nodeId: n.id, x: e.clientX - r.left, y: e.clientY - r.top }); setEditText(n.label.replace(/\n/g, ' ')) } }
  const commitEdit = () => { if (editing && editText.trim()) setNodes((p) => p.map((n) => n.id === editing.nodeId ? { ...n, label: editText.trim() } : n)); setEditing(null) }
  const addNode = () => { const id = 'n' + (_nid++); setNodes((p) => [...p, { id, x: 150 + Math.random() * 300, y: 150 + Math.random() * 150, label: 'New Step', color: '#475569', agent: 'none' }]); setSelectedId(id) }
  const delSel = () => { if (!selectedId) return; setNodes((p) => p.filter((n) => n.id !== selectedId)); setEdges((p) => p.filter((e) => e.from !== selectedId && e.to !== selectedId)); setSelectedId(null); setNodeDialog(null) }

  const dNode = nodeDialog ? nodes.find((n) => n.id === nodeDialog) : null
  const usedColors = [...new Set(nodes.map((n) => n.color))]

  return (
    <div className={styles.container} data-testid="workflow-page">
      <div className={styles.header}>
        <div>
          <Subtitle2>Support Workflow</Subtitle2>
          <Caption1 style={{ display: 'block', marginTop: '2px' }}>Click node to configure · Drag to move · Shift+drag to connect · Double-click to rename</Caption1>
        </div>
        <div className={styles.toolbar}>
          <Button appearance={animating ? 'primary' : 'outline'} icon={<Play24Regular />} onClick={() => setAnimating(!animating)} data-testid="workflow-animate">{animating ? 'Stop' : 'Animate'}</Button>
          <Button appearance="subtle" icon={<Add24Regular />} onClick={addNode} data-testid="workflow-add-node">Add Node</Button>
          <Button appearance="subtle" icon={<ArrowReset24Regular />} onClick={() => switchWf(activeWf)} data-testid="workflow-reset">Reset</Button>
        </div>
      </div>

      <Card>
        <div className={styles.toolbar}>
          <Text size={200} weight="semibold">Workflow:</Text>
          {Object.entries(WORKFLOWS).map(([key, wf]) => (
            <Button key={key} appearance={activeWf === key ? 'primary' : 'outline'} size="small" className={styles.wfBtn} onClick={() => switchWf(key)} data-testid={'workflow-preset-' + key}>{wf.name}</Button>
          ))}
          <div style={{ flex: 1 }} />
          <Caption1>{nodes.length} nodes · {edges.length} edges</Caption1>
        </div>
      </Card>

      <div className={styles.canvasWrap} ref={wrapRef}>
        <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
          onMouseLeave={() => { setDragging(null); setConnecting(null); setHoveredId(null) }}
          onClick={onClick} onDoubleClick={onDbl} style={{ display: 'block' }} data-testid="workflow-canvas" />
        {editing && (
          <div className={styles.editOverlay} style={{ left: editing.x - 80, top: editing.y - 16 }}>
            <Input autoFocus value={editText} onChange={(_, d) => setEditText(d.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
              onBlur={commitEdit} style={{ width: '160px' }} data-testid="workflow-edit-input" />
          </div>
        )}
      </div>

      <div className={styles.legend}>
        {usedColors.map((c) => (
          <div key={c} className={styles.legendItem}>
            <span className={styles.legendLine} style={{ backgroundColor: c }} />
            <Caption1>{PALETTE.find((p) => p.hex === c)?.name || 'Custom'}</Caption1>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(dNode)} onOpenChange={(_, d) => { if (!d.open) setNodeDialog(null) }}>
        <DialogSurface className={styles.dialogSurface}>
          {dNode && (<>
            <DialogTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setNodeDialog(null)} />}>
              {dNode.label.replace(/\n/g, ' ')}
            </DialogTitle>
            <DialogBody><DialogContent style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
              <Field label="Node Color">
                <div className={styles.colorPicker}>
                  {PALETTE.map((c) => (
                    <Tooltip key={c.hex} content={c.name} relationship="label">
                      <div className={styles.colorDot + ' ' + (dNode.color === c.hex ? styles.colorDotSelected : '')}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setNodes((p) => p.map((n) => n.id === dNode.id ? { ...n, color: c.hex } : n))}
                        data-testid={'color-' + c.name.toLowerCase()} />
                    </Tooltip>
                  ))}
                </div>
              </Field>
              <Field label="Assigned Agent">
                <Combobox value={AGENT_PRESETS.find((a) => a.id === dNode.agent)?.name || '(none)'}
                  onOptionSelect={(_, data) => setNodes((p) => p.map((n) => n.id === dNode.id ? { ...n, agent: data.optionValue } : n))}
                  data-testid="workflow-agent-select">
                  {AGENT_PRESETS.map((a) => (
                    <Option key={a.id} value={a.id} text={a.name}>
                      <div><Text weight="semibold">{a.name}</Text>{a.description && (<><br /><Caption1>{a.description}</Caption1></>)}</div>
                    </Option>
                  ))}
                </Combobox>
              </Field>
              {dNode.agent && dNode.agent !== 'none' && (
                <Badge appearance="filled" color="brand" style={{ alignSelf: 'flex-start' }}>
                  {'🤖 ' + (AGENT_PRESETS.find((a) => a.id === dNode.agent)?.name || '')}
                </Badge>
              )}
            </DialogContent></DialogBody>
            <DialogActions>
              <Button appearance="subtle" style={{ color: tokens.colorPaletteRedForeground1 }} onClick={delSel}>Delete Node</Button>
              <Button appearance="primary" onClick={() => setNodeDialog(null)}>Done</Button>
            </DialogActions>
          </>)}
        </DialogSurface>
      </Dialog>
    </div>
  )
}
