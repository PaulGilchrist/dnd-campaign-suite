import { rollD20 } from '../../dice/diceRoller.js'
import { getMonsterData } from '../../npcs/monsterUtils.js'
import { getAbilitySaveBonus } from './conditionUtils.js'
import { computeAuraBonus } from '../auraOfProtection.js'
import { playerIsImmuneToCondition } from '../automationService.js'
import { getAuraOfPuritySaveAdvantageConditions, isAuraOfPurityActive } from '../../automation/handlers/buffs/auraOfPurityHandler.js'

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
    const aura = await computeAuraBonus({ targetName: creature.name, characters, campaignName, activeMapName: mapName })
    const auraBonus = aura.bonus
    const conditionKey = String(condition.key || condition.label || '').toLowerCase()
    const hasAuraOfPurityAdvantage = isAuraOfPurityActive(creature.name, campaignName)
        && getAuraOfPuritySaveAdvantageConditions(creature.name, campaignName).includes(conditionKey)
    if (hasAuraOfPurityAdvantage) {
        const a = rollD20()
        const b = rollD20()
        const roll = Math.max(a, b)
        const total = roll + saveBonus + auraBonus
        const success = total >= condition.dc
        const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
        return { roll, total, success, bonus: saveBonus + auraBonus, bonusDetail, advantage: true }
    }
    const r1 = rollD20()
    const total = r1 + saveBonus + auraBonus
    const success = total >= condition.dc
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
    return { roll: r1, total, success, bonus: saveBonus + auraBonus, bonusDetail }
}

function removeCondition(combatSummary, creatureName, condition, getRuntimeValue, setRuntimeValue, campaignName) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature) return
    if (creature.type === 'player') {
        const conditions = getRuntimeValue(creature.name, 'activeConditions') || []
        const filtered = conditions.filter(c => String(c).toLowerCase() !== (condition.key || condition).toLowerCase())
        setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName)
    } else {
        creature.conditions = creature.conditions.filter(c => c.id !== condition.id)
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

    if (creature.type === 'player') {
        const conditions = getRuntimeValue(creature.name, 'activeConditions') || []
        const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionDef.key.toLowerCase())
        setRuntimeValue(creature.name, 'activeConditions', [...filtered, conditionDef.key], campaignName)
    } else {
        creature.conditions = creature.conditions.filter(c => c.key !== conditionDef.key)
        creature.conditions.push({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            key: conditionDef.key,
            label: conditionDef.label,
            dc,
            ability,
        })
    }
}

function buildConditionPopup(roll, bonus, bonusDetail, abilityLabel, conditionLabel, dc, success) {
    return {
        type: 'd20',
        rollType: 'condition-save',
        name: abilityLabel,
        rolls: [roll],
        bonus,
        bonusDetail,
        targetName: null,
        targetAc: null,
        hit: undefined,
        condition: conditionLabel,
        dc,
        success,
    }
}

export {
    getCreatureSaveBonus,
    rollConditionSave,
    removeCondition,
    addCondition,
    buildConditionPopup,
}
