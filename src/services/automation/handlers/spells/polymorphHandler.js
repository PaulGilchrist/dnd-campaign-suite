import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import utils from '../../../ui/utils.js';

const POLYMORPH_EFFECT = 'polymorph';
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

export async function resolvePolymorphMaxCR(targetName, campaignName, characters = []) {
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

async function polymorphEnemySaveFlow(action, casterName, targetName, dc, campaignName) {
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
        description: `${casterName} casts ${action.name} on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or be transformed into a beast.`,
        promptId,
    }).catch((e) => { console.error("[polymorph] Error:", e); });

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
        }).catch((e) => { console.error("[polymorph] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} resisted the transformation.`,
            },
        };
    }

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-polymorph',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against ${action.name} and is transformed into a beast.`,
    }).catch((e) => { console.error("[polymorph] Error:", e); });

    return null;
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
    const targetName = action.metaCtx?.polymorphTarget;
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

    const targetCreature = cs.creatures.find(c => c.name === targetName);
    if (!targetCreature) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Target ${targetName} not found in combat. ${action.name} has no effect.`,
            },
        };
    }

    const existingEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const alreadyPolymorphed = existingEffects.some(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === targetName && te.effect === POLYMORPH_EFFECT;
    });
    if (alreadyPolymorphed) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name} on ${targetName}, but ${targetName} is already transformed.`,
        }).catch((e) => { console.error("[polymorph] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} is already polymorphed.`,
            },
        };
    }

    if (getTargetCurrentHp(targetName, targetCreature, campaignName) <= 0) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name} on ${targetName}, but a creature with 0 hit points can't be polymorphed.`,
        }).catch((e) => { console.error("[polymorph] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no effect on a creature with 0 hit points.`,
            },
        };
    }

    const targetIsShapechanger = isShapechanger(targetName, targetCreature);
    if (targetIsShapechanger) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name} on ${targetName}, but shapechangers are unaffected.`,
        }).catch((e) => { console.error("[polymorph] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no effect on a shapechanger.`,
            },
        };
    }

    const allies = getAllyList(casterName);
    const isAlly = allies.some(n => utils.getName(n) === utils.getName(targetName));

    if (!isAlly) {
        const resisted = await polymorphEnemySaveFlow(action, casterName, targetName, dc, campaignName);
        if (resisted) return resisted;
    }

    const characters = action.metaCtx?.characters || [];
    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, characters);

    return {
        type: 'popup',
        payload: {
            type: 'polymorph_select',
            targetName,
            maxCR,
            casterName,
            campaignName,
            spell: action.spell,
            spellLevel: action.spellSlotLevel,
        },
    };
}
