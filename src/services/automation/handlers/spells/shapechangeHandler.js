import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import utils from '../../../ui/utils.js';

const SHAPECHANGE_EFFECT = 'shapechange';
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

export async function resolveShapechangeMaxCR(targetName, campaignName, characters = []) {
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

export async function handle(action, playerStats, campaignName, _mapName) {
    const casterName = playerStats.name;

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

    const targetName = casterName;
    const targetCreature = cs.creatures.find(c => c.name === targetName);
    if (!targetCreature) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} not found in combat. ${action.name} has no effect.`,
            },
        };
    }

    const existingEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const selfEffects = existingEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === targetName;
    });
    // SP-103: an active shapechange is NOT a refusal — RAW allows "an action to
    // change form" while the spell runs. Recast of Shapechange reopens the chooser
    // (formChange:true) unpaid; confirmShapechangeTransform swaps forms without
    // re-granting THP. Only polymorph-family effects (a DIFFERENT spell's control)
    // still refuse.
    const blockedByPolymorph = selfEffects.some(te => te.effect === 'polymorph' || te.effect === 'true_polymorph');
    const shapechangeActive = selfEffects.some(te => te.effect === SHAPECHANGE_EFFECT) || !!targetCreature.shapechangeOriginal;
    if (blockedByPolymorph) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name}, but ${targetName} is already transformed.`,
        }).catch((e) => { console.error("[shapechange] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} is already transformed.`,
            },
        };
    }

    if (action.metaCtx?._shapechangeFormChange && !shapechangeActive) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} attempts to shape-shift, but ${targetName} is not transformed.`,
        }).catch((e) => { console.error("[shapechange] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} is not transformed. Shapechange the caster first.`,
            },
        };
    }

    if (getTargetCurrentHp(targetName, targetCreature, campaignName) <= 0) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: casterName,
            abilityName: action.name,
            description: `${casterName} casts ${action.name}, but a creature with 0 hit points can't use Shapechange.`,
        }).catch((e) => { console.error("[shapechange] Error:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no effect on a creature with 0 hit points.`,
            },
        };
    }

    const characters = action.metaCtx?.characters || [];
    const maxCR = await resolveShapechangeMaxCR(targetName, campaignName, characters);

    return {
        type: 'popup',
        payload: {
            type: 'shapechange_select',
            targetName,
            maxCR,
            casterName,
            campaignName,
            spell: action.spell,
            spellLevel: action.spellSlotLevel,
            ...(shapechangeActive ? { formChange: true } : {}),
        },
    };
}
