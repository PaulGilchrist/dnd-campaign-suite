import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js'
import { getRuntimeValue } from '../../hooks/useRuntimeState.js'

function ConditionEffectBadges({ conditions, targetEffects = [], creatureName, campaignName, hasTacticalShift, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects(condKeys, [], targetEffects)
    const badges = []
    if (effects.cannotAct) badges.push({ label: "Can't Act", cls: 'effect-cannot-act', icon: 'fa-hand' })
    if (effects.speedZero) badges.push({ label: 'Speed 0', cls: 'effect-speed-zero', icon: 'fa-stop' })
    if (effects.speedReduction) badges.push({ label: `Speed -${effects.speedReduction}`, cls: 'effect-speed-zero', icon: 'fa-minus' })
    if (effects.pushEffect) badges.push({ label: `Push ${effects.pushDistance || 10} ft`, cls: 'effect-push', icon: 'fa-angles-right' })
    if (effects.proneEffect) badges.push({ label: 'Prone', cls: 'effect-prone', icon: 'fa-person-falling' })
    if (effects.autoCritWithin5ft) badges.push({ label: 'Auto-Crit', cls: 'effect-auto-crit', icon: 'fa-bolt' })
    if (effects.concentrationBroken) badges.push({ label: 'No Conc.', cls: 'effect-no-conc', icon: 'fa-spinner' })
    if (effects.autoFailSaves.length > 0) badges.push({ label: `Auto-Fail ${effects.autoFailSaves.join('/').toUpperCase()}`, cls: 'effect-auto-fail', icon: 'fa-shield' })
    if (effects.resistantToAll) badges.push({ label: 'Resist All', cls: 'effect-resist', icon: 'fa-shield-halved' })
    if (effects.attackDisadvantageCount > 0 || effects.abilityCheckDisadvantage) badges.push({ label: 'Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' })
    if (effects.strCheckDisadvantage) badges.push({ label: 'STR Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' })
    if (effects.rayOfEnfeebleDamageReduction) badges.push({ label: '-1d8 dmg', cls: 'effect-damage-reduction', icon: 'fa-burst' })
    if (effects.targetAdvantageCount > 0) badges.push({ label: 'Adv vs', cls: 'effect-target-adv', icon: 'fa-arrow-up' })
    if (effects.targetDisadvantageCount > 0) badges.push({ label: 'Disadv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down' })
    if (effects.riderSaveDisadvantage) badges.push({ label: 'Save Disadv', cls: 'effect-disadvantage', icon: 'fa-shield' })
    if (effects.riderAttackBonus > 0) badges.push({ label: `+${effects.riderAttackBonus} to hit`, cls: 'effect-target-adv', icon: 'fa-bullseye' })
    if (effects.riderCannotOpportunityAttack) badges.push({ label: 'No OA', cls: 'effect-cannot-act', icon: 'fa-ban' })
    const noOA = getRuntimeValue(creatureName, 'inspiringMovementNoOA', campaignName) || hasTacticalShift
    if (creatureName && campaignName && noOA) {
        badges.push({ label: 'Insp. Move', cls: 'effect-cannot-act', icon: 'fa-person-walking' })
    }
    const remarkableNoOA = getRuntimeValue(creatureName, 'remarkableAthleteNoOA', campaignName)
    if (creatureName && campaignName && remarkableNoOA) {
        badges.push({ label: 'No OA (Crit)', cls: 'effect-cannot-act', icon: 'fa-ban' })
    }
    if (hasSpeedyOpportunityDisadvantage) {
        badges.push({ label: 'OA Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' })
    }
    if (hasSpeedyDifficultTerrainIgnore) {
        badges.push({ label: 'No Difficult Terrain on Dash', cls: 'effect-cannot-act', icon: 'fa-person-walking' })
    }
    return (
        <>
            {badges.map(b => (
                <div key={b.label} className={`condition-effect-badge ${b.cls}`} title={b.label}>
                    <i className={`fa-solid ${b.icon}`}></i> {b.label}
                </div>
            ))}
        </>
    )
}

export default ConditionEffectBadges
