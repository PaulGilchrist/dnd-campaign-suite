import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getEffectDefinition, registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

// CLA-357: Psi Warrior lv3 "Action to move an object or willing creature up
// to 30 feet." Row opens a willing-creature chooser (CreatureSelectionModal);
// confirm gates on the canonical isWithinRange (strict token distances on a
// positioned map, lenient gridless per playbook §7) and records a
// telekinetic_movement te. Prose resolves range via rangeToFeet so raw
// `30_ft` tokens never leak into popup/log text.
export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Telekinetic Movement';
    const rangeFt = rangeToFeet(auto.range) ?? 30;

    const cs = await getCombatContext(campaignName);
    const creatureTargets = (cs?.creatures || [])
        .filter(c => c.name !== playerName)
        .map(c => ({ name: c.name, currentHp: c.currentHp, maxHp: c.maxHp, type: c.type }));

    if (creatureTargets.length === 0) {
        const description = `${featureName}: Move an object up to <strong>${rangeFt}</strong> feet (no creatures in combat to select — object movement is GM-adjudicated).`;
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${playerName} used ${featureName} to move an object up to ${rangeFt} feet (no creatures in combat to select).`,
        }).catch((e) => { console.error("[telekineticMovementHandler:log-error]", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'telekineticMovement',
        payload: { action, playerStats, campaignName, creatureTargets, rangeFt },
    };
}

export async function applyTelekineticMovement(action, playerStats, campaignName, targetName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Telekinetic Movement';
    const rangeFt = rangeToFeet(auto.range) ?? 30;

    if (!targetName) {
        return null;
    }

    const inRange = await isWithinRange(playerName, targetName, rangeFt);
    if (!inRange) {
        const refusalText = `${featureName} requires the target to be within ${rangeFt} feet. ${targetName} is out of range.`;
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'telekinetic_movement_refused',
            name: featureName,
            description: refusalText,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[telekineticMovementHandler:log-error]", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: refusalText,
                automation: auto,
            },
        };
    }

    if (!getEffectDefinition('telekinetic_movement')) {
        console.error('[telekineticMovementHandler] Missing telekinetic_movement entry in targetEffectDefinitions registry');
    }
    registerTargetEffect(campaignName, targetName, 'telekinetic_movement', featureName, {
        value: rangeFt,
        movedDistanceFt: rangeFt,
        duration: 'instant',
    });

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to telekinetically move ${targetName} up to ${rangeFt} feet.`,
    }).catch((e) => { console.error("[telekineticMovementHandler:log-error]", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName}: Moved <strong>${targetName}</strong> up to <strong>${rangeFt}</strong> feet.`,
            automation: auto,
        },
    };
}
