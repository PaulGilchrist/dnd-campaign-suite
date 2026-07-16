import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { EFFECT_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js'

function getEffectDescription(label) {
    if (EFFECT_DESCRIPTIONS[label]) return EFFECT_DESCRIPTIONS[label]
    if (label.startsWith('Speed -')) return 'Speed is reduced by the amount shown.'
    if (label.startsWith('+') && label.includes('to hit')) return 'Attackers gain the shown bonus to hit this creature.'
    return label
}

function ConditionEffectBadges({ conditions, targetEffects = [], creatureName, campaignName, hasTacticalShift, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, isLocalhost, coronaDisadvantage }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects(condKeys, [], targetEffects, false, false, false, false, null, false, null, false, false, false, false)
    const activeBuffs = creatureName && campaignName ? (getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []) : []
    if (Array.isArray(activeBuffs)) {
        for (const buff of activeBuffs) {
            if (buff.effect === 'advantage_attacks_and_saves') {
                effects.attackAdvantageCount = (effects.attackAdvantageCount || 0) + 1
                effects.attackAdvantageReasons.push(buff.name)
                effects.saveAdvantageCount = (effects.saveAdvantageCount || 0) + 1
                effects.saveAdvantageReasons.push(buff.name)
            }
        }
    }
    const badges = []
    const stealthAttackCost = creatureName && campaignName ? (getRuntimeValue(creatureName, 'stealthAttackCost', campaignName) ?? 0) : 0
    if (stealthAttackCost > 0) {
        badges.push({ label: 'Stealth Attack', cls: 'effect-stealth-attack', icon: 'fa-eye-slash', removable: false })
    }
    if (effects.speedReduction) {
        const label = effects.speedReduction >= 1000 ? 'Speed 0' : `Speed -${effects.speedReduction}`
        badges.push({ label, cls: 'effect-speed-zero', icon: 'fa-minus', removable: false })
    }
    if (effects.noAdvantageAgainst) badges.push({ label: 'No Adv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down', removable: false })
    if (effects.targetDisadvantageCount > 0 && !effects.noAdvantageAgainst) badges.push({ label: 'Disadv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down', removable: false })
    if (effects.attackAdvantageCount > 0) {
        const reasons = (effects.attackAdvantageReasons || []).length > 0 ? effects.attackAdvantageReasons.join(', ') : 'Advantage on attack rolls'
        badges.push({ label: 'Adv', cls: 'effect-target-adv', icon: 'fa-arrow-up', removable: false, tooltip: `Advantage on attack rolls${reasons !== 'Advantage on attack rolls' ? ' (' + reasons + ')' : ''}` })
    }
    if (effects.saveAdvantageCount > 0) {
        const reasons = (effects.saveAdvantageReasons || []).length > 0 ? effects.saveAdvantageReasons.join(', ') : 'Advantage on saving throws'
        badges.push({ label: 'Adv Save', cls: 'effect-target-adv', icon: 'fa-shield-halved', removable: false, tooltip: `Advantage on saving throws${reasons !== 'Advantage on saving throws' ? ' (' + reasons + ')' : ''}` })
    }
    if (effects.riderSaveDisadvantage) badges.push({ label: 'Save Disadv', cls: 'effect-disadvantage', icon: 'fa-shield', removable: false })
    if (effects.riderAttackBonus > 0) badges.push({ label: `+${effects.riderAttackBonus} to hit`, cls: 'effect-target-adv', icon: 'fa-bullseye', removable: true, effectType: 'damage_bonus' })
    if (effects.riderCannotOpportunityAttack) badges.push({ label: 'No OA', cls: 'effect-cannot-act', icon: 'fa-ban', removable: true, effectType: 'no_opportunity_attacks' })
    const noOA = getRuntimeValue(creatureName, 'inspiringMovementNoOA', campaignName) || hasTacticalShift
    if (creatureName && campaignName && noOA) {
        badges.push({ label: 'Insp. Move', cls: 'effect-cannot-act', icon: 'fa-person-walking', removable: false })
    }
    const remarkableNoOA = getRuntimeValue(creatureName, 'remarkableAthleteNoOA', campaignName)
    if (creatureName && campaignName && remarkableNoOA) {
        badges.push({ label: 'No OA (Crit)', cls: 'effect-cannot-act', icon: 'fa-ban', removable: false })
    }
    if (hasSpeedyOpportunityDisadvantage) {
        badges.push({ label: 'OA Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down', removable: false })
    }
    if (hasSpeedyDifficultTerrainIgnore) {
        badges.push({ label: 'No Difficult Terrain on Dash', cls: 'effect-cannot-act', icon: 'fa-person-walking', removable: false })
    }
    if (coronaDisadvantage) {
        badges.push({ label: 'Disadv Fire/Radiant', cls: 'effect-disadvantage', icon: 'fa-sun', removable: false })
    }

    const handleRemoveEffect = (effectType) => {
        const existingEffects = getRuntimeValue(campaignName, 'targetEffects') || []
        const index = existingEffects.findIndex(te => te.target === creatureName && te.effect === effectType)
        if (index === -1) return
        const filtered = [...existingEffects.slice(0, index), ...existingEffects.slice(index + 1)]
        setRuntimeValue(campaignName, 'targetEffects', filtered, campaignName)
    }

    return (
        <>
            {badges.map(b => (
                <div key={b.label} className={`condition-effect-badge ${b.cls}`} title={b.tooltip || getEffectDescription(b.label)}>
                    <i className={`fa-solid ${b.icon}`}></i> {b.label}
                    {isLocalhost && b.removable && (
                        <button
                            className='effect-break-btn'
                            onClick={() => handleRemoveEffect(b.effectType)}
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
