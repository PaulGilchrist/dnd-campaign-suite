const passiveKey = (effect) => `rule:${effect}`
const typeKey = (type) => `type:${type}`

const buildSteadyAimClear = (feature) => ({
    type: 'steady_aim_clear',
    name: feature.name,
})

const buildSimple = (type) => (feature) => ({
    type,
    name: feature.name,
})

const TURN_START_EFFECT_BUILDERS = {
    [passiveKey('heroic_inspiration_turn_start')]: buildSimple('heroic_inspiration'),
    [passiveKey('end_of_turn_condition_removal')]: (feature, auto) => {
        const conditions = (auto.conditions || []).map(c => c.toLowerCase())
        if (conditions.length === 0) return null
        return {
            type: 'condition_removal',
            name: feature.name,
            conditions,
        }
    },
    [passiveKey('flurry_healing_harm')]: (feature, auto) => ({
        type: 'flurry_healing_harm',
        name: feature.name,
        usesExpression: auto.usesExpression || 'WIS modifier minimum 1',
    }),
    [passiveKey('dread_ambush_speed')]: (feature, auto) => ({
        type: 'dread_ambush_speed',
        name: feature.name,
        bonusExpression: auto.bonusExpression || '10',
    }),
    [passiveKey('supreme_sneak')]: buildSimple('supreme_sneak'),
    [passiveKey('umbral_sight')]: buildSimple('umbral_sight'),
    [passiveKey('naturally_stealthy')]: buildSimple('naturally_stealthy'),
    [passiveKey('create_thrall_temp_hp')]: (feature, auto) => ({
        type: 'create_thrall_temp_hp',
        name: feature.name,
        tempHpExpression: auto.tempHpExpression || 'warlock level + CHA modifier',
    }),
    [passiveKey('mage_hand_legerdemain')]: buildSimple('mage_hand_legerdemain'),
    [passiveKey('roving_aim')]: buildSteadyAimClear,
    [typeKey('steady_aim')]: buildSteadyAimClear,
    [typeKey('living_legend')]: buildSimple('living_legend_turn_start'),
    [typeKey('elder_champion')]: (feature) => ({
        type: 'elder_champion_regeneration',
        name: feature.name,
        healExpression: '10',
    }),
    [typeKey('radiant_soul')]: buildSimple('radiant_soul_turn_start'),
    [typeKey('damage_aura')]: (feature, auto) => {
        if (feature.name !== 'Inner Radiance') return null
        return {
            type: 'inner_radiance_turn_start',
            name: feature.name,
            damageExpression: auto.damageExpression || 'proficiency_bonus',
            damageType: auto.damageType || 'Radiant',
            range: auto.range || '10_ft',
        }
    },
    [typeKey('temp_hp_buff')]: (feature, auto) => {
        if (!auto.healingStartOfTurn) return null
        return {
            type: 'vitalityOfTheTree_turn_start',
            name: feature.name,
            ongoingHealingExpression: auto.ongoingHealingExpression || '',
            healingRange: auto.healingRange || '10 ft',
        }
    },
    [typeKey('precise_hunter')]: buildSimple('precise_hunter'),
    [typeKey('hunter_lore')]: buildSimple('hunter_lore'),
    [typeKey('use_magic_device')]: (feature, auto) => ({
        type: 'use_magic_device',
        name: feature.name,
        attunementLimit: auto.attunementLimit || 4,
    }),
    [passiveKey('divination_savant')]: buildSimple('divination_savant'),
    [passiveKey('evocation_savant')]: buildSimple('evocation_savant'),
    [passiveKey('illusion_savant')]: buildSimple('illusion_savant'),
    [passiveKey('improved_illusions')]: buildSimple('improved_illusions'),
    [passiveKey('tavern_brawler_push')]: buildSimple('tavern_brawler_push'),
    [passiveKey('ignore_loading_crossbows')]: (feature, auto) => ({
        type: 'ignore_loading_crossbows',
        name: feature.name,
        weapons: auto.weapons || [],
    }),
    [passiveKey('no_melee_disadvantage_crossbows')]: buildSimple('no_melee_disadvantage_crossbows'),
    [passiveKey('grapple_damage')]: buildSimple('grapple_damage'),
    [passiveKey('confusion_turn_start')]: buildSimple('confusion_turn_start'),
    [typeKey('healing_start_of_turn')]: (feature, auto) => ({
        type: auto.bloodiedOnly ? 'survivor_turn_start_heal' : 'regenerate_turn_start_heal',
        name: feature.name,
        healExpression: auto.healExpression || '1',
        bloodiedOnly: auto.bloodiedOnly || false,
        bodyPartRegrowMinutes: auto.bodyPartRegrowMinutes || 2,
    }),
    [passiveKey('arcane_ward')]: (feature, auto) => ({
        type: 'arcane_ward',
        name: feature.name,
        wardHpExpression: auto.wardHpExpression || '',
        wardRestoreExpression: auto.wardRestoreExpression || '',
        bonusActionRestore: !!auto.bonusActionRestore,
    }),
    [passiveKey('projected_ward')]: (feature, auto) => ({
        type: 'projected_ward',
        name: feature.name,
        range: auto.range || 30,
        reaction: true,
    }),
    [passiveKey('spell_breaker')]: (feature, auto) => ({
        type: 'spell_breaker',
        name: feature.name,
        alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
        bonusActionSpells: auto.bonusActionSpells || [],
        dispelAbilityCheckBonus: auto.dispelAbilityCheckBonus || '',
        slotRetentionSpells: auto.slotRetentionSpells || [],
    }),
    [typeKey('phantasmal_creatures')]: (feature, auto) => ({
        type: 'phantasmal_creatures',
        name: feature.name,
        alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
        freeCastSpells: auto.freeCastSpells || [],
        usesMax: auto.usesMax || 1,
        halvesHp: auto.halvesHp || false,
    }),
}

function dispatchTurnStartEffect(feature, auto) {
    const key = auto?.type === 'passive_rule' ? passiveKey(auto.effect) : typeKey(auto?.type)
    const builder = Object.hasOwn(TURN_START_EFFECT_BUILDERS, key) ? TURN_START_EFFECT_BUILDERS[key] : null
    return builder ? builder(feature, auto) : null
}

export function collectTurnStartEffects(features) {
    const effects = []
    if (!features) return effects

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            const effect = dispatchTurnStartEffect(feature, auto)
            if (effect) effects.push(effect)
        }
    })

    return effects
}
