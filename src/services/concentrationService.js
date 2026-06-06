import * as concentrationRules from './concentrationRules.js'
import { computeAuraBonus } from './auraOfProtection.js'
import { getCreatureSaveBonus } from './conditionSaveService.js'

async function rollConcentrationSave(creature, concentration, characters, campaignNpcs, campaignName, mapName, getName) {
    const saveBonus = await getCreatureSaveBonus(creature, 'con', characters, campaignNpcs, getName)
    const aura = await computeAuraBonus({ targetName: creature.name, characters, campaignName, activeMapName: mapName })
    const auraBonus = aura.bonus
    const effectiveSaveBonus = saveBonus + auraBonus
    const { roll: r1, success } = concentrationRules.rollConcentrationSave(effectiveSaveBonus, concentration.dc)
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
    return { roll: r1, success, bonus: effectiveSaveBonus, bonusDetail }
}

function breakConcentration(combatSummary, creatureName) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature || !creature.concentration) return null
    const spell = creature.concentration.spell
    creature.concentration = concentrationRules.breakConcentration(creature.concentration)
    return spell
}

function addConcentration(combatSummary, creatureName, spellName, dc) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature) return
    creature.concentration = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        spell: spellName.trim(),
        dc,
    }
}

function buildConcentrationPopup(roll, bonus, bonusDetail, spellName, dc, success) {
    return {
        type: 'd20',
        rollType: 'condition-save',
        name: 'Concentration',
        rolls: [roll],
        bonus,
        bonusDetail,
        targetName: null,
        targetAc: null,
        hit: undefined,
        condition: spellName,
        dc,
        success,
    }
}

export {
    rollConcentrationSave,
    breakConcentration,
    addConcentration,
    buildConcentrationPopup,
}
