import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No creatures in combat. ${action.name} has no effect.`,
            },
        };
    }

    const casterName = playerStats.name;
    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No target selected. ${action.name} has no effect.`,
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'DEX',
        saveDc: dc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a DEX save (DC ${dc}) or be enclosed in a Resilient Sphere.`,
        promptId,
    }).catch(() => {});

    const saveResult = await promise;

    if (saveResult.success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-resilient-sphere',
            targetName,
            saveDc: dc,
            saveType: 'DEX',
            success: true,
            description: `${targetName} succeeded on DEX save against ${action.name}.`,
        }).catch(() => {});

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on DEX save against ${action.name}.`,
            },
        };
    }

    // Failed save: apply the sphere enclosure as an active buff (concentration)
    const { wasActive } = toggleResilientSphere(
        targetName,
        action.name,
        casterName,
        auto.duration || 'Concentration, up to 1 minute',
        campaignName
    );

    if (!wasActive) {
        addExpiration(casterName, targetName, [
            { type: 'remove_active_buff', buffName: action.name, effect: 'resilient_sphere' }
        ], campaignName, 10);
    }

    postLogEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Resilient Sphere',
        reason: action.name,
        note: `${targetName} is enclosed in Otiluke's Resilient Sphere. Nothing can pass through the barrier. The sphere is immune to all damage. Inside can't be damaged from outside; inside can't damage outside. Enclosed creature can use action to roll sphere at half speed. Others can pick up and move it. Disintegrate destroys it.`,
        timestamp: Date.now(),
    });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-resilient-sphere',
        targetName,
        saveDc: dc,
        saveType: 'DEX',
        success: false,
        description: `${targetName} failed DEX save against ${action.name} and is enclosed in a Resilient Sphere.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed DEX save and is enclosed in a Resilient Sphere. Nothing passes through the barrier. The sphere is immune to all damage. Inside can't be damaged from outside; inside can't damage outside. Creature can use action to roll sphere at half speed. Others can move it. Disintegrate destroys it.`,
        },
    };
}

function toggleResilientSphere(targetName, buffName, casterName, duration, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === buffName && b.effect === 'resilient_sphere');

    const newBuffs = wasActive
        ? activeBuffs.filter(b => !(b.name === buffName && b.effect === 'resilient_sphere'))
        : [...activeBuffs, {
            name: buffName,
            effect: 'resilient_sphere',
            duration,
            sourceCharacter: casterName,
        }];

    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);

    return { isActive: !wasActive, wasActive };
}

export function isResilientSphereActive(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.effect === 'resilient_sphere');
}

export function getResilientSphereSource(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buff = activeBuffs.find(b => b.effect === 'resilient_sphere');
    return buff?.sourceCharacter || null;
}
