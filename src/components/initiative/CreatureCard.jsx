

import AvatarImage from '../common/AvatarImage.jsx'
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx'
import NpcAvatar from './NpcAvatar.jsx'
import CreatureHp from './CreatureHp.jsx'
import { getAbilityLabel } from '../../services/combat/conditions/conditionUtils.js'
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import ConditionEffectBadges from './ConditionEffectBadges.jsx'
import utils from '../../services/ui/utils.js'

const FLESH_TO_STONE_PREFIX = '_fleshToStone_';
const PRISMATIC_SPRAY_INDIGO_PREFIX = '_prismaticSprayIndigo_';
const PRISMATIC_SPRAY_VIOLET_PREFIX = '_prismaticSprayViolet_';
import CreatureBadge from '../common/CreatureBadge.jsx'
import { isBuffActive } from '../../services/automation/common/buffToggle.js';
import { CONDITION_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc, clearUnbreakableMajesty } from '../../services/combat/auras/unbreakableMajesty.js'
import { sendFleshToStoneResult, sendPrismaticSprayIndigoResult, sendPrismaticSprayVioletResult } from '../../services/combat/conditions/savePromptService.js'
import { isResilientSphereActive, getResilientSphereSource } from '../../services/combat/automation/automationPassives.js'
import { cleanupWildShape } from '../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js'
import { revertPolymorph } from '../../services/automation/handlers/spells/polymorphService.js'
import { revertAnimalShapes } from '../../services/automation/handlers/spells/animalShapesService.js'
import { revertShapechange } from '../../services/automation/handlers/spells/shapechangeService.js'

