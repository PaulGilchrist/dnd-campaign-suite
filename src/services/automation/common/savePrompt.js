import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export function buildSaveDc(auto, playerStats) {
    if (!playerStats) {
        console.error('[buildSaveDc] playerStats is null/undefined');
        return 10;
    }
    if (auto.saveDc === 'ability') {
        let ability = auto.saveAbility || 'CON';
        if (Array.isArray(ability)) ability = ability[0];
        const abilityBonus = getAbilityModifier(playerStats.abilities, ability);
        const prof = playerStats.proficiency || 0;
        return 8 + abilityBonus + prof;
     }
    if (auto.saveDc === 'spell_save_dc') {
        if (playerStats.spellAbilities?.saveDc != null) {
            return playerStats.spellAbilities.saveDc;
        }
        const prof = playerStats.proficiency || 0;
        const spellMod = playerStats.spellAbilities?.modifier ?? getAbilityModifier(playerStats.abilities, 'CHA');
        return 8 + spellMod + prof;
    }
    if (typeof auto.saveDc === 'number') return auto.saveDc;
    console.error(`[buildSaveDc] Spell "${auto.type || 'unknown'}" has no saveDc defined. Expected 'spell_save_dc', 'ability', or a number.`);
    return 10;
 }

function buildPromptPayload(config) {
    return {
        targetName: config.targetName,
        attackerName: config.attackerName || null,
        saveType: config.saveType || 'CON',
        saveDc: config.saveDc,
        dcSuccess: config.dcSuccess,
        advantage: config.advantage || false,
        disadvantage: config.disadvantage || false,
        condition: config.condition || null,
        damageFormula: config.damageFormula || null,
        damageType: config.damageType || null,
        rawDamage: config.rawDamage || 0,
        sourceName: config.sourceName || null,
        secondaryFormula: config.secondaryFormula || null,
        secondaryDamageType: config.secondaryDamageType || null,
        secondaryRawDamage: config.secondaryRawDamage || 0,
        isSpellDamage: config.isSpellDamage === true,
    };
}

function resolveSaveOutcome(promptData, detail) {
    const pd = promptData || {};
    return {
        attackerName: pd.attackerName || detail.attackerName || 'Unknown',
        targetName: pd.targetName || detail.targetName || 'Unknown',
        saveType: pd.saveType || detail.saveType || 'CON',
        saveDc: pd.saveDc || detail.saveDc || 0,
        success: detail.success,
        roll: detail.roll ?? 0,
        saveBonus: detail.saveBonus ?? 0,
        total: detail.total ?? 0,
        advantage: pd.advantage,
        disadvantage: pd.disadvantage,
        dcSuccess: pd.dcSuccess,
        sourceName: pd.sourceName,
        condition: pd.condition,
        damageFormula: pd.damageFormula,
        damageType: pd.damageType,
        rawDamage: pd.rawDamage,
    };
}

function logSaveOutcome(campaignName, config, detail) {
    const fields = resolveSaveOutcome(config, detail);
    const rollDetail = describeSaveRoll({ roll: fields.roll, saveBonus: fields.saveBonus, total: fields.total, advantage: fields.advantage, disadvantage: fields.disadvantage, success: fields.success, dcSuccess: fields.dcSuccess });

    const description = `${fields.targetName} ${fields.success ? 'succeeded' : 'failed'} ${fields.saveType} save (DC ${fields.saveDc}, ${rollDetail})`;

    const entry = buildSaveResultEntry({
        characterName: fields.attackerName,
        targetName: fields.targetName,
        saveDc: fields.saveDc,
        saveType: fields.saveType,
        success: fields.success,
        roll: fields.roll,
        total: fields.total,
        saveBonus: fields.saveBonus,
        description,
        sourceName: fields.sourceName,
        condition: fields.condition,
        damageFormula: fields.damageFormula,
        damageType: fields.damageType,
        rawDamage: fields.rawDamage,
    });

    return addEntry(campaignName, entry).catch((e) => { console.error('[savePrompt] Error logging save result:', e); });
}

export function createSaveListener(campaignName, config) {
    const promptId = utils.guid();
    console.debug(`[saveDebug] createSaveListener creating prompt`, { promptId, campaignName, targetName: config.targetName, saveType: config.saveType, saveDc: config.saveDc });

    const payload = buildPromptPayload(config);

    const pendingSaves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
    pendingSaves[promptId] = { promptId, campaignName, ...payload };
    setRuntimeValue('campaign', 'pendingSavePrompts', pendingSaves, campaignName);

    const listenerPrompts = getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || [];
    listenerPrompts.push(promptId);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', listenerPrompts, campaignName);

    sendSavePrompt(campaignName, { promptId, ...payload });

    const promise = new Promise((resolve) => {
        const handler = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-result', handler);
            const saves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
            delete saves[promptId];
            setRuntimeValue('campaign', 'pendingSavePrompts', saves, campaignName);
            resolve(event.detail);
         };
        window.addEventListener('save-result', handler);
     });

    const saveResultPromise = promise.then(async (detail) => {
        await logSaveOutcome(campaignName, config, detail);
        return detail;
    });

    saveResultPromise.finally(() => {
        const saves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
        delete saves[promptId];
        setRuntimeValue('campaign', 'pendingSavePrompts', saves, campaignName);
    });

    return { promptId, promise: saveResultPromise };
}

function describeSaveRoll({ roll, saveBonus, total, advantage, disadvantage, success, dcSuccess }) {
    let rollDetail = `rolled ${roll}${saveBonus !== 0 ? ' +' + saveBonus : ''} = ${total}`;
    if (advantage && disadvantage) {
        rollDetail += ' (advantage & disadvantage cancel)';
    } else if (advantage) {
        rollDetail += ' (advantage)';
    } else if (disadvantage) {
        rollDetail += ' (disadvantage)';
    }
    if (success && dcSuccess !== undefined && dcSuccess !== null) {
        const successLabel = dcSuccess === 0 ? 'none' : (dcSuccess === 0.5 ? 'half' : 'full');
        rollDetail += ` — ${successLabel} success`;
    }
    return rollDetail;
}

function buildSaveResultEntry({ characterName, targetName, saveDc, saveType, success, roll, total, saveBonus, description, sourceName, condition, damageFormula, damageType, rawDamage }) {
    const entry = {
        type: 'save_result',
        characterName,
        targetName,
        saveDc,
        saveType,
        success,
        roll,
        total,
        saveBonus,
        description,
    };

    if (sourceName && sourceName !== characterName) {
        entry.sourceName = sourceName;
    }
    if (condition) {
        entry.condition = condition;
    }
    if (damageFormula) {
        entry.damageFormula = damageFormula;
    }
    if (damageType) {
        entry.damageType = damageType;
    }
    if (rawDamage) {
        entry.rawDamage = rawDamage;
    }

    return entry;
}
