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
        // MN-020: never bake a numeric DC here — collectAutomationFromFeatures runs
        // BEFORE rules.getAbilities folds ability `.bonus` (CLA-229 fingerprint), so a
        // build-time 8 + mod + PB baked DC 14 for a STR +3 host. Pass the 'ability'
        // token through and let buildSaveDc resolve it against computed abilities at
        // prompt time (CLA-342 Stunning Strike data-fix precedent).
        const saveDc = auto.saveDc || 'ability'
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
    },

    // MN-002: movement maneuvers (Bait and Switch) — the collector dropped these
    // rows pre-render because DISPATCH had no entry and buildAttackInfo returned
    // null (psionic.js telekinetic_movement template). maneuverName must ride the
    // info: handleCombatSuperiorityMovement reads action.automation.maneuverName
    // and the merged special-action row carries the info as its .automation.
    'combat_superiority_movement': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'combat_superiority_movement',
            name: feature.name,
            description: feature.description || '',
            maneuverName: auto.maneuverName || feature.name,
            effect: auto.effect || 'ac_bonus_and_swap',
            range: auto.range || '5_ft',
            hasAutomation: true
        }
    },

    // MN-002 sibling: skill-check maneuvers (e.g. Evasive Footwork). Router
    // routes this type to specialActions and executeSkillCheckManeuver consumes
    // it (pendingSkillCheckBonus) — same builder gap closed.
    'combat_superiority_skill_check': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'combat_superiority_skill_check',
            name: feature.name,
            description: feature.description || '',
            maneuverName: auto.maneuverName || feature.name,
            skills: auto.skills || [],
            ability: auto.ability || null,
            initiativeBonus: !!auto.initiativeBonus,
            hasAutomation: true
        }
    }
}
