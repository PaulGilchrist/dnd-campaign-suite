import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { EFFECT_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'

function getEffectDescription(label) {
    if (EFFECT_DESCRIPTIONS[label]) return EFFECT_DESCRIPTIONS[label]
    if (label.startsWith('Speed -')) return 'Speed is reduced by the amount shown.'
    if (label.startsWith('+') && label.includes('to hit')) return 'Attackers gain the shown bonus to hit this creature.'
    return label
}

function removeConditionByKey(creatureName, conditionKey, campaignName) {
    const conditions = getRuntimeValue(creatureName, 'activeConditions') || []
    const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionKey.toLowerCase())
    setRuntimeValue(creatureName, 'activeConditions', filtered, campaignName)
}

function removeTargetEffect(targetName, effectType, campaignName) {
    const existingEffects = getRuntimeValue(campaignName, 'targetEffects') || []
    const filtered = existingEffects.filter(te => !(te.target === targetName && te.effect === effectType))
    setRuntimeValue(campaignName, 'targetEffects', filtered, campaignName)
}

function ConditionEffectBadges({ conditions, targetEffects = [], creatureName, campaignName, allCreatures, hasTacticalShift, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, isLocalhost, coronaDisadvantage }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects(condKeys, [], targetEffects, false, false, false, false, null, false, null, false, false, false, false, false, false, false)
    const activeBuffs = creatureName && campaignName ? (getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []) : []
    if (Array.isArray(activeBuffs)) {
        for (const buff of activeBuffs) {
            if (buff.effect === 'advantage_attacks_and_saves') {
                effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
                effects.attackAdvantageReasons.push(buff.name)
                effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1
                effects.saveAdvantageReasons.push(buff.name)
            }
            if (buff.effect === 'vow_of_enmity') {
                effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
                effects.attackAdvantageReasons.push(buff.name)
            }
            if (buff.effect === 'dodge') {
                effects.targetDisadvantageCount = (effects.targetDisadvantageCount || 0) + 1
                effects.dexSaveAdvantageCount = (effects.dexSaveAdvantageCount || 0) + 1
            }
        }
    }
    const badges = []
    // Check if any creature has Vow of Enmity against this creature
    if (allCreatures?.length && campaignName) {
        const hasVow = allCreatures.some(c => {
            const vowTarget = getRuntimeValue(c.name, 'vowOfEnmityTarget', campaignName);
            return vowTarget === creatureName;
        });
        if (hasVow) {
            effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
            effects.attackAdvantageReasons.push('Vow of Enmity')
        }
    }
    const stealthAttackCost = creatureName && campaignName ? (getRuntimeValue(creatureName, 'stealthAttackCost', campaignName) ?? 0) : 0
    if (stealthAttackCost > 0) {
        badges.push({ label: 'Stealth Attack', cls: 'effect-stealth-attack', icon: 'fa-eye-slash', removable: true, removeAction: 'stealth_attack' })
    }
    if (effects.speedReduction) {
        const label = effects.speedReduction >= 1000 ? 'Speed 0' : `Speed -${effects.speedReduction}`
        const speedConditionKeys = ['grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero']
        const speedCondition = conditions.find(c => speedConditionKeys.includes(c.key))
        badges.push({ label, cls: 'effect-speed-zero', icon: 'fa-minus', removable: true, removeAction: 'condition', removeKey: speedCondition?.key || 'grappled' })
    }
    if (effects.noAdvantageAgainst) {
        const noAdvConditionKeys = ['blinded', 'charmed', 'invisible', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious']
        const noAdvCondition = conditions.find(c => noAdvConditionKeys.includes(c.key))
        badges.push({ label: 'No Adv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down', removable: true, removeAction: 'condition', removeKey: noAdvCondition?.key || 'blinded' })
    }
    if (effects.targetDisadvantageCount > 0 && !effects.noAdvantageAgainst) {
        const disAdvConditionKeys = ['blinded', 'charmed', 'invisible', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious']
        const disAdvCondition = conditions.find(c => disAdvConditionKeys.includes(c.key))
        badges.push({ label: 'Disadv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down', removable: true, removeAction: 'condition', removeKey: disAdvCondition?.key || 'blinded' })
    }
    if (effects.attackAdvantageCount > 0) {
        const reasons = (effects.attackAdvantageReasons || []).length > 0 ? effects.attackAdvantageReasons.join(', ') : 'Advantage on attack rolls'
        const advSource = effects.attackAdvantageReasons?.find(r => r === 'Vow of Enmity') || activeBuffs.find(b => b.effect === 'vow_of_enmity') || activeBuffs.find(b => b.effect === 'advantage_attacks_and_saves')
        badges.push({ label: 'Adv', cls: 'effect-target-adv', icon: 'fa-arrow-up', removable: true, removeAction: advSource ? (advSource.effect === 'vow_of_enmity' ? 'vow_of_enmity' : 'remove_buff') : 'target_effect', tooltip: `Advantage on attack rolls${reasons !== 'Advantage on attack rolls' ? ' (' + reasons + ')' : ''}` })
    }
    if (effects.saveAdvantageCount > 0) {
        const reasons = (effects.saveAdvantageReasons || []).length > 0 ? effects.saveAdvantageReasons.join(', ') : 'Advantage on saving throws'
        const saveAdvSource = effects.saveAdvantageReasons?.find(r => r === 'Vow of Enmity') || activeBuffs.find(b => b.effect === 'advantage_attacks_and_saves')
        badges.push({ label: 'Adv Save', cls: 'effect-target-adv', icon: 'fa-shield-halved', removable: true, removeAction: saveAdvSource ? (saveAdvSource.effect === 'advantage_attacks_and_saves' ? 'remove_buff' : 'vow_of_enmity') : 'target_effect', tooltip: `Advantage on saving throws${reasons !== 'Advantage on saving throws' ? ' (' + reasons + ')' : ''}` })
    }
    if (effects.dexSaveAdvantageCount > 0) {
        const dodgeBuff = activeBuffs.find(b => b.effect === 'dodge')
        badges.push({ label: 'Adv DEX Save', cls: 'effect-target-adv', icon: 'fa-shield-halved', removable: true, removeAction: dodgeBuff ? 'remove_buff' : 'target_effect', tooltip: 'Advantage on Dexterity saving throws' })
    }
    if (effects.riderSaveDisadvantage) badges.push({ label: 'Save Disadv', cls: 'effect-disadvantage', icon: 'fa-shield', removable: true, removeAction: 'target_effect', effectType: 'disadvantage_on_next_save' })
    if (effects.riderAttackBonus > 0) badges.push({ label: `+${effects.riderAttackBonus} to hit`, cls: 'effect-target-adv', icon: 'fa-bullseye', removable: true, removeAction: 'target_effect', effectType: 'next_attack_bonus' })
    if (effects.riderCannotOpportunityAttack) badges.push({ label: 'No OA', cls: 'effect-cannot-act', icon: 'fa-ban', removable: true, removeAction: 'target_effect', effectType: 'no_opportunity_attacks' })
    const noOA = getRuntimeValue(creatureName, 'inspiringMovementNoOA', campaignName) || hasTacticalShift
    if (creatureName && campaignName && noOA) {
        badges.push({ label: 'Insp. Move', cls: 'effect-cannot-act', icon: 'fa-person-walking', removable: true, removeAction: 'inspiring_move' })
    }
    const remarkableNoOA = getRuntimeValue(creatureName, 'remarkableAthleteNoOA', campaignName)
    if (creatureName && campaignName && remarkableNoOA) {
        badges.push({ label: 'No OA (Crit)', cls: 'effect-cannot-act', icon: 'fa-ban', removable: true, removeAction: 'remarkable_no_oa' })
    }
    if (hasSpeedyOpportunityDisadvantage) {
        badges.push({ label: 'OA Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down', removable: true, removeAction: 'oa_disadv' })
    }
    if (hasSpeedyDifficultTerrainIgnore) {
        badges.push({ label: 'No Difficult Terrain on Dash', cls: 'effect-cannot-act', icon: 'fa-person-walking', removable: true, removeAction: 'difficult_terrain_ignore' })
    }
    if (coronaDisadvantage) {
        badges.push({ label: 'Disadv Fire/Radiant', cls: 'effect-disadvantage', icon: 'fa-sun', removable: true, removeAction: 'corona_disadvantage' })
    }

    const handleRemoveEffect = (badge) => {
        switch (badge.removeAction) {
            case 'condition':
                removeConditionByKey(creatureName, badge.removeKey, campaignName)
                break
            case 'target_effect':
                removeTargetEffect(creatureName, badge.effectType, campaignName)
                break
            case 'inspiring_move':
                setRuntimeValue(creatureName, 'inspiringMovementNoOA', false, campaignName)
                break
            case 'remarkable_no_oa':
                setRuntimeValue(creatureName, 'remarkableAthleteNoOA', false, campaignName)
                break
            case 'oa_disadv':
                setRuntimeValue(creatureName, 'hasSpeedyOpportunityDisadvantage', false, campaignName)
                break
            case 'difficult_terrain_ignore':
                setRuntimeValue(creatureName, 'hasSpeedyDifficultTerrainIgnore', false, campaignName)
                break
            case 'corona_disadvantage':
                setRuntimeValue(creatureName, 'coronaDisadvantage', false, campaignName)
                break
            case 'stealth_attack':
                setRuntimeValue(creatureName, 'stealthAttackCost', 0, campaignName)
                break
            case 'vow_of_enmity': {
                const vowCreature = allCreatures?.find(c => getRuntimeValue(c.name, 'vowOfEnmityTarget', campaignName) === creatureName)
                if (vowCreature) {
                    setRuntimeValue(vowCreature.name, 'vowOfEnmityTarget', null, campaignName)
                }
                break
            }
            case 'remove_buff': {
                const buffs = getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []
                const filtered = buffs.filter(b => b.effect !== 'advantage_attacks_and_saves' && b.effect !== 'vow_of_enmity' && b.effect !== 'dodge')
                setRuntimeValue(creatureName, 'activeBuffs', filtered, campaignName)
                break
            }
        }
    }

    return (
        <>
            {badges.map(b => (
                <div key={b.label} style={{position: 'relative'}}>
                    <div className={`condition-effect-badge ${b.cls}`} title={b.tooltip || getEffectDescription(b.label)}>
                        <i className={`fa-solid ${b.icon}`}></i> {b.label}
                    </div>
                    {isLocalhost && b.removable && (
                        <button
                            className='badge-break-btn'
                            onClick={() => handleRemoveEffect(b)}
                            type='button'
                            title='Remove effect'
                        >
                            <i className='fa-solid fa-xmark'></i>
                        </button>
                    )}
                </div>
            ))}
        </>
    )
}

export default ConditionEffectBadges
