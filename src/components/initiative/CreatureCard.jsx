

import AvatarImage from '../common/AvatarImage.jsx'
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx'
import NpcAvatar from './NpcAvatar.jsx'
import CreatureHp from './CreatureHp.jsx'
import { getAbilityLabel } from '../../services/combat/conditionUtils.js'
import ConditionEffectBadges from './ConditionEffectBadges.jsx'

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
    onRollNpcInitiative,
    onTargetChange,
    onRollConditionSave,
    onBreakCondition,
    onOpenConditionPicker,
    onRollConcentrationSave,
    onBreakConcentration,
    onOpenConcentrationPicker,
    allCreatures,
}) {
    const isUnconscious = creature.currentHp <= 0
    const showRollLink = creature.type === 'npc'
        && creature.initiativeBonus != null
        && creature.initiativeBonus !== ''
        && creature.initiativeBonus !== 0

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
                    <AvatarImage name={creature.name} imagePath={creature.imagePath} size={150} />
                ) : (
                    <NpcAvatar
                        name={creature.name}
                        imageUrl={npcImage}
                        imagePath={creature.imagePath}
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
                {showRollLink ? (
                    <span
                        className="initiative-roll-link"
                        onClick={() => onRollNpcInitiative(creature.name)}
                        role="button"
                        tabIndex={0}
                        title={`Roll initiative (d20 + ${creature.initiativeBonus})`}
                    >
                        {creature.initiative || <i className="fa-solid fa-dice-d20" />}
                    </span>
                ) : (
                    <input
                        min="0"
                        onChange={(event) => onInitiativeChange(creature.name, event.target.value)}
                        type="number"
                        value={creature.initiative}
                        placeholder="Init"
                    />
                )}
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
                                title={cond.dc ? `${cond.label} (DC ${cond.dc} ${getAbilityLabel(cond.ability)})` : cond.label}
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
                <ConditionEffectBadges conditions={creature.conditions} />
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
            </div>
        </div>
    )
}

export default CreatureCard
