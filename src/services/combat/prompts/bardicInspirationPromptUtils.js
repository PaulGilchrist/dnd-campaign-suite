import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../../hooks/runtime/useRuntimeState.js';

// Combat Inspiration adjudication prompts ride the `<name>-biPrompt` top-level
// change-data key through the campaign store (`name` is the reacting creature:
// defense → target, offense → attacker), mirroring the sibling save/concentration/
// death-save prompt lanes (savePromptService.js): one dedicated wildcard key per
// prompt, and a resolved prompt is EVICTED with the wildcard DELETE
// (deleteRuntimeKey — server removes the key and publishes a null echo), never
// left persisted for the SSE connect-snapshot to replay. The old lane wrote the
// prompt into the character bucket with a local-only clear, so every answered/
// skipped prompt resurrected its modal on the next connect of any tab
// (bug-bi-prompt-skip-never-evicts-server-key). The `-biPrompt` key shape is
// registered in campaignKeys.js so value echoes mirror into every mounted tab's
// campaign store and the null echo is a REMOVE (pendingOAs echo-misroute family).
function biPromptKey(name) {
    return `${name}-biPrompt`;
}

export function sendBardicInspirationDefensePrompt({ campaignName, targetName, attackerName, attackRoll, bonus, effectiveAc, dieSize, promptId }) {
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
    setRuntimeValue('campaign', biPromptKey(targetName), data, campaignName);
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
    setRuntimeValue('campaign', biPromptKey(attackerName), data, campaignName);
}

export function clearBardicInspirationPrompt(campaignName, name) {
    deleteRuntimeKey('campaign', biPromptKey(name), campaignName);
}

export function getBardicInspirationPrompt(campaignName, name) {
    return getRuntimeValue('campaign', biPromptKey(name));
}
