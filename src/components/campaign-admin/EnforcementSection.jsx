/**
 * L5-001 — Referee / Enforcement section (Admin view, localhost-only surface).
 *
 * Master enforcement switch + the Phase 0/1 sub-flags, and referee assignment
 * (this browser claims the referee role with its durable client id, §6.8).
 * All writes flow through useSyncedState → the server-validated chokepoint
 * (server/validation/keyValidators.js). Default OFF ⇒ Levels 1–4 unchanged.
 */
import React from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { getClientId } from '../../services/ui/clientId.js'
import { ENFORCEMENT_DEFAULTS } from '../../services/combat/canTakeAction.js'
import './EnforcementSection.css'

const FLAGS = [
    { key: 'turnLock', label: 'Turn lock', hint: 'Only the active creature may take Actions or Bonus Actions (Reactions stay allowed off-turn).' },
    { key: 'actionEconomy', label: 'Action economy', hint: 'Charge 1 Action + 1 Bonus Action + 1 Reaction per creature; extra attempts are refused.' },
    { key: 'movementBudget', label: 'Movement budget', hint: 'Clamp token drags to each creature\u2019s remaining speed (active map only).' },
    { key: 'tokenMoving', label: 'Teleport token-move', hint: 'Teleport automations move the token to the nearest legal space near the selected target (active map only).' },
    { key: 'autoEncounters', label: 'Auto-encounters', hint: 'Accepting a travel combat event also starts the initiative tracker — the engine rolls initiative for every monster. Off: the encounter map spawns and you start initiative when you like.' },
    // §8.3 follow-up: the spatial/zone flags ride the store — surfaced here
    // so the GM can toggle them without hand-editing runtime state.
    { key: 'zones', label: 'Zones & areas', hint: 'Zone automations arm real expiry clocks and turn-end damage (insect-cloud style); lair cadence matures at the initiative-count-20 wrap.' },
    { key: 'lineOfSight', label: 'Line of sight', hint: 'Attacks and spells behind walls or closed doors are denied before their slot is charged (active map only).' },
    { key: 'opportunityAttacks', label: 'Opportunity attacks', hint: 'Leaving a hostile creature\u2019s reach spends their reaction and prompts you to resolve the attack on their sheet.' },
]

export default function EnforcementSection({ campaignName, characters = [] }) {
    const [enforcement, setEnforcement] = useSyncedState('campaign', 'enforcement', { ...ENFORCEMENT_DEFAULTS }, campaignName)
    const [referee, setReferee] = useSyncedState('campaign', 'referee', null, campaignName)
    const [claimName, setClaimName] = React.useState(characters[0]?.name || '')

    const flags = { ...ENFORCEMENT_DEFAULTS, ...(enforcement || {}) }
    const clientId = getClientId()

    const setFlag = (key, value) => setEnforcement({ ...flags, [key]: value })

    return (
        <div className="admin-section enforcement-section">
            <h3><i className="fas fa-gavel"></i> Enforcement &amp; Referee</h3>
            <div className="enforcement-master">
                <label className="enforcement-toggle">
                    <input
                        type="checkbox"
                        checked={flags.mode === 'on'}
                        onChange={(e) => setFlag('mode', e.target.checked ? 'on' : 'off')}
                    />
                    <span>Enforcement {flags.mode === 'on' ? 'ON' : 'OFF'}</span>
                </label>
                <p className="enforcement-hint">
                    Master switch. With Enforcement OFF the game plays exactly as before — nothing is gated.
                </p>
            </div>

            <fieldset className="enforcement-flags" disabled={flags.mode !== 'on'}>
                {FLAGS.map(f => (
                    <label key={f.key} className="enforcement-toggle" title={f.hint}>
                        <input
                            type="checkbox"
                            checked={!!flags[f.key]}
                            onChange={(e) => setFlag(f.key, e.target.checked)}
                        />
                        <span>{f.label}</span>
                        <em className="enforcement-flag-hint">{f.hint}</em>
                    </label>
                ))}
            </fieldset>

            <div className="enforcement-referee">
                <h4>Referee</h4>
                {referee ? (
                    <p>
                        Referee: <b>{referee.name}</b>
                        {referee.clientId === clientId && <span className="enforcement-referee-self"> (this browser)</span>}
                        {' — '}
                        <button className="ct-btn" onClick={() => setReferee(null)}>Release</button>
                    </p>
                ) : (
                    <p className="enforcement-hint">
                        No referee assigned — this browser (GM/localhost) holds authority by default.
                    </p>
                )}
                {!referee || referee.clientId !== clientId ? (
                    <label className="enforcement-claim">
                        <span>Claim referee for this browser as:</span>
                        <select value={claimName} onChange={(e) => setClaimName(e.target.value)}>
                            {characters.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <button
                            className="ct-btn ct-btn-primary"
                            disabled={!claimName}
                            onClick={() => setReferee({ name: claimName, clientId })}
                        >
                            <i className="fas fa-user-shield"></i> Claim Referee
                        </button>
                    </label>
                ) : null}
                <p className="enforcement-client-id">Client id: <code>{clientId}</code></p>
            </div>
        </div>
    )
}
