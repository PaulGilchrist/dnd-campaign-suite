import { rollD20 } from '../../dice/diceRoller.js'
import { getMonsterData } from '../../npcs/monsterUtils.js'
import { getAbilitySaveBonus } from './conditionUtils.js'
import { computeAuraBonus } from '../auras/auraOfProtection.js'
import { playerIsImmuneToCondition } from '../automation/automationService.js'
import { getAuraOfPuritySaveAdvantageConditions, isAuraOfPurityActive } from '../../automation/handlers/buffs/auraOfPurityHandler.js'
import { getCombatSummary } from '../../encounters/combatData.js'

async function getCreatureSaveBonus(creature, abilityAbbr, characters, campaignNpcs, getName) {
    if (creature.type === 'player') {
        const character = characters.find(c => getName(c.name) === creature.name)
        return getAbilitySaveBonus(character?.computedStats || character, abilityAbbr)
    }
    try {
        const monster = await getMonsterData(creature.name, campaignNpcs)
        if (monster?.saving_throws?.[abilityAbbr]) {
            return monster.saving_throws[abilityAbbr].modifier
        } else if (monster?.ability_score_modifiers?.[abilityAbbr]) {
            return monster.ability_score_modifiers[abilityAbbr]
        }
    } catch { /* ignore */ }
    return 0
}

async function rollConditionSave(creature, condition, characters, campaignNpcs, campaignName, mapName, getName) {
    const saveBonus = await getCreatureSaveBonus(creature, condition.ability, characters, campaignNpcs, getName)
    const aura = await computeAuraBonus({ targetName: creature.name, characters, campaignName, activeMapName: mapName, allCreatures: getCombatSummary(campaignName)?.creatures })
    const auraBonus = aura.bonus
    const conditionKey = String(condition.key || condition.label || '').toLowerCase()
    const hasAuraOfPurityAdvantage = isAuraOfPurityActive(creature.name, campaignName)
        && getAuraOfPuritySaveAdvantageConditions(creature.name, campaignName).includes(conditionKey)

    let hasPassiveImmunityAdvantage = false
    if (creature.type === 'player') {
        const playerCharacter = characters.find(c => getName(c.name) === creature.name)
        const playerStats = playerCharacter?.computedStats || playerCharacter
        const saveModifiers = playerStats?.saveModifiers || playerCharacter?.saveModifiers
        if (saveModifiers) {
            const matchingModifier = saveModifiers.find(mod =>
                mod.saveType && mod.condition && mod.target === 'saving_throw' && mod.effect === 'advantage' && (!mod.abilities || mod.abilities.length === 0) && mod.condition === conditionKey
            )
            if (matchingModifier) {
                hasPassiveImmunityAdvantage = true
            }
        }
        const powerfulBuildAdvantage = saveModifiers?.some(mod =>
            mod.target === 'ability_check' && mod.effect === 'advantage' && mod.abilities?.includes('STR') && mod.condition === 'powerful_build_grapple_escape'
        )
        if (powerfulBuildAdvantage && conditionKey === 'grappled') {
            hasPassiveImmunityAdvantage = true
        }
    }
    const hasAdvantage = hasAuraOfPurityAdvantage || hasPassiveImmunityAdvantage
    if (hasAdvantage) {
        const a = rollD20()
        const b = rollD20()
        const roll = Math.max(a, b)
        const total = roll + saveBonus + auraBonus
        const success = total >= condition.dc
        const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
        return { roll, total, success, bonus: saveBonus + auraBonus, bonusDetail, advantage: true, rolls: [a, b] }
    }
    const r1 = rollD20()
    const total = r1 + saveBonus + auraBonus
    const success = total >= condition.dc
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
    return { roll: r1, total, success, bonus: saveBonus + auraBonus, bonusDetail, rolls: [r1] }
}

function removeCondition(combatSummary, creatureName, condition, getRuntimeValue, setRuntimeValue, campaignName) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature) return
    const conditionKey = String(condition.key || condition).toLowerCase()
    const conditions = getRuntimeValue(creature.name, 'activeConditions') || []
    const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionKey)
    setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName)

    const existingMeta = getRuntimeValue(creature.name, 'activeConditionMeta', campaignName) || {}
    if (existingMeta[conditionKey]) {
        const remainingMeta = { ...existingMeta }
        delete remainingMeta[conditionKey]
        setRuntimeValue(creature.name, 'activeConditionMeta', remainingMeta, campaignName)
    }
}

function addCondition(combatSummary, creatureName, conditionDef, dc, ability, getRuntimeValue, setRuntimeValue, campaignName, playerStats) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature) return

    if (playerStats && getRuntimeValue && campaignName) {
        if (playerIsImmuneToCondition({
            conditionKey: conditionDef.key,
            playerStats,
            getRuntimeValue,
            campaignName,
        })) {
            return
        }
    }

    const conditions = getRuntimeValue(creature.name, 'activeConditions') || []
    const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionDef.key.toLowerCase())
    setRuntimeValue(creature.name, 'activeConditions', [...filtered, conditionDef.key], campaignName)

    const existingMeta = getRuntimeValue(creature.name, 'activeConditionMeta', campaignName) || {}
    const metaKey = conditionDef.key.toLowerCase()
    const shouldStoreMeta = dc || ability
    if (shouldStoreMeta) {
        setRuntimeValue(creature.name, 'activeConditionMeta', {
            ...existingMeta,
            [metaKey]: {
                ...(existingMeta[metaKey] || {}),
                ...(dc ? { dc } : {}),
                ...(ability ? { ability } : {}),
            },
        }, campaignName)
    }
}

function buildConditionPopup(roll, bonus, bonusDetail, abilityLabel, conditionLabel, dc, success, rolls, advantage) {
    return {
        type: 'd20',
        rollType: 'condition-save',
        name: abilityLabel,
        rolls: rolls || [roll],
        bonus,
        bonusDetail,
        targetName: null,
        targetAc: null,
        hit: undefined,
        condition: conditionLabel,
        dc,
        success,
        forcedMode: advantage ? 'advantage' : undefined,
    }
}

export {
    getCreatureSaveBonus,
    rollConditionSave,
    removeCondition,
    addCondition,
    buildConditionPopup,
}
