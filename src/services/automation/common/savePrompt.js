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

export function createSaveListener(campaignName, config) {
    const promptId = utils.guid();
    console.debug(`[saveDebug] createSaveListener creating prompt`, { promptId, campaignName, targetName: config.targetName, saveType: config.saveType, saveDc: config.saveDc });

    const pendingSaves = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
    pendingSaves[promptId] = {
        promptId,
        campaignName,
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
    setRuntimeValue('campaign', 'pendingSavePrompts', pendingSaves, campaignName);

    const listenerPrompts = getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || [];
    listenerPrompts.push(promptId);
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', listenerPrompts, campaignName);

    sendSavePrompt(campaignName, {
        promptId,
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
     });

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
        const promptData = config;
        const attackerName = promptData?.attackerName || detail.attackerName || 'Unknown';
        const targetName = promptData?.targetName || detail.targetName || 'Unknown';
        const saveType = promptData?.saveType || detail.saveType || 'CON';
        const saveDc = promptData?.saveDc || detail.saveDc || 0;
        const success = detail.success;
        const roll = detail.roll ?? 0;
        const saveBonus = detail.saveBonus ?? 0;
        const total = detail.total ?? 0;
        const advantage = promptData?.advantage;
        const disadvantage = promptData?.disadvantage;
        const dcSuccess = promptData?.dcSuccess;
        const sourceName = promptData?.sourceName;
        const condition = promptData?.condition;
        const damageFormula = promptData?.damageFormula;
        const damageType = promptData?.damageType;
        const rawDamage = promptData?.rawDamage;

        const rollDetail = describeSaveRoll({ roll, saveBonus, total, advantage, disadvantage, success, dcSuccess });

        const description = `${targetName} ${success ? 'succeeded' : 'failed'} ${saveType} save (DC ${saveDc}, ${rollDetail})`;

        const entry = buildSaveResultEntry({
            characterName: attackerName,
            targetName,
            saveDc,
            saveType,
            success,
            roll,
            total,
            saveBonus,
            description,
            sourceName,
            condition,
            damageFormula,
            damageType,
            rawDamage,
        });

        await addEntry(campaignName, entry).catch((e) => { console.error('[savePrompt] Error logging save result:', e); });
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
