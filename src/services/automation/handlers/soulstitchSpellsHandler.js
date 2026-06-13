import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCombatContext } from '../../../services/rules/damageUtils.js';
import { addEntry } from '../../../services/ui/logService.js';

const EVOCATION_SCHOOL = 'Evocation';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Soulstitch Spells';

    // Check if this is an Evocation spell
    const spell = action.spell || action.payload?.spell;
    const spellSchool = (spell?.school || '').toLowerCase();

    if (spellSchool !== EVOCATION_SCHOOL) {
        return null;
    }

    // Check if the spell has a save (dc field)
    const hasSave = !!(spell?.dc || auto?.saveType);

    if (!hasSave) {
        return null;
    }

    // Get the spell slot level for max selections
    const spellSlotLevel = action.spellSlotLevel || spell?.level || 1;
    const maxSelections = 1 + spellSlotLevel;

    // Get combat context for creature targets
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary?.creatures) {
        return null;
    }

    // Get previously chosen creatures for this spell cast
    const castKey = `_${featureName.replace(/\s+/g, '_')}_cast_${Date.now()}`;
    const chosenCreatures = getRuntimeValue(playerName, castKey, campaignName) || [];

    // Get all creatures the caster can see (all creatures except self in combat)
    const eligibleTargets = combatSummary.creatures
        .filter(c => c.name !== playerName)
        .map(c => c.name);

    return {
        type: 'modal',
        modalName: 'soulstitchSpells',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName,
            featureName,
            maxSelections,
            eligibleTargets,
            chosenCreatures,
            spellName: spell?.name || 'Unknown',
            spellSchool,
        },
    };
}

export async function applySoulstitchSelection(action, playerStats, campaignName, selectedNames) {
    const featureName = action.name || 'Soulstitch Spells';
    const playerName = playerStats.name;

    if (!selectedNames || selectedNames.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No creatures chosen.`,
            },
        };
    }

    const castKey = `_${featureName.replace(/\s+/g, '_')}_cast_${Date.now()}`;
    await setRuntimeValue(playerName, castKey, selectedNames, campaignName);

    // Store a persistent key for the current spell cast context
    const persistentKey = `_${featureName.replace(/\s+/g, '_')}_active`;
    await setRuntimeValue(playerName, persistentKey, selectedNames, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: ${selectedNames.length} creature(s) chosen for automatic save success: ${selectedNames.join(', ')}`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: ${selectedNames.join(', ')} automatically succeed on saves and take no damage.`,
            automation: action.automation,
        },
    };
}
