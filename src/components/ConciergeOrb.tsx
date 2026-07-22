import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Check, Grip, Sparkles } from 'lucide-react'
import type { OrbState } from '../types'

const labels: Record<OrbState, string> = {
  idle: 'Tap to begin', listening: 'Listening', typing: 'You are typing', thinking: 'Analysing your request', responding: 'Organising information', collecting: 'Collecting application details', validating: 'Validating information', completed: 'Application created', error: 'Please try again',
}

const ORB_POSITION_KEY = 'hyna-ai-concierge-orb-position-v1'

type OrbPlacement = { x: number; y: number; custom: boolean; ready: boolean }
type DragSession = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  lastX: number
  lastY: number
  lastTime: number
  stretch: number
  angle: number
  waveX: number
  waveY: number
  moved: boolean
}

function loadPlacement(): OrbPlacement {
  try {
    const stored = JSON.parse(localStorage.getItem(ORB_POSITION_KEY) ?? 'null') as { x?: unknown; y?: unknown } | null
    if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') return { x: stored.x, y: stored.y, custom: true, ready: false }
  } catch {
    // Invalid demo preferences should never block the application.
  }
  return { x: 0, y: 0, custom: false, ready: false }
}

function clampPlacement(x: number, y: number, width: number, height: number) {
  const edge = 12
  return {
    x: Math.min(Math.max(edge, x), Math.max(edge, window.innerWidth - width - edge)),
    y: Math.min(Math.max(edge, y), Math.max(edge, window.innerHeight - height - edge)),
  }
}

export function ConciergeOrb({ state, compact = false, progress = 0, onClick }: { state: OrbState; compact?: boolean; progress?: number; onClick: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const physicsRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const bounceFrameRef = useRef<number | null>(null)
  const [placement, setPlacement] = useState<OrbPlacement>(loadPlacement)
  const [dragging, setDragging] = useState(false)
  const [impactId, setImpactId] = useState(0)

  const applyPhysics = (stretch: number, angle: number, waveX: number, waveY: number) => {
    const surface = physicsRef.current
    if (!surface) return
    const safeStretch = Math.max(-.22, Math.min(.32, stretch))
    surface.style.setProperty('--liquid-scale-x', `${1 + safeStretch}`)
    surface.style.setProperty('--liquid-scale-y', `${1 - safeStretch * .58}`)
    surface.style.setProperty('--liquid-angle', `${angle}deg`)
    surface.style.setProperty('--wave-x', `${Math.max(-18, Math.min(18, waveX))}px`)
    surface.style.setProperty('--wave-y', `${Math.max(-18, Math.min(18, waveY))}px`)
  }

  const settlePhysics = (stretch: number, angle: number, waveX: number, waveY: number) => {
    if (bounceFrameRef.current !== null) window.cancelAnimationFrame(bounceFrameRef.current)
    const started = performance.now()
    const tick = (now: number) => {
      const seconds = (now - started) / 1000
      const decay = Math.exp(-4.2 * seconds)
      const oscillation = Math.cos(seconds * 18)
      applyPhysics(stretch * decay * oscillation, angle * decay * oscillation, waveX * decay * oscillation, waveY * decay * oscillation)
      if (seconds < 1.25) bounceFrameRef.current = window.requestAnimationFrame(tick)
      else {
        bounceFrameRef.current = null
        applyPhysics(0, 0, 0, 0)
      }
    }
    bounceFrameRef.current = window.requestAnimationFrame(tick)
  }

  useEffect(() => {
    const positionOrb = () => {
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return
      setPlacement((current) => {
        if (current.custom) return { ...current, ...clampPlacement(current.x, current.y, rect.width, rect.height), ready: true }
        const x = compact ? window.innerWidth - rect.width - Math.max(20, window.innerWidth * .035) : (window.innerWidth - rect.width) / 2
        const y = compact ? 168 : Math.min(window.innerHeight - rect.height - 90, Math.max(286, window.innerHeight * .43))
        return { ...current, ...clampPlacement(x, y, rect.width, rect.height), ready: true }
      })
    }
    const frame = window.requestAnimationFrame(positionOrb)
    window.addEventListener('resize', positionOrb)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', positionOrb)
    }
  }, [compact])

  useEffect(() => () => {
    if (bounceFrameRef.current !== null) window.cancelAnimationFrame(bounceFrameRef.current)
  }, [])

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    if (bounceFrameRef.current !== null) window.cancelAnimationFrame(bounceFrameRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.x,
      originY: placement.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      stretch: 0,
      angle: 0,
      waveX: 0,
      waveY: 0,
      moved: false,
    }
    setImpactId((current) => current + 1)
    applyPhysics(-.035, 0, 0, 8)
    setDragging(true)
  }

  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const rect = stageRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== event.pointerId || !rect) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    const now = performance.now()
    const frameX = event.clientX - drag.lastX
    const frameY = event.clientY - drag.lastY
    const elapsed = Math.max(8, now - drag.lastTime)
    const speed = Math.hypot(frameX, frameY) / elapsed
    drag.stretch = Math.min(.3, speed * .095)
    drag.angle = Math.atan2(frameY, frameX) * 180 / Math.PI
    drag.waveX = frameX * -.62
    drag.waveY = frameY * -.62
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    drag.lastTime = now
    applyPhysics(drag.stretch, drag.angle, drag.waveX, drag.waveY)
    if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true
    const next = clampPlacement(drag.originX + deltaX, drag.originY + deltaY, rect.width, rect.height)
    setPlacement((current) => ({ ...current, ...next, ready: true }))
  }

  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    setDragging(false)
    settlePhysics(drag.stretch, drag.angle, drag.waveX, drag.waveY)
    if (drag.moved) {
      setPlacement((current) => {
        localStorage.setItem(ORB_POSITION_KEY, JSON.stringify({ x: current.x, y: current.y }))
        return { ...current, custom: true }
      })
    } else {
      onClick()
    }
  }

  const pointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    setDragging(false)
    settlePhysics(drag?.stretch ?? 0, drag?.angle ?? 0, drag?.waveX ?? 0, drag?.waveY ?? 0)
  }

  const style = { '--progress': `${Math.max(4, progress)}%` } as CSSProperties
  return <div ref={stageRef} className={`floating-orb orb-stage ${compact ? 'is-compact' : ''} ${dragging ? 'is-dragging' : ''}`} style={{ left: placement.x, top: placement.y, opacity: placement.ready ? 1 : 0 }}>
    <button type="button" data-testid="concierge-orb" aria-label={`${compact ? 'Continue' : 'Start'} AI loan application. Drag to move.`} className={`concierge-orb state-${state}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick() }} style={style}>
      <span ref={physicsRef} className="orb-physics">
        <span className="orb-aura" />
        <span className="orb-shell">
          <span className="orb-water-membrane" />
          <span className="orb-caustics" />
          <span className="orb-light orb-light-one" />
          <span className="orb-light orb-light-two" />
          <span className="orb-light orb-light-three" />
          <span className="orb-particles" />
          <span className="orb-core">{state === 'completed' ? <Check size={compact ? 22 : 34} /> : <Sparkles size={compact ? 18 : 26} />}</span>
        </span>
        <span key={impactId} className="orb-impact-ripple" />
        {(state === 'collecting' || state === 'validating') && <span className="orb-progress" />}
      </span>
    </button>
    <p className="orb-status"><span />{labels[state]}</p>
    <p className="orb-drag-hint"><Grip size={10} /> Drag anywhere</p>
  </div>
}
