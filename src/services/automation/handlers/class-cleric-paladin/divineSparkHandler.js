import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';

// CLA-092: fallback table mirrors public/data/2024/classes.json Cleric
// channel_divinity (lv2-5: 2, lv6-17: 3, lv18-20: 4) — used only when the
// character carries no class_levels entry for the current level.
function fallbackSparkChargesByLevel(level) {
    if (level >= 18) return 4;
    if (level >= 6) return 3;
    if (level >= 2) return 2;
    return 0;
}

function resolveSparkCharges(playerStats) {
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || fallbackSparkChargesByLevel(playerStats.level || 1);
    return storedCharges != null ? Number(storedCharges) : maxCharges;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const currentCharges = resolveSparkCharges(playerStats);

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
            },
        };
    }

    const newCharges = currentCharges - 1;
    setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName, true);

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || playerStats.name;

    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const wisModifier = wis?.bonus || 0;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Divine Spark activated — targeting ${targetName}.`,
    }).catch((e) => { console.error("[divineSparkHandler:log-error]", e); });

    return {
        type: 'modal',
        modalName: 'divineSpark',
        payload: {
            featureName: action.name,
            attackerName: playerStats.name,
            targetName,
            campaignName,
            healExpression: `1d8 + ${wisModifier}`,
            damageExpression: `1d8 + ${wisModifier}`,
            damageTypes: auto.damageTypes || ['Necrotic', 'Radiant'],
            saveType: auto.saveType || 'CON',
            wisModifier,
        },
    };
}
