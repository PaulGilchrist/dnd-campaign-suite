import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function buildSaveDc(auto, playerStats) {
    if (auto.saveDc === 'ability') {
        let ability = auto.saveAbility || 'CON';
        if (Array.isArray(ability)) ability = ability[0];
        const abilityBonus = getAbilityModifier(playerStats.abilities, ability);
        const prof = playerStats.proficiency || 0;
        return 8 + abilityBonus + prof;
     }
    if (auto.saveDc === 'spell_save_dc') {
        const prof = playerStats.proficiency || 0;
        const chaBonus = getAbilityModifier(playerStats.abilities, 'CHA');
        return 8 + chaBonus + prof;
    }
    if (typeof auto.saveDc === 'number') return auto.saveDc;
    return 10;
 }

export function createSaveListener(campaignName, config) {
    const promptId = utils.guid();

    const pendingSaves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};
    pendingSaves[promptId] = {
        promptId,
        campaignName,
        targetName: config.targetName,
        saveType: config.saveType || 'CON',
        saveDc: config.saveDc,
        dcSuccess: config.dcSuccess,
        advantage: config.advantage || false,
        disadvantage: config.disadvantage || false,
    };
    setRuntimeValue(campaignName, 'pendingSavePrompts', pendingSaves, campaignName);

    sendSavePrompt(campaignName, {
        promptId,
        targetName: config.targetName,
        saveType: config.saveType || 'CON',
        saveDc: config.saveDc,
        dcSuccess: config.dcSuccess,
        advantage: config.advantage || false,
        disadvantage: config.disadvantage || false,
     });

    const promise = new Promise((resolve) => {
        const handler = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-result', handler);
            const saves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};
            delete saves[promptId];
            setRuntimeValue(campaignName, 'pendingSavePrompts', saves, campaignName);
            resolve(event.detail);
         };
        window.addEventListener('save-result', handler);
     });

    promise.finally(() => {
        const saves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};
        delete saves[promptId];
        setRuntimeValue(campaignName, 'pendingSavePrompts', saves, campaignName);
    });

    return { promptId, promise };
}
