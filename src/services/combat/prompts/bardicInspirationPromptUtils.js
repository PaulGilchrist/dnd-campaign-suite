import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../../hooks/runtime/useRuntimeState.js';

// OFFENSE Combat Inspiration adjudication prompts ride the `<name>-biPrompt`
// top-level change-data key through the campaign store (`name` is the ATTACKING
// creature — the one who hit), mirroring the sibling save/concentration/
// death-save prompt lanes (savePromptService.js): one dedicated wildcard key per
// prompt, and a resolved prompt is EVICTED with the wildcard DELETE
// (deleteRuntimeKey — server removes the key and publishes a null echo), never
// left persisted for the SSE connect-snapshot to replay. The old lane wrote the
// prompt into the character bucket with a local-only clear, so every answered/
// skipped prompt resurrected its modal on the next connect of any tab
// (bug-bi-prompt-skip-never-evicts-server-key). The `-biPrompt` key shape is
// registered in campaignKeys.js so value echoes mirror into every mounted tab's
// campaign store and the null echo is a REMOVE (pendingOAs echo-misroute family).
// The defense half of this lane was DELETED (bug-bi-defense-prompt-producer-
// orphaned, owner decision 2026-11-17): it had zero production call sites, and
// the single source of truth for the hit-reaction defense adjudication is the
// popup-inline `Bardic Inspiration - Defense (dN)` button fed by
// hitResolution.js applyBardicInspirationDefense. Never reintroduce a
// `mode: 'defense'` payload on this key — the modal refuses to mount it.
function biPromptKey(name) {
    return `${name}-biPrompt`;
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
