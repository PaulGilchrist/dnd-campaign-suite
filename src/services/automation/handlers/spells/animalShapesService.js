import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

const ANIMAL_SHAPES_EFFECT = 'animal_shapes';

export function getActiveAnimalShapes(campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return effects.filter(te => te.effect === ANIMAL_SHAPES_EFFECT);
}

export function getAnimalShapesCaster(targetName, campaignName) {
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effect = effects.find(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return teTarget === targetName && te.effect === ANIMAL_SHAPES_EFFECT;
    });
    return effect?.source || null;
}

export async function applyAnimalShapes({ targetBeastMap, casterName, spell, _playerStats, campaignName }) {
    if (!targetBeastMap || typeof targetBeastMap !== 'object') {
        console.error('[animalShapesService] No targetBeastMap provided.');
        return { ok: false, reason: 'no_targets' };
    }

    const cs = await getCombatContext(campaignName) || { creatures: [] };
    const targetNames = Object.keys(targetBeastMap);
    const results = [];

    for (const targetName of targetNames) {
        const beast = targetBeastMap[targetName];
        const creature = cs.creatures.find(c => c.name === targetName);
        if (!creature || !beast) {
            console.error(`[animalShapesService] Target ${targetName} or beast not found.`);
            continue;
        }

        const result = await confirmAnimalShapesTransform({
            targetName,
            beast,
            casterName,
            spell,
            campaignName,
        });
        results.push(result);
    }

    const allOk = results.every(r => r.ok);
    return { ok: allOk, results };
}

export async function confirmAnimalShapesTransform({ targetName, beast, casterName, spell, _playerStats, campaignName }) {
    const cs = await getCombatContext(campaignName) || { creatures: [] };
    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) {
        console.error(`[animalShapesService] Target ${targetName} not found in combat.`);
        return { ok: false, reason: 'no_target' };
    }

    const beastHp = typeof beast.hit_points === 'number' ? beast.hit_points : 0;
    const beastAc = typeof beast.armor_class === 'number' ? beast.armor_class : 10;

    creature.polymorphOriginal = {
        maxHp: creature.maxHp ?? beastHp,
        ac: creature.ac ?? beastAc,
        speed: creature.speed,
    };
    creature.animalShapesSource = casterName;
    creature.animalShapesBeast = {
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
    setRuntimeValue(targetName, 'animalShapesTempHp', beastHp, campaignName);

    await storage.set('combatSummary', cs, campaignName);
    setCombatSummaryCache(cs, campaignName);

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const cleaned = targetEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && te.effect === ANIMAL_SHAPES_EFFECT);
    });
    cleaned.push({
        target: targetName,
        source: casterName,
        effect: ANIMAL_SHAPES_EFFECT,
        duration: '24hours',
        beastName: beast.name,
    });
    setRuntimeValue('campaign', 'targetEffects', cleaned, campaignName, true);

    const expirations = getRuntimeValue(casterName, 'pendingExpirations', campaignName);
    const expList = Array.isArray(expirations) ? expirations : [];
    const filteredExp = expList.filter(e => !(e.target === targetName && (e.effects || []).some(ef => ef.type === ANIMAL_SHAPES_EFFECT)));
    filteredExp.push({
        target: targetName,
        effects: [{ type: ANIMAL_SHAPES_EFFECT }],
        appliedRound: getCurrentCombatRound(campaignName),
        expiryRounds: Infinity,
        expireOnCreatureName: targetName,
    });
    setRuntimeValue(casterName, 'pendingExpirations', filteredExp, campaignName);

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-animal-shapes',
        targetName,
        saveDc: 0,
        saveType: 'WIS',
        success: false,
        description: `${targetName} is transformed into ${beast.name} (CR ${beast.challenge_rating}) by ${casterName}'s ${spell?.name || 'Animal Shapes'}.`,
    }).catch((e) => { console.error("[animalShapesService:log-error]", e); });

    return { ok: true };
}

function clearCasterAnimalShapesExpiration(animalShapesCaster, targetName, campaignName) {
    if (!animalShapesCaster) return;
    const expirations = getRuntimeValue(animalShapesCaster, 'pendingExpirations', campaignName);
    if (!Array.isArray(expirations)) return;
    const filteredExp = expirations.filter(e => !(e.target === targetName && (e.effects || []).some(ef => ef.type === ANIMAL_SHAPES_EFFECT)));
    if (filteredExp.length === expirations.length) return;
    setRuntimeValue(animalShapesCaster, 'pendingExpirations', filteredExp, campaignName);
}

export function revertAnimalShapes(targetName, campaignName) {
    const cs = getCombatSummary(campaignName);
    let animalShapesCaster = null;
    let changed = false;

    if (cs?.creatures) {
        const creature = cs.creatures.find(c => c.name === targetName);
        if (creature?.animalShapesSource) {
            animalShapesCaster = creature.animalShapesSource;
            const original = creature.polymorphOriginal || {};
            creature.maxHp = original.maxHp;
            creature.ac = original.ac;
            if (original.speed !== undefined) creature.speed = original.speed;
            delete creature.animalShapesSource;
            delete creature.animalShapesBeast;
            delete creature.beastName;
            changed = true;
        }
    }
    if (changed && cs) {
        storage.set('combatSummary', cs, campaignName);
        setCombatSummaryCache(cs, campaignName);
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const filtered = targetEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && te.effect === ANIMAL_SHAPES_EFFECT);
    });
    if (filtered.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
        if (!animalShapesCaster) {
            const effect = targetEffects.find(te => {
                const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
                return teTarget === targetName && te.effect === ANIMAL_SHAPES_EFFECT;
            });
            animalShapesCaster = effect?.source || null;
        }
    }

    const animalShapesTempHp = Number(getRuntimeValue(targetName, 'animalShapesTempHp', campaignName) || 0);
    const storedTempHp = Number(getRuntimeValue(targetName, 'tempHp', campaignName) || 0);
    if (animalShapesTempHp > 0) {
        const remaining = Math.max(0, storedTempHp - animalShapesTempHp);
        setRuntimeValue(targetName, 'tempHp', remaining, campaignName);
        setRuntimeValue(targetName, 'animalShapesTempHp', 0, campaignName);
    }

    clearCasterAnimalShapesExpiration(animalShapesCaster, targetName, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Animal Shapes',
        description: `${targetName} reverts to their normal form.`,
    }).catch((e) => { console.error("[animalShapesService:log-error]", e); });

    return changed;
}