const SHAPE_LABELS = {
    sphere: 'Sphere',
    cylinder: 'Cylinder',
    cube: 'Cube',
    cone: 'Cone',
    line: 'Line',
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
}) {
    const isUnconscious = creature.currentHp <= 0
    const allTargetEffects = useRuntimeValue('campaign', 'targetEffects') ?? [];
    const myTargetEffects = allTargetEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === creature.name;
    });
    const saveTrackingKey = FLESH_TO_STONE_PREFIX + creature.name.replace(/\s+/g, '_');
    const fleshToStoneData = useRuntimeValue('campaign', saveTrackingKey, campaignName);
    const prismaticIndigoKey = PRISMATIC_SPRAY_INDIGO_PREFIX + creature.name.replace(/\s+/g, '_');
    const prismaticIndigoData = useRuntimeValue('campaign', prismaticIndigoKey, campaignName);
    const prismaticVioletKey = PRISMATIC_SPRAY_VIOLET_PREFIX + creature.name.replace(/\s+/g, '_');
    const prismaticVioletData = useRuntimeValue('campaign', prismaticVioletKey, campaignName);
    const isMajestyActive = creature.type === 'player' && isUnbreakableMajestyActive(creature.name, campaignName);
    const majestyDc = isMajestyActive ? getUnbreakableMajestySaveDc(creature.name, campaignName) : 0;
    const wildShapeActive = isBuffActive(creature.name, 'Wild Shape', campaignName);
    const polymorphActive = myTargetEffects.some(te => te.effect === 'polymorph');
    const animalShapesActive = myTargetEffects.some(te => te.effect === 'animal_shapes');
    const shapechangeActive = myTargetEffects.some(te => te.effect === 'shapechange');
    const wrathOfTheSeaActive = creature.type === 'player' && getRuntimeValue(creature.name, 'wrathOfTheSeaActive', campaignName);
    const recklessAttackActive = myTargetEffects.some(te => te.effect === 'reckless_attack');
    const isPlayerSummoned = (creature.type !== 'player' || creature.wildShapeSource || creature.shapechangeSource) && myTargetEffects.some(te =>
        te.effect === 'summoned' &&
        allCreatures.some(c => c.type === 'player' && c.name === te.source)
    ) || (creature.wildShapeSource && allCreatures.some(c => c.type === 'player' && c.name === creature.wildShapeSource)) || (creature.shapechangeSource && allCreatures.some(c => c.type === 'player' && c.name === creature.shapechangeSource));

    const sanctuaryInfo = (() => {
        for (const other of allCreatures) {
            if (other.type !== 'player') continue;
            const active = getRuntimeValue(other.name, 'naturesSanctuaryActive', campaignName);
            if (!active) continue;
            const creatureList = getRuntimeValue(other.name, 'naturesSanctuaryCreatures', campaignName) || [];
            if (creatureList.includes(creature.name)) {
                const resistance = getRuntimeValue(other.name, 'naturesSanctuaryResistance', campaignName) || 'None';
                return { druid: other.name, resistance };
            }
        }
        return null;
    })();

    return (
        <div className={`creature-card ${creature.type} ${isActive ? 'active' : ''} ${isUnconscious ? 'creature-unconscious' : ''}`}>
            {creature.type !== 'player' && isLocalhost && (
                <button
                    className="npc-remove-btn"
                    onClick={() => onRemoveNpc(creature.name)}
                    type="button"
                    title="Remove NPC"
                >
                    <i className="fa-solid fa-xmark"></i>
                </button>
            )}
            <div className='creature-avatar'>
                {creature.polymorphObject ? (
                    <div className="npc-avatar" onClick={() => {
                        if (isLocalhost || isPlayerSummoned) {
                            onNpcClick(creature, { allowNonLocalhost: true });
                        }
                    }}>
                        <i className={`fa-solid ${creature.polymorphObject.icon || 'fa-circle'}`}></i>
                    </div>
                ) : (creature.type === 'player' && !creature.wildShapeSource && !creature.polymorphSource && !creature.animalShapesSource && !creature.shapechangeSource) ? (
                    <AvatarImage name={creature.name} imagePath={creature.imagePath} campaignName={campaignName} size={150} onClick={onViewCharacter ? () => onViewCharacter(characters.find(ch => utils.getName(ch.name) === creature.name)) : undefined} />
                ) : (
                    <NpcAvatar
                        name={creature.polymorphSource || creature.animalShapesSource || creature.wildShapeSource || creature.shapechangeSource ? (creature.beastName || creature.formName || creature.name) : creature.name}
                        imageUrl={npcImage}
                        imagePath={creature.wildShapeSource || creature.polymorphSource || creature.animalShapesSource || creature.shapechangeSource ? undefined : creature.imagePath}
                        campaignName={campaignName}
                        onClick={() => {
                            if (isLocalhost || isPlayerSummoned) {
                                onNpcClick(creature, { allowNonLocalhost: true });
                            }
                        }}
                    />
                )}
            </div>
            <div className='creature-name'>
                {creature.polymorphObject ? (
                    <span>{creature.polymorphObject.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                ) : creature.type === 'npc' ? (
                    <MonsterNameAutocomplete
                        value={creature.name}
                        onChange={(newVal) => onNameChange(creature.name, newVal)}
                        npcs={campaignNpcs}
                        showBadge={campaignNpcs.some(n => n.name?.toLowerCase() === creature.name?.toLowerCase())}
                    />
                ) : (
                    <span>{(creature.wildShapeSource || creature.polymorphSource || creature.animalShapesSource || creature.shapechangeSource) && (creature.beastName || creature.formName) ? (creature.beastName || creature.formName) : creature.name}</span>
                )}
            </div>
            <CreatureHp
                creature={creature}
                isLocalhost={isLocalhost}
                onChange={onHpChange}
                isPlayerSummoned={isPlayerSummoned}
            />
            {(creature.type !== 'player' || creature.wildShapeSource || creature.polymorphSource || creature.animalShapesSource) && (() => {
                const creatureTempHp = getRuntimeValue(creature.name, 'tempHp', campaignName) || 0;
                return creatureTempHp > 0 ? (
                    <div className="temp-hp-display">
                        <i className="fa-solid fa-shield"></i> Temp HP: {creatureTempHp}
                    </div>
                ) : null;
            })()}
            <div className='creature-initiative'>Initiative&nbsp;
                <input
                    data-testid="initiative-input"
                    min="0"
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
            <div className='creature-target'>Target&nbsp;
                <select
                    data-testid="target-select"
                    value={creature.targetName || ''}
                    onChange={(e) => onTargetChange(creature.name, e.target.value)}
                    disabled={creature.type !== 'player' && !isLocalhost && !isPlayerSummoned}
                >
                    <option value="">— No Target —</option>
                    {allCreatures
                        .filter(c => c.name !== creature.name)
                        .map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                        ))
                    }
                    {overlays.length > 0 && (
                        <optgroup label="─── Overlays ───">
                            {overlays.map(o => {
                                const label = o.label || `${SHAPE_LABELS[o.shape] || o.shape} (${o.radiusFt || o.distanceFt || o.sizeFt || 0}ft)`
                                return (
                                    <option key={`overlay-${o.id}`} value={`overlay-${o.id}`}>
                                        {label}
                                    </option>
                                )
                            })}
                        </optgroup>
                    )}
                </select>
            </div>
            <div className='creature-conditions'>
                {creature.conditions?.map(cond => {
                    if (!cond || typeof cond !== 'object') return null;
                    const canRoll = creature.type === 'player' || isLocalhost
                    const condCls = cond.key === 'invisible' ? 'effect-buff' : 'effect-condition'
                    return (
                        <CreatureBadge
                            key={cond.id || cond.key}
                            label={cond.dc ? `${cond.label} DC ${cond.dc}` : cond.label}
                            cls={condCls}
                            tooltip={cond.dc ? `${cond.label}\n\n${CONDITION_DESCRIPTIONS[cond.label] || ''}\n\nDC ${cond.dc} ${getAbilityLabel(cond.ability)}` : (CONDITION_DESCRIPTIONS[cond.label] || cond.label)}
                            onClick={canRoll ? () => onRollConditionSave(creature.name, cond) : undefined}
                            disabled={!canRoll}
                            removable={isLocalhost}
                            onRemove={() => onBreakCondition(creature.name, cond)}
                        />
                    )
                })}
                <ConditionEffectBadges conditions={creature.conditions?.filter(c => c && typeof c === 'object' && c.key) || []} targetEffects={myTargetEffects} creatureName={creature.name} campaignName={campaignName} allCreatures={allCreatures} hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage} hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore} isLocalhost={isLocalhost} coronaDisadvantage={coronaDisadvantage} characters={characters} activeMapName={mapName} onRollConditionSave={(creature.type === 'player' || isLocalhost) ? onRollConditionSave : undefined} />
                {isLocalhost && (
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
                {creature.concentration ? (
                    <CreatureBadge
                        icon='fa-spinner'
                        label={`${creature.concentration.spell} DC ${creature.concentration.dc}`}
                        cls='effect-neutral'
                        tooltip={`Concentration: ${creature.concentration.spell} (DC ${creature.concentration.dc} Constitution)`}
                        onClick={isLocalhost ? () => onRollConcentrationSave(creature.name) : undefined}
                        removable={isLocalhost}
                        onRemove={() => onBreakConcentration(creature.name)}
                    />
                ) : null}
                {isLocalhost && (() => {
                    if (!fleshToStoneData) return null;
                    return (
                        <div className="flesh-to-stone-prompt">
                            <span className="flesh-to-stone-label">
                                <i className="fa-solid fa-dungeon"></i> Flesh to Stone
                            </span>
                            <div className="flesh-to-stone-row">
                                <span className="flesh-to-stone-progress">
                                    Saves: {fleshToStoneData.successes}/3 | Failures: {fleshToStoneData.failures}/3
                                </span>
                            </div>
                            <div className="flesh-to-stone-row flesh-to-stone-actions">
                                <button
                                    className="flesh-to-stone-btn success"
                                    onClick={() => {
                                        sendFleshToStoneResult(campaignName, creature.name, { success: true });
                                    }}
                                    title="Record successful save"
                                >
                                    <i className="fa-solid fa-check"></i> Success
                                </button>
                                <button
                                    className="flesh-to-stone-btn failure"
                                    onClick={() => {
                                        sendFleshToStoneResult(campaignName, creature.name, { success: false });
                                    }}
                                    title="Record failed save"
                                >
                                    <i className="fa-solid fa-xmark"></i> Failure
                                </button>
                            </div>
                        </div>
                    );
                })()}
                {isLocalhost && (() => {
                    if (!prismaticIndigoData) return null;
                    return (
                        <div className="flesh-to-stone-prompt">
                            <span className="flesh-to-stone-label">
                                <i className="fa-solid fa-eye"></i> Prismatic Spray (Indigo)
                            </span>
                            <div className="flesh-to-stone-row">
                                <span className="flesh-to-stone-progress">
                                    CON Saves: {prismaticIndigoData.successes}/3 | Failures: {prismaticIndigoData.failures}/3
                                </span>
                            </div>
                            <div className="flesh-to-stone-row flesh-to-stone-actions">
                                <button
                                    className="flesh-to-stone-btn success"
                                    onClick={() => {
                                        sendPrismaticSprayIndigoResult(campaignName, creature.name, { success: true });
                                    }}
                                    title="Record successful CON save"
                                >
                                    <i className="fa-solid fa-check"></i> Success
                                </button>
                                <button
                                    className="flesh-to-stone-btn failure"
                                    onClick={() => {
                                        sendPrismaticSprayIndigoResult(campaignName, creature.name, { success: false });
                                    }}
                                    title="Record failed CON save"
                                >
                                    <i className="fa-solid fa-xmark"></i> Failure
                                </button>
                            </div>
                        </div>
                    );
                })()}
                {isLocalhost && (() => {
                    if (!prismaticVioletData) return null;
                    return (
                        <div className="flesh-to-stone-prompt">
                            <span className="flesh-to-stone-label">
                                <i className="fa-solid fa-door-open"></i> Prismatic Spray (Violet)
                            </span>
                            <div className="flesh-to-stone-row">
                                <span className="flesh-to-stone-progress">
                                    WIS Save (caster's next turn)
                                </span>
                            </div>
                            <div className="flesh-to-stone-row flesh-to-stone-actions">
                                <button
                                    className="flesh-to-stone-btn success"
                                    onClick={() => {
                                        sendPrismaticSprayVioletResult(campaignName, creature.name, { success: true });
                                    }}
                                    title="Record successful WIS save"
                                >
                                    <i className="fa-solid fa-check"></i> Success
                                </button>
                                <button
                                    className="flesh-to-stone-btn failure"
                                    onClick={() => {
                                        sendPrismaticSprayVioletResult(campaignName, creature.name, { success: false });
                                    }}
                                    title="Record failed WIS save"
                                >
                                    <i className="fa-solid fa-xmark"></i> Failure
                                </button>
                            </div>
                        </div>
                    );
                })()}
                {allCreatures?.some(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === creature.name) && (() => {
                    const markCreature = allCreatures.find(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === creature.name);
                    return (
                        <CreatureBadge
                            icon='fa-crosshairs'
                            label="Hunter's Mark"
                            cls='effect-neutral'
                            tooltip={`Marked by ${markCreature?.name}`}
                            removable={isLocalhost}
                            onRemove={() => {
                                if (markCreature) {
                                    const concentration = getRuntimeValue(markCreature.name, 'concentration');
                                    if (concentration?.spell === "Hunter's Mark") {
                                        setRuntimeValue(markCreature.name, 'concentration', null, campaignName);
                                    }
                                }
                            }}
                        />
                    );
                })()}
                {isMajestyActive && (
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
                )}
                {wildShapeActive && (
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
                )}
                {polymorphActive && (
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
                )}
                {animalShapesActive && (
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
                )}
                {shapechangeActive && (
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
                )}
                {(() => {
                    const starryBuffs = getRuntimeValue(creature.name, 'activeBuffs') || [];
                    const starryFormBuff = Array.isArray(starryBuffs) ? starryBuffs.find(b => b.name === 'Starry Form' && b.constellation) : null;
                    if (!starryFormBuff) return null;
                    const constellation = starryFormBuff.constellation;
                    return (
                        <CreatureBadge
                            icon='fa-star'
                            label={`Starry Form - ${constellation}`}
                            cls='effect-buff'
                            tooltip={`Starry Form (${constellation} constellation): Luminous form active — Resistance to Bludgeoning, Piercing, and Slashing damage${constellation === 'Archer' ? '; Bonus Action: Luminous Arrow attack' : constellation === 'Chalice' ? '; Healing spells restore extra HP to allies within 30 feet' : '; Concentration checks: Treat d20 rolls of 9 or lower as 10'}`}
                            removable={isLocalhost}
                            onRemove={() => {
                                const newBuffs = starryBuffs.filter(b => b.name !== 'Starry Form');
                                setRuntimeValue(creature.name, 'activeBuffs', newBuffs, campaignName);
                                const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                                const filteredEffects = allTargetEffects.filter(te => !(te.effect === 'starry_form' && te.source === creature.name));
                                if (filteredEffects.length !== allTargetEffects.length) {
                                    setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName, true);
                                }
                            }}
                        />
                    );
                })()}
                {wrathOfTheSeaActive && (
                    <CreatureBadge
                        icon='fa-water'
                        label='Wrath of the Sea'
                        cls='effect-buff'
                        tooltip='Wrath of the Sea: Ocean spray emanation active — Bonus Action to force CON save or take WIS modifier d6 Cold damage'
                        removable={isLocalhost}
                        onRemove={() => setRuntimeValue(creature.name, 'wrathOfTheSeaActive', false, campaignName)}
                    />
                )}
                {sanctuaryInfo && (
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
                )}
                {recklessAttackActive && (
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
                )}
                {myTargetEffects.filter(te => te.effect === 'summoned').map(te => (
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
                ))}
                {(() => {
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
                    );
                })()}
                {isResilientSphereActive(creature.name, campaignName) && (() => {
                    const sourceName = getResilientSphereSource(creature.name, campaignName) || 'Unknown';
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
                    );
                })()}
            </div>
        </div>
    )
}

export default CreatureCard
