import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import utils from '../../../ui/utils.js';

const TRUE_POLYMORPH_EFFECT = 'true_polymorph';
const DEFAULT_MAX_CR = 1;

function parseChallengeRating(crString) {
    if (!crString) return 0;
    const crValue = String(crString);
    if (crValue.includes('/')) {
        const parts = crValue.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(crValue) || 0;
}

function getTargetCurrentHp(targetName, creature, campaignName) {
    if (creature?.type === 'player') {
        const stored = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        if (typeof stored === 'number') return stored;
    }
    return creature?.currentHp ?? creature?.hit_points?.current ?? 0;
}

function isShapechanger(targetName, creature) {
    const traits = creature?.traits || [];
    const specialAbilities = creature?.special_abilities || [];
    const allTraits = [...traits, ...specialAbilities];
    if (allTraits.some(t => String(t?.name || '').toLowerCase() === 'shapechanger')) return true;
    const typeValue = String(creature?.monsterType || '').toLowerCase();
    if (typeValue === 'shapechanger') return true;
    if (typeValue.includes('shapechanger')) return true;
    const typeTags = creature?.type_tags || [];
    if (typeTags.some(t => String(t).toLowerCase() === 'shapechanger')) return true;
    return false;
}

export async function resolveTruePolymorphMaxCR(targetName, campaignName, characters = []) {
    const pc = (characters || []).find(c => utils.getName(c.name) === utils.getName(targetName));
    if (pc) {
        const level = pc.computedStats?.level ?? pc.level;
        if (typeof level === 'number' && level > 0) return level;
    }
    const monster = await getMonsterData(targetName, null);
    if (monster && monster.challenge_rating != null && monster.challenge_rating !== '') {
        return parseChallengeRating(monster.challenge_rating);
    }
    return DEFAULT_MAX_CR;
}

function refusalPopup(action, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}

function logTransformRefusal(campaignName, casterName, action, targetName, reason) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts ${action.name} on ${targetName}, but ${reason}.`,
    }).catch((e) => { console.error("[truePolymorph] Error:", e); });
}

async function gateTruePolymorphTarget(action, casterName, targetName, targetCreature, campaignName) {
    const existingEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const alreadyTransformed = existingEffects.some(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === targetName && (te.effect === TRUE_POLYMORPH_EFFECT || te.effect === 'polymorph' || te.effect === 'object_transform');
    });
    if (alreadyTransformed) {
        logTransformRefusal(campaignName, casterName, action, targetName, `${targetName} is already transformed`);
        return refusalPopup(action, `${targetName} is already transformed.`);
    }

    if (getTargetCurrentHp(targetName, targetCreature, campaignName) <= 0) {
        logTransformRefusal(campaignName, casterName, action, targetName, `a creature with 0 hit points can't be transformed`);
        return refusalPopup(action, `${action.name} has no effect on a creature with 0 hit points.`);
    }

    if (isShapechanger(targetName, targetCreature)) {
        logTransformRefusal(campaignName, casterName, action, targetName, `shapechangers are unaffected`);
        return refusalPopup(action, `${action.name} has no effect on a shapechanger.`);
    }

    return null;
}

async function runTransformationSave(action, campaignName, casterName, targetName, dc) {
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
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or be transformed.`,
        promptId,
    }).catch((e) => { console.error("[truePolymorph] Error:", e); });

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
            rollType: 'save-polymorph',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against ${action.name}.`,
        }).catch((e) => { console.error("[truePolymorph] Error:", e); });
        return refusalPopup(action, `${targetName} resisted the transformation.`);
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-polymorph',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is transformed.`,
    }).catch((e) => { console.error("[truePolymorph] Error:", e); });

    return null;
}

function buildModePopup(mode, action, targetName, casterName, campaignName, maxCR) {
    if (mode === 'object_into_creature') {
        return {
            type: 'popup',
            payload: {
                type: 'true_polymorph_select',
                targetName,
                maxCR: 9,
                casterName,
                campaignName,
                spell: action.spell,
                spellLevel: action.spellSlotLevel,
                mode: 'object_into_creature',
            },
        };
    }

    if (mode === 'creature_to_object') {
        return {
            type: 'popup',
            payload: {
                type: 'true_polymorph_object',
                targetName,
                casterName,
                campaignName,
                spell: action.spell,
                spellLevel: action.spellSlotLevel,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'true_polymorph_select',
            targetName,
            maxCR,
            casterName,
            campaignName,
            spell: action.spell,
            spellLevel: action.spellSlotLevel,
            mode: 'creature_to_creature',
        },
    };
}

async function resolveCreatureTargetMode({ action, campaignName, casterName, dc, mode, targetName, targetCreature }) {
    const refusal = await gateTruePolymorphTarget(action, casterName, targetName, targetCreature, campaignName);
    if (refusal) return refusal;

    const allies = getAllyList(casterName);
    const isAlly = allies.some(n => utils.getName(n) === utils.getName(targetName));

    if (!isAlly) {
        const resisted = await runTransformationSave(action, campaignName, casterName, targetName, dc);
        if (resisted) return resisted;
    }

    const characters = action.metaCtx?.characters || [];
    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, characters);

    return buildModePopup(mode, action, targetName, casterName, campaignName, maxCR);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);
    const mode = auto?.mode || 'creature_to_creature';

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
    const targetName = action.metaCtx?.truePolymorphTarget;
    if (!targetName && mode !== 'object_into_creature') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No target selected. ${action.name} has no effect.`,
            },
        };
    }

    const targetCreature = cs.creatures.find(c => c.name === targetName);

    if (targetName && targetCreature) {
        return await resolveCreatureTargetMode({ action, campaignName, casterName, dc, mode, targetName, targetCreature });
    }

    if (mode === 'object_into_creature') {
        return buildObjectIntoCreaturePopup(action, casterName, campaignName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `No valid target for ${action.name}.`,
        },
    };
}

function buildObjectIntoCreaturePopup(action, casterName, campaignName) {
    const characters = action.metaCtx?.characters || [];
    return {
        type: 'popup',
        payload: {
            type: 'true_polymorph_select',
            targetName: null,
            maxCR: 9,
            casterName,
            campaignName,
            spell: action.spell,
            spellLevel: action.spellSlotLevel,
            mode: 'object_into_creature',
            characters,
        },
    };
}
