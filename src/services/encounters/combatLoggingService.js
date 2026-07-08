import utils from '../ui/utils.js'
import { addEntry } from '../ui/logService.js'

function logInitiativeRoll(campaignName, creatureName, roll, bonus) {
    return addEntry(campaignName, {
        type: 'roll',
        characterName: creatureName,
        rollType: 'initiative',
        name: 'Initiative',
        rolls: [roll],
        total: roll,
        bonus,
        mode: 'normal',
        isNatural20: roll === 20,
        isNatural1: roll === 1,
        timestamp: Date.now(),
        id: utils.guid(),
    }).catch((e) => { console.error("[combatLogging] Error:", e); })
}

function logConditionEvent(campaignName, action, creatureName, conditionLabel, dc, ability) {
    return addEntry(campaignName, {
        type: 'condition',
        action,
        characterName: creatureName,
        condition: conditionLabel,
        dc,
        ability,
        timestamp: Date.now(),
        id: utils.guid(),
    }).catch((e) => { console.error("[combatLogging] Error:", e); })
}

function logConcentrationSave(campaignName, creatureName, roll, bonus, bonusDetail, spellName, dc, success) {
    return addEntry(campaignName, {
        type: 'roll',
        rollType: 'concentration-save',
        characterName: creatureName,
        name: 'Constitution',
        rolls: [roll],
        mode: 'normal',
        total: roll,
        bonus,
        bonusDetail,
        condition: `Concentration: ${spellName}`,
        dc,
        success,
        timestamp: Date.now(),
        id: utils.guid(),
    }).catch((e) => { console.error("[combatLogging] Error:", e); })
}

function logConditionSave(campaignName, creatureName, roll, bonus, bonusDetail, conditionLabel, abilityLabel, dc, success) {
    return addEntry(campaignName, {
        type: 'roll',
        rollType: 'condition-save',
        characterName: creatureName,
        name: abilityLabel,
        rolls: [roll],
        mode: 'normal',
        total: roll,
        bonus,
        bonusDetail,
        condition: conditionLabel,
        dc,
        success,
        timestamp: Date.now(),
        id: utils.guid(),
    }).catch((e) => { console.error("[combatLogging] Error:", e); })
}

function logHpChange(campaignName, targetName, delta, currentHp, maxHp, isHealing, isUnconscious) {
    return addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta,
        currentHp,
        maxHp,
        isHealing,
        isUnconscious,
    }).catch((e) => { console.error("[combatLogging] Error:", e); })
}

function logNpcThreshold(campaignName, targetName, delta, threshold, maxHp) {
    return addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta,
        threshold,
        maxHp,
    }).catch((e) => { console.error("[combatLogging] Error:", e); })
}

export {
    logInitiativeRoll,
    logConditionEvent,
    logConcentrationSave,
    logConditionSave,
    logHpChange,
    logNpcThreshold,
}
