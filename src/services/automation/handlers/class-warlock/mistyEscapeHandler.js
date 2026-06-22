import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { findLastAttack } from '../../common/damageRollback.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Misty Escape';

    // Check that the player has recently taken damage
    const attackResult = await findLastAttack();
    const damageEvent = attackResult.attackEvent;
    if (!damageEvent || isStale(damageEvent) || attackResult.targetName !== playerName || !attackResult.totalDamage) {
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

    // Apply Disappearing Step: Invisible condition until start of next turn
    const storedConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
        await setRuntimeValue(playerName, 'activeConditions', [...conditions, 'invisible'], campaignName);
    }

    // Set expiration: Invisible lasts until start of player's next turn (~1 round)
    addExpiration(playerName, playerName, [
        { type: 'condition', condition: 'invisible' }
    ], campaignName, 1);

    // Dreadful Step: Creatures within 5 feet of space you left or appear in
    // make WIS save or take 2d10 Psychic damage
    const saveDc = buildSaveDc(auto, playerStats);

    // Build description for the popup
    let description = `<b>${featureName}</b><br/><br/>`;
    description += `Cast <b>Misty Step</b> as a Reaction in response to taking damage.<br/><br/>`;
    description += `<b>Disappearing Step:</b> You have the Invisible condition until the start of your next turn (or until you attack, deal damage, or cast a spell).<br/><br/>`;
    description += `<b>Dreadful Step:</b> Creatures within 5 feet of the space you left or appear in must make a <b>Wisdom</b> saving throw (DC ${saveDc}) or take <b>2d10 Psychic damage</b>.<br/><br/>`;
    description += `<em>Open your spell sheet to cast Misty Step. After teleporting, the Dreadful Step and Disappearing Step effects apply.</em>`;

    // Create a save listener for Dreadful Step — the target(s) are nearby creatures
    // We prompt for a primary target; the DM/UI handles AoE application
    const saveType = auto.saveType || 'WIS';

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — Reaction Misty Step cast, Invisible until start of next turn, Dreadful Step WIS save DC ${saveDc} for nearby creatures.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            saveType,
            saveDc,
            damageExpression: '2d10',
            damageType: 'Psychic',
            aoeRange: '5_ft',
            triggerMistyStep: true,
        },
    };
}
