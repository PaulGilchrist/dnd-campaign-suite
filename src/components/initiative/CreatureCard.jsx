

import AvatarImage from '../common/AvatarImage.jsx'
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx'
import NpcAvatar from './NpcAvatar.jsx'
import CreatureHp from './CreatureHp.jsx'
import { getAbilityLabel } from '../../services/combat/conditions/conditionUtils.js'
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import ConditionEffectBadges from './ConditionEffectBadges.jsx'
import TurnEconomyStrip from './TurnEconomyStrip.jsx'
import utils from '../../services/ui/utils.js'

const FLESH_TO_STONE_PREFIX = '_fleshToStone_';
const PRISMATIC_SPRAY_INDIGO_PREFIX = '_prismaticSprayIndigo_';
const PRISMATIC_SPRAY_VIOLET_PREFIX = '_prismaticSprayViolet_';
import CreatureBadge from '../common/CreatureBadge.jsx'
import HpFeedback from './HpFeedback.jsx'
import AlliesButton from './AlliesButton.jsx'
import { isBuffActive } from '../../services/automation/common/buffToggle.js';
import { CONDITION_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc, clearUnbreakableMajesty } from '../../services/combat/auras/unbreakableMajesty.js'
import { sendFleshToStoneResult, sendPrismaticSprayIndigoResult, sendPrismaticSprayVioletResult } from '../../services/combat/conditions/savePromptService.js'
import { isResilientSphereActive, getResilientSphereSource } from '../../services/combat/automation/automationPassives.js'
import { getCreatureController } from '../../services/encounters/creatureControl.js'
import { isCreaturePresent } from '../../services/combat/creaturePresence.js'
import { cleanupWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js'
import { revertPolymorph } from '../../services/automation/handlers/spells/polymorphService.js'
import { revertAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js'
import { revertShapechange } from '../../services/automation/handlers/spells/shapechangeService.js'
import { isSecondTurnEntry } from '../../services/combat/thiefsReflexesService.js'
import { resolveSpeedFeet } from '../../services/combat/turnState.js'

const SHAPE_LABELS = {
    sphere: 'Sphere',
    cylinder: 'Cylinder',
    cube: 'Cube',
    cone: 'Cone',
    line: 'Line',
}

const STARRY_CONSTELLATION_NOTES = {
    Archer: '; Bonus Action: Luminous Arrow attack',
    Chalice: '; Healing spells restore extra HP to allies within 30 feet',
}
const STARRY_DEFAULT_NOTE = '; Concentration checks: Treat d20 rolls of 9 or lower as 10'

function hasFormSource(creature) {
    return creature.wildShapeSource || creature.polymorphSource || creature.animalShapesSource || creature.shapechangeSource
}

// Control resolution (Phase 2) lives in services/encounters/creatureControl.js —
// explicit GM assignment wins, then the historical summon/form-source lanes.
// (Former computePlayerSummoned removed per code-simplicity: single source.)

function findSanctuaryInfo(allCreatures, creatureName, campaignName) {
    for (const other of allCreatures) {
        if (other.type !== 'player') continue;
        const active = getRuntimeValue(other.name, 'naturesSanctuaryActive', campaignName);
        if (!active) continue;
        const creatureList = getRuntimeValue(other.name, 'naturesSanctuaryCreatures', campaignName) || [];
        if (creatureList.includes(creatureName)) {
            const resistance = getRuntimeValue(other.name, 'naturesSanctuaryResistance', campaignName) || 'None';
            return { druid: other.name, resistance };
        }
    }
    return null;
}

function NpcRemoveButton({ creature, isLocalhost, onRemoveNpc }) {
    if (creature.type === 'player' || !isLocalhost) return null
    return (
        <button
            className="npc-remove-btn"
            onClick={() => onRemoveNpc(creature.name)}
            type="button"
            title="Remove NPC"
        >
            <i className="fa-solid fa-xmark"></i>
        </button>
    )
}

// Split-party toggle (GM-only, player rows): marks the PC away — their card
// greys out, parks at the back of the board, and vanishes from target lists —
// or rejoins them at the end-of-round initiative slot. Tracker authorship is
// localhost-gated like initiative stamping (bug-player-clients-can-hijack-
// initiative family); the write + audit lane lives in createCreatureHandlers.
function AwayToggle({ creature, isLocalhost, onToggleAway }) {
    if (creature.type !== 'player' || !isLocalhost || !onToggleAway) return null
    const away = creature.away === true
    // Honest slot copy (FV 2026-11-09 backlog): second-turn twins rejoin by
    // re-anchoring to the holder's second-turn slot (holder initiative − 10 —
    // secondTurnAnchorInitiative in creaturePresence.js), NOT the end-of-round
    // slot. Without a holderName the anchor can't resolve, so the twin falls
    // through to the end-of-round law and the default copy stays honest.
    const rejoinTitle = (isSecondTurnEntry(creature) && creature.holderName)
        ? `Rejoin ${creature.name} to the encounter (initiative re-anchors to ${creature.holderName}'s second-turn slot)`
        : `Rejoin ${creature.name} to the encounter (initiative lands at the end of the round)`
    return (
        <button
            className={`away-toggle-btn${away ? ' away-toggle-btn-active' : ''}`}
            onClick={() => onToggleAway(creature.name)}
            type="button"
            title={away ? rejoinTitle : `Mark ${creature.name} away from the encounter (split party)`}
            aria-label={away ? `Rejoin ${creature.name} to initiative` : `Mark ${creature.name} away from initiative`}
        >
            <i className={away ? 'fa-solid fa-person-walking-arrow-right' : 'fa-solid fa-person-walking'}></i>
        </button>
    )
}

function CardAvatar({ creature, isLocalhost, isPlayerSummoned, npcImage, campaignName, characters, onViewCharacter, onNpcClick }) {
    const handleAvatarClick = () => {
        if (isLocalhost || isPlayerSummoned) {
            onNpcClick(creature, { allowNonLocalhost: true });
        }
    }
    const formSource = hasFormSource(creature)
    if (creature.polymorphObject) {
        return (
            <div className='creature-avatar'>
                <div className="npc-avatar" onClick={handleAvatarClick}>
                    <i className={`fa-solid ${creature.polymorphObject.icon || 'fa-circle'}`}></i>
                </div>
            </div>
        )
    }
    if (creature.type === 'player' && !formSource) {
        return (
            <div className='creature-avatar'>
                <AvatarImage name={creature.name} imagePath={creature.imagePath} campaignName={campaignName} size={150} onClick={onViewCharacter ? () => onViewCharacter(characters.find(ch => utils.getName(ch.name) === creature.name)) : undefined} />
            </div>
        )
    }
    return (
        <div className='creature-avatar'>
            <NpcAvatar
                name={formSource ? (creature.beastName || creature.formName || creature.name) : creature.name}
                imageUrl={npcImage}
                imagePath={formSource ? undefined : creature.imagePath}
                campaignName={campaignName}
                onClick={handleAvatarClick}
            />
        </div>
    )
}

function CardName({ creature, campaignNpcs, onNameChange, isLocalhost }) {
    const formName = creature.beastName || creature.formName
    return (
        <div className='creature-name'>
            {creature.polymorphObject ? (
                <span>{creature.polymorphObject.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            ) : creature.type === 'npc' && isLocalhost ? (
                // GM-only rename: MonsterNameAutocomplete posts every keystroke through
                // handleNameChange → renameNpc + full combatSummary writes (the spawn/
                // rename half of bug-player-clients-can-hijack-initiative). Read-only
                // tabs render the plain name, mirroring NpcRemoveButton's strip above.
                // aria-label "<Name> name" gives the editable lane the same stable
                // accessible-name probe as the PC/.creature-name span lane
                // (backlog 2026-11-08: one census resolves every initiative card).
                <MonsterNameAutocomplete
                    value={creature.name}
                    ariaLabel={`${creature.name} name`}
                    onChange={(newVal) => onNameChange(creature.name, newVal)}
                    npcs={campaignNpcs}
                    showBadge={campaignNpcs.some(n => n.name?.toLowerCase() === creature.name?.toLowerCase())}
                />
            ) : (
                <span>{hasFormSource(creature) && formName ? formName : creature.name}</span>
            )}
        </div>
    )
}

function TempHpDisplay({ creature, campaignName }) {
    const formLinked = creature.type !== 'player' || creature.wildShapeSource || creature.polymorphSource || creature.animalShapesSource
    if (!formLinked) return null
    const creatureTempHp = getRuntimeValue(creature.name, 'tempHp', campaignName) || 0
    if (creatureTempHp <= 0) return null
    return (
        <div className="temp-hp-display">
            <i className="fa-solid fa-shield"></i> Temp HP: {creatureTempHp}
        </div>
    )
}

function InitiativeControl({ creature, onInitiativeChange, isLocalhost, isAway }) {
    return (
        <div className='creature-initiative'>Initiative&nbsp;
            <input
                data-testid="initiative-input"
                min="0"
                // GM-only bookkeeping: blur-stamps initiative into combatSummary and
                // flips the session phase (bug-player-clients-can-hijack-initiative).
                // Disabled keeps the read value visible with the card's own styling,
                // mirroring TargetSelect's disabled gate. Split-party law: an AWAY row
                // holds NO initiative slot (initiative is wiped on split), so the input
                // is read-only there too — the GM rejoins the hero first
                // (bug-away-card-initiative-input-resurrects-slot). The presence-keyed
                // input remounts on split/rejoin so the uncontrolled defaultValue
                // re-syncs to the store value instead of lingering on a stale roll.
                key={isAway ? 'away' : 'present'}
                disabled={!isLocalhost || isAway}
                title={isAway ? `${creature.name} is away from the party — rejoin them before setting initiative` : undefined}
                onBlur={(event) => onInitiativeChange(creature.name, event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.target.blur()
                    }
                }}
                type="number"
                defaultValue={creature.initiative ?? ''}
                placeholder="Init"
            />
        </div>
    )
}

function overlayLabel(o) {
    return o.label || `${SHAPE_LABELS[o.shape] || o.shape} (${o.radiusFt || o.distanceFt || o.sizeFt || 0}ft)`
}

function TargetSelect({ creature, isLocalhost, isPlayerSummoned, allCreatures, overlays, onTargetChange }) {
    // Overlay targets are live ONLY on the PC cast lane (CharSpells
    // getTargetInfo SP-097 fallback → useLoggedDiceRollDamage 'overlay-'
    // branch → handleAoeDamage area adjudication). Monster damage chips
    // resolve their target through MonsterCardModal.getTarget()'s name
    // lookup, which can never match `overlay-<id>` — a monster with an
    // overlay armed rolls plain untargeted damage (targetName:undefined).
    // Suppress the inert options on monster cards (backlog
    // aoe-overlay-dead-lane trap fix).
    const showOverlays = creature.type === 'player' && overlays.length > 0
    return (
        <div className='creature-target'>Target&nbsp;
            <select
                aria-label={`${creature.name} target`}
                data-testid="target-select"
                value={creature.targetName || ''}
                onChange={(e) => onTargetChange(creature.name, e.target.value)}
                disabled={creature.type !== 'player' && !isLocalhost && !isPlayerSummoned}
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

function ConditionBadgeRow({ cond, canRoll, isLocalhost, creatureName, onRollConditionSave, onBreakCondition }) {
    const condCls = cond.key === 'invisible' ? 'effect-buff' : 'effect-condition'
    // Owner ruling 2026-11-09 (bug-condition-badge-no-dc-auto-success-removal):
    // the EffectAdder's "No saving throw" copy stands — a condition added with a
    // blank DC (buildRuntimeConditions coerces it to 0, falsy) must NOT offer a
    // save roll. Same dc branch as the label/tooltip props below: no DC, no
    // click lane, the badge renders as an inert span (CreatureBadge's non-
    // interactive face) and the condition is removable only via × / consumer
    // lanes. Left ungated, every d20 beat DC 0 → guaranteed removal.
    const canSaveRoll = canRoll && !!cond.dc
    return (
        <CreatureBadge
            key={cond.id || cond.key}
            label={cond.dc ? `${cond.label} DC ${cond.dc}` : cond.label}
            cls={condCls}
            tooltip={cond.dc ? `${cond.label}\n\n${CONDITION_DESCRIPTIONS[cond.label] || ''}\n\nDC ${cond.dc} ${getAbilityLabel(cond.ability)}` : (CONDITION_DESCRIPTIONS[cond.label] || cond.label)}
            onClick={canSaveRoll ? () => onRollConditionSave(creatureName, cond) : undefined}
            disabled={!canSaveRoll}
            removable={isLocalhost}
            onRemove={() => onBreakCondition(creatureName, cond)}
        />
    )
}

function SaveTrackingPrompt({ isLocalhost, data, campaignName, creatureName, icon, title, counterLabel, staticText, successTitle, failureTitle, sendResult }) {
    if (!isLocalhost || !data) return null
    return (
        <div className="flesh-to-stone-prompt">
            <span className="flesh-to-stone-label">
                <i className={`fa-solid ${icon}`}></i> {title}
            </span>
            <div className="flesh-to-stone-row">
                <span className="flesh-to-stone-progress">
                    {counterLabel ? `${counterLabel}: ${data.successes}/3 | Failures: ${data.failures}/3` : staticText}
                </span>
            </div>
            <div className="flesh-to-stone-row flesh-to-stone-actions">
                <button
                    className="flesh-to-stone-btn success"
                    onClick={() => {
                        sendResult(campaignName, creatureName, { success: true });
                    }}
                    title={successTitle}
                >
                    <i className="fa-solid fa-check"></i> Success
                </button>
                <button
                    className="flesh-to-stone-btn failure"
                    onClick={() => {
                        sendResult(campaignName, creatureName, { success: false });
                    }}
                    title={failureTitle}
                >
                    <i className="fa-solid fa-xmark"></i> Failure
                </button>
            </div>
        </div>
    )
}

function HuntersMarkBadge({ allCreatures, creatureName, isLocalhost, campaignName }) {
    const markCreature = (allCreatures || []).find(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === creatureName)
    if (!markCreature) return null
    return (
        <CreatureBadge
            icon='fa-crosshairs'
            label="Hunter's Mark"
            cls='effect-neutral'
            tooltip={`Marked by ${markCreature.name}`}
            removable={isLocalhost}
            onRemove={() => {
                const concentration = getRuntimeValue(markCreature.name, 'concentration');
                if (concentration?.spell === "Hunter's Mark") {
                    setRuntimeValue(markCreature.name, 'concentration', null, campaignName);
                }
            }}
        />
    )
}

function MajestyBadge({ creature, isLocalhost, campaignName }) {
    if (creature.type !== 'player' || !isUnbreakableMajestyActive(creature.name, campaignName)) return null
    const majestyDc = getUnbreakableMajestySaveDc(creature.name, campaignName)
    return (
        <CreatureBadge
            icon='fa-shield-halved'
            label={`Majesty DC ${majestyDc}`}
            cls='effect-buff'
            tooltip={`Unbreakable Majesty (DC ${majestyDc})\n\nFirst attack per turn that hits forces attacker to make a CHA save or the attack misses.\nClick to deactivate.`}
            onClick={isLocalhost ? () => clearUnbreakableMajesty(creature.name, campaignName) : undefined}
            disabled={!isLocalhost}
            removable={isLocalhost}
            onRemove={() => clearUnbreakableMajesty(creature.name, campaignName)}
        />
    )
}

// GM-only control assignment (Phase 2). Handing an NPC/monster to a player
// stamps `controller` on the roster row; the owning device's card opens and
// rolls through the exact same monster-action lanes the GM uses. Release
// falls back to the derived lane (summons stay with their caster).
function ControlRow({ creature, allCreatures, isLocalhost, controllerName, onControllerChange }) {
    if (!isLocalhost || creature.type !== 'npc' || !onControllerChange) return null
    const players = allCreatures.filter(c => c.type === 'player')
    if (!players.length) return null
    const explicit = creature.controller || ''
    const autoNote = !explicit && controllerName ? `auto: ${controllerName}` : ''
    return (
        <div className='creature-control'>
            <i className='fa-solid fa-gamepad'></i>&nbsp;
            <select
                aria-label={`Assign who controls ${creature.name}`}
                data-testid="control-select"
                value={explicit}
                onChange={(e) => onControllerChange(creature.name, e.target.value || null)}
                title={`Assign who controls ${creature.name} (their device can roll from its card)`}
            >
                <option value=''>— GM —</option>
                {players.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                ))}
            </select>
            {autoNote && <span className='creature-control-auto'>{autoNote}</span>}
        </div>
    )
}

// Device-side turn cue: shown on a viewer's screen when a creature THEY
// control becomes the active combatant (the GM view already spotlights it).
function YourTurnCue({ isActive, isLocalhost, controlled }) {
    if (!isActive || isLocalhost || !controlled) return null
    return (
        <div className='your-turn-cue' role='status'>
            <i className='fa-solid fa-clock'></i> Your turn!
        </div>
    )
}

// TV-mode target readout replacing the (CSS-hidden) TargetSelect dropdown —
// overlay targets keep their picker, so plain names only.
function TvTargetChip({ tvMode, targetName }) {
    if (!tvMode || !targetName || String(targetName).startsWith('overlay-')) return null
    return (
        <div className='tv-target-chip'>
            <i className='fa-solid fa-crosshairs'></i> → {targetName}
        </div>
    )
}

function WildShapeBadge({ creature, isLocalhost, campaignName }) {
    if (!isBuffActive(creature.name, 'Wild Shape', campaignName)) return null
    return (
        <CreatureBadge
            icon='fa-paw'
            label='Wild Shape'
            cls='effect-buff'
            tooltip={creature.beastName
                ? `Wild Shape: Animal form active as ${creature.beastName} — spellcasting blocked, resistance types apply`
                : 'Wild Shape: Animal form active — spellcasting blocked, resistance types apply'}
            removable={isLocalhost}
            onRemove={() => {
                cleanupWildShape(creature.name, campaignName);
            }}
        />
    )
}

function PolymorphBadge({ creature, isLocalhost, campaignName, active }) {
    if (!active) return null
    return (
        <CreatureBadge
            icon='fa-paw'
            label='Polymorph'
            cls='effect-buff'
            tooltip={creature.beastName
                ? `Polymorph: Transformed into ${creature.beastName} — game statistics replaced, reverts at 0 HP or when the caster loses concentration`
                : 'Polymorph: Transformed into a beast — game statistics replaced, reverts at 0 HP or when the caster loses concentration'}
            removable={isLocalhost}
            onRemove={() => {
                revertPolymorph(creature.name, campaignName);
            }}
        />
    )
}

function AnimalShapesBadge({ creature, isLocalhost, campaignName, active }) {
    if (!active) return null
    return (
        <CreatureBadge
            icon='fa-paw'
            label='Animal Shapes'
            cls='effect-buff'
            tooltip={creature.beastName
                ? `Animal Shapes: Transformed into ${creature.beastName} — game statistics replaced, retains original HP`
                : 'Animal Shapes: Transformed into a beast — game statistics replaced, retains original HP'}
            removable={isLocalhost}
            onRemove={() => {
                revertAnimalShapes(creature.name, campaignName);
            }}
        />
    )
}

function ShapechangeBadge({ creature, isLocalhost, campaignName, active }) {
    if (!active) return null
    return (
        <CreatureBadge
            icon='fa-paw'
            label='Shapechange'
            cls='effect-buff'
            tooltip={creature.formName
                ? `Shapechange: Transformed into ${creature.formName} — game statistics replaced, reverts when concentration is broken`
                : 'Shapechange: Transformed — game statistics replaced, reverts when concentration is broken'}
            removable={isLocalhost}
            onRemove={() => {
                revertShapechange(creature.name, campaignName);
            }}
        />
    )
}

function StarryFormBadge({ creature, isLocalhost, campaignName }) {
    const starryBuffs = getRuntimeValue(creature.name, 'activeBuffs') || [];
    const starryFormBuff = Array.isArray(starryBuffs) ? starryBuffs.find(b => b.name === 'Starry Form' && b.constellation) : null;
    if (!starryFormBuff) return null;
    const constellation = starryFormBuff.constellation;
    return (
        <CreatureBadge
            icon='fa-star'
            label={`Starry Form - ${constellation}`}
            cls='effect-buff'
            tooltip={`Starry Form (${constellation} constellation): Luminous form active — Resistance to Bludgeoning, Piercing, and Slashing damage${STARRY_CONSTELLATION_NOTES[constellation] || STARRY_DEFAULT_NOTE}`}
            removable={isLocalhost}
            onRemove={() => {
                const newBuffs = starryBuffs.filter(b => b.name !== 'Starry Form');
                setRuntimeValue(creature.name, 'activeBuffs', newBuffs, campaignName);
                const campaignEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const filteredEffects = campaignEffects.filter(te => !(te.effect === 'starry_form' && te.source === creature.name));
                if (filteredEffects.length !== campaignEffects.length) {
                    setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName, true);
                }
            }}
        />
    )
}

function WrathOfTheSeaBadge({ creature, isLocalhost, campaignName }) {
    if (creature.type !== 'player' || !getRuntimeValue(creature.name, 'wrathOfTheSeaActive', campaignName)) return null
    return (
        <CreatureBadge
            icon='fa-water'
            label='Wrath of the Sea'
            cls='effect-buff'
            tooltip='Wrath of the Sea: Ocean spray emanation active — Bonus Action to force CON save or take WIS modifier d6 Cold damage'
            removable={isLocalhost}
            onRemove={() => setRuntimeValue(creature.name, 'wrathOfTheSeaActive', false, campaignName)}
        />
    )
}

function SanctuaryBadge({ creature, sanctuaryInfo, isLocalhost, campaignName }) {
    if (!sanctuaryInfo) return null
    return (
        <CreatureBadge
            icon='fa-leaf'
            label='Sanctuary'
            cls='effect-buff'
            tooltip={`Nature's Sanctuary: Half Cover (AC +2), ${sanctuaryInfo.resistance} resistance. Protected by ${sanctuaryInfo.druid}'s Nature's Sanctuary`}
            removable={isLocalhost}
            onRemove={() => {
                const creatures = getRuntimeValue(sanctuaryInfo.druid, 'naturesSanctuaryCreatures', campaignName) || [];
                const filtered = creatures.filter(c => c !== creature.name);
                setRuntimeValue(sanctuaryInfo.druid, 'naturesSanctuaryCreatures', filtered, campaignName);
            }}
        />
    )
}

function RecklessAttackBadge({ creature, isLocalhost, campaignName, active }) {
    if (!active) return null
    return (
        <CreatureBadge
            icon='fa-shield-halved'
            label='Reckless Attack'
            cls='effect-debuff'
            tooltip='Reckless Attack: Advantage on Strength attack rolls, attack rolls against you have Advantage'
            removable={isLocalhost}
            onRemove={() => {
                const existingEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const filtered = existingEffects.filter(te => !(te.target === creature.name && te.effect === 'reckless_attack'));
                setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
            }}
        />
    )
}

function SummonedBadges({ creature, isLocalhost, campaignName, myTargetEffects }) {
    return myTargetEffects.filter(te => te.effect === 'summoned').map(te => (
        <CreatureBadge
            key={`summoned-${te.source}`}
            icon='fa-hand-sparkles'
            label={te.source ? `Summoned (${te.source})` : 'Summoned'}
            cls='effect-summoned'
            tooltip={te.source ? `Summoned by ${te.source}` : 'Summoned creature'}
            removable={isLocalhost}
            onRemove={() => {
                const effects = getRuntimeValue('campaign', 'targetEffects') || [];
                const filtered = effects.filter(e => !(e.target === creature.name && e.effect === 'summoned' && e.source === te.source));
                setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
            }}
        />
    ))
}

function DeathWardBadge({ creature, isLocalhost, campaignName }) {
    const buffs = getRuntimeValue(creature.name, 'activeBuffs') || [];
    const deathWardBuff = Array.isArray(buffs) ? buffs.find(b => b.name === 'Death Ward' && b.effect === 'death_ward') : null;
    if (!deathWardBuff) return null;
    return (
        <CreatureBadge
            icon='fa-shield-halved'
            label='Death Ward'
            cls='effect-buff'
            tooltip={`Death Ward: Protected from death by ${deathWardBuff.sourceCharacter || 'unknown'}. First time target would drop to 0 HP, drops to 1 HP instead.`}
            removable={isLocalhost}
            onRemove={() => {
                const filtered = buffs.filter(b => !(b.name === 'Death Ward' && b.effect === 'death_ward'));
                setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
            }}
        />
    )
}

function ResilientSphereBadge({ creature, isLocalhost, campaignName }) {
    if (!isResilientSphereActive(creature.name, campaignName)) return null
    const sourceName = getResilientSphereSource(creature.name, campaignName) || 'Unknown'
    return (
        <CreatureBadge
            icon='fa-circle'
            label='Resilient Sphere'
            cls='effect-debuff'
            tooltip={`Enclosed in Resilient Sphere by ${sourceName}. Nothing passes through the barrier. Expires on concentration loss.`}
            removable={isLocalhost}
            onRemove={() => {
                const effects = getRuntimeValue('campaign', 'targetEffects') || [];
                const filtered = effects.filter(e => !(e.target === creature.name && e.effect === 'resilient_sphere'));
                setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
            }}
        />
    )
}

function ConditionsSection({
    creature,
    isLocalhost,
    isAway,
    campaignName,
    allCreatures,
    characters,
    mapName,
    myTargetEffects,
    effectSubjectName,
    sanctuaryInfo,
    fleshToStoneData,
    prismaticIndigoData,
    prismaticVioletData,
    hasSpeedyOpportunityDisadvantage,
    hasSpeedyDifficultTerrainIgnore,
    coronaDisadvantage,
    onRollConditionSave,
    onBreakCondition,
    onOpenEffectAdder,
    onRollConcentrationSave,
    onBreakConcentration,
}) {
    const canRoll = creature.type === 'player' || isLocalhost
    const polymorphActive = myTargetEffects.some(te => te.effect === 'polymorph')
    const animalShapesActive = myTargetEffects.some(te => te.effect === 'animal_shapes')
    const shapechangeActive = myTargetEffects.some(te => te.effect === 'shapechange')
    const recklessAttackActive = myTargetEffects.some(te => te.effect === 'reckless_attack')
    // CLA-360 display parity: the Add modal writes concentration on the
    // HOLDER's cs row (ST rows keep theirs null), so a second-turn row shows
    // the holder's active concentration too — effectSubjectName differs from
    // creature.name only for ST rows. ×/save-click act on the holder's row
    // (the handlers look rows up by name), auditing the holder, never the
    // synthetic bucket (same law as 583d078ff / 930393775).
    const displayedConcentration = creature.concentration
        || (effectSubjectName !== creature.name
            ? (allCreatures?.find(c => c.name === effectSubjectName)?.concentration ?? null)
            : null)
    return (
        <div className='creature-conditions'>
            {creature.conditions?.map(cond => {
                if (!cond || typeof cond !== 'object') return null;
                return (
                    <ConditionBadgeRow
                        key={cond.id || cond.key}
                        cond={cond}
                        canRoll={canRoll}
                        isLocalhost={isLocalhost}
                        creatureName={creature.name}
                        onRollConditionSave={onRollConditionSave}
                        onBreakCondition={onBreakCondition}
                    />
                )
            })}
            {/* L5-001: enforcement economy readout (renders nothing while enforcement off).
                CLA-360: ST rows read the holder's turnState key (effectSubjectName, the same
                remap ConditionEffectBadges below uses); the strip label stays the row's name.
                Movement-budget parity: the denominator resolves through the same sources the
                drag engine and the Initiative header strip use — the row's stamped speed
                (EB-join monsters carry the bestiary walk speed in feet) → the sheet's
                computedStats.speed via the effectSubjectName (holder-remapped) character
                lookup → the 30 ft default. */}
            <TurnEconomyStrip
                creatureName={creature.name}
                economyName={effectSubjectName}
                speedFeet={resolveSpeedFeet({ speed: creature.speed, name: effectSubjectName }, characters)}
                // GM-movement advisory (design law in useItemDragging.js):
                // non-player rows (monster/NPC) get the "GM-driven moves are
                // not charged" tooltip on the movement segment; player rows
                // keep the honest remaining-ft copy byte-unchanged.
                // Card face is space-rich: also show the compact visible
                // "(GM-driven)" hint (the header strip omits it and relies on
                // the title + aria-label advisory lanes).
                gmMovement={creature.type !== 'player'}
                showGmHint
            />
            <ConditionEffectBadges conditions={creature.conditions?.filter(c => c && typeof c === 'object' && c.key) || []} targetEffects={myTargetEffects} creatureName={effectSubjectName} campaignName={campaignName} allCreatures={allCreatures} hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage} hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore} isLocalhost={isLocalhost} coronaDisadvantage={coronaDisadvantage} characters={characters} activeMapName={mapName} onRollConditionSave={canRoll ? onRollConditionSave : undefined} />
            {/* Owner ruling 2026-11-10 (improve gate-away-condition-add): an AWAY
                row is not a valid manual-add target — the card-level Add door is
                ABSENT (not a disabled stub), matching the automated lanes that
                already hide away creatures (§13 presence law). Removal (badge ×)
                above and below stays permitted so pre-existing conditions and
                lingering world effects can still be cleaned off an away card. */}
            {isLocalhost && !isAway && (
                <button
                    className='effect-add-btn'
                    onClick={() => onOpenEffectAdder(creature, 'conditions')}
                    type='button'
                    title={`Add condition, effect, or concentration to ${creature.name}`}
                    aria-label={`Add condition, effect, or concentration to ${creature.name}`}
                >
                    <i className='fa-solid fa-wand-magic-sparkles'></i> Add
                </button>
            )}
            {displayedConcentration ? (
                <CreatureBadge
                    icon='fa-spinner'
                    label={`${displayedConcentration.spell} DC ${displayedConcentration.dc}`}
                    cls='effect-neutral'
                    tooltip={`Concentration: ${displayedConcentration.spell} (DC ${displayedConcentration.dc} Constitution)`}
                    onClick={isLocalhost ? () => onRollConcentrationSave(effectSubjectName) : undefined}
                    removable={isLocalhost}
                    onRemove={() => onBreakConcentration(effectSubjectName)}
                />
            ) : null}
            <SaveTrackingPrompt isLocalhost={isLocalhost} data={fleshToStoneData} campaignName={campaignName} creatureName={creature.name} icon="fa-dungeon" title="Flesh to Stone" counterLabel="Saves" successTitle="Record successful save" failureTitle="Record failed save" sendResult={sendFleshToStoneResult} />
            <SaveTrackingPrompt isLocalhost={isLocalhost} data={prismaticIndigoData} campaignName={campaignName} creatureName={creature.name} icon="fa-eye" title="Prismatic Spray (Indigo)" counterLabel="CON Saves" successTitle="Record successful CON save" failureTitle="Record failed CON save" sendResult={sendPrismaticSprayIndigoResult} />
            <SaveTrackingPrompt isLocalhost={isLocalhost} data={prismaticVioletData} campaignName={campaignName} creatureName={creature.name} icon="fa-door-open" title="Prismatic Spray (Violet)" staticText="WIS Save (caster's next turn)" successTitle="Record successful WIS save" failureTitle="Record failed WIS save" sendResult={sendPrismaticSprayVioletResult} />
            <HuntersMarkBadge allCreatures={allCreatures} creatureName={creature.name} isLocalhost={isLocalhost} campaignName={campaignName} />
            <MajestyBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} />
            <WildShapeBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} />
            <PolymorphBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} active={polymorphActive} />
            <AnimalShapesBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} active={animalShapesActive} />
            <ShapechangeBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} active={shapechangeActive} />
            <StarryFormBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} />
            <WrathOfTheSeaBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} />
            <SanctuaryBadge creature={creature} sanctuaryInfo={sanctuaryInfo} isLocalhost={isLocalhost} campaignName={campaignName} />
            <RecklessAttackBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} active={recklessAttackActive} />
            <SummonedBadges creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} myTargetEffects={myTargetEffects} />
            <DeathWardBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} />
            <ResilientSphereBadge creature={creature} isLocalhost={isLocalhost} campaignName={campaignName} />
        </div>
    )
}

