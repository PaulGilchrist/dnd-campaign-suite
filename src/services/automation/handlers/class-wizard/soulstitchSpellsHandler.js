import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { soulstitchStampKey } from '../../../../hooks/combat/loggedDiceRollUtils.js';

const EVOCATION_SCHOOL = 'evocation';

function resolveSpell(action) {
    return action.spell || action.payload?.spell;
}

function spellHasSave(spell, auto) {
    return !!(spell?.dc || auto?.saveType);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Soulstitch Spells';

    // Check if this is an Evocation spell
    const spell = resolveSpell(action);
    const spellSchool = (spell?.school || '').toLowerCase();

    if (spellSchool !== EVOCATION_SCHOOL) {
        return null;
    }

    // Check if the spell has a save (dc field)
    if (!spellHasSave(spell, auto)) {
        return null;
    }

    // Get the spell slot level for max selections
    const spellSlotLevel = action.spellSlotLevel || spell?.level || 1;
    const maxSelections = 1 + spellSlotLevel;

    // Get combat context from in-memory cache (same source as initiative tracker)
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary?.creatures) {
        return null;
    }

    // CLA-321: "other creatures you can see" — the caster is never an eligible target.
    const eligibleTargets = combatSummary.creatures.filter(c => c.name !== playerName).map(c => c.name);

    return {
        type: 'modal',
        modalName: 'soulstitchSpells',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName: _mapName,
            featureName,
            maxSelections,
            eligibleTargets,
            spellName: spell?.name || 'Unknown',
            spellSchool,
        },
    };
}

export async function applySoulstitchSelection(action, playerStats, campaignName, selectedNames) {
    const featureName = action.name || 'Soulstitch Spells';
    const playerName = playerStats.name;

    const persistentKey = soulstitchStampKey(playerName);

    if (!selectedNames || selectedNames.length === 0) {
        // CLA-321: declining the chooser protects no one this cast — clear any stale stamp.
        await setRuntimeValue(playerName, persistentKey, [], campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No creatures chosen.`,
            },
        };
    }

    // CLA-321: per-cast stamp; consumed (cleared) when the cast resolves.
    await setRuntimeValue(playerName, persistentKey, selectedNames, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: ${selectedNames.length} creature(s) chosen for automatic save success: ${selectedNames.join(', ')}`,
    }).catch((e) => { console.error("[soulstitchSpellsHandler:log-error]", e); });

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
