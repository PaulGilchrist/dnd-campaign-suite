import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { playerIsImmuneToCondition } from '../../../combat/automationImmunities.js';

/**
 * Web spell area save handler for 2024 ruleset.
 * Mechanics:
 * - 20-foot Cube of sticky webbing, Difficult Terrain, Lightly Obscured
 * - Concentration, up to 1 hour
 * - DEX save on entry or start of turn — Restrained on failure
 * - Restrained creature can use Action for STR (Athletics) check vs spell DC to break free
 * - Flammable: 5-ft cube exposed to fire burns in 1 round, 2d4 Fire damage to creatures starting turn in fire
 */

function getTrackingKey(casterName) {
    return `_web_${casterName.replace(/\s+/g, '_')}`;
}

export async function processWebAreaSave(casterName, targetName, campaignName, mapName) {
    const trackingKey = getTrackingKey(casterName);
    const tracking = getRuntimeValue(casterName, trackingKey, campaignName);

    if (!tracking || !tracking.saveDc) {
        return null;
    }

    // If there's a map and a center position, check if target is still in the area
    if (mapName && tracking.center) {
        try {
            const mapsService = await import('../../../maps/mapsService.js');
            const mapData = await mapsService.loadMapData(campaignName, mapName);
            const targetPos = mapData?.players?.find(p => p.name === targetName) ||
                              mapData?.placedItems?.find(i => i.name === targetName);

            if (!targetPos) return null;

            const { getDistanceFeet } = await import('../../../rules/combat/rangeValidation.js');
            const dist = getDistanceFeet(tracking.center, {
                gridX: targetPos.gridX,
                gridY: targetPos.gridY,
            });

            // Allow some tolerance for cube area
            const inArea = dist <= tracking.radius;

            if (!inArea) return null;
        } catch {
            // If map data unavailable, proceed with save
        }
    }

    // Check if target is already Restrained (no need to re-save)
    const existingConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const isAlreadyRestrained = existingConditions.some(c => String(c).toLowerCase() === 'restrained');
    if (isAlreadyRestrained) return null;

    // Check condition immunity
    const targetCharacter = (await getCombatContext(campaignName))?.creatures?.find(c => c.name === targetName);
    if (targetCharacter?.type === 'player') {
        const targetStats = {
            computedStats: (await import('../../../../hooks/useRuntimeState.js')).getRuntimeValue(targetName, 'computedStats', campaignName),
        };
        if (playerIsImmuneToCondition({
            conditionKey: 'restrained',
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            return null;
        }
    }

    // Trigger save for this creature
    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: tracking.saveType,
        saveDc: tracking.saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Web',
        description: `${targetName} must make a ${tracking.saveType} save (DC ${tracking.saveDc}) or become Restrained (Web area).`,
        promptId,
    }).catch(() => {});

    const saveResult = await promise;

    if (!saveResult.success) {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'restrained'], campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-web',
            targetName,
            saveDc: tracking.saveDc,
            saveType: tracking.saveType,
            success: false,
            description: `${targetName} failed ${tracking.saveType} save against Web. Becomes Restrained.`,
        }).catch(() => {});
    } else {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-web',
            targetName,
            saveDc: tracking.saveDc,
            saveType: tracking.saveType,
            success: true,
            description: `${targetName} succeeded on ${tracking.saveType} save against Web.`,
        }).catch(() => {});
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Web',
            description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} the ${tracking.saveType} save (DC ${tracking.saveDc}). ${!saveResult.success ? 'Becomes Restrained.' : 'Unaffected.'}`,
        },
    };
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.saveType || 'DEX';
    const rangeFeet = 20; // 20-foot cube

    const cs = await getCombatContext(campaignName);

    let casterPos = null;
    let mapData = null;
    if (mapName) {
        try {
            const mapsService = await import('../../../maps/mapsService.js');
            mapData = await mapsService.loadMapData(campaignName, mapName);
            const casterPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (casterPlayer) {
                casterPos = { gridX: casterPlayer.gridX, gridY: casterPlayer.gridY };
            }
        } catch { /* positions unavailable */ }
    }

    // Store web area tracking for recurring saves
    const trackingKey = getTrackingKey(playerStats.name);
    setRuntimeValue(playerStats.name, trackingKey, {
        caster: playerStats.name,
        center: casterPos,
        mapName,
        campaignName,
        saveDc,
        saveType,
        radius: rangeFeet,
        timestamp: Date.now(),
        duration: auto.duration || '1 hour',
    }, campaignName);

    return {
        type: 'modal',
        modalName: 'setCondition',
        payload: {
            combatSummary: cs,
            attackerName: playerStats.name,
            attackerPos: casterPos,
            saveDc,
            campaignName,
            mapData,
            featureName: action.name,
            conditionName: 'restrained',
            saveType,
            rangeFeet,
            durationRounds: 60, // Concentration, up to 1 hour = 60 rounds
        },
    };
}
