import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';

export function buildSaveDc(auto, playerStats) {
    if (auto.saveDc === 'ability') {
        const ability = auto.saveAbility || 'CON';
        const abilityBonus = getAbilityModifier(playerStats.abilities, ability);
        const prof = playerStats.proficiency || 0;
        return 8 + abilityBonus + prof;
     }
    if (auto.saveDc === 'spell_save_dc') {
        const prof = playerStats.proficiency || 0;
        const chaBonus = getAbilityModifier(playerStats.abilities, 'CHA');
        return 8 + chaBonus + prof;
    }
    return auto.saveDc || 10;
 }

export function createSaveListener(campaignName, config) {
    const promptId = utils.guid();

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
            resolve(event.detail);
         };
        window.addEventListener('save-result', handler);
     });

    return { promptId, promise };
}
