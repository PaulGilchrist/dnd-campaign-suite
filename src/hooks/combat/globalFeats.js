import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

// CLA-134: Feats of Chaos (Wild Magic Sorcery): the armed latch folds
// Advantage into the FIRST d20 test that reaches the roll seam
// (computeD20Roll), CONSUMES there, and logs the consumption — this is the
// single consume owner (weapon attacks, spell attacks via the spell-cast
// lane, saves, checks/skills and initiative all converge on that seam).
// An existing forcedMode (caster conditions) or a Restore Balance-cancelled
// roll (CLA-295 pre-roll cancel) beats the fold and leaves the latch armed.
export function consumeFeatsOfChaos(characterName, campaignName, { name, rollType, forcedMode, restoreBalanceCancelled } = {}) {
    if (forcedMode && forcedMode !== 'normal') return null;
    if (restoreBalanceCancelled) return null;
    const focActive = getRuntimeValue(characterName, 'featsOfChaosActive', campaignName);
    if (focActive !== true) return null;
    setRuntimeValue(characterName, 'featsOfChaosActive', false, campaignName, true);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: 'Feats of Chaos',
        description: `${characterName} consumed Feats of Chaos: Advantage on ${name} ${rollType}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[FeatsOfChaos] Error logging consumption:', e); });
    return 'advantage';
}
