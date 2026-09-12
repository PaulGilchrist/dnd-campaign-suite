import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

const COMMAND_EFFECTS = {
    'Approach': 'approach',
    'Drop': 'drop',
    'Flee': 'flee',
    'Grovel': 'grovel',
    'Halt': 'halt',
};

function commandLogDescription(commandEffect, commandChoice, targetName, casterName) {
    switch (commandEffect) {
        case 'approach': return `${targetName} failed WIS save against Command. Command: ${commandChoice} — ${targetName} should move toward ${casterName} by the shortest route and end turn within 5 feet.`;
        case 'drop': return `${targetName} failed WIS save against Command. Command: Drop — ${targetName} should drop held items and end turn.`;
        case 'flee': return `${targetName} failed WIS save against Command. Command: Flee — ${targetName} should spend turn moving away from ${casterName} by the fastest means.`;
        case 'halt': return `${targetName} failed WIS save against Command. Command: Halt — ${targetName} shouldn't move or take actions on its next turn.`;
        default: return null;
    }
}

async function applyCommandEffect(commandEffect, commandChoice, targetName, casterName, campaignName) {
    if (commandEffect === 'grovel') {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const existingConditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = existingConditions.filter(c => String(c).toLowerCase() !== 'prone');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'prone'], campaignName);

        addEntry(campaignName, {
            type: 'condition',
            action: 'applied',
            characterName: targetName,
            condition: 'Prone',
            reason: 'Command spell (Grovel)',
            note: `${targetName} falls prone due to Command spell.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[command] Error:", e); });
    }

    if (commandEffect === 'halt') {
        setRuntimeValue(targetName, 'commandHalt', true, campaignName);
    }

    const description = commandLogDescription(commandEffect, commandChoice, targetName, casterName);
    if (description) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: `Command: ${commandChoice}`,
            description,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[command] Error:", e); });
    }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const commandChoice = auto.commandChoice || 'Approach';

    const casterName = playerStats.name;

    storeSpellLastAttack(campaignName, {
        casterName,
        spellName: action.name,
        saveType: 'WIS',
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
                description: 'No target selected. Command has no effect.',
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
        disadvantage: !!action.metaCtx?.metamagicHeighten,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts Command on ${targetName} with command "${commandChoice}"! ${targetName} must make a WIS save (DC ${dc}) or follow the command.`,
        promptId,
    }).catch((e) => { console.error("[command] Error:", e); });

    const saveResult = await promise;

    if (saveResult.success) {
        await addTargetResult(campaignName, {
            targetName,
            saveResult: 'success',
            roll: saveResult.roll ?? 0,
            total: saveResult.total ?? 0,
            conditions: [],
            appliedDamage: 0,
        });
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-command',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against Command.`,
        }).catch((e) => { console.error("[command] Error:", e); });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on WIS save against Command.`,
            },
        };
    }

    const commandEffect = COMMAND_EFFECTS[commandChoice] || 'approach';
    const conditions = ['prone'];

    await addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: saveResult.roll ?? 0,
        total: saveResult.total ?? 0,
        conditions: commandEffect === 'grovel' ? conditions : [],
        appliedDamage: 0,
    });

    await applyCommandEffect(commandEffect, commandChoice, targetName, casterName, campaignName);

    const effectDescriptions = {
        approach: 'should move toward the caster by the shortest route and end turn within 5 feet',
        drop: 'should drop held items and end turn',
        flee: 'should spend the turn moving away from the caster by the fastest means',
        grovel: 'falls prone and then ends turn',
        halt: "shouldn't move or take actions or bonus actions on its next turn",
    };

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-command',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Command (${commandChoice}). ${targetName} ${effectDescriptions[commandEffect]}.`,
    }).catch((e) => { console.error("[command] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save against Command (${commandChoice}). ${targetName} ${effectDescriptions[commandEffect]}.`,
        },
    };
}
