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

/**
 * GM-movement advisory (owner decision 2026-11-10 — advisory only, zero
 * enforcement change). A monster/NPC row's strip shows used/ft all combat
 * because GM-driven token moves are free by design (design law:
 * useItemDragging.js header; movementBudget clamps player tokens only),
 * so the movement badge on a non-player row explains why the number
 * never drains while the GM drags the token around the board.
 */
const GM_MOVEMENT_ADVISORY =
    'GM-driven moves are not charged against this budget — monster movement is GM-adjudicated, so the drag clamp is player-token-only by design (these moves still provoke opportunity reactions).'

export default function TurnEconomyStrip({ creatureName, economyName, speedFeet, gmMovement }) {
    const enforcement = useRuntimeValue('campaign', 'enforcement')
    const turnState = useRuntimeValue('campaign', 'turnState')
    if (!enforcement || enforcement.mode !== 'on' || !creatureName) return null

    // CLA-360 display parity (economyNameFor law, navigationHandlers.js): a
    // (Second Turn) row's economy lives on the HOLDER's turnState key — every
    // charge writer and the gate resolve the seam, so the readout must too, or
    // the ACTIVE twin's strip shows a stale fresh face all turn. Callers pass
    // the row's own name as creatureName (display keeps twin provenance) and
    // the resolved holder via economyName; normal rows omit it (bytes unchanged).
    const readName = economyName || creatureName
    const entry = getTurnState(turnState, readName)
    const remaining = remainingMovement(turnState, readName, speedFeet)

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
                tooltip={gmMovement ? GM_MOVEMENT_ADVISORY : `${remaining} ft of movement remaining this turn`}
            />
        </div>
    )
}
