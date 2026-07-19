import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { toggleBuff, isBuffActive } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const isHeightened = action.name === 'Heightened Patient Defense';

    const cost = auto.cost?.amount || 1;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(playerName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus >= cost) {
        await setRuntimeValue(playerName, 'focusPoints', currentFocus - cost, campaignName);

        let description = `${playerName} used ${action.name}: Disengage and Dodge as a bonus action.`;
        let tempHpRoll = null;

        // Activate existing Dodge buff using the same mechanism as the base Dodge action
        const dodgeActive = isBuffActive(playerName, 'Dodge', campaignName);
        if (!dodgeActive) {
            toggleBuff(playerName, 'Dodge', {
                effect: 'dodge',
                duration: 'until_start_of_next_turn',
            }, campaignName, playerName);
            addExpiration(playerName, playerName, [
                { type: 'remove_active_buff', buffName: 'Dodge' }
            ], campaignName, undefined, playerName);
        }

        // Add temp HP for heightened version
        if (isHeightened) {
            const martialArtsDie = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.martial_arts_die || 4;
            tempHpRoll = rollDie(martialArtsDie) + rollDie(martialArtsDie);
            const existingTempHp = Number(getRuntimeValue(playerName, 'tempHp', campaignName) || 0);
            const newTotal = Math.max(existingTempHp, tempHpRoll);
            setRuntimeValue(playerName, 'tempHp', newTotal, campaignName);
            description += ` Gained ${tempHpRoll} temporary hit points (2 × ${martialArtsDie}-sided die).`;
        }

        description += ` (${currentFocus - cost} Focus Points remaining).`;

        const logDesc = isHeightened && tempHpRoll
            ? `${playerName} used ${action.name} to Disengage and Dodge with ${tempHpRoll} temporary hit points`
            : `${playerName} used ${action.name} to Disengage and Dodge`;
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: logDesc,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: description,
                automation: auto,
            },
        };
    } else {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name} to Disengage as a bonus action (no Focus Points available for Dodge).`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${playerName} used ${action.name}: Disengage as a bonus action. (No Focus Points available for Dodge${isHeightened ? ` + Temporary Hit Points` : ''}. ${currentFocus}/${cost} Focus Points)`,
                automation: auto,
            },
        };
    }
}

function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}
