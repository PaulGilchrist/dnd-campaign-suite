import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { sendFleshToStonePrompt } from '../../../combat/conditions/savePromptService.js';


function applySpeedZero(campaignName, casterName, targetName) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'speed_zero');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'speed_zero'], campaignName);

    addExpiration(casterName, targetName, [
        { type: 'speed_zero' },
    ], campaignName, undefined, casterName);
}

function popup(name, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
        },
    };
}

function handleConstructAutoSuccess(campaignName, casterName, action, targetName) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${targetName} is a Construct and automatically succeeds on the save against Flesh to Stone.`,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    // Constructs still get Speed 0 until start of your next turn
    applySpeedZero(campaignName, casterName, targetName);

    return popup(action.name, `${targetName} is a Construct and automatically succeeds on the save. Speed is 0 until the start of your next turn.`);
}

async function handleFleshToStoneSaveSuccess(campaignName, casterName, action, targetName, dc, saveResult) {
    // On successful save: Speed 0 until the start of your next turn
    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'success',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
    applySpeedZero(campaignName, casterName, targetName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-flesh-to-stone',
        targetName,
        saveDc: dc,
        saveType: 'CON',
        success: true,
        description: `${targetName} succeeded on CON save against Flesh to Stone. Speed is 0 until the start of ${casterName}'s next turn.`,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Speed 0',
        reason: 'Flesh to Stone (successful save)',
        note: `${targetName} succeeded on CON save; Speed is 0 until the start of ${casterName}'s next turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    return popup(action.name, `${targetName} succeeded on CON save. Speed is 0 until the start of your next turn.`);
}

async function handleFleshToStoneRestrained(campaignName, casterName, action, targetName, dc, saveResult) {
    // Failed save: apply Restrained condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'restrained'], campaignName);

    // Store condition metadata with DC and ability for recurring CON save
    const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    setRuntimeValue(targetName, 'activeConditionMeta', {
        ...existingMeta,
        restrained: {
            ...(existingMeta.restrained || {}),
            dc,
            ability: 'con',
        },
    }, campaignName);

    // Register flesh_to_stone targetEffect
    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'flesh_to_stone' && te.source === casterName
    );
    const fleshEffect = {
        target: targetName,
        effect: 'flesh_to_stone',
        source: casterName,
        dc,
    };
    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = fleshEffect;
    } else {
        allTargetEffects.push(fleshEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    // Set up recurring save tracking for end-of-turn saves
    const saveTrackingKey = `_fleshToStone_${targetName.replace(/\s+/g, '_')}`;
    setRuntimeValue('campaign', saveTrackingKey, {
        successes: 0,
        failures: 0,
        dc,
        casterName,
    }, campaignName);

    // Send prompt to GM to roll recurring saves
    sendFleshToStonePrompt(campaignName, { targetName, dc, casterName });

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: ['restrained'],
        appliedDamage: 0,
    });

    addExpiration(casterName, targetName, [
        { type: 'condition', condition: 'restrained' },
    ], campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-flesh-to-stone',
        targetName,
        saveDc: dc,
        saveType: 'CON',
        success: false,
        description: `${targetName} failed CON save against Flesh to Stone and is Restrained.`,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Restrained',
        reason: 'Flesh to Stone',
        note: `${targetName} is Restrained by Flesh to Stone.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    return popup(action.name, `${targetName} failed CON save and is Restrained.`);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return popup(action.name, 'No creatures in combat. Flesh to Stone has no effect.');
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
        return popup(action.name, 'No target selected. Flesh to Stone has no effect.');
    }

    const targetCreature = cs.creatures.find(c => c.name === targetName);

    // Constructs automatically succeed on the save
    const creatureType = targetCreature?.monsterType || '';
    const isConstruct = creatureType.toLowerCase() === 'construct';
    if (isConstruct) {
        return handleConstructAutoSuccess(campaignName, casterName, action, targetName);
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc: dc,
        dcSuccess: 'none',
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts Flesh to Stone on ${targetName}! ${targetName} must make a CON save (DC ${dc}) or become Restrained.`,
        promptId,
    }).catch((e) => { console.error("[fleshToStone] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        return handleFleshToStoneSaveSuccess(campaignName, casterName, action, targetName, dc, saveResult);
    }

    return handleFleshToStoneRestrained(campaignName, casterName, action, targetName, dc, saveResult);
}
