/**
 * Level 5 (L5-002) §7.5 — optional per-turn countdown for the Initiative
 * control row. Renders NOTHING while enforcement is off (L1–4 byte-identical).
 *
 * State lives in the campaign `turnTimer` runtime key so every client shows
 * the same clock; the countdown ticks locally from `endsAt` (no SSE spam).
 * Auto-advance executes only on the GM/localhost client — remote clients
 * display the clock and the initiative change arrives via SSE.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import './TurnTimer.css'

const DEFAULT_SECONDS = 60
const PRESETS = [30, 60, 90, 120]

const OFF_SHAPE = Object.freeze({ seconds: DEFAULT_SECONDS, running: false, endsAt: null, autoAdvance: false })

// Seconds left: the live countdown while running, else the armed duration.
function computeClock(timer) {
    const seconds = timer?.seconds ?? DEFAULT_SECONDS
    const running = timer?.running && timer?.endsAt
    const remaining = running ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000)) : seconds
    return {
        remaining,
        label: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
        expiring: !!running && remaining <= 10,
    }
}

export default function TurnTimer({ campaignName, enforcementOn, isLocalhost, onExpire }) {
    const [timer, setTimer] = useSyncedState('campaign', 'turnTimer', null, campaignName)
    const [, setTick] = useState(0)
    const expiredRef = useRef(false)

    // Merge helper — one shape for every control (keeps the render handlers flat).
    const patch = (updates) => setTimer({ ...OFF_SHAPE, ...(timer || {}), ...updates })

    // Tick the display once per second while running.
    useEffect(() => {
        if (!enforcementOn) return undefined
        if (!timer?.running) return undefined
        const id = setInterval(() => setTick(t => t + 1), 1000)
        return () => clearInterval(id)
    }, [enforcementOn, timer?.running])

    // Expiry: only the GM/localhost client drives the transition (stop clock /
    // auto-advance) — remote clients hold at zero and receive the result via
    // SSE. Writing running:false from every client would race the store.
    useEffect(() => {
        if (!enforcementOn || !isLocalhost) return
        if (!timer?.running || !timer?.endsAt) return
        if (Date.now() < timer.endsAt || expiredRef.current) return
        expiredRef.current = true
        if (timer.autoAdvance && typeof onExpire === 'function') {
            Promise.resolve(onExpire()).catch(() => {})
        }
        setTimer({ ...OFF_SHAPE, ...(timer || {}), running: false, endsAt: null })
    }, [enforcementOn, timer, isLocalhost, onExpire, setTimer])

    useEffect(() => {
        if (!timer?.running) expiredRef.current = false
    }, [timer?.running])

    if (!enforcementOn) return null

    const { label, expiring } = computeClock(timer)
    const running = !!timer?.running

    return (
        <span className={`turn-timer${expiring ? ' turn-timer--warn' : ''}`} aria-label="Turn timer">
            <i className="fa-regular fa-clock" /> {label}
            <button className="ct-btn" onClick={() => patch({ running: true, endsAt: Date.now() + (timer?.seconds ?? DEFAULT_SECONDS) * 1000 })} title={running ? 'Already running' : 'Start the per-turn countdown'}>{running ? 'Running' : 'Start'}</button>
            <button className="ct-btn" onClick={() => patch({ running: false, endsAt: null })} title="Pause the countdown">Pause</button>
            <button className="ct-btn" onClick={() => patch({ running: false, endsAt: null })} title="Reset the countdown">Reset</button>
            {isLocalhost && (
                <>
                    <select className="turn-timer-preset" value={timer?.seconds ?? DEFAULT_SECONDS} onChange={(e) => patch({ seconds: Number(e.target.value) })} title="Seconds per turn">
                        {PRESETS.map(s => <option key={s} value={s}>{s}s</option>)}
                    </select>
                    <label className="turn-timer-auto" title="Advance initiative automatically when the clock hits zero">
                        <input type="checkbox" checked={!!timer?.autoAdvance} onChange={() => patch({ autoAdvance: !timer?.autoAdvance })} /> auto
                    </label>
                </>
            )}
        </span>
    )
}
