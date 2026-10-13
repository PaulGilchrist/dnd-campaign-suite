/**
 * L5 Phase 4 (§10.1/§10.4 groundwork) — Session & Audit console (Admin view,
 * localhost-only surface).
 *
 * Phase pills move the session state machine (manual authority; initiative /
 * travel / clear-combat seams move it automatically). The audit ledger shows
 * the enforcement/AI paper trail — denies, triggers, clock expiries, cover
 * calls, AI proposals, phase changes — read from the campaign log with a
 * manual refresh (no timers, no polling).
 */
import React from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { getClientId } from '../../services/ui/clientId.js'
import { SESSION_PHASES, setSessionPhase, readSessionPhase } from '../../services/combat/sessionService.js'
import './SessionSection.css'

const PHASE_LABELS = {
    exploration: { icon: 'fa-person-walking', label: 'Exploration' },
    encounter: { icon: 'fa-dragon', label: 'Encounter' },
    travel: { icon: 'fa-road', label: 'Travel' },
    roleplay: { icon: 'fa-comments', label: 'Roleplay' },
}

const AUDIT_TYPES = [
    'enforcement_denied', 'enforcement_triggered', 'enforcement_clock_expired',
    'enforcement_cover', 'ai_ruling', 'ai_director', 'ai_world', 'session_phase',
]

// The campaign log lives at its own route (not change-data) — read on mount,
// re-read on the Refresh click. No polling timers (AGENTS.md).
function useAuditFeed(campaignName) {
    const [entries, setEntries] = React.useState([])
    const refresh = React.useCallback(async () => {
        try {
            const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`)
            if (res.ok) {
                const data = await res.json()
                setEntries(Array.isArray(data) ? data : data?.log || [])
            }
        } catch (e) { console.error('[SessionSection] audit refresh failed:', e) }
    }, [campaignName])
    React.useEffect(() => { refresh() }, [refresh])
    return { entries, refresh }
}

function entryMatchesAudit(e) {
    const type = String(e?.type || '')
    const automationType = String(e?.automationType || '')
    return AUDIT_TYPES.includes(type) || automationType.startsWith('ai_') || automationType === 'manual_takeover'
}

export default function SessionSection({ campaignName }) {
    // sessionState rides the synced store so SSE moves the pills in every view.
    const [sessionState] = useSyncedState('campaign', 'sessionState', null, campaignName)
    const phase = sessionState?.phase || readSessionPhase(campaignName)
    const { entries, refresh } = useAuditFeed(campaignName)

    const move = (next) => setSessionPhase({ campaignName, phase: next, changedBy: 'referee console', reason: 'manual' })
        .catch((e) => { console.error('[SessionSection] phase change failed:', e) })

    // §10.4 "take over the GM": one click drops every automation lane back
    // to manual L1–4 (enforcement master off, AI off — sub-flag/config
    // values are read-merged, not wiped, so the GM can re-engage selectively).
    const takeOverManual = async () => {
        const url = (key) => `/api/campaigns/${encodeURIComponent(campaignName)}/${key}`
        const get = async (key) => {
            try { const res = await fetch(url(key)); return res.ok ? (await res.json())?.[key] ?? null : null }
            catch (e) { console.error(`[SessionSection] takeover read ${key} failed:`, e); return null }
        }
        const post = async (key, value) => {
            try { await fetch(url(key), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() }, body: JSON.stringify({ value }) }) }
            catch (e) { console.error(`[SessionSection] takeover ${key} failed:`, e) }
        }
        const enforcement = await get('enforcement')
        await post('enforcement', { ...(enforcement || {}), mode: 'off' })
        const aiConfig = await get('aiConfig')
        await post('aiConfig', { ...(aiConfig || {}), mode: 'off' })
        await fetch(url('log'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'automation', automationType: 'manual_takeover', description: 'Referee took over: enforcement and AI switched off — manual control (L1–4 behavior).' }),
        }).catch((e) => { console.error('[SessionSection] takeover audit failed:', e) })
        refresh()
    }

    const audit = (entries || []).filter(entryMatchesAudit).slice(-25).reverse()

    return (
        <div className="admin-section session-section">
            <div className="session-head">
                <h3><i className="fas fa-map"></i> Session</h3>
                {/* §10.4 safety valve: a person can always take the table back. */}
                <button type="button" className="ct-btn session-takeover" onClick={takeOverManual} title="Switch enforcement and AI off — back to manual play">
                    <i className="fas fa-hand"></i> Take over manually
                </button>
            </div>
            <div className="session-phase-row" role="group" aria-label="Session phase">
                {SESSION_PHASES.map(p => (
                    <button
                        key={p}
                        type="button"
                        className={`session-phase-pill ${p === phase ? 'active' : ''}`}
                        onClick={() => move(p)}
                        aria-pressed={p === phase}
                    >
                        <i className={`fas ${PHASE_LABELS[p].icon}`}></i> {PHASE_LABELS[p].label}
                    </button>
                ))}
            </div>
            {sessionState?.changedBy && (
                <p className="session-phase-note">
                    Last moved by {sessionState.changedBy}.
                </p>
            )}

            <div className="session-audit">
                <div className="session-audit-head">
                    <h4><i className="fas fa-list-check"></i> Enforcement &amp; AI audit</h4>
                    <button type="button" className="ct-btn" onClick={refresh}><i className="fas fa-rotate"></i> Refresh</button>
                </div>
                {audit.length === 0
                    ? <p className="session-audit-empty">Nothing to show — enforcement and AI activity will appear here.</p>
                    : (
                        <ul className="session-audit-list">
                            {audit.map((e, i) => (
                                <li key={e.id || i} className={`session-audit-row ${e.type}`}>
                                    <span className="session-audit-type">{e.type.replace(/_/g, ' ')}</span>
                                    <span className="session-audit-text">{(e.description || e.reason || e.message || JSON.stringify(e)).slice(0, 180)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </div>
        </div>
    )
}
