import { buildSaveDc } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

async function applyPowerWordStun(targetName, action, campaignName, dc, targetCurrentHp) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'stunned');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'stunned'], campaignName);

    // Store condition metadata with DC and ability for recurring CON save
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        stunned: {
            ...(existingMeta.stunned || {}),
            dc,
            ability: 'con',
        },
    }, campaignName);

    // Update lastAttack for counterspell rollback
    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['stunned'],
        appliedDamage: 0,
    });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Stunned',
        reason: action.name,
        note: `${targetName} is Stunned by ${action.name} (${targetCurrentHp} HP).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[powerWordStun] Error:", e); });

    return `${targetName} has ${targetCurrentHp} HP (150 or fewer). ${targetName} is Stunned.`;
}

async function applyPowerWordSpeedZero(targetName, casterName, action, campaignName, dc, targetCurrentHp) {
    setRuntimeValue(targetName, 'activeConditions', [...(getRuntimeValue(targetName, 'activeConditions', campaignName) || []), 'speed_zero'], campaignName);

    // Update lastAttack for counterspell rollback
    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['speed_zero'],
        appliedDamage: 0,
    });

    // Set expiration: speed_zero ends at start of caster's next turn
    addExpiration(casterName, targetName, [
        { type: 'speed_zero', condition: 'speed_zero' },
    ], campaignName, undefined, casterName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Speed 0',
        reason: action.name,
        note: `${targetName} has Speed 0 from ${action.name} (${targetCurrentHp !== null ? targetCurrentHp + ' HP' : 'HP unknown'}). Ends at start of caster's next turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[powerWordStun] Error:", e); });

    return `${targetName} has ${targetCurrentHp !== null ? targetCurrentHp + ' HP' : 'unknown HP'} (more than 150). ${targetName}'s Speed is 0 until the start of your next turn.`;
}

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

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'CON',
        saveDc: dc,
        attackScope: 'single',
    });

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

    // Get target's current HP from combat context
    const targetCreature = cs.creatures.find(c => c.name === targetName);
    const targetCurrentHp = targetCreature?.currentHp ?? targetCreature?.hit_points?.current ?? null;

    let description;
    let actionsTaken = [];

    if (targetCurrentHp !== null && targetCurrentHp <= 150) {
        // Target has 150 HP or fewer → Stunned condition
        description = await applyPowerWordStun(targetName, action, campaignName, dc, targetCurrentHp);
        actionsTaken.push('stunned');
    } else {
        // Target has more than 150 HP → Speed 0 until start of next turn
        description = await applyPowerWordSpeedZero(targetName, casterName, action, campaignName, dc, targetCurrentHp);
        actionsTaken.push('speed_zero');
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-power-word-stun',
        targetName,
        saveDc: dc,
        saveType: 'CON',
        success: false,
        description: description,
    }).catch((e) => { console.error("[powerWordStun] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: description,
        },
    };
}
