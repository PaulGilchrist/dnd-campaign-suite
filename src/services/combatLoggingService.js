import utils from './utils.js'
import { postLogEntry } from './shared/logPoster.js'

function logInitiativeRoll(campaignName, creatureName, roll, bonus) {
    return postLogEntry(campaignName, {
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
    })
}

function logConditionEvent(campaignName, action, creatureName, conditionLabel, dc, ability) {
    return postLogEntry(campaignName, {
        type: 'condition',
        action,
        characterName: creatureName,
        condition: conditionLabel,
        dc,
        ability,
        timestamp: Date.now(),
        id: utils.guid(),
    })
}

function logConcentrationSave(campaignName, creatureName, roll, bonus, bonusDetail, spellName, dc, success) {
    return postLogEntry(campaignName, {
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
    })
}

function logConditionSave(campaignName, creatureName, roll, bonus, bonusDetail, conditionLabel, abilityLabel, dc, success) {
    return postLogEntry(campaignName, {
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
    })
}

function logHpChange(campaignName, targetName, delta, currentHp, maxHp, isHealing, isUnconscious) {
    return postLogEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta,
        currentHp,
        maxHp,
        isHealing,
        isUnconscious,
    })
}

function logNpcThreshold(campaignName, targetName, delta, threshold, maxHp) {
    return postLogEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta,
        threshold,
        maxHp,
    })
}

export {
    logInitiativeRoll,
    logConditionEvent,
    logConcentrationSave,
    logConditionSave,
    logHpChange,
    logNpcThreshold,
}
