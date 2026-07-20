import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Misty Escape';

    // Check that the player has recently taken damage
    const attackResult = await findLastAttack(campaignName);
    const damageEvent = attackResult.attackEvent;
    if (!damageEvent || attackResult.targetName !== playerName || !attackResult.totalDamage) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent damage taken. ${featureName} can only be used as a Reaction when you take damage.`,
                automation: auto,
            },
        };
    }

    // Get combat context for eligible targets (creatures within 5 ft of the space you left/appear in)
    const cs = await getCombatContext(campaignName);
    const eligibleTargets = cs?.creatures?.filter(c => c.name !== playerName) || [];

    const saveDc = buildSaveDc(auto, playerStats);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — Reaction Misty Step cast. Choose Disappearing Step (Invisible) or Dreadful Step (2d10 Psychic damage) for nearby creatures.`,
    }).catch(() => {});

    return {
        type: 'modal',
        modalName: 'stepsOfTheFeyTaunt',
        payload: {
            mode: 'mistyEscape',
            title: 'Misty Step',
            targets: eligibleTargets,
            action,
            playerStats,
            campaignName,
            saveDc,
            featureName,
        },
    };
}
