import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const PROMPT_KEY = 'biPrompt';
const PROMPT_CLEARED_KEY = 'biPromptCleared';

export function sendBardicInspirationDefensePrompt(campaignName, targetName, attackerName, attackRoll, bonus, effectiveAc, dieSize, promptId) {
    const data = {
        mode: 'defense',
        promptId,
        targetName,
        attackerName,
        attackRoll,
        bonus,
        effectiveAc,
        dieSize,
        fullDescription: 'When hit by an attack roll, you can use your Reaction to roll the Bardic Inspiration die and add the number rolled to your AC against that attack, potentially causing the attack to miss.',
    };
    setRuntimeValue(targetName, PROMPT_KEY, data, campaignName);
}

export function sendBardicInspirationOffensePrompt(campaignName, attackerName, targetName, dieSize, promptId) {
    const data = {
        mode: 'offense',
        promptId,
        targetName,
        attackerName,
        dieSize,
        fullDescription: 'Immediately after you hit a target with an attack roll, you can roll the Bardic Inspiration die and add the number rolled to the attack\'s damage against the target.',
    };
    setRuntimeValue(attackerName, PROMPT_KEY, data, campaignName);
}

export function clearBardicInspirationPrompt(campaignName, targetName) {
    setRuntimeValue(targetName, PROMPT_KEY, null, campaignName);
    setRuntimeValue(targetName, PROMPT_CLEARED_KEY, { promptId: null }, campaignName);
}

export function getBardicInspirationPrompt(campaignName, targetName) {
    return getRuntimeValue(targetName, PROMPT_KEY, campaignName);
}

export function clearBardicInspirationPromptState(_campaignName, targetName) {
    clearBardicInspirationPrompt(_campaignName, targetName);
}
