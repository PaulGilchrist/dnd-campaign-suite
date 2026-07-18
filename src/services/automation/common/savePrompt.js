import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getAbilityModifier } from '../../shared/abilityLookup.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

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
        condition: config.condition || null,
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
        condition: config.condition || null,
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

    const saveResultPromise = promise.then(async (detail) => {
        const attackerName = config.attackerName || config.targetName;
        const lastAttackData = {
            attackerName,
            targetName: config.targetName,
            d20: detail.roll ?? 0,
            d20Rolls: [detail.roll ?? 0, ...(detail.rawRolls || [])],
            bonus: detail.saveBonus ?? 0,
            total: detail.total ?? 0,
            rollType: 'attack',
            saveType: config.saveType || null,
            saveDc: config.saveDc,
            saveResult: detail.success ? 'success' : 'failure',
            saveConditions: config.condition ? [config.condition] : [],
            actionName: config.actionName || null,
            timestamp: Date.now(),
        };
        try {
            const cs = await getCombatContext(campaignName);
            const merged = { ...(cs || {}), lastAttack: lastAttackData };
            await storage.set('combatSummary', merged, campaignName);
        } catch (err) {
            console.error('[savePrompt] Failed to set lastAttack:', err);
        }
        return detail;
    });

    saveResultPromise.finally(() => {
        const saves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};
        delete saves[promptId];
        setRuntimeValue(campaignName, 'pendingSavePrompts', saves, campaignName);
    });

    return { promptId, promise: saveResultPromise };
}
