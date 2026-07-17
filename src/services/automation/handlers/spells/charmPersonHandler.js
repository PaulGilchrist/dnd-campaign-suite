import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import storage from '../../../ui/storage.js';

function dispatchSaveResult(campaignName, promptId, targetName, saveType, saveDc, saveResult) {
    sendSaveResult(campaignName, targetName, {
        promptId,
        success: saveResult.success,
        roll: saveResult.roll,
        total: saveResult.total,
        saveBonus: saveResult.bonus,
        rawRolls: saveResult.rawRolls,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
        detail: {
            promptId,
            targetName,
            saveType,
            saveDc,
            success: saveResult.success,
            roll: saveResult.roll,
            total: saveResult.total,
            saveBonus: saveResult.bonus,
            rawRolls: saveResult.rawRolls,
        },
    }));
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const saveAdvantage = auto.advantage || false;

    const casterName = playerStats.name;
    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No target selected. Charm Person has no effect.',
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        advantage: saveAdvantage,
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts Charm Person on ${targetName}! ${targetName} must make a WIS save (DC ${dc})${saveAdvantage ? ' with Advantage' : ''} or become Charmed.`,
        promptId,
    }).catch((e) => { console.error("[charmPerson] Error:", e); });

    if (targetInfo?.target?.type === 'npc') {
        const cs = targetInfo.cs;
        const creature = cs?.creatures?.find(c => c.name === targetName);
        const saveResult = creature
            ? rollSaveForCreature(creature, 'WIS', dc, false, saveAdvantage)
            : (() => {
                const r1 = rollD20();
                const r2 = rollD20();
                const roll = saveAdvantage ? Math.max(r1, r2) : r1;
                const total = roll;
                const success = total >= dc;
                return { roll, total, bonus: 0, success, rawRolls: [r1, r2] };
            })();

        dispatchSaveResult(campaignName, promptId, targetName, 'WIS', dc, saveResult);
    }

    const saveResult = await promise;

    // Set combatSummary.lastAttack so Countercharm can find this save
    if (saveResult) {
        const lastAttackData = {
            attackerName: casterName,
            targetName,
            d20: saveResult.roll,
            d20Rolls: [saveResult.roll, ...(saveResult.rawRolls || [])],
            bonus: saveResult.saveBonus,
            total: saveResult.total,
            saveType: 'WIS',
            saveDc: dc,
            saveResult: saveResult.success ? 'success' : 'failure',
            isNatural20: saveResult.roll === 20,
            isNatural1: saveResult.roll === 1,
            actionName: 'Charm Person',
            rollType: 'save',
            saveConditions: ['charmed'],
            timestamp: Date.now(),
        };
        await storage.setProperty('combatSummary', 'lastAttack', lastAttackData, campaignName);
    }

    if (saveResult.success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-charm-person',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against Charm Person.`,
        }).catch((e) => { console.error("[charmPerson] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on WIS save against Charm Person.`,
            },
        };
    }

    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
    ], campaignName, undefined, casterName);

    addEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Charm Person spell',
        note: `${targetName} is Charmed by ${casterName} and regards them as a friendly acquaintance. The spell ends if ${casterName} or their companions do anything harmful to ${targetName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[charmPerson] Error:", e); });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-charm-person',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Charm Person and is Charmed.`,
    }).catch((e) => { console.error("[charmPerson] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Charmed by Charm Person. The charmed creature regards ${casterName} as a friendly acquaintance. The spell ends if ${casterName} or companions do anything harmful to ${targetName}.`,
        },
    };
}
