import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const name = action.name;

    const damageTypeKey = `_${name.replace(/\s+/g, '_')}_damageType`;
    const currentDamageType = getRuntimeValue(playerStats.name, damageTypeKey, campaignName);

    if (!currentDamageType) {
        await setRuntimeValue(playerStats.name, damageTypeKey, auto.damageType || 'Psychic', campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: name,
        description: `${name}: Damage type can be changed to ${auto.damageType || 'Psychic'} for Warlock spells that deal damage. Enchantment and Illusion Warlock spells require no Verbal or Somatic components.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description: `${name}: When you cast a Warlock spell that deals damage, you can change its damage type to ${auto.damageType || 'Psychic'}. When you cast a Warlock spell that is an Enchantment or Illusion, you can do so without Verbal or Somatic components.`,
            automation: auto,
        },
    };
}

export function isPsychicSpellsActive(playerStats) {
    const passives = playerStats?.automation?.passives || [];
    return passives.some(p => p.type === 'psychic_spells');
}

export function getPsychicSpellsConfig(playerStats) {
    const passives = playerStats?.automation?.passives || [];
    return passives.find(p => p.type === 'psychic_spells');
}
