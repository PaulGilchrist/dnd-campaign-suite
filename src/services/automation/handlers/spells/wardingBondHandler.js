import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

const ALL_DAMAGES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant'
];

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const casterName = playerStats.name;

    const combatSummary = getCombatSummary();
    let targetName = null;
    if (combatSummary) {
        const target = getTargetFromAttacker(combatSummary, casterName);
        if (target) {
            targetName = target.name;
        }
    }

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No target selected. Choose a willing creature within range.`,
                automation: auto,
            },
        };
    }

    // Check if warding bond is already active on the target
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
    const existingBond = targetActiveBuffs.find(b => b.effect === 'warding_bond');

    if (existingBond) {
        // Remove existing warding bond from target
        const newTargetBuffs = targetActiveBuffs.filter(b => b.effect !== 'warding_bond');
        setRuntimeValue(targetName, 'activeBuffs', newTargetBuffs, campaignName);

        // Remove bond from caster
        const casterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
        const casterActiveBuffs = Array.isArray(casterBuffs) ? casterBuffs : [];
        const newCasterBuffs = casterActiveBuffs.filter(b => b.effect !== 'warding_bond');
        setRuntimeValue(casterName, 'activeBuffs', newCasterBuffs, campaignName);
    }

    // Apply warding bond buff to target: AC +1, save +1, resistance to all damage
    const targetBuff = {
        name: action.name,
        effect: 'warding_bond',
        duration: auto.duration || '1 hour',
        resistanceTypes: [...ALL_DAMAGES],
        acBonus: 1,
        saveBonus: 1,
        sourceCharacter: casterName,
    };

    let newTargetBuffs;
    if (existingBond) {
        newTargetBuffs = [...newTargetBuffs, targetBuff];
    } else {
        newTargetBuffs = [...targetActiveBuffs, targetBuff];
    }
    setRuntimeValue(targetName, 'activeBuffs', newTargetBuffs, campaignName);

    // Store bond relationship on caster
    const casterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const casterActiveBuffs = Array.isArray(casterBuffs) ? casterBuffs : [];
    const newCasterBuffs = [...casterActiveBuffs, {
        name: action.name,
        effect: 'warding_bond',
        duration: auto.duration || '1 hour',
        sourceCharacter: casterName,
        bondTarget: targetName,
    }];
    setRuntimeValue(casterName, 'activeBuffs', newCasterBuffs, campaignName);

    // Add expiration
    addExpiration(casterName, targetName, [
        { type: 'remove_active_buff', buffName: action.name }
    ], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} cast ${action.name} on ${targetName}.`,
        targetName,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated on ${targetName}. While within 60 feet, they gain +1 AC, +1 to saving throws, and resistance to all damage. You take the same damage they take.`,
            automation: auto,
        },
    };
}

export function getWardingBondTarget(casterName, campaignName) {
    const casterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const casterActiveBuffs = Array.isArray(casterBuffs) ? casterBuffs : [];
    const bondBuff = casterActiveBuffs.find(b => b.effect === 'warding_bond');
    return bondBuff?.bondTarget || null;
}

export function getWardingBondSource(targetName, campaignName) {
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
    const bondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond');
    return bondBuff?.sourceCharacter || null;
}

export function isWardingBondActive(targetName, campaignName) {
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
    return targetActiveBuffs.some(b => b.effect === 'warding_bond');
}
