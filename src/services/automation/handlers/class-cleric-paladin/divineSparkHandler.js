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

// Refusal shape mirrors bewitchingMagicHandler.bewitchingRefusal (automation +
// divine_spark_refused + reason token, zero spend) with the infoPopup payload
// convention used by the no-charges branch below.
function divineSparkRefusal(action, playerStats, campaignName, reason, message) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        abilityName: action.name,
        automationType: action.automation?.type || 'divine_spark',
        automationDetail: 'divine_spark_refused',
        reason,
        description: `${action.name} refused — ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[divineSparkHandler:refusal-log-error]', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type || 'divine_spark',
            description: message,
            automation: action.automation,
        },
    };
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

    // Rules text (public/data/2024/classes.json Cleric lv2): "another creature
    // you can see within 30 feet of yourself" — self is never a legal target.
    // Resolve the armed target BEFORE spending a Channel Divinity charge (the
    // old `|| playerStats.name` fallback silently self-targeted and burned the
    // scarce resource). Resolve-then-spend mirrors handOfUltimateMercyHandler.
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    if (!targetName) {
        return divineSparkRefusal(action, playerStats, campaignName, 'no_target',
            'No target selected — Divine Spark requires another creature within 30 feet.');
    }

    if (targetName === playerStats.name) {
        return divineSparkRefusal(action, playerStats, campaignName, 'cannot_target_self',
            "You can't target yourself with Divine Spark — it requires another creature.");
    }

    const newCharges = currentCharges - 1;
    setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName, true);

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
