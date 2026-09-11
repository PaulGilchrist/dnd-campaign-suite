import { buildAttackInfo } from './automationInfoBuilder.js'
import { routeAutomation } from './automationRouter.js'
export { collectTurnStartEffects } from './turnStartEffects.js'
export { processFeatureAutomation } from './processFeatureAutomation.js'

const SPECIAL_AUTOMATIONS = [
    {
        matches: auto => auto?.type === 'passive_rule' && auto?.effect === 'arcane_ward',
        collect: (feature, auto, result) => {
            result.passives.push({
                type: 'arcane_ward',
                name: feature.name,
                wardHpExpression: auto.wardHpExpression || '',
                wardRestoreExpression: auto.wardRestoreExpression || '',
                bonusActionRestore: !!auto.bonusActionRestore,
            })
        },
    },
    {
        matches: auto => auto?.type === 'projected_ward',
        collect: (feature, auto, result) => {
            result.reactions.push({
                type: 'projected_ward',
                name: feature.name,
                range: auto.range || 30,
                reaction: true,
                automation: {
                    type: 'projected_ward',
                    name: feature.name,
                    range: auto.range || 30,
                    reaction: true,
                    wardTrigger: auto.wardTrigger || 'ally_damage_taken',
                    casting_time: auto.casting_time || '1 reaction',
                    hasAutomation: true,
                },
            })
        },
    },
    {
        matches: auto => auto?.type === 'passive_rule' && auto?.effect === 'arcane_apotheosis',
        collect: (feature, auto, result) => {
            result.passives.push({
                type: 'passive_rule',
                name: feature.name,
                effect: 'arcane_apotheosis',
                hasAutomation: true,
            })
        },
    },
    {
        matches: auto => auto?.type === 'passive_rule' && auto?.effect === 'spell_breaker',
        collect: (feature, auto, result) => {
            result.passives.push({
                type: 'spell_breaker',
                name: feature.name,
                spellLevel: auto.spellLevel || 1,
                alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
                bonusActionSpells: auto.bonusActionSpells || [],
                dispelAbilityCheckBonus: auto.dispelAbilityCheckBonus || '',
                slotRetentionSpells: auto.slotRetentionSpells || [],
            })
        },
    },
    {
        matches: auto => auto?.type === 'passive_rule' && auto?.effect === 'relentless',
        collect: (feature, auto, result) => {
            result.passives.push({
                type: 'passive_rule',
                name: feature.name,
                effect: 'relentless',
                hasAutomation: true,
            })
        },
    },
    {
        // CLA-301: Sacred Weapon — the feature-held passive marker that gates
        // the steps/features/sacredWeapon.js damage-type-swap consumer. The row
        // itself stays routed as a temp_buff special action (fall through below).
        matches: auto => auto?.type === 'temp_buff' && auto?.effect === 'sacred_weapon',
        collect: (feature, auto, result) => {
            result.passives.push({
                type: 'passive_buff',
                name: feature.name,
                effect: 'sacred_weapon',
                hasAutomation: true,
            })
        },
        fallThrough: true,
    },
]

function collectCantripRangeBonus(info, result) {
    if (info.type !== 'damage_bonus' || !info.rangeBonusCantrip) return
    const bonusMatch = String(info.rangeBonusCantrip).match(/(\d+)/)
    if (!bonusMatch) return
    result.passives.push({
        type: 'cantrip_range_bonus',
        name: info.name,
        effect: 'cantrip_range_bonus',
        bonusExpression: bonusMatch[1],
        hasAutomation: true,
    })
}

export function collectAutomationFromFeatures(features, playerStats) {
    const result = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        passives: [],
        autoEffects: [],
        saveModifiers: [],
        primalKnowledge: [],
        ritualSpells: []
    }

    if (!features) return result

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            const special = SPECIAL_AUTOMATIONS.find(entry => entry.matches(auto))
            if (special) {
                special.collect(feature, auto, result)
                if (!special.fallThrough) continue
            }
            const info = buildAttackInfo({ ...feature, automation: auto }, playerStats)
            if (!info) continue

            routeAutomation(info, auto, result)

            collectCantripRangeBonus(info, result)
        }
    })

    return result
}

