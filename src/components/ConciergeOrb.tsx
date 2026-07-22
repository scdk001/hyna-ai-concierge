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
  velocityX: number
  velocityY: number
  moved: boolean
}
type LiquidMotion = {
  stretch: number
  stretchVelocity: number
  stretchTarget: number
  angle: number
  angleTarget: number
  lagX: number
  lagY: number
  lagVelocityX: number
  lagVelocityY: number
  lagTargetX: number
  lagTargetY: number
  waveX: number
  waveY: number
  waveVelocityX: number
  waveVelocityY: number
  waveTargetX: number
  waveTargetY: number
  wobble: number
  wobbleVelocity: number
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

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

function springStep(value: number, velocity: number, target: number, stiffness: number, damping: number, seconds: number) {
  const acceleration = (target - value) * stiffness - velocity * damping
  const nextVelocity = velocity + acceleration * seconds
  return [value + nextVelocity * seconds, nextVelocity] as const
}

function shortestAngle(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function writeLiquidFrame(surface: HTMLSpanElement | null, motion: LiquidMotion, now: number, idleMotion: boolean) {
  if (!surface) return
  const idleOne = idleMotion ? Math.sin(now / 820) : 0
  const idleTwo = idleMotion ? Math.sin(now / 1260 + 1.8) : 0
  const stretch = clamp(motion.stretch, -.18, .29)
  const wobble = clamp(motion.wobble, -1.25, 1.25)
  const lagX = clamp(motion.lagX, -18, 18)
  const lagY = clamp(motion.lagY, -18, 18)
  const waveX = clamp(motion.waveX + idleTwo * 2.1, -21, 21)
  const waveY = clamp(motion.waveY + idleOne * 1.8, -21, 21)
  const shapeA = clamp(wobble * 7.5 + waveY * .18 + idleOne * 2.1, -11, 11)
  const shapeB = clamp(-wobble * 5.8 - waveX * .16 + idleTwo * 1.8, -10, 10)
  const shapeC = clamp(wobble * 4.2 - waveY * .14 - idleOne * 1.7, -9, 9)
  const shapeD = clamp(-wobble * 6.7 + waveX * .17 - idleTwo * 2.2, -11, 11)

  surface.style.setProperty('--liquid-scale-x', `${1 + stretch}`)
  surface.style.setProperty('--liquid-scale-y', `${1 - stretch * .62 + Math.abs(wobble) * .008}`)
  surface.style.setProperty('--liquid-angle', `${motion.angle}deg`)
  surface.style.setProperty('--liquid-skew', `${clamp(wobble * 3.4 + (waveY - waveX) * .035, -6, 6)}deg`)
  surface.style.setProperty('--lag-x', `${lagX}px`)
  surface.style.setProperty('--lag-y', `${lagY}px`)
  surface.style.setProperty('--wave-x', `${waveX}px`)
  surface.style.setProperty('--wave-y', `${waveY}px`)
  surface.style.setProperty('--highlight-x', `${clamp(-waveX * .22, -5, 5)}px`)
  surface.style.setProperty('--highlight-y', `${clamp(-waveY * .22, -5, 5)}px`)
  surface.style.setProperty('--shape-a', `${shapeA}px`)
  surface.style.setProperty('--shape-b', `${shapeB}px`)
  surface.style.setProperty('--shape-c', `${shapeC}px`)
  surface.style.setProperty('--shape-d', `${shapeD}px`)
}

export function ConciergeOrb({ state, compact = false, progress = 0, onClick }: { state: OrbState; compact?: boolean; progress?: number; onClick: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const physicsRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const physicsFrameRef = useRef<number | null>(null)
  const motionRef = useRef<LiquidMotion>({
    stretch: 0,
    stretchVelocity: 0,
    stretchTarget: 0,
    angle: 0,
    angleTarget: 0,
    lagX: 0,
    lagY: 0,
    lagVelocityX: 0,
    lagVelocityY: 0,
    lagTargetX: 0,
    lagTargetY: 0,
    waveX: 0,
    waveY: 0,
    waveVelocityX: 0,
    waveVelocityY: 0,
    waveTargetX: 0,
    waveTargetY: 0,
    wobble: 0,
    wobbleVelocity: 0,
  })
  const [placement, setPlacement] = useState<OrbPlacement>(loadPlacement)
  const [dragging, setDragging] = useState(false)
  const [impactId, setImpactId] = useState(0)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let previous = performance.now()
    const animate = (now: number) => {
      const seconds = clamp((now - previous) / 1000, 1 / 240, 1 / 30)
      previous = now
      const motion = motionRef.current
      const active = dragRef.current !== null

      if (reducedMotion.matches) {
        motion.stretch = active ? motion.stretchTarget : 0
        motion.lagX = active ? motion.lagTargetX : 0
        motion.lagY = active ? motion.lagTargetY : 0
        motion.waveX = active ? motion.waveTargetX : 0
        motion.waveY = active ? motion.waveTargetY : 0
        motion.wobble = 0
      } else {
        const stretchSpring = active ? 170 : 105
        const stretchDamping = active ? 17 : 9.2
        ;[motion.stretch, motion.stretchVelocity] = springStep(motion.stretch, motion.stretchVelocity, active ? motion.stretchTarget : 0, stretchSpring, stretchDamping, seconds)
        ;[motion.lagX, motion.lagVelocityX] = springStep(motion.lagX, motion.lagVelocityX, active ? motion.lagTargetX : 0, active ? 190 : 122, active ? 20 : 11.5, seconds)
        ;[motion.lagY, motion.lagVelocityY] = springStep(motion.lagY, motion.lagVelocityY, active ? motion.lagTargetY : 0, active ? 190 : 122, active ? 20 : 11.5, seconds)
        ;[motion.waveX, motion.waveVelocityX] = springStep(motion.waveX, motion.waveVelocityX, active ? motion.waveTargetX : 0, active ? 105 : 66, active ? 11 : 6.8, seconds)
        ;[motion.waveY, motion.waveVelocityY] = springStep(motion.waveY, motion.waveVelocityY, active ? motion.waveTargetY : 0, active ? 105 : 66, active ? 11 : 6.8, seconds)
        ;[motion.wobble, motion.wobbleVelocity] = springStep(motion.wobble, motion.wobbleVelocity, 0, 78, active ? 8.5 : 6.6, seconds)
      }

      const angleTarget = active || Math.abs(motion.stretch) > .006 ? motion.angleTarget : 0
      motion.angle += shortestAngle(motion.angle, angleTarget) * (1 - Math.exp(-(active ? 18 : 4.5) * seconds))
      writeLiquidFrame(physicsRef.current, motion, now, !active && !reducedMotion.matches)

      if (active) {
        const targetDecay = Math.exp(-5.8 * seconds)
        motion.stretchTarget *= targetDecay
        motion.lagTargetX *= targetDecay
        motion.lagTargetY *= targetDecay
        motion.waveTargetX *= targetDecay
        motion.waveTargetY *= targetDecay
      }
      physicsFrameRef.current = window.requestAnimationFrame(animate)
    }
    physicsFrameRef.current = window.requestAnimationFrame(animate)
    return () => {
      if (physicsFrameRef.current !== null) window.cancelAnimationFrame(physicsFrameRef.current)
    }
  }, [])

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

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
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
      velocityX: 0,
      velocityY: 0,
      moved: false,
    }
    const motion = motionRef.current
    motion.stretchTarget = -.055
    motion.stretchVelocity -= .7
    motion.lagTargetY = 3
    motion.waveTargetY = 8
    motion.wobbleVelocity += .65
    setImpactId((current) => current + 1)
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
    const instantX = frameX / elapsed
    const instantY = frameY / elapsed
    drag.velocityX = drag.velocityX * .58 + instantX * .42
    drag.velocityY = drag.velocityY * .58 + instantY * .42
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    drag.lastTime = now

    const speed = Math.hypot(drag.velocityX, drag.velocityY)
    const motion = motionRef.current
    motion.stretchTarget = clamp(speed * .15, 0, .27)
    if (speed > .025) motion.angleTarget = Math.atan2(drag.velocityY, drag.velocityX) * 180 / Math.PI
    motion.lagTargetX = clamp(-drag.velocityX * 13, -16, 16)
    motion.lagTargetY = clamp(-drag.velocityY * 13, -16, 16)
    motion.waveTargetX = clamp(-drag.velocityX * 18, -20, 20)
    motion.waveTargetY = clamp(-drag.velocityY * 18, -20, 20)
    motion.wobbleVelocity += clamp((instantX - instantY) * .18, -.32, .32)

    if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true
    const next = clampPlacement(drag.originX + deltaX, drag.originY + deltaY, rect.width, rect.height)
    setPlacement((current) => ({ ...current, ...next, ready: true }))
  }

  const releaseLiquid = (drag: DragSession | null) => {
    const motion = motionRef.current
    const velocityX = drag?.velocityX ?? 0
    const velocityY = drag?.velocityY ?? 0
    const releaseSpeed = Math.hypot(velocityX, velocityY)
    motion.stretchTarget = 0
    motion.lagTargetX = 0
    motion.lagTargetY = 0
    motion.waveTargetX = 0
    motion.waveTargetY = 0
    motion.stretchVelocity += clamp(releaseSpeed * 1.1, 0, 2.2)
    motion.lagVelocityX += clamp(-velocityX * 82, -105, 105)
    motion.lagVelocityY += clamp(-velocityY * 82, -105, 105)
    motion.waveVelocityX += clamp(-velocityX * 145, -175, 175)
    motion.waveVelocityY += clamp(-velocityY * 145, -175, 175)
    motion.wobbleVelocity += clamp((velocityX + velocityY) * .72, -1.45, 1.45)
    setImpactId((current) => current + 1)
  }

  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    setDragging(false)
    releaseLiquid(drag)
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
    releaseLiquid(drag)
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
