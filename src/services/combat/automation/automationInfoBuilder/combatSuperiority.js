import { getSaveDc } from '../automationExpressions.js'
import { getAbilityModifier } from '../../../shared/abilityLookup.js'

function resolveSaveAbility(auto) {
    const raw = auto.saveAbility
    if (Array.isArray(raw)) return raw
    if (raw) return [raw]
    return ['STR']
}

function pickBestSaveAbility(abilities, saveAbilities) {
    let best = 'STR'
    let bestMod = -Infinity
    for (const ab of saveAbilities) {
        const mod = getAbilityModifier(abilities, ab)
        if (mod > bestMod) {
            bestMod = mod
            best = ab
        }
    }
    return best
}

function computeMaxOptions(playerStats, auto) {
    const base = auto.maxOptions || 3
    const scaling = auto.maxOptionsScaling || {}
    let total = base
    const level = playerStats.level || 0
    const sortedLevels = Object.keys(scaling)
        .map(Number)
        .filter(l => !isNaN(l))
        .sort((a, b) => a - b)
    for (const scaleLevel of sortedLevels) {
        if (level >= scaleLevel) {
            total += scaling[scaleLevel]
        }
    }
    return total
}

export const combatSuperiorityHandlers = {
    'combat_superiority': (feature, playerStats) => {
        const auto = feature.automation
        const saveAbilities = resolveSaveAbility(auto)
        const saveAbility = pickBestSaveAbility(playerStats.abilities, saveAbilities)
        const prof = playerStats.proficiency || 0
        const saveDc = auto.saveDc === 'ability'
            ? getSaveDc(playerStats, saveAbility, prof)
            : auto.saveDc || 10
        const maxOptions = computeMaxOptions(playerStats, auto)
        return {
            type: 'combat_superiority',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc,
            saveAbility,
            saveAbilities,
            dieExpression: auto.dieExpression || 'superiority_die',
            usesMax: auto.uses_max || 4,
            usesRecharge: auto.recharge || 'short_rest',
            options: auto.options || [],
            maxOptions,
            oncePerTurn: !!auto.oncePerTurn,
            chooseOne: !!auto.chooseOne,
            hasAutomation: true
        }
    },

    'tactical_mind': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'tactical_mind',
            name: feature.name,
            bonusExpression: auto.bonusExpression || '',
            hasAutomation: true
        }
    },

    'know_enemy': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'know_enemy',
            name: feature.name,
            range: auto.range || '30_ft',
            usesMax: auto.uses_max || 4,
            hasAutomation: true
        }
    }
}
