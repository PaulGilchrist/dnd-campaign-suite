import { sendSavePrompt } from '../../savePromptService.js';
import utils from '../../utils.js';

export function buildSaveDc(auto, playerStats) {
    if (auto.saveDc === 'ability') {
        const conBonus = playerStats.abilities?.find(a => a.name === 'CON')?.bonus || 0;
        const prof = playerStats.proficiency || 0;
        return 8 + conBonus + prof;
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
