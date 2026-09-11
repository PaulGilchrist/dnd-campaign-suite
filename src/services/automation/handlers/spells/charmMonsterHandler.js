import { handleCharmSpell } from './charmSpellUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    return handleCharmSpell(action, playerStats, campaignName, {
        targetsKey: 'charmMonsterTargets',
        advantagesKey: 'charmMonsterAdvantages',
        rollType: 'save-charm-monster',
        noTargetDescription: 'No target selected. Charm Monster has no effect.',
        logPrefix: '[charmMonster] Error:',
    });
}
