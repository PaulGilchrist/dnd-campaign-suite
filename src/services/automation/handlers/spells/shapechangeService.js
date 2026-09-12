import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { handle as runShapechangeHandler } from './shapechangeHandler.js';

const SHAPECHANGE_EFFECT = 'shapechange';

export function getActiveShapechanges(campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.filter(te => te.effect === SHAPECHANGE_EFFECT);
}

export function getShapechangeCaster(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effect = effects.find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === targetName && te.effect === SHAPECHANGE_EFFECT;
    });
    return effect?.source || null;
}

export async function applyShapechange(spell, metaCtx, playerStats, campaignName, mapName) {
    const spellName = (spell.name || '').toLowerCase();
    if (spellName !== 'shapechange') return null;

    const action = {
        name: spell.name,
        spell,
        spellSlotLevel: metaCtx?.slotLevel || spell.level || 9,
        metaCtx,
    };

    try {
        const result = await runShapechangeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[shapechangeService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}

export async function confirmShapechangeTransform({ targetName, form, casterName, spell, playerStats, campaignName }) {
    const cs = await getCombatContext(campaignName) || { creatures: [] };
    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) {
        console.error(`[shapechangeService] Target ${targetName} not found in combat.`);
        return { ok: false, reason: 'no_target' };
    }

    const formHp = typeof form.hit_points === 'number' ? form.hit_points : 0;
    const formAc = typeof form.armor_class === 'number' ? form.armor_class : 10;

    creature.shapechangeOriginal = {
        maxHp: creature.maxHp ?? formHp,
        ac: creature.ac ?? formAc,
        speed: creature.speed,
    };
    creature.shapechangeSource = casterName;
    creature.shapechangeForm = {
        name: form.name,
        index: form.index,
        size: form.size,
        hitPoints: formHp,
        armorClass: formAc,
        speed: form.speed,
        challengeRating: form.challenge_rating,
        type: form.type,
    };
    creature.formName = form.name;
    creature.maxHp = formHp;
    creature.ac = formAc;
    creature.speed = form.speed;

    setRuntimeValue(targetName, 'tempHp', formHp, campaignName);
    setRuntimeValue(targetName, 'shapechangeTempHp', formHp, campaignName);

    await storage.set('combatSummary', cs, campaignName);
    setCombatSummaryCache(cs, campaignName);

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const cleaned = targetEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && (te.effect === SHAPECHANGE_EFFECT || te.effect === 'polymorph' || te.effect === 'true_polymorph'));
    });
    cleaned.push({
        target: targetName,
        source: casterName,
        effect: SHAPECHANGE_EFFECT,
        duration: 'concentration',
        formName: form.name,
    });
    setRuntimeValue('campaign', 'targetEffects', cleaned, campaignName, true);

    const casterCreature = cs.creatures.find(c => c.name === casterName);
    if (casterCreature) {
        const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0);
        addConcentration(cs, casterName, spell?.name || 'Shapechange', concentrationDc);
        await storage.set('combatSummary', cs, campaignName);
        setCombatSummaryCache(cs, campaignName);
    }

    const expirations = getRuntimeValue(casterName, 'pendingExpirations', campaignName);
    const expList = Array.isArray(expirations) ? expirations : [];
    const filteredExp = expList.filter(e => !(e.target === targetName && (e.effects || []).some(ef => ef.type === SHAPECHANGE_EFFECT)));
    filteredExp.push({
        target: targetName,
        effects: [{ type: SHAPECHANGE_EFFECT }],
        appliedRound: getCurrentCombatRound(campaignName),
        expiryRounds: Infinity,
        expireOnCreatureName: null,
    });
    setRuntimeValue(casterName, 'pendingExpirations', filteredExp, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-shapechange',
        targetName,
        saveDc: 0,
        saveType: 'WIS',
        success: false,
        description: `${targetName} uses Shapechange to transform into ${form.name} (CR ${form.challenge_rating}) cast by ${casterName}.`,
    }).catch((e) => { console.error("[shapechangeService:log-error]", e); });

    return { ok: true };
}

function isShapechangeEffectOn(te, targetName) {
    const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
    return teTarget === targetName && te.effect === SHAPECHANGE_EFFECT;
}

function findShapechangeEffect(targetEffects, targetName) {
    return targetEffects.find(te => isShapechangeEffectOn(te, targetName)) || null;
}

function revertShapechangeTempHp(targetName, campaignName) {
    const shapechangeTempHp = Number(getRuntimeValue(targetName, 'shapechangeTempHp', campaignName) || 0);
    const playerCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    if (shapechangeTempHp > 0) {
        const storedTempHp = Number(getRuntimeValue(targetName, 'tempHp', campaignName) || 0);
        const remaining = Math.max(0, storedTempHp - shapechangeTempHp);
        setRuntimeValue(targetName, 'tempHp', remaining, campaignName);
        setRuntimeValue(targetName, 'shapechangeTempHp', 0, campaignName);
    } else if (typeof playerCurrentHp === 'number') {
        setRuntimeValue(targetName, 'tempHp', playerCurrentHp, campaignName);
        setRuntimeValue(targetName, 'shapechangeTempHp', 0, campaignName);
    }
}

export function revertShapechange(targetName, campaignName) {
    const cs = getCombatSummary(campaignName);
    let shapechangeCaster = null;
    let changed = false;

    if (cs?.creatures) {
        const creature = cs.creatures.find(c => c.name === targetName);
        if (creature?.shapechangeSource) {
            shapechangeCaster = creature.shapechangeSource;
            const original = creature.shapechangeOriginal || {};
            creature.maxHp = original.maxHp;
            creature.ac = original.ac;
            if (original.speed !== undefined) creature.speed = original.speed;
            delete creature.shapechangeSource;
            delete creature.shapechangeOriginal;
            delete creature.shapechangeForm;
            delete creature.formName;
            changed = true;
        }
    }
    if (changed && cs) {
        storage.set('combatSummary', cs, campaignName);
        setCombatSummaryCache(cs, campaignName);
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const kept = targetEffects.filter(te => !isShapechangeEffectOn(te, targetName));
    if (kept.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', kept, campaignName, true);
        if (!shapechangeCaster) {
            shapechangeCaster = findShapechangeEffect(targetEffects, targetName)?.source || null;
        }
    }

    revertShapechangeTempHp(targetName, campaignName);

    if (shapechangeCaster) {
        const expirations = getRuntimeValue(shapechangeCaster, 'pendingExpirations', campaignName);
        if (Array.isArray(expirations)) {
            const filteredExp = expirations.filter(e => !(e.target === targetName && (e.effects || []).some(ef => ef.type === SHAPECHANGE_EFFECT)));
            if (filteredExp.length !== expirations.length) {
                setRuntimeValue(shapechangeCaster, 'pendingExpirations', filteredExp, campaignName);
            }
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Shapechange',
        description: `${targetName} reverts to their normal form.`,
    }).catch((e) => { console.error("[shapechangeService:log-error]", e); });

    return changed;
}
