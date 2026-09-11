import { handleCharmSpell } from './charmSpellUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    return handleCharmSpell(action, playerStats, campaignName, {
        targetsKey: 'charmPersonTargets',
        advantagesKey: 'charmPersonAdvantages',
        rollType: 'save-charm-person',
        noTargetDescription: 'No target selected. Charm Person has no effect.',
        saveConditions: ['charmed'],
        logPrefix: '[charmPerson] Error:',
    });
}
