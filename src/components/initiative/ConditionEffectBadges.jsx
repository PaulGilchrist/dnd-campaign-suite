import { computeConditionEffects } from '../../services/combat/conditionEffects.js'

function ConditionEffectBadges({ conditions, targetEffects = [] }) {
    const condKeys = (conditions || []).map(c => c.key)
    const effects = computeConditionEffects(condKeys, [], targetEffects)
    const badges = []
    if (effects.cannotAct) badges.push({ label: "Can't Act", cls: 'effect-cannot-act', icon: 'fa-hand' })
    if (effects.speedZero) badges.push({ label: 'Speed 0', cls: 'effect-speed-zero', icon: 'fa-stop' })
    if (effects.autoCritWithin5ft) badges.push({ label: 'Auto-Crit', cls: 'effect-auto-crit', icon: 'fa-bolt' })
    if (effects.concentrationBroken) badges.push({ label: 'No Conc.', cls: 'effect-no-conc', icon: 'fa-spinner' })
    if (effects.autoFailSaves.length > 0) badges.push({ label: `Auto-Fail ${effects.autoFailSaves.join('/').toUpperCase()}`, cls: 'effect-auto-fail', icon: 'fa-shield' })
    if (effects.resistantToAll) badges.push({ label: 'Resist All', cls: 'effect-resist', icon: 'fa-shield-halved' })
    if (effects.attackDisadvantageCount > 0 || effects.abilityCheckDisadvantage) badges.push({ label: 'Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' })
    if (effects.targetAdvantageCount > 0) badges.push({ label: 'Adv vs', cls: 'effect-target-adv', icon: 'fa-arrow-up' })
    if (effects.riderSaveDisadvantage) badges.push({ label: 'Save Disadv', cls: 'effect-disadvantage', icon: 'fa-shield' })
    if (effects.riderAttackBonus > 0) badges.push({ label: `+${effects.riderAttackBonus} to hit`, cls: 'effect-target-adv', icon: 'fa-bullseye' })
    if (effects.riderCannotOpportunityAttack) badges.push({ label: 'No OA', cls: 'effect-cannot-act', icon: 'fa-ban' })
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
