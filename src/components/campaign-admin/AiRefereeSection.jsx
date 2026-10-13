/**
 * L5-005 §9.2 — AI Referee console (Admin view, localhost-only surface,
 * lives beside Enforcement & Referee).
 *
 * suggest mode (default): the referee describes a player's action, the AI
 * proposes a validated ruling, and NOTHING happens until Confirm is clicked
 * — the prompt waits indefinitely (AGENTS.md "No Game Timers"). Confirmed
 * atomic ops apply through applyRuling.js on the existing lanes.
 * autopilot: atomic ops (narrative/dice/hp/effect) auto-apply + log;
 * automation rulings still wait for the referee (§16 parked).
 * aiConfig unset/off ⇒ no console, no input, no traffic (L1–4 parity).
 */
import React from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { withClientId } from '../../services/ui/clientId.js'
import { ENFORCEMENT_DEFAULTS } from '../../services/combat/canTakeAction.js'
import { getAiStatus, askAiReferee } from '../../services/ai/aiClient.js'
import { applyRuling, isAtomicRuling } from '../../services/ai/applyRuling.js'
import AiConfigRow, { AiStatusBadge } from './AiConfigRow.jsx'
import AiWorldConsole from './AiWorldConsole.jsx'
import './AiRefereeSection.css'

async function postAiConfig(campaignName, value) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/aiConfig`, {
        method: 'POST',
        headers: withClientId({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ value }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, reason: data.reason || data.error || '' }
}

export default function AiRefereeSection({ campaignName, characters = [] }) {
    const [aiConfig] = useSyncedState('campaign', 'aiConfig', null, campaignName)
    const [enforcement] = useSyncedState('campaign', 'enforcement', { ...ENFORCEMENT_DEFAULTS }, campaignName)
    const [status, setStatus] = React.useState(null)
    const [notice, setNotice] = React.useState(null)

    const live = !!(aiConfig && aiConfig.mode && aiConfig.mode !== 'off')

    React.useEffect(() => {
        let cancelled = false
        getAiStatus(campaignName).then((s) => { if (!cancelled) setStatus(s) }).catch(() => { if (!cancelled) setStatus(null) })
        return () => { cancelled = true }
    }, [campaignName, aiConfig])

    const saveConfig = async (value) => {
        const r = await postAiConfig(campaignName, value)
        setNotice(r.ok ? null : `Server refused: ${r.reason}`)
    }
    const removeConfig = async () => {
        const r = await postAiConfig(campaignName, null)
        setNotice(r.ok ? null : `Server refused: ${r.reason}`)
    }

    return (
        <div className="admin-section ai-referee-section">
            <h3><i className="fas fa-robot"></i> AI Referee <AiStatusBadge status={status} /></h3>
            <AiConfigRow aiConfig={aiConfig} onSave={saveConfig} onRemove={removeConfig} />
            {notice && <div className="ai-notice ai-notice--error" role="alert">{notice}</div>}
            {live && <AiAskConsole campaignName={campaignName} characters={characters} aiConfig={aiConfig} enforcement={enforcement} />}
            {live && <AiWorldConsole campaignName={campaignName} />}
        </div>
    )
}

function AiAskConsole({ campaignName, characters, aiConfig, enforcement }) {
    const [action, setAction] = React.useState('')
    const [characterName, setCharacterName] = React.useState(characters[0]?.name || '')
    const [proposal, setProposal] = React.useState(null)
    const [result, setResult] = React.useState(null)
    const [asking, setAsking] = React.useState(false)

    const confirm = async (ruling) => {
        const r = await applyRuling({ campaignName, ruling, enforcement })
        setResult(r)
        setProposal(null)
    }

    const ask = async () => {
        setAsking(true); setResult(null)
        const res = await askAiReferee({ campaignName, action, characterName })
        setAsking(false)
        if (!res.ok && res.code !== 'AI_NEEDS_HUMAN') { setResult({ applied: false, detail: res.error || res.code || 'AI unavailable' }); return }
        setProposal(res.ruling)
        // autopilot applies ATOMIC ops at once; automation/needs_human wait
        // for the referee's click — forever if need be (no clock decides).
        if (aiConfig.mode === 'autopilot' && isAtomicRuling(res.ruling)) confirm(res.ruling)
    }

    return (
        <div className="ai-console">
            <textarea
                className="ai-action-input"
                rows={2}
                placeholder="Describe what a player does… e.g. 'I cast Fire Bolt at Goblin 1 from the doorway'"
                value={action}
                onChange={(e) => setAction(e.target.value)}
            />
            <div className="ai-console-row">
                <select value={characterName} onChange={(e) => setCharacterName(e.target.value)}>
                    {characters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <button className="ct-btn ct-btn-primary" disabled={!action.trim() || asking} onClick={ask}>
                    <i className="fas fa-brain"></i> {asking ? 'AI thinking…' : 'Ask AI referee'}
                </button>
            </div>
            {proposal && <AiProposalCard ruling={proposal} onConfirm={() => confirm(proposal)} onDismiss={() => setProposal(null)} />}
            {result && (
                <div className={`ai-notice ${result.applied ? 'ai-notice--ok' : 'ai-notice--refused'}`} role="status">
                    {result.applied ? 'Applied: ' : 'Not applied: '}{result.detail}
                </div>
            )}
        </div>
    )
}

function AiProposalCard({ ruling, onConfirm, onDismiss }) {
    return (
        <div className="ai-proposal-card">
            <div className="ai-proposal-head">
                <b>AI proposes: {ruling.type}</b>
                {typeof ruling.confidence === 'number' && <em className="ai-confidence">confidence {(ruling.confidence * 100).toFixed(0)}%</em>}
            </div>
            <p className="ai-proposal-body">
                {ruling.text || ruling.expression || ruling.actionName || ruling.effect || ''}
                {ruling.targetName ? ` → ${ruling.targetName}` : ''}
                {ruling.type === 'dice' && ruling.mode && ruling.mode !== 'normal' ? ` (${ruling.mode})` : ''}
                {ruling.amount !== undefined ? ` (${ruling.amount > 0 ? '+' : ''}${ruling.amount} HP)` : ''}
            </p>
            {ruling.explanation && <p className="ai-proposal-why">{ruling.explanation}</p>}
            <div className="ai-proposal-actions">
                <button className="ct-btn ct-btn-primary" onClick={onConfirm}><i className="fas fa-check"></i> Confirm &amp; Apply</button>
                <button className="ct-btn" onClick={onDismiss}>Dismiss</button>
            </div>
        </div>
    )
}
