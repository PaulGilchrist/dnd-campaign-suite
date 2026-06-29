import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

function ConditionEffectBadges({ conditions, targetEffects = [], creatureName, campaignName, hasTacticalShift, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, isLocalhost }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects(condKeys, [], targetEffects)
    const badges = []
    if (effects.cannotAct) badges.push({ label: "Can't Act", cls: 'effect-cannot-act', icon: 'fa-hand', removable: false })
    if (effects.speedZero) badges.push({ label: 'Speed 0', cls: 'effect-speed-zero', icon: 'fa-stop', removable: false })
    if (effects.speedReduction) badges.push({ label: `Speed -${effects.speedReduction}`, cls: 'effect-speed-zero', icon: 'fa-minus', removable: false })
    if (effects.pushEffect) badges.push({ label: `Push ${effects.pushDistance || 10} ft`, cls: 'effect-push', icon: 'fa-angles-right', removable: true, effectType: 'push' })
    if (effects.proneEffect) badges.push({ label: 'Prone', cls: 'effect-prone', icon: 'fa-person-falling', removable: true, effectType: 'prone_and_push' })
    if (effects.autoCritWithin5ft) badges.push({ label: 'Auto-Crit', cls: 'effect-auto-crit', icon: 'fa-bolt', removable: false })
    if (effects.concentrationBroken) badges.push({ label: 'No Conc.', cls: 'effect-no-conc', icon: 'fa-spinner', removable: false })
    if (effects.autoFailSaves.length > 0) badges.push({ label: `Auto-Fail ${effects.autoFailSaves.join('/').toUpperCase()}`, cls: 'effect-auto-fail', icon: 'fa-shield', removable: false })
    if (effects.resistantToAll) badges.push({ label: 'Resist All', cls: 'effect-resist', icon: 'fa-shield-halved', removable: false })
    if (effects.attackDisadvantageCount > 0 || effects.abilityCheckDisadvantage) badges.push({ label: 'Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down', removable: false })
    if (effects.strCheckDisadvantage) badges.push({ label: 'STR Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down', removable: false })
    if (effects.rayOfEnfeebleDamageReduction) badges.push({ label: '-1d8 dmg', cls: 'effect-damage-reduction', icon: 'fa-burst', removable: false })
    if (effects.targetAdvantageCount > 0) badges.push({ label: 'Adv vs', cls: 'effect-target-adv', icon: 'fa-arrow-up', removable: false })
    if (effects.targetDisadvantageCount > 0) badges.push({ label: 'Disadv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down', removable: false })
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
                <div key={b.label} className={`condition-effect-badge ${b.cls}`} title={b.label}>
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
