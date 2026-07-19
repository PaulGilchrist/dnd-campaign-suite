import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

export async function handle(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const epitomeActive = getRuntimeValue(playerName, 'elementalEpitomeActive', campaignName);

    if (!epitomeActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: action.automation?.type,
                description: 'Elemental Epitome must be active to use Destructive Stride.',
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'destructiveStride',
        payload: { action, playerStats, campaignName },
    };
}

export async function applyDamageTypeChoice(action, playerStats, campaignName, chosenType) {
    const chosen = DAMAGE_TYPES.find(t => t === chosenType);
    if (!chosen) return null;

    await setRuntimeValue(playerStats.name, 'destructiveStrideDamageType', chosen, campaignName);
    await setRuntimeValue(playerStats.name, 'destructiveStrideActive', true, campaignName);

    const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
    const martialArtsDie = classLevel?.martial_arts_die || 4;

    const combatSummary = getCombatSummary(campaignName);
    const targets = combatSummary
        ? combatSummary.creatures
            .filter(c => c.name !== playerStats.name)
            .map(c => ({
                name: c.name,
                type: c.type,
                currentHp: c.currentHp,
                maxHp: c.maxHp,
                size: c.size,
            }))
        : [];

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Destructive Stride activated — Speed +20 ft, damage type set to ${chosen} (d${martialArtsDie}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] Error logging:', e); });

    return {
        type: 'modal',
        modalName: 'destructiveStrideTarget',
        payload: { action, playerStats, campaignName, chosenType: chosen, martialArtsDie, targets },
    };
}

export async function applyTargetChoice(action, playerStats, campaignName, targetName, chosenType, martialArtsDie) {
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) return null;

    const target = combatSummary.creatures.find(c => c.name === targetName);
    if (!target) return null;

    const rollResult = rollExpression(`1d${martialArtsDie}`);
    const damage = rollResult?.total || martialArtsDie;

    const characters = combatSummary.creatures.filter(c => c.type === 'player') || [];
    applyDamageToTarget(
        combatSummary, targetName, damage, [chosenType.toLowerCase()],
        campaignName, characters, false, playerStats.name, false
    );

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Destructive Stride — ${targetName} takes ${damage} ${chosenType} damage (d${martialArtsDie} roll: ${rollResult?.total || martialArtsDie}).`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] Error logging target:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: `${targetName} takes ${damage} ${chosenType} damage.`,
            automation: action.automation,
        },
    };
}

export async function skipTargetChoice(action, playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, 'destructiveStrideActive', true, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: 'Destructive Stride activated — Speed +20 ft, no target chosen.',
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] Error logging skip:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: 'Destructive Stride activated — Speed +20 ft, no damage dealt.',
            automation: action.automation,
        },
    };
}
