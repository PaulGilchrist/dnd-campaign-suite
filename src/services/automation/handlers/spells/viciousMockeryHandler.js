import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';


export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const targetName = auto.targetName || 'Unknown';

    // Vicious Mockery: the save+damage roll is handled by the generic spell flow.
    // The handler just applies the disadvantage effect on failure.
    // Since we can't know the save result here (rollDamage doesn't return it),
    // we apply the effect and let the expiration system clean it up.
    // The frontend's save-damage roll entry will show the save result to the user.

    const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'disadvantage_next_attack' && te.source === playerStats.name
    );

    const mockeryEffect = {
        target: targetName,
        source: playerStats.name,
        effect: 'disadvantage_next_attack',
    };

    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = mockeryEffect;
    } else {
        allTargetEffects.push(mockeryEffect);
    }

    setRuntimeValue(campaignName, 'targetEffects', allTargetEffects, campaignName);

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: playerStats.name },
    ], campaignName, 1);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Disadvantage on next attack',
        reason: 'Vicious Mockery (failed save)',
        note: `${targetName} has Disadvantage on the next attack roll until the start of ${playerStats.name}'s next turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[viciousMockery] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Vicious Mockery',
            targetName,
            description: `${targetName} takes psychic damage and has Disadvantage on the next attack roll until the start of ${playerStats.name}'s next turn.`,
            automation: auto,
        },
    };
}
