/**
 * L5 §9.3 — AI director panel (Initiative view, localhost + configured AI
 * only). When an NPC is the active creature the referee can ask the AI to
 * decide its turn; the proposal is bounded server-side by the monster's real
 * stat block. suggest ⇒ card waits for Confirm indefinitely (no clock);
 * autopilot auto-applies safe intents (target stamp / log / advisory — the
 * attack itself still resolves on the monster's own card lane: the engine
 * rolls, never the model). needs_human always waits for a person.
 * aiConfig off or unset ⇒ renders nothing, zero traffic.
 */
import React from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { askNpcDirector } from '../../services/ai/aiClient.js'
import { applyDirectorIntent, isAutoSafeIntent } from '../../services/ai/applyDirectorIntent.js'
import './AiDirectorPanel.css'

const INTENT_ICONS = { attack: 'fa-crosshairs', cast: 'fa-wand-magic-sparkles', utility: 'fa-toolbox', move: 'fa-shoe-prints', talk: 'fa-comment', pass: 'fa-hand', needs_human: 'fa-user' }

const aiLive = (cfg) => !!(cfg && cfg.mode && cfg.mode !== 'off')
const npcAlive = (c) => !!c && c.type === 'npc' && (c.currentHp ?? c.hp ?? 1) > 0
// autopilot dedupe across remounts (SSE-driven view refreshes can re-key
// the panel mid-turn): one auto-ask per creature per active turn. Manual
// asks are never deduped — the referee clicking twice means it twice.
const autoAsked = new Set()

export default function AiDirectorPanel({ campaignName, activeCreature, isLocalhost, onStampTarget, round = null }) {
    const [aiConfig] = useSyncedState('campaign', 'aiConfig', null, campaignName)
    const [intent, setIntent] = React.useState(null)
    const [result, setResult] = React.useState(null)
    const [asking, setAsking] = React.useState(false)
    const askingRef = React.useRef(false)

    const creatureName = activeCreature?.name || null
    const live = isLocalhost && aiLive(aiConfig)
    const npcTurn = live && npcAlive(activeCreature)
    const autopilot = aiConfig?.mode === 'autopilot'

    React.useEffect(() => {
        setIntent(null)
        setResult(null)
    }, [creatureName])

    const ask = React.useCallback(async () => {
        if (!creatureName || askingRef.current) return
        askingRef.current = true
        setAsking(true)
        setResult(null)
        const res = await askNpcDirector({ campaignName, creatureName })
        askingRef.current = false
        setAsking(false)
        if (!res.ok && res.code !== 'AI_NEEDS_HUMAN') {
            setResult({ applied: false, detail: res.error || res.code || 'AI unavailable' })
            return
        }
        setIntent(res.intent || null)
        // autopilot auto-applies SAFE intents (stamp/log/advisory only);
        // automation-style execution still belongs to the referee's click.
        if (autopilot && res.ok && isAutoSafeIntent(res.intent)) {
            setResult(await applyDirectorIntent({ campaignName, intent: res.intent, onStampTarget }))
            setIntent(null)
        }
    }, [campaignName, creatureName, autopilot, onStampTarget])

    // autopilot turn seam: when an NPC becomes active, ask exactly once per
    // creature-per-round — deduped across remounts via the module set (key
    // includes the round so the next round's same-creature turn re-asks
    // naturally, and an SSE re-mount mid-turn does not double-ask).
    // Event-driven, no timers (AGENTS.md).
    React.useEffect(() => {
        if (!npcTurn || !autopilot) return
        if (autoAsked.size > 200) autoAsked.clear()
        const key = `${campaignName}:${creatureName}:${round ?? '?'}`
        if (autoAsked.has(key)) return
        autoAsked.add(key)
        ask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [npcTurn, autopilot, creatureName, round])

    if (!npcTurn) return null

    return (
        <div className='ai-director'>
            {!intent && (
                <button className='ai-director-ask' onClick={ask} disabled={asking} title="Ask the AI to decide this NPC's turn — it may only pick from the monster's real actions; the engine rolls the dice">
                    <i className={`fas ${asking ? 'fa-spinner' : 'fa-brain'}`}></i> {asking ? 'AI deciding…' : `AI director: decide ${creatureName}'s turn`}
                </button>
            )}
            {intent && <AiIntentCard intent={intent} onConfirm={async () => { setResult(await applyDirectorIntent({ campaignName, intent, onStampTarget })); setIntent(null) }} onDismiss={() => setIntent(null)} />}
            {result && (
                <span className={`ai-director-notice ${result.applied ? 'ok' : 'advisory'}`} role='status'>
                    {result.applied ? 'Confirmed: ' : ''}{result.detail}
                </span>
            )}
        </div>
    )
}

function AiIntentCard({ intent, onConfirm, onDismiss }) {
    return (
        <div className='ai-director-card' role='status'>
            <span className='ai-director-intent'>
                <i className={`fas ${INTENT_ICONS[intent.intent] || 'fa-chess'}`}></i>{' '}
                <b>{intent.intent}</b>
                {intent.actionName ? ` — ${intent.actionName}` : ''}
                {intent.targetName ? ` → ${intent.targetName}` : ''}
                {intent.intent === 'move' ? ` (${intent.feet} ft.)` : ''}
            </span>
            {intent.explanation && <span className='ai-director-why'>{intent.explanation}</span>}
            {intent.text && <span className='ai-director-why'>{intent.text}</span>}
            <span className='ai-director-actions'>
                <button className='ct-btn ct-btn-primary' onClick={onConfirm}><i className='fas fa-check'></i> Confirm</button>
                <button className='ct-btn' onClick={onDismiss}>Dismiss</button>
            </span>
        </div>
    )
}
