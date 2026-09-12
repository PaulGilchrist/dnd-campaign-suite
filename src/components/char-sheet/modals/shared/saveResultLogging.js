import { addEntry } from '../../../../services/ui/logService.js';

export function saveResultLogValues(detail) {
    return { roll: detail.roll ?? 0, total: detail.total ?? 0, saveBonus: detail.saveBonus ?? 0 };
}

export function saveResultDescription(targetName, saveType, saveDc, success, detail) {
    const { roll, total, saveBonus } = saveResultLogValues(detail);
    const outcome = success ? 'succeeded on' : 'failed';
    return `${targetName} ${outcome} ${saveType} save (DC ${saveDc}, rolled ${roll}${saveBonus !== 0 ? ' + ' + saveBonus : ''} = ${total})`;
}

export function logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success, detail, logPrefix }) {
    const { roll, total, saveBonus } = saveResultLogValues(detail);
    return addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        targetName,
        saveDc,
        saveType,
        success,
        roll,
        total,
        saveBonus,
        description: saveResultDescription(targetName, saveType, saveDc, success, detail),
        timestamp: Date.now(),
    }).catch((e) => { console.error(`${logPrefix} Error logging save result:`, e); });
}

export function logConditionApplied(campaignName, { targetName, condition, reason, note, logPrefix }) {
    return addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition,
        reason,
        note,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`${logPrefix} Error logging condition:`, e); });
}