function CreatureCard({
    creature,
    isActive,
    isLocalhost,
    npcImage,
    campaignNpcs,
    overlays,
    onRemoveNpc,
    onNpcClick,
    onNameChange,
    onHpChange,
    onInitiativeChange,
    onTargetChange,
    onRollConditionSave,
    onBreakCondition,
    onOpenEffectAdder,
    onRollConcentrationSave,
    onBreakConcentration,
    allCreatures,
    campaignName,
    hasSpeedyOpportunityDisadvantage,
    hasSpeedyDifficultTerrainIgnore,
    coronaDisadvantage,
    characters,
    mapName,
    onViewCharacter,
    tvMode = false,
    hpEvent = null,
    onHpFeedbackDone,
    onControllerChange,
    onEditAllies,
    onToggleAway,
}) {
    const isUnconscious = creature.currentHp <= 0
    const isAway = creature.type === 'player' && creature.away === true
    const allTargetEffects = useRuntimeValue('campaign', 'targetEffects') ?? [];
    // CLA-360 display parity (mirrors openEffectAdder Initiative.jsx:502 /
    // badge × 583d078ff): a structural second-turn row DISPLAYS and REMOVES
    // te/concentration via the holder's real name — the Add modal writes the
    // holder's rows, so filtering by the synthetic name left the row card
    // blind to them. Non-second-turn cards resolve to their own name (bytes
    // unchanged), and the holder card keeps showing its own badges.
    const effectSubjectName = isSecondTurnEntry(creature) && creature.holderName
        ? creature.holderName
        : creature.name
    const myTargetEffects = allTargetEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === effectSubjectName;
    });
    const saveTrackingKey = FLESH_TO_STONE_PREFIX + creature.name.replace(/\s+/g, '_');
    const fleshToStoneData = useRuntimeValue('campaign', saveTrackingKey, campaignName);
    const prismaticIndigoKey = PRISMATIC_SPRAY_INDIGO_PREFIX + creature.name.replace(/\s+/g, '_');
    const prismaticIndigoData = useRuntimeValue('campaign', prismaticIndigoKey, campaignName);
    const prismaticVioletKey = PRISMATIC_SPRAY_VIOLET_PREFIX + creature.name.replace(/\s+/g, '_');
    const prismaticVioletData = useRuntimeValue('campaign', prismaticVioletKey, campaignName);
    const controllerName = getCreatureController(creature, allCreatures, myTargetEffects);
    const isPlayerSummoned = controllerName !== null;
    const sanctuaryInfo = findSanctuaryInfo(allCreatures, creature.name, campaignName);

    return (
        <div className={`creature-card ${creature.type} ${isActive ? 'active' : ''} ${isUnconscious ? 'creature-unconscious' : ''} ${isAway ? 'creature-away' : ''}`}>
            <HpFeedback creatureName={creature.name} hpEvent={hpEvent} onDone={onHpFeedbackDone} />
            <NpcRemoveButton creature={creature} isLocalhost={isLocalhost} onRemoveNpc={onRemoveNpc} />
            <AwayToggle creature={creature} isLocalhost={isLocalhost} onToggleAway={onToggleAway} />
            <CardAvatar creature={creature} isLocalhost={isLocalhost} isPlayerSummoned={isPlayerSummoned} npcImage={npcImage} campaignName={campaignName} characters={characters} onViewCharacter={onViewCharacter} onNpcClick={onNpcClick} />
            <CardName creature={creature} campaignNpcs={campaignNpcs} onNameChange={onNameChange} isLocalhost={isLocalhost} />
            {isAway && (
                <CreatureBadge
                    icon='fa-person-walking'
                    label='Away'
                    cls='effect-neutral'
                    tooltip='Split from the party — skipped by initiative and hidden from target lists. The GM can rejoin them at the end of the round.'
                />
            )}
            {creature.type === 'npc' && /^NPC \d+$/.test(creature.name) && creature.currentHp === 10 && creature.maxHp === 10 && (
                <div className='npc-statless-hint text-muted'>
                    <i className='fa-solid fa-circle-info'></i> Statless default · 10 HP (AC 10)
                </div>
            )}
            <CreatureHp
                creature={creature}
                isLocalhost={isLocalhost}
                onChange={onHpChange}
                isPlayerSummoned={isPlayerSummoned}
                tvMode={tvMode}
            />
            <TempHpDisplay creature={creature} campaignName={campaignName} />
            <InitiativeControl creature={creature} onInitiativeChange={onInitiativeChange} isLocalhost={isLocalhost} isAway={isAway} />
            <TargetSelect creature={creature} isLocalhost={isLocalhost} isPlayerSummoned={isPlayerSummoned} allCreatures={allCreatures} overlays={overlays} onTargetChange={onTargetChange} />
            <ControlRow creature={creature} allCreatures={allCreatures} isLocalhost={isLocalhost} controllerName={controllerName} onControllerChange={onControllerChange} />
            <AlliesButton creature={creature} isLocalhost={isLocalhost} onEditAllies={onEditAllies} />
            <TvTargetChip tvMode={tvMode} targetName={creature.targetName} />
            <YourTurnCue isActive={isActive} isLocalhost={isLocalhost} controlled={isPlayerSummoned} />
            <ConditionsSection
                creature={creature}
                fleshToStoneData={fleshToStoneData}
                prismaticIndigoData={prismaticIndigoData}
                prismaticVioletData={prismaticVioletData}
                isLocalhost={isLocalhost}
                isAway={isAway}
                campaignName={campaignName}
                allCreatures={allCreatures}
                characters={characters}
                mapName={mapName}
                myTargetEffects={myTargetEffects}
                effectSubjectName={effectSubjectName}
                sanctuaryInfo={sanctuaryInfo}
                hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage}
                hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore}
                coronaDisadvantage={coronaDisadvantage}
                onRollConditionSave={onRollConditionSave}
                onBreakCondition={onBreakCondition}
                onOpenEffectAdder={onOpenEffectAdder}
                onRollConcentrationSave={onRollConcentrationSave}
                onBreakConcentration={onBreakConcentration}
            />
        </div>
    )
}

export default CreatureCard
