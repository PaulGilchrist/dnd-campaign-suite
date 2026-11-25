import { useEffect, useRef } from 'react'
import { isCreaturePresent } from '../../services/combat/creaturePresence.js'
import { consumePendingArmTarget, subscribeToArmTarget } from '../../services/ui/armTargetSignal.js'

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
export default function TargetSelect({ creature, isLocalhost, isPlayerSummoned, localCharacterName, allCreatures, overlays, onTargetChange, tvMode = false }) {
    // "Arm a target" deep link (backlog 2026-11-24 run BA): the sheet's loud
    // no-target refusal offers a button that navigates here and asks THIS
    // card's select to take focus, so the arm is one click away. Consumption
    // is name-matched and single-shot (armTargetSignal law): sibling cards
    // never eat the request, a card with no mountable select never clears it
    // (the visitor plain-span face simply stays on the board), and an
    // honored request never re-steals focus on a later visit. Per-client
    // focus only — this writes zero game state; arming stays the select's
    // own onChange lane.
    const selectRef = useRef(null)
    useEffect(() => {
        const honorArmTargetRequest = () => {
            if (selectRef.current && consumePendingArmTarget(creature.name)) {
                selectRef.current.focus()
            }
        }
        // Mount seam: the request fired while this view was unmounted (the
        // sheet's denial click navigates first); subscribe covers a request
        // arriving to an already-mounted board.
        honorArmTargetRequest()
        return subscribeToArmTarget(honorArmTargetRequest)
    }, [creature.name])
    // TV-mode GM card (owner decision 2026-11-23): the table-mounted screen is
    // shared with players, so a GM tab in TV mode takes the presentation door
    // wholesale — NO arm select on ANY row, even ones a visitor WOULD arm (the
    // device-played PC row, delegated monster rows): a GM tab plays no
    // character, and the card-level TvTargetChip carries the armed-target
    // readout. Visitor tabs are untouched in both modes.
    const gmDisplayTier = tvMode && isLocalhost
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
    // (explicit controller or derived summon/form lanes) keep the live arm lane.
    if (creature.type !== 'player' && (gmDisplayTier || (!isLocalhost && !isPlayerSummoned))) return null
    // PC-row ownership gate (bug-visitor-arms-any-pc-target-cross-player-write):
    // a visitor tab arms the target ONLY on the row its device plays. The
    // LAN-trust model (owner decision D2 — no accounts) has exactly one "mine"
    // signal a device genuinely owns: its own sidebar selection, threaded here
    // as localCharacterName (Players.jsx isTokenOwnedHere precedent). Foreign
    // players' cards render the target as plain read-only text — the same face
    // visitor HP already shows (CreatureHp.jsx plain span) — and the shared
    // write seam (createCreatureHandlers.applyTargetSelection) refuses the same
    // rows handler-side. The GM sees the live select in every state — except
    // TV mode, where the whole card is display-only (gmDisplayTier above).
    if (creature.type === 'player' && (gmDisplayTier || (!isLocalhost && creature.name !== localCharacterName))) {
        return (
            <div className='creature-target'>Target&nbsp;
                <span className='text-muted' data-testid="target-readonly" aria-label={`${creature.name} target`}>
                    {creature.targetName || '—'}
                </span>
            </div>
        )
    }
    const showOverlays = creature.type === 'player' && overlays.length > 0
    return (
        <div className='creature-target'>Target&nbsp;
            <select
                ref={selectRef}
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
