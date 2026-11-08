// @maintained-by-ai
// Phase 1 TV-mode presentation bundle (Initiative tracker): per-client TV
// display setting + fullscreen sync, timer-free damage/heal floater events
// (display-only HP diff across renders), the derived up-next strip, and the
// victory banner visibility. Everything here is PRESENTATION state (AGENTS
// "stays local: display formatting") except the shared `lastCombatResult`
// stamp, which is combat UI state written by handleClear and read via the
// runtime store — no new game rules, no timers.

import React from 'react'
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { setTvModeActive, saveTvPref, subscribeTvPref, getTvPref } from '../../services/ui/tvModeStore.js'

const TV_PREF_KEY = 'initiative-tv'
const VICTORY_DISMISS_KEY = 'initiative-victory-dismissed'

export function useTvPresentation({ campaignName, displayCreatures, activeCreatureName, showToast }) {
    // ── TV presentation mode ── localStorage precedent: the theme toggle.
    const [tvMode, setTvMode] = React.useState(() => {
        try { return localStorage.getItem(TV_PREF_KEY) === '1' } catch { return false }
    })
    const toggleTvMode = React.useCallback(() => {
        // Side effects (pref persist + store notify, fullscreen) run in the
        // CLICK phase, never inside a state-updater: an updater executes
        // during render, and a store notification from there makes React
        // re-render sibling subscribers (TvExitButton) mid-render.
        const next = !tvMode
        saveTvPref(next)
        setTvMode(next)
        // Piggyback fullscreen on the toggle (user-gesture context). LAN
        // http:// origins are non-secure, so browsers may reject the API —
        // say so honestly and keep the big-type presentation anyway.
        if (next) {
            const req = document.documentElement.requestFullscreen?.()
            if (req && req.catch) {
                req.catch(() => showToast('TV mode on — browser blocked fullscreen (press F11)'))
            }
        } else if (document.fullscreenElement) {
            const exit = document.exitFullscreen?.()
            if (exit && exit.catch) exit.catch(() => {})
        }
    }, [tvMode, showToast])
    // Escape exits fullscreen natively — mirror that so the toggle never goes stale.
    React.useEffect(() => {
        const onFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setTvMode(false)
                saveTvPref(false)
            }
        }
        document.addEventListener('fullscreenchange', onFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
    }, [])
    // The app-level corner "Exit TV mode" button exits through the shared
    // pref store without touching this hook — observe the pref flip and drop
    // the presentation here too (sidebar gate, big-type layout, fullscreen).
    const tvPref = React.useSyncExternalStore(subscribeTvPref, getTvPref)
    React.useEffect(() => {
        if (tvMode && !tvPref) setTvMode(false)
    }, [tvMode, tvPref])
    // Broadcast to the app shell: TV mode hides the left sidebar (nobody reads
    // it from across the room) and reclaims its gutter for the card carousel.
    // The unmount clear keeps every non-tracker view navigable.
    React.useEffect(() => {
        setTvModeActive(tvMode)
        return () => setTvModeActive(false)
    }, [tvMode])

    // ── Damage/heal floaters ── display-only diff of each creature's HP across
    // renders (the container survives the per-tick card remounts). Events live
    // until the floater's animationend retires them — no timers.
    const prevHpRef = React.useRef(new Map())
    const hpEventSeqRef = React.useRef(0)
    const [hpEvents, setHpEvents] = React.useState({})
    React.useEffect(() => {
        if (!displayCreatures.length) return
        const fresh = {}
        const names = new Set()
        for (const c of displayCreatures) {
            names.add(c.name)
            const hp = c.currentHp ?? 0
            const prev = prevHpRef.current.get(c.name)
            if (prev !== undefined && prev !== hp) {
                hpEventSeqRef.current += 1
                fresh[c.name] = { delta: hp - prev, id: hpEventSeqRef.current, max: c.maxHp || 1 }
            }
            prevHpRef.current.set(c.name, hp)
        }
        for (const stale of [...prevHpRef.current.keys()]) {
            if (!names.has(stale)) prevHpRef.current.delete(stale)
        }
        if (Object.keys(fresh).length) {
            setHpEvents(prev => ({ ...prev, ...fresh }))
        }
    }, [displayCreatures])
    const clearHpFeedback = React.useCallback((creatureName) => {
        setHpEvents(prev => {
            if (!prev[creatureName]) return prev
            const next = { ...prev }
            delete next[creatureName]
            return next
        })
    }, [])

    // ── Up-next strip ── pure derivation from tracker order (Thief's Reflexes
    // second turns excluded, mirrors TargetSelect).
    const nextUpCreatures = React.useMemo(() => {
        const list = displayCreatures.filter(c => !c.secondTurn)
        if (list.length < 2) return []
        const idx = list.findIndex(c => c.name === activeCreatureName)
        const out = []
        for (let i = 1; i <= 4 && i < list.length; i++) {
            out.push(list[((idx < 0 ? -1 : idx) + i + list.length) % list.length])
        }
        return out
    }, [displayCreatures, activeCreatureName])

    // ── Victory banner ── handleClear stamps `lastCombatResult` (campaign
    // runtime key) at the combat seam; every client celebrates until dismissed.
    // Dismissal is the per-client stamp. Auto-hides once foes rejoin the board
    // (a new fight outranks the old result).
    const lastCombatResult = useRuntimeValue('campaign', 'lastCombatResult', campaignName)
    const [victoryDismissTick, setVictoryDismissTick] = React.useState(0)
    const trackerHasFoes = displayCreatures.some(c => c.type === 'npc')
    const victoryVisible = React.useMemo(() => {
        void victoryDismissTick
        if (!lastCombatResult || trackerHasFoes) return false
        try {
            return localStorage.getItem(VICTORY_DISMISS_KEY) !== String(lastCombatResult.stamp)
        } catch {
            return true
        }
    }, [lastCombatResult, trackerHasFoes, victoryDismissTick])
    const dismissVictory = React.useCallback(() => {
        try { localStorage.setItem(VICTORY_DISMISS_KEY, String(lastCombatResult?.stamp ?? '')) } catch { /* ignore */ }
        setVictoryDismissTick(t => t + 1)
    }, [lastCombatResult])

    return { tvMode, toggleTvMode, hpEvents, clearHpFeedback, nextUpCreatures, lastCombatResult, victoryVisible, dismissVictory }
}
