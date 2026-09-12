import { rollD20 } from '../../dice/diceRoller.js'
import { getMonsterData } from '../../npcs/monsterUtils.js'
import { getAbilitySaveBonus } from './conditionUtils.js'
import { computeAuraBonus } from '../auras/auraOfProtection.js'
import { playerIsImmuneToCondition } from '../automation/automationService.js'
import { getAuraOfPuritySaveAdvantageConditions, isAuraOfPurityActive } from '../../automation/handlers/buffs/auraOfPurityHandler.js'
import { isCircleOfPowerActive } from '../../automation/handlers/buffs/circleOfPowerHandler.js'
import { getCombatSummary } from '../../encounters/combatData.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { hasStarryDragonConstellation } from '../starryFormConstellation.js'

async function getCreatureSaveBonus(creature, abilityAbbr, characters, campaignNpcs, getName) {
    if (creature.type === 'player') {
        if (creature.wildShapeSource && abilityAbbr === 'con') {
            return creature.wildShapeConSaveBonus ?? 0
        }
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
    } catch (error) { console.warn('[conditionSaveService] Monster save bonus unavailable:', error) }
    return 0
}

const CONDITION_KEYWORD_TO_KEY = { poison: 'poisoned' }

function isSavingThrowAdvantageMod(mod, conditionKey) {
    return mod.target === 'saving_throw' && mod.effect === 'advantage' && (!mod.abilities || mod.abilities.length === 0) && (mod.condition === conditionKey || CONDITION_KEYWORD_TO_KEY[mod.condition] === conditionKey)
}

function isPowerfulBuildAdvantageMod(mod) {
    return mod.target === 'ability_check' && mod.effect === 'advantage' && mod.abilities?.includes('STR') && mod.condition === 'powerful_build_grapple_escape'
}

function hasPassiveImmunityAdvantage(creature, characters, getName, conditionKey) {
    if (creature.type !== 'player') return false
    const playerCharacter = characters.find(c => getName(c.name) === creature.name)
    const playerStats = playerCharacter?.computedStats || playerCharacter
    const saveModifiers = playerStats?.saveModifiers || playerCharacter?.saveModifiers
    if (saveModifiers?.some(mod => isSavingThrowAdvantageMod(mod, conditionKey))) {
        return true
    }
    const powerfulBuildAdvantage = saveModifiers?.some(isPowerfulBuildAdvantageMod)
    return !!(powerfulBuildAdvantage && conditionKey === 'grappled')
}

function hasProtectionFromPoisonAdvantage(creatureName, campaignName, conditionKey) {
    if (conditionKey !== 'poisoned') return false
    const activeBuffs = getRuntimeValue(creatureName, 'activeBuffs', campaignName) || []
    return activeBuffs.some(b => b.name === 'Protection from Poison' && b.saveAdvantageTypes?.includes('poisoned'))
}

function buildSaveResult({ roll, rolls, saveBonus, auraBonus, aura, dc, starryDragonFloor, advantage }) {
    const total = roll + saveBonus + auraBonus
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
    return { roll, total, success: total >= dc, bonus: saveBonus + auraBonus, bonusDetail, ...(advantage ? { advantage: true } : {}), rolls, starryDragonFloor }
}

function applyStarryDragonFloor(roll, dragonConstellationActive) {
    return dragonConstellationActive && roll <= 9 ? 10 : roll
}

async function rollConditionSave(creature, condition, characters, campaignNpcs, campaignName, mapName, getName) {
    const saveBonus = await getCreatureSaveBonus(creature, condition.ability, characters, campaignNpcs, getName)
    const aura = await computeAuraBonus({ targetName: creature.name, characters, campaignName, activeMapName: mapName, allCreatures: getCombatSummary(campaignName)?.creatures })
    const auraBonus = aura.bonus
    const conditionKey = String(condition.key || condition.label || '').toLowerCase()
    const auraOfPurityActive = isAuraOfPurityActive(creature.name, campaignName)
    const saveAdvConditions = getAuraOfPuritySaveAdvantageConditions(creature.name, campaignName)
    const hasAuraOfPurityAdvantage = auraOfPurityActive && saveAdvConditions.includes(conditionKey)

    if (auraOfPurityActive && !hasAuraOfPurityAdvantage) {
        const rawStored = getRuntimeValue(creature.name, 'auraOfPuritySaveAdvantageConditions', campaignName)
        const activeBuffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || []
        console.debug('[conditionSave] DEBUG creature=%s rawStored=%s activeBuffs=%s',
            creature.name, JSON.stringify(rawStored), JSON.stringify(activeBuffs.map(b => b.name)))
    }

    const hasPassiveAdvantage = hasPassiveImmunityAdvantage(creature, characters, getName, conditionKey)
    const hasPoisonAdvantage = hasProtectionFromPoisonAdvantage(creature.name, campaignName, conditionKey)
    const hasAdvantage = hasAuraOfPurityAdvantage || hasPassiveAdvantage || isCircleOfPowerActive(creature.name, campaignName) || hasPoisonAdvantage
    const dragonConstellationActive = String(condition.ability || '').toLowerCase() === 'con' && hasStarryDragonConstellation(creature, characters)
    if (hasAdvantage) {
        const rolls = [rollD20(), rollD20()]
        const max = Math.max(...rolls)
        const roll = applyStarryDragonFloor(max, dragonConstellationActive)
        return buildSaveResult({ roll, rolls, saveBonus, auraBonus, aura, dc: condition.dc, starryDragonFloor: dragonConstellationActive, advantage: true })
    }
    const rawRoll = rollD20()
    const roll = applyStarryDragonFloor(rawRoll, dragonConstellationActive)
    return buildSaveResult({ roll, rolls: [rawRoll], saveBonus, auraBonus, aura, dc: condition.dc, starryDragonFloor: dragonConstellationActive, advantage: false })
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

function addCondition({ combatSummary, creatureName, conditionDef, dc, ability, getRuntimeValue, setRuntimeValue, campaignName, playerStats }) {
    if (!combatSummary || !combatSummary.creatures) {
        console.error(`[addCondition] combatSummary is null/undefined or missing creatures when adding ${conditionDef.key} to ${creatureName}`)
        return
    }
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

function buildConditionPopup({ roll, bonus, bonusDetail, abilityLabel, conditionLabel, dc, success, rolls, advantage, starryDragonFloor }) {
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
        ...(starryDragonFloor ? { starryDragonFloor } : {}),
    }
}

export {
    getCreatureSaveBonus,
    rollConditionSave,
    removeCondition,
    addCondition,
    buildConditionPopup,
}
