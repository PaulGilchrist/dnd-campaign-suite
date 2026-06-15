import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

export async function handle(action, _playerStats, _campaignName) {
    const auto = action.automation;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name}: Select a creature within your reach that just left your reach to cast a spell as a reaction. The spell must have a casting time of 1 action and target only that creature.`,
            automation: auto,
            trigger: 'opportunity_attack_reaction',
        },
    };
}

export function applyWarCasterReaction(targetName, spellName, spellData, playerStats, campaignName) {
    const stored = getRuntimeValue(campaignName, 'warCasterReactions') || [];
    stored.push({
        targetName,
        spellName,
        spellData,
        characterName: playerStats.name,
        timestamp: Date.now(),
    });
    setRuntimeValue(campaignName, 'warCasterReactions', stored, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'War Caster - Reactive Spell',
        description: `War Caster Reactive Spell: Casting ${spellName} as a reaction on ${targetName}.`,
    }).catch(() => {});

    return { ok: true };
}
