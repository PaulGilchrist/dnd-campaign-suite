import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { handle as runPolymorphHandler } from './polymorphHandler.js';

const POLYMORPH_EFFECT = 'polymorph';

export function getActivePolymorphs(campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.filter(te => te.effect === POLYMORPH_EFFECT);
}

export function getPolymorphCaster(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effect = effects.find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === targetName && te.effect === POLYMORPH_EFFECT;
    });
    return effect?.source || null;
}

export async function applyPolymorph(spell, metaCtx, playerStats, campaignName, mapName) {
    const spellName = (spell.name || '').toLowerCase();
    if (spellName !== 'polymorph') return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 4;

    const action = {
        name: spell.name,
        automation: {
            type: 'polymorph',
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        spellSlotLevel: slotLevel,
        metaCtx,
    };

    try {
        const result = await runPolymorphHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[polymorphService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}

function numOr(value, fallback) {
    return typeof value === 'number' ? value : fallback;
}

async function addPolymorphConcentration(cs, casterName, playerStats, spellName, campaignName) {
    const casterCreature = cs.creatures.find(c => c.name === casterName);
    if (!casterCreature) return;
    const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0);
    addConcentration(cs, casterName, spellName, concentrationDc);
    await storage.set('combatSummary', cs, campaignName);
    setCombatSummaryCache(cs, campaignName);
}

export async function confirmPolymorphTransform({ targetName, beast, casterName, spell, playerStats, campaignName }) {
    const cs = await getCombatContext(campaignName) || { creatures: [] };
    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) {
        console.error(`[polymorphService] Target ${targetName} not found in combat.`);
        return { ok: false, reason: 'no_target' };
    }

    const spellName = spell?.name || 'Polymorph';
    const beastHp = numOr(beast.hit_points, 0);
    const beastAc = numOr(beast.armor_class, 10);

    creature.polymorphOriginal = {
        maxHp: creature.maxHp ?? beastHp,
        ac: creature.ac ?? beastAc,
        speed: creature.speed,
    };
    creature.polymorphSource = casterName;
    creature.polymorphBeast = {
        name: beast.name,
        index: beast.index,
        size: beast.size,
        hitPoints: beastHp,
        armorClass: beastAc,
        speed: beast.speed,
        challengeRating: beast.challenge_rating,
    };
    creature.beastName = beast.name;
    creature.maxHp = beastHp;
    creature.ac = beastAc;
    creature.speed = beast.speed;

    setRuntimeValue(targetName, 'tempHp', beastHp, campaignName);
    setRuntimeValue(targetName, 'polymorphTempHp', beastHp, campaignName);

    await storage.set('combatSummary', cs, campaignName);
    setCombatSummaryCache(cs, campaignName);

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const cleaned = targetEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && te.effect === POLYMORPH_EFFECT);
    });
    cleaned.push({
        target: targetName,
        source: casterName,
        effect: POLYMORPH_EFFECT,
        duration: 'concentration',
        beastName: beast.name,
    });
    setRuntimeValue('campaign', 'targetEffects', cleaned, campaignName, true);

    await addPolymorphConcentration(cs, casterName, playerStats, spellName, campaignName);

    const expirations = getRuntimeValue(casterName, 'pendingExpirations', campaignName);
    const expList = Array.isArray(expirations) ? expirations : [];
    const filteredExp = expList.filter(e => !(e.target === targetName && (e.effects || []).some(ef => ef.type === POLYMORPH_EFFECT)));
    filteredExp.push({
        target: targetName,
        effects: [{ type: POLYMORPH_EFFECT }],
        appliedRound: getCurrentCombatRound(campaignName),
        expiryRounds: Infinity,
        expireOnCreatureName: null,
    });
    setRuntimeValue(casterName, 'pendingExpirations', filteredExp, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-polymorph',
        targetName,
        saveDc: 0,
        saveType: 'WIS',
        success: false,
        description: `${targetName} is transformed into ${beast.name} (CR ${beast.challenge_rating}) by ${casterName}'s ${spellName}.`,
    }).catch((e) => { console.error("[polymorphService:log-error]", e); });

    return { ok: true };
}

function isPolymorphEffectOn(te, targetName) {
    const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
    return teTarget === targetName && te.effect === POLYMORPH_EFFECT;
}

function findPolymorphEffect(targetEffects, targetName) {
    return targetEffects.find(te => isPolymorphEffectOn(te, targetName)) || null;
}

function revertPolymorphTempHp(targetName, campaignName) {
    const polymorphTempHp = Number(getRuntimeValue(targetName, 'polymorphTempHp', campaignName) || 0);
    const playerCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    if (polymorphTempHp > 0) {
        const storedTempHp = Number(getRuntimeValue(targetName, 'tempHp', campaignName) || 0);
        const remaining = Math.max(0, storedTempHp - polymorphTempHp);
        setRuntimeValue(targetName, 'tempHp', remaining, campaignName);
        setRuntimeValue(targetName, 'polymorphTempHp', 0, campaignName);
    } else if (typeof playerCurrentHp === 'number') {
        setRuntimeValue(targetName, 'tempHp', playerCurrentHp, campaignName);
        setRuntimeValue(targetName, 'polymorphTempHp', 0, campaignName);
    }
}

function revertPolymorphCreature(cs, targetName) {
    if (!cs?.creatures) return { changed: false, caster: null };
    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature?.polymorphSource) return { changed: false, caster: null };

    const caster = creature.polymorphSource;
    const original = creature.polymorphOriginal || {};
    creature.maxHp = original.maxHp;
    creature.ac = original.ac;
    if (original.speed !== undefined) creature.speed = original.speed;
    delete creature.polymorphSource;
    delete creature.polymorphOriginal;
    delete creature.polymorphBeast;
    delete creature.beastName;
    return { changed: true, caster };
}

export function revertPolymorph(targetName, campaignName) {
    const cs = getCombatSummary(campaignName);
    const { changed, caster } = revertPolymorphCreature(cs, targetName);
    let polymorphCaster = caster;

    if (changed && cs) {
        storage.set('combatSummary', cs, campaignName);
        setCombatSummaryCache(cs, campaignName);
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const kept = targetEffects.filter(te => !isPolymorphEffectOn(te, targetName));
    if (kept.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', kept, campaignName, true);
        if (!polymorphCaster) {
            polymorphCaster = findPolymorphEffect(targetEffects, targetName)?.source || null;
        }
    }

    revertPolymorphTempHp(targetName, campaignName);

    if (polymorphCaster) {
        const expirations = getRuntimeValue(polymorphCaster, 'pendingExpirations', campaignName);
        if (Array.isArray(expirations)) {
            const filteredExp = expirations.filter(e => !(e.target === targetName && (e.effects || []).some(ef => ef.type === POLYMORPH_EFFECT)));
            if (filteredExp.length !== expirations.length) {
                setRuntimeValue(polymorphCaster, 'pendingExpirations', filteredExp, campaignName);
            }
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Polymorph',
        description: `${targetName} reverts to their normal form.`,
    }).catch((e) => { console.error("[polymorphService:log-error]", e); });

    return changed;
}
