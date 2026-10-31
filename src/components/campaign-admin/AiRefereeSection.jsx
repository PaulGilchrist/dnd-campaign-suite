/**
 * L5-005 §9.2 — AI Referee console (Admin view, localhost-only surface,
 * lives beside Enforcement).
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
import { ENFORCEMENT_DEFAULTS } from '../../services/combat/canTakeAction.js'
import { getAiStatus, askAiReferee } from '../../services/ai/aiClient.js'
import { applyRuling, isAtomicRuling } from '../../services/ai/applyRuling.js'
import { getEffectDefinition, TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js'
import AiConfigRow, { AiStatusBadge } from './AiConfigRow.jsx'
import AiWorldConsole from './AiWorldConsole.jsx'
import './AiRefereeSection.css'

async function postAiConfig(campaignName, value) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/aiConfig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, reason: data.reason || data.error || '' }
}

// Key-hygiene twin of the death-save result lane (savePromptService.js
// :51-65): POST null first so every live client receives the value-echo
// (consumers gate on aiConfigLive/`live`, which null satisfies), then DELETE
// the key so wildcard audits and snapshot diffs never carry a zombie
// `aiConfig: null` (backlog ai-config-null-key-retained). Delete-after-ack,
// event-driven, zero timers: the server publishes the echo synchronously
// before responding (campaigns-changedata.js publish → res.json) and the
// shared SSE is in-order per connection, so the DELETE's null-echo trails
// every live client's value-echo — trailing null echoes are inert. A
// refused POST (e.g. server lock 403) never fires the DELETE — nothing was
// written to wipe.
async function deleteAiConfig(campaignName) {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/aiConfig`, {
        method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    // Wildcard DELETE honesty (2026-10-30): a 404 means the key is already
    // gone — the exact end state this lane wants (e.g. another tab cleared
    // it between the null-POST ack and here). Only non-404 failures are a
    // refusal worth surfacing.
    return { ok: res.ok || res.status === 404, reason: data.reason || data.error || '' }
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
        if (!r.ok) {
            setNotice(`Server refused: ${r.reason}`)
            return
        }
        const d = await deleteAiConfig(campaignName)
        setNotice(d.ok ? null : `Server refused: ${d.reason}`)
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
                rows={5}
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
            {proposal && <AiProposalCard ruling={proposal} onConfirm={confirm} onDismiss={() => setProposal(null)} />}
            {result && (
                <div className={`ai-notice ${result.applied ? 'ai-notice--ok' : 'ai-notice--refused'}`} role="status">
                    {result.applied ? 'Applied: ' : 'Not applied: '}{result.detail}
                </div>
            )}
        </div>
    )
}

// One-line prose description of a ruling (kept out of JSX so the card's
// branch count stays under the lint complexity cap).
function describeRuling(ruling, effectDisplay) {
    return [
        ruling.text || ruling.expression || ruling.actionName || effectDisplay || '',
        ruling.targetName ? ` → ${ruling.targetName}` : '',
        ruling.type === 'dice' && ruling.mode && ruling.mode !== 'normal' ? ` (${ruling.mode})` : '',
        ruling.type === 'hp_change' && ruling.amount !== undefined ? ` (${ruling.amount > 0 ? '+' : ''}${ruling.amount} HP)` : '',
    ].join('')
}

function AiProposalCard({ ruling, onConfirm, onDismiss }) {
    // §10.4 override: the referee may edit the proposed HP delta before it
    // touches the sheet — AI proposes, the HUMAN disposes.
    const [amountOverride, setAmountOverride] = React.useState(
        ruling.type === 'hp_change' && ruling.amount !== undefined ? String(ruling.amount) : '')
    // Pre-filter: a model-proposed effect key outside the te registry used to
    // be a post-confirm dead end (the apply lane honestly refuses). Surface a
    // registry picker instead so the GM repairs the key BEFORE confirming.
    const effectInvalid = ruling.type === 'target_effect' && !getEffectDefinition(ruling.effect)
    const [effectFix, setEffectFix] = React.useState('')
    const effectRepaired = effectInvalid && !!getEffectDefinition(effectFix)
    const confirmClick = () => {
        if (effectInvalid) {
            onConfirm({ ...ruling, effect: effectFix, overridden: true })
        } else if (ruling.type === 'hp_change' && amountOverride !== '' && Number(amountOverride) !== ruling.amount) {
            onConfirm({ ...ruling, amount: Number(amountOverride), overridden: true })
        } else {
            onConfirm(ruling)
        }
    }
    return (
        <div className="ai-proposal-card">
            <div className="ai-proposal-head">
                <b>AI proposes: {ruling.type}</b>
                {typeof ruling.confidence === 'number' && <em className="ai-confidence">confidence {(ruling.confidence * 100).toFixed(0)}%</em>}
            </div>
            <p className="ai-proposal-body">{describeRuling(ruling, effectRepaired ? effectFix : ruling.effect)}</p>
            {ruling.explanation && <p className="ai-proposal-why">{ruling.explanation}</p>}
            {ruling.type === 'hp_change' && (
                <label className="ai-override-row">
                    Override HP
                    <input
                        type="number"
                        className="ai-override-input"
                        value={amountOverride}
                        onChange={(e) => setAmountOverride(e.target.value)}
                        aria-label="Override HP amount"
                    />
                </label>
            )}
            {effectInvalid && (
                <div className="ai-effect-fix">
                    <div className="ai-notice ai-notice--refused" role="alert">
                        “{ruling.effect}” is not in the effect registry — pick a valid effect key or Dismiss this proposal.
                    </div>
                    <label className="ai-override-row">
                        Effect key
                        <select
                            className="ai-effect-select"
                            value={effectFix}
                            onChange={(e) => setEffectFix(e.target.value)}
                            aria-label="Choose a valid effect key"
                        >
                            <option value="">Choose a valid effect key…</option>
                            {TARGET_EFFECT_DEFINITIONS.map(def => (
                                <option key={def.effect} value={def.effect}>{def.label} ({def.effect})</option>
                            ))}
                        </select>
                    </label>
                </div>
            )}
            <div className="ai-proposal-actions">
                <button
                    className="ct-btn ct-btn-primary"
                    disabled={effectInvalid && !effectRepaired}
                    title={effectInvalid && !effectRepaired ? 'Pick a valid effect key first' : undefined}
                    onClick={confirmClick}
                >
                    <i className="fas fa-check"></i> Confirm &amp; Apply
                </button>
                <button className="ct-btn" onClick={onDismiss}>Dismiss</button>
            </div>
        </div>
    )
}
