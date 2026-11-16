import { isCreaturePresent } from '../../services/combat/creaturePresence.js'

const SHAPE_LABELS = {
    sphere: 'Sphere',
    cylinder: 'Cylinder',
    cube: 'Cube',
    cone: 'Cone',
    line: 'Line',
}

function overlayLabel(o) {
    return o.label || `${SHAPE_LABELS[o.shape] || o.shape} (${o.radiusFt || o.distanceFt || o.sizeFt || 0}ft)`
}

// The single target-arm select for EVERY surface that arms a creature's
// target (improvement 2026-11-16 XD): the initiative card (CreatureCard.jsx)
// and the avatar-opened .mc-overlay stat modal header (MonsterCardBody.jsx).
// Both hosts pass the SAME lane handler (Initiative.jsx handleTargetChange →
// combatSummary runtime-store PATCH + SSE echo), so the two surfaces read and
// write one canonical targetName and stay in sync live without reload.
// Lifted verbatim out of CreatureCard.jsx — do not fork a second copy.
export default function TargetSelect({ creature, isLocalhost, isPlayerSummoned, allCreatures, overlays, onTargetChange }) {
    // Overlay targets are live ONLY on the PC cast lane (CharSpells
    // getTargetInfo SP-097 fallback → useLoggedDiceRollDamage 'overlay-'
    // branch → handleAoeDamage area adjudication). Monster damage chips
    // resolve their target through MonsterCardModal.getTarget()'s name
    // lookup, which can never match `overlay-<id>` — a monster with an
    // overlay armed rolls plain untargeted damage (targetName:undefined).
    // Suppress the inert options on monster cards (backlog
    // aoe-overlay-dead-lane trap fix).
    // Uncontrolled monster rows on visitor tabs render NO select at all (backlog
    // 2026-11-16 TA): the old permanently-disabled arm kept the card looking
    // delegable-to-anyone after the GM released control. Mirrors InitiativeControl's
    // visitor plain-value law (backlog 2026-11-11 LZ) — don't mount an
    // editable-looking control that can never be enabled on this device. The
    // predicate is verbatim the old `disabled` gate, so controlled monsters
    // (explicit controller or derived summon/form lanes) keep the live arm lane,
    // PC rows are untouched, and the GM sees the select in every state.
    if (creature.type !== 'player' && !isLocalhost && !isPlayerSummoned) return null
    const showOverlays = creature.type === 'player' && overlays.length > 0
    return (
        <div className='creature-target'>Target&nbsp;
            <select
                aria-label={`${creature.name} target`}
                data-testid="target-select"
                value={creature.targetName || ''}
                onChange={(e) => onTargetChange(creature.name, e.target.value)}
            >
                <option value="">— No Target —</option>
                {allCreatures
                    .filter(c => c.name !== creature.name && !c.secondTurn && isCreaturePresent(c))
                    .map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                    ))
                }
                {showOverlays && (
                    <optgroup label="─── Overlays ───">
                        {overlays.map(o => (
                            <option key={`overlay-${o.id}`} value={`overlay-${o.id}`}>
                                {overlayLabel(o)}
                            </option>
                        ))}
                    </optgroup>
                )}
            </select>
        </div>
    )
}
