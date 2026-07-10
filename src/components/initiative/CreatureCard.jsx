

import AvatarImage from '../common/AvatarImage.jsx'
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx'
import NpcAvatar from './NpcAvatar.jsx'
import CreatureHp from './CreatureHp.jsx'
import { getAbilityLabel } from '../../services/combat/conditions/conditionUtils.js'
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import ConditionEffectBadges from './ConditionEffectBadges.jsx'
import { isBuffActive } from '../../services/automation/common/buffToggle.js';
import { CONDITION_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc, clearUnbreakableMajesty } from '../../services/combat/auras/unbreakableMajesty.js'

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
    onOpenConditionPicker,
    onRollConcentrationSave,
    onBreakConcentration,
    onOpenConcentrationPicker,
    allCreatures,
    campaignName,
    hasTacticalShift,
    hasSpeedyOpportunityDisadvantage,
    hasSpeedyDifficultTerrainIgnore,
    coronaDisadvantage,
}) {
    const isUnconscious = creature.currentHp <= 0
    const allTargetEffects = useRuntimeValue(campaignName, 'targetEffects') ?? [];
    const myTargetEffects = allTargetEffects.filter(te => te.target === creature.name);
    const isMajestyActive = creature.type === 'player' && isUnbreakableMajestyActive(creature.name, campaignName);
    const majestyDc = isMajestyActive ? getUnbreakableMajestySaveDc(creature.name, campaignName) : 0;
    const wildShapeActive = isBuffActive(creature.name, 'Wild Shape', campaignName);

    return (
        <div className={`creature-card ${creature.type} ${isActive ? 'active' : ''} ${isUnconscious ? 'creature-unconscious' : ''}`}>
            {creature.type === 'npc' && isLocalhost && (
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
                {creature.type === 'player' ? (
                    <AvatarImage name={creature.name} imagePath={creature.imagePath} campaignName={campaignName} size={150} />
                ) : (
                    <NpcAvatar
                        name={creature.name}
                        imageUrl={npcImage}
                        imagePath={creature.imagePath}
                        campaignName={campaignName}
                        onClick={() => onNpcClick(creature)}
                    />
                )}
            </div>
            <div className='creature-name'>
                {creature.type === 'npc' ? (
                    <MonsterNameAutocomplete
                        value={creature.name}
                        onChange={(newVal) => onNameChange(creature.name, newVal)}
                        npcs={campaignNpcs}
                        showBadge={campaignNpcs.some(n => n.name?.toLowerCase() === creature.name?.toLowerCase())}
                    />
                ) : (
                    <span>{creature.name}</span>
                )}
            </div>
            <CreatureHp
                creature={creature}
                isLocalhost={isLocalhost}
                onChange={onHpChange}
            />
            <div className='creature-initiative'>Initiative&nbsp;
                <input
                    min="0"
                    onChange={(event) => onInitiativeChange(creature.name, event.target.value)}
                    type="number"
                    value={creature.initiative}
                    placeholder="Init"
                />
            </div>
            <div className='creature-target'>Target&nbsp;
                <select
                    value={creature.targetName || ''}
                    onChange={(e) => onTargetChange(creature.name, e.target.value)}
                    disabled={creature.type === 'npc' && !isLocalhost}
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
                    const canRoll = creature.type === 'player' || isLocalhost
                    return (
                        <div key={cond.id} className='condition-badge-wrapper'>
                            <button
                                className='condition-badge initiative-condition-badge'
                                onClick={() => canRoll && onRollConditionSave(creature.name, cond)}
                                disabled={!canRoll}
                                type='button'
                                title={cond.dc ? `${cond.label}\n\n${CONDITION_DESCRIPTIONS[cond.label] || ''}\n\nDC ${cond.dc} ${getAbilityLabel(cond.ability)}` : (CONDITION_DESCRIPTIONS[cond.label] || cond.label)}
                            >
                                {cond.dc ? `${cond.label} DC ${cond.dc}` : cond.label}
                            </button>
                            {isLocalhost && (
                                <button
                                    className='condition-break-btn'
                                    onClick={() => onBreakCondition(creature.name, cond)}
                                    type='button'
                                    title='Automatically break condition'
                                >
                                    <i className='fa-solid fa-xmark'></i>
                                </button>
                            )}
                        </div>
                    )
                })}
                <ConditionEffectBadges conditions={creature.conditions} targetEffects={myTargetEffects} creatureName={creature.name} campaignName={campaignName} hasTacticalShift={hasTacticalShift} hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage} hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore} isLocalhost={isLocalhost} coronaDisadvantage={coronaDisadvantage} />
                {isLocalhost && (
                    <button
                        className='condition-add-btn'
                        onClick={() => onOpenConditionPicker(creature)}
                        type='button'
                        title='Add condition'
                    >
                        <i className='fa-solid fa-plus'></i>
                    </button>
                )}
                {creature.concentration ? (
                    <div className='concentration-badge-wrapper'>
                        <button
                            className='initiative-concentration-badge'
                            onClick={() => onRollConcentrationSave(creature.name)}
                            type='button'
                            title={`Concentration: ${creature.concentration.spell} (DC ${creature.concentration.dc} Constitution)`}
                        >
                            <i className='fa-solid fa-spinner'></i> {creature.concentration.spell} DC {creature.concentration.dc}
                        </button>
                        <button
                            className='concentration-break-btn'
                            onClick={() => onBreakConcentration(creature.name)}
                            type='button'
                            title='Break concentration'
                        >
                            <i className='fa-solid fa-xmark'></i>
                        </button>
                    </div>
                ) : isLocalhost ? (
                    <button
                        className='concentration-add-btn'
                        onClick={() => onOpenConcentrationPicker(creature)}
                        type='button'
                        title='Add concentration'
                    >
                        <i className='fa-solid fa-spinner'></i>
                    </button>
                ) : null}
                {allCreatures?.some(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === creature.name) && (
                    <div className='hunters-mark-badge-wrapper'>
                        <span className='initiative-hunters-mark-badge' title={`Marked by ${allCreatures.find(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === creature.name)?.name}`}>
                            <i className='fa-solid fa-crosshairs'></i> Hunter's Mark
                        </span>
                    </div>
                )}
                {isMajestyActive && (
                    <div className='majesty-badge-wrapper'>
                        <button
                            className='initiative-majesty-badge'
                            onClick={() => isLocalhost && clearUnbreakableMajesty(creature.name, campaignName)}
                            disabled={!isLocalhost}
                            type='button'
                            title={`Unbreakable Majesty (DC ${majestyDc})\n\nFirst attack per turn that hits forces attacker to make a CHA save or the attack misses.\nClick to deactivate.`}
                        >
                            <i className='fa-solid fa-shield-halved'></i> Majesty DC {majestyDc}
                        </button>
                        {isLocalhost && (
                            <button
                                className='majesty-break-btn'
                                onClick={() => clearUnbreakableMajesty(creature.name, campaignName)}
                                type='button'
                                title='Deactivate Unbreakable Majesty'
                            >
                                <i className='fa-solid fa-xmark'></i>
                            </button>
                        )}
                    </div>
                )}
                {wildShapeActive && (
                    <div className='wild-shape-badge-wrapper'>
                        <span className='initiative-wild-shape-badge' title='Wild Shape: Animal form active — spellcasting blocked, resistance types apply'>
                            <i className='fa-solid fa-paw'></i> Wild Shape
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CreatureCard
