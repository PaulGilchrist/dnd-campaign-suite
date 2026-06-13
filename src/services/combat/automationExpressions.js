import { getAbilityModifier } from '../shared/abilityLookup.js'

function resolveUses(playerStats, usesSpec) {
    if (typeof usesSpec === 'number') return usesSpec
    if (usesSpec === 'proficiency_bonus') return playerStats.proficiency || 0
    if (typeof usesSpec === 'string' && usesSpec.endsWith('_level')) {
        const className = usesSpec.replace('_level', '')
        if (playerStats.class?.name?.toLowerCase() === className) return playerStats.level
        return playerStats.class?.levels || playerStats.level || 0
    }
    return playerStats.level || 1
}

function resolveScaling(playerStats, scaling) {
    if (!scaling) return null
    let result = null
    for (const entry of scaling) {
        if (playerStats.level >= entry.level) {
            result = entry
        }
    }
    return result
}

function getSaveDc(playerStats, ability, proficiency) {
    return 8 + getAbilityModifier(playerStats.abilities, ability) + (proficiency || 0)
}

function resolveHealingPoolExpression(baseExpression, scaling, playerStats) {
    if (!scaling) return baseExpression
    const entries = Object.entries(scaling)
        .map(([k, v]) => ({ level: parseInt(k, 10), expression: String(v) }))
        .filter(e => !isNaN(e.level))
        .sort((a, b) => a.level - b.level)
    let resolved = baseExpression
    for (const entry of entries) {
        if (playerStats.level >= entry.level) {
            resolved = entry.expression
        }
    }
    return resolved
}

function getSuperiorityDieSize(playerStats) {
    const level = playerStats?.level || 1
    if (level >= 18) return 12
    if (level >= 10) return 10
    return 8
}

function getPsionicEnergyDieSize(playerStats) {
    const level = playerStats?.level || 3
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
    if (classLevel?.energy) {
        return classLevel.energy.energy_die_type || 6
    }
    if (level >= 17) return 12
    if (level >= 13) return 10
    if (level >= 9) return 8
    return 6
}

function resolveDiceExpression(expression, playerStats, slotLevel) {
    if (!expression) return expression
    const prof = playerStats?.proficiency || 0
    const level = playerStats?.level || 1
    slotLevel = slotLevel || 1
    const rageDamage = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2
    const bardicDie = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_die || 6
    const superiorityDie = getSuperiorityDieSize(playerStats)
    const psionicEnergyDie = getPsionicEnergyDieSize(playerStats)
    const martialArtsDie = playerStats?.class?.class_levels?.find(cl => cl.level === playerStats.level)?.martial_arts_die || 4
    const favoredEnemy = playerStats?.class?.class_levels?.find(cl => cl.level === playerStats.level)?.favored_enemy || 0
    let expr = expression
        .replace(/bardic_inspiration_die/g, bardicDie)
        .replace(/proficiency_bonus_d4/g, `${Math.max(1, prof)}d4`)
        .replace(/proficiency_bonus/g, prof)
        .replace(/monk level/gi, level)
        .replace(/monk_level/gi, level)
        .replace(/fighter_level/gi, level)
        .replace(/fighter level/gi, level)
        .replace(/paladin level/gi, level)
        .replace(/barbarian_level/gi, level)
        .replace(/barbarian level/gi, level)
        .replace(/bard level/gi, level)
        .replace(/rage_damage_d6/g, `${rageDamage}d6`)
        .replace(/rage_damage/g, rageDamage)
        .replace(/cleric_level/gi, level)
        .replace(/cleric level/gi, level)
        .replace(/druid_level/gi, level)
        .replace(/superiority_die/g, superiorityDie)
        .replace(/psionic_energy_die/g, psionicEnergyDie)
        .replace(/martial_arts_die/g, martialArtsDie)
        .replace(/favored_enemy/gi, favoredEnemy)
        .replace(/rogue_level/gi, level)
        .replace(/warlock_level/gi, level)
        .replace(/warlock level/gi, level)
        .replace(/level/gi, level)
        .replace(/spell_slot_level/g, slotLevel)
    const abilities = playerStats?.abilities || {}
    const abilityModifiers = {
        strength: getAbilityModifier(abilities, 'strength'),
        dexterity: getAbilityModifier(abilities, 'dexterity'),
        constitution: getAbilityModifier(abilities, 'constitution'),
        intelligence: getAbilityModifier(abilities, 'intelligence'),
        wisdom: getAbilityModifier(abilities, 'wisdom'),
        charisma: getAbilityModifier(abilities, 'charisma'),
    }
    expr = expr
        .replace(/STR modifier/gi, abilityModifiers.strength)
        .replace(/DEX modifier/gi, abilityModifiers.dexterity)
        .replace(/CON modifier/gi, abilityModifiers.constitution)
        .replace(/INT modifier/gi, abilityModifiers.intelligence)
        .replace(/WIS modifier/gi, abilityModifiers.wisdom)
        .replace(/CHA modifier/gi, abilityModifiers.charisma)
    return expr
}

export function evaluateAutoExpression(expression, playerStats, prof, level, slotLevel) {
    if (!expression) return expression
    prof = prof || 0
    level = level || 1
    let expr = resolveDiceExpression(expression, playerStats, slotLevel)

    const minMatch = expr.match(/^(.+?)_min_(\d+)$/)
    if (minMatch) {
        expr = `Math.max(${minMatch[2]}, (${minMatch[1]}))`
    }

    try {
        const result = new Function(`"use strict"; return (${expr})`)()
        if (typeof result === 'number' && !isNaN(result)) return result
    } catch (e) { /* not a simple expression, return as string */ }
    return expr
}

export { resolveUses, resolveScaling, getSaveDc, resolveHealingPoolExpression, resolveDiceExpression, getSuperiorityDieSize, getPsionicEnergyDieSize }
