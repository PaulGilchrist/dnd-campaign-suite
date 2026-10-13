/**
 * L5-001 — per-creature turn-economy readout (initiative view).
 *
 * Renders only while enforcement.mode === 'on' (off ⇒ zero DOM, today's view
 * unchanged). Reads the shared campaign runtime keys, so it broadcasts with the
 * same SSE traffic the combat summary already produces.
 */
import React from 'react'
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getTurnState, remainingMovement } from '../../services/combat/turnState.js'
import CreatureBadge from '../common/CreatureBadge.jsx'
import './TurnEconomyStrip.css'

function formatMovement(used, remaining) {
    return `${used}/${used + remaining} ft`
}

const ICONS = {
    action: 'fa-hand-fist',
    bonusAction: 'fa-bolt-lightning',
    reaction: 'fa-shield-halved',
}

export default function TurnEconomyStrip({ creatureName, speedFeet }) {
    const enforcement = useRuntimeValue('campaign', 'enforcement')
    const turnState = useRuntimeValue('campaign', 'turnState')
    if (!enforcement || enforcement.mode !== 'on' || !creatureName) return null

    const entry = getTurnState(turnState, creatureName)
    const remaining = remainingMovement(turnState, creatureName, speedFeet)

    const badges = [
        { key: 'action', label: entry.actionsUsed >= 1 ? 'Action used' : 'Action', spent: entry.actionsUsed >= 1 },
        { key: 'bonusAction', label: entry.bonusActionsUsed >= 1 ? 'Bonus used' : 'Bonus', spent: entry.bonusActionsUsed >= 1 },
        { key: 'reaction', label: entry.reactionsUsed >= 1 ? 'Reaction used' : 'Reaction', spent: entry.reactionsUsed >= 1 },
    ]

    return (
        <div className='turn-economy-strip' aria-label={`Turn economy for ${creatureName}`}>
            <span className='turn-economy-name'>{creatureName}</span>
            {badges.map(b => (
                <CreatureBadge
                    key={b.key}
                    icon={ICONS[b.key]}
                    label={b.label}
                    cls={b.spent ? 'effect-debuff' : 'effect-buff'}
                    tooltip={`${b.label} this turn`}
                />
            ))}
            <CreatureBadge
                icon='fa-shoe-prints'
                label={formatMovement(entry.movementUsedFeet, remaining)}
                cls={remaining <= 0 ? 'effect-debuff' : 'effect-neutral'}
                tooltip={`${remaining} ft of movement remaining this turn`}
            />
        </div>
    )
}
