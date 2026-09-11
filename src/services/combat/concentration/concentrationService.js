import * as concentrationRules from './concentrationRules.js'
import { computeAuraBonus } from '../auras/auraOfProtection.js'
import { getCreatureSaveBonus } from '../conditions/conditionSaveService.js'
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { hasStarryDragonConstellation } from '../starryFormConstellation.js'
import storage from '../../../services/ui/storage.js'
import { getCombatSummary } from '../../encounters/combatData.js'
import { clearExpirationEffects } from '../../rules/effects/expirations.js'
import utils from '../../ui/utils.js'
import { logConditionEvent } from '../../encounters/combatLoggingService.js'
import { addEntry } from '../../ui/logService.js'
import { clearFleshToStonePrompt } from '../conditions/savePromptService.js'
import { removeHeroismBuff } from '../../rules/features/heroismService.js'
import { removeSummonedCreatures } from '../summons/summonedCreatureService.js'
import { revertTruePolymorph } from '../../automation/handlers/spells/truePolymorphService.js'

async function rollConcentrationSave(creature, concentration, characters, campaignNpcs, campaignName, mapName, getName, disadvantage = false) {
    const saveBonus = await getCreatureSaveBonus(creature, 'con', characters, campaignNpcs, getName)
    const aura = await computeAuraBonus({ targetName: creature.name, characters, campaignName, activeMapName: mapName, allCreatures: getCombatSummary(campaignName)?.creatures })
    const auraBonus = aura.bonus
    const effectiveSaveBonus = saveBonus + auraBonus
    const dragonConstellationActive = hasStarryDragonConstellation(creature, characters)
    const { roll: r1, success, rawRolls } = concentrationRules.rollConcentrationSave(effectiveSaveBonus, concentration.dc, dragonConstellationActive, disadvantage)
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined
    const displayRolls = !disadvantage && Array.isArray(rawRolls) && rawRolls.length > 0 ? rawRolls : [r1]
    return { roll: r1, success, bonus: effectiveSaveBonus, bonusDetail, starryDragonFloor: dragonConstellationActive, displayRolls }
}

function breakConcentration(combatSummary, creatureName) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature || !creature.concentration) return null
    const spell = creature.concentration.spell
    creature.concentration = concentrationRules.breakConcentration(creature.concentration)
    return spell
}

function clearAllConcentrations(campaignName, restingCreatureName) {
    const cs = getCombatSummary(campaignName);
    const creatures = cs?.creatures || [];
    let changed = false;
    for (const creature of creatures) {
        if (creature.name === restingCreatureName && creature.concentration) {
            const spellName = creature.concentration.spell;
            creature.concentration = null;
            changed = true;
            cleanupConcentrationEffects(creature.name, spellName, campaignName);
        }
    }
    if (changed && cs) {
        storage.set('combatSummary', cs, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    // Also clear concentration-duration targetEffects from the resting creature
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredEffects = allTargetEffects.filter(te => !(te.source === restingCreatureName && te.duration === 'concentration'));
    if (filteredEffects.length !== allTargetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName, true);
    }
}

function removeTargetEffectsByEffect(effectKey, source, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = storedEffects.filter(te => !(te.effect === effectKey && te.source === source));
    if (filtered.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    }
}

function clearBaneEffects(campaignName, casterName) {
    removeTargetEffectsByEffect('bane_penalty', casterName, campaignName);
}

// Blade Ward uses the same bane_penalty effect, so clearBaneEffects handles it too
// This is kept for backwards compatibility and clarity
function clearBladeWardEffects(campaignName, casterName) {
    return clearBaneEffects(campaignName, casterName);
}

function clearBlessEffects(campaignName, casterName) {
    removeTargetEffectsByEffect('bless_bonus', casterName, campaignName);
}

function clearRayOfEnfeeblementEffects(campaignName, casterName) {
    removeTargetEffectsByEffect('ray_of_enfeeble_debuff', casterName, campaignName);
}

function addConcentration(combatSummary, creatureName, spellName, dc, target = null) {
    const creature = combatSummary.creatures.find(c => c.name === creatureName)
    if (!creature) return
    creature.concentration = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        spell: spellName.trim(),
        dc,
        target,
    }
}

function buildConcentrationPopup(roll, bonus, bonusDetail, spellName, dc, success, starryDragonFloor, displayRolls) {
    return {
        type: 'd20',
        rollType: 'condition-save',
        name: 'Concentration',
        rolls: displayRolls || [roll],
        bonus,
        bonusDetail,
        targetName: null,
        targetAc: null,
        hit: undefined,
        condition: spellName,
        dc,
        success,
        ...(starryDragonFloor ? { starryDragonFloor } : {}),
    }
}

const INVISIBILITY_FLAG_PREFIXES = ['_activeInvisibility_', '_activeGreaterInvisibility_'];

// Spell-specific per-creature runtime value cleanups, keyed by spell name.
const SPELL_RUNTIME_CLEANERS = {
    'Resistance': (creature, campaignName) => {
        if (getRuntimeValue(creature.name, 'resistanceChosenDamageType', campaignName)) {
            setRuntimeValue(creature.name, 'resistanceChosenDamageType', null, campaignName);
            setRuntimeValue(creature.name, 'resistanceUsedThisTurn', false, campaignName);
        }
    },
    'Protection from Energy': (creature, campaignName) => {
        if (getRuntimeValue(creature.name, 'protectionFromEnergyDamageType', campaignName)) {
            setRuntimeValue(creature.name, 'protectionFromEnergyDamageType', null, campaignName);
        }
    },
    'Stone Skin': (creature, campaignName) => {
        if (getRuntimeValue(creature.name, 'stoneSkinDamageTypes', campaignName)) {
            setRuntimeValue(creature.name, 'stoneSkinDamageTypes', null, campaignName);
        }
    },
};

function revertObjectTransforms(casterName, campaignName) {
    const objectTransformEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(te =>
        te.source === casterName && te.duration === 'concentration' && te.effect === 'object_transform'
    );
    for (const te of objectTransformEffects) {
        const target = Array.isArray(te.target) ? te.target[0] : te.target;
        if (target) {
            revertTruePolymorph(target, campaignName);
        }
    }
}

function clearCasterInvisibilityFlags(targetName, casterName, campaignName) {
    for (const prefix of INVISIBILITY_FLAG_PREFIXES) {
        const flagKey = `${prefix}${targetName}`;
        if (getRuntimeValue('campaign', flagKey, campaignName) !== casterName) continue;
        const campaignData = getRuntimeValue('campaign', '', campaignName) || {};
        const rest = Object.fromEntries(Object.entries(campaignData).filter(([k]) => k !== flagKey));
        setRuntimeValue('campaign', '', rest, campaignName);
    }
}

function restoreSuppressedConditions(effect, campaignName) {
    if (effect.effect !== 'calm_emotions' || effect.mode !== 'immunity') return;
    if (!Array.isArray(effect.suppressedConditions) || effect.suppressedConditions.length === 0 || !effect.target) return;
    const storedConditions = getRuntimeValue(effect.target, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const lowerConditions = conditions.map(c => String(c).toLowerCase());
    for (const suppressedCond of effect.suppressedConditions) {
        if (!lowerConditions.includes(String(suppressedCond).toLowerCase())) {
            setRuntimeValue(effect.target, 'activeConditions', [...conditions, suppressedCond], campaignName);
        }
    }
}

function removeCalmEmotionsBuffs(campaignName) {
    const cs = getCombatSummary(campaignName);
    if (!cs?.creatures) return;
    for (const creature of cs.creatures) {
        const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
        const filtered = buffs.filter(b => b.name !== 'Calm Emotions');
        if (filtered.length !== buffs.length) {
            setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
        }
    }
}

function removeConditionIfNoSourceRemains(target, condition, remaining, casterName, campaignName) {
    const stillHasCondition = remaining.some(te => te.target === target && te.condition === condition);
    if (stillHasCondition) return;
    const condList = getRuntimeValue(target, 'activeConditions') || [];
    const filtered = condList.filter(c => utils.getName(c) !== utils.getName(condition));
    if (filtered.length === condList.length) return;
    setRuntimeValue(target, 'activeConditions', filtered, campaignName);
    logConditionEvent(campaignName, 'removed', target, condition, 'Concentration lost by ' + casterName);
}

function clearCasterConcentrationTargetEffects(casterName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || []
    const casterEffects = targetEffects.filter(te => te.source === casterName && te.duration === 'concentration')
    if (casterEffects.length === 0) return

    const remaining = targetEffects.filter(te => !(te.source === casterName && te.duration === 'concentration'))
    setRuntimeValue('campaign', 'targetEffects', remaining, campaignName, true)

    for (const effect of casterEffects) {
        if (effect.target) {
            clearCasterInvisibilityFlags(effect.target, casterName, campaignName);
        }
    }

    // Calm Emotions: restore suppressed conditions for immunity-mode effects
    for (const effect of casterEffects) {
        restoreSuppressedConditions(effect, campaignName);
    }

    // Remove "Calm Emotions" activeBuffs from all creatures
    removeCalmEmotionsBuffs(campaignName);

    for (const effect of casterEffects) {
        if (effect.condition) {
            removeConditionIfNoSourceRemains(effect.target, effect.condition, remaining, casterName, campaignName)
        }
        if (effect.conditions) {
            for (const cond of effect.conditions) {
                removeConditionIfNoSourceRemains(effect.target, cond, remaining, casterName, campaignName)
            }
        }
    }
}

function clearPendingExpirations(casterName, campaignName) {
    const expirations = getRuntimeValue(casterName, 'pendingExpirations') || []
    if (!Array.isArray(expirations) || expirations.length === 0) return
    for (const entry of expirations) {
        clearExpirationEffects(entry.effects, entry.target, casterName, campaignName)
    }
    setRuntimeValue(casterName, 'pendingExpirations', [], campaignName)
}

function clearAuraOfLifeBuffs(cs, casterName, campaignName) {
    if (!cs?.creatures) return;
    for (const creature of cs.creatures) {
        const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
        const filtered = buffs.filter(b => !(b.name === 'Aura of Life' && b.sourceCharacter === casterName));
        if (filtered.length !== buffs.length) {
            setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
            setRuntimeValue(creature.name, 'auraOfLifeHpMaxProtected', false, campaignName);
        }
    }
}

function clearAuraOfPurityBuffs(casterName, campaignName) {
    const cs = getCombatSummary(campaignName);
    if (!cs?.creatures) return;
    for (const creature of cs.creatures) {
        const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
        const filtered = buffs.filter(b => !(b.name === 'Aura of Purity' && b.sourceCharacter === casterName));
        if (filtered.length !== buffs.length) {
            setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
        }
        const savedConditions = getRuntimeValue(creature.name, 'auraOfPuritySaveAdvantageConditions', campaignName);
        if (savedConditions && savedConditions.length > 0) {
            setRuntimeValue(creature.name, 'auraOfPuritySaveAdvantageConditions', [], campaignName);
        }
    }
}

function clearChosenDamageTypesForSpell(cs, spellName, campaignName) {
    const cleanCreature = SPELL_RUNTIME_CLEANERS[spellName];
    if (!cleanCreature || !cs?.creatures) return;
    for (const creature of cs.creatures) {
        cleanCreature(creature, campaignName);
    }
}

function clearProtectionFromPoison(cs, casterName, campaignName) {
    removeTargetEffectsByEffect('protection_from_poison', casterName, campaignName);
    if (!cs?.creatures) return;
    for (const creature of cs.creatures) {
        const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
        const filtered = buffs.filter(b => !(b.name === 'Protection from Poison' && b.sourceCharacter === casterName));
        if (filtered.length !== buffs.length) {
            setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
        }
    }
}

function clearFaerieFire(cs, casterName, campaignName) {
    removeTargetEffectsByEffect('faerie_fire', casterName, campaignName);
    // Also clean up activeBuffs on targets that had faerie_fire from this caster
    if (!cs?.creatures) return;
    for (const creature of cs.creatures) {
        const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
        const filteredBuffs = buffs.filter(b => !(b.name === 'Faerie Fire' && b.source === casterName));
        if (filteredBuffs.length !== buffs.length) {
            setRuntimeValue(creature.name, 'activeBuffs', filteredBuffs, campaignName);
        }
    }
}

function clearTashasHideousLaughter(casterName, campaignName) {
    const allLaughterEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const isCasterLaughter = te => te.effect === 'tashas_hideous_laughter' && te.source === casterName;
    const filteredLaughterEffects = allLaughterEffects.filter(te => !isCasterLaughter(te));
    if (filteredLaughterEffects.length === allLaughterEffects.length) return;
    for (const te of allLaughterEffects) {
        if (!isCasterLaughter(te) || !te.target) continue;
        const condList = getRuntimeValue(te.target, 'activeConditions', campaignName) || [];
        const filteredConds = condList.filter(c => {
            const lower = String(c).toLowerCase();
            return lower !== 'prone' && lower !== 'incapacitated';
        });
        if (filteredConds.length !== condList.length) {
            setRuntimeValue(te.target, 'activeConditions', filteredConds, campaignName);
            logConditionEvent(campaignName, 'removed', te.target, 'Prone, Incapacitated', 'Concentration lost by ' + casterName);
        }
    }
    setRuntimeValue('campaign', 'targetEffects', filteredLaughterEffects, campaignName, true);
}

async function cleanupConcentrationEffects(casterName, spellName, campaignName) {
    removeSummonedCreatures(casterName, campaignName);

    // Revert creature-into-object transforms when concentration breaks
    revertObjectTransforms(casterName, campaignName);

    clearCasterConcentrationTargetEffects(casterName, campaignName);

    clearPendingExpirations(casterName, campaignName);

    cleanupBuffsByName(casterName, spellName, campaignName);

    const cs = getCombatSummary(campaignName);

    // Clear aura_of_life buffs and HP protection from all creatures
    clearAuraOfLifeBuffs(cs, casterName, campaignName);

    // Clear aura_of_purity buffs and save advantage conditions from all creatures
    clearAuraOfPurityBuffs(casterName, campaignName);

    clearRayOfEnfeeblementEffects(campaignName, casterName)

    // Clean up Flesh to Stone recurring save tracking when concentration breaks
    cleanupFleshToStoneEffects(casterName, campaignName)

    // Clean up Heroism buff and effects when concentration breaks
    removeHeroismBuff(casterName, campaignName)

    // Clean up Resistance / Protection from Energy / Stone Skin runtime values from targets
    clearChosenDamageTypesForSpell(cs, spellName, campaignName);

    // Clean up Protection from Poison targetEffects and activeBuffs when concentration breaks
    clearProtectionFromPoison(cs, casterName, campaignName);

    // Clean up Holy Aura buffs and targets when concentration breaks
    cleanupHolyAuraEffects(casterName, campaignName)

    // Clean up Resilient Sphere targetEffects for this caster
    removeTargetEffectsByEffect('resilient_sphere', casterName, campaignName);

    // Clean up Faerie Fire targetEffects and activeBuffs for this caster
    clearFaerieFire(cs, casterName, campaignName);

    // Clean up Tasha's Hideous Laughter targetEffects and conditions for this caster
    clearTashasHideousLaughter(casterName, campaignName);
}

function cleanupHolyAuraEffects(casterName, campaignName) {
    const cs = getCombatSummary(campaignName);
    if (cs?.creatures) {
        for (const creature of cs.creatures) {
            const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
            const filtered = buffs.filter(b => !(b.name === 'Holy Aura' && b.sourceCharacter === casterName));
            if (filtered.length !== buffs.length) {
                setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
            }
        }
    }
    // Clean up targetEffects for Holy Aura badges
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const filteredEffects = storedEffects.filter(te => !(te.effect === 'holy_aura' && te.source === casterName));
    if (filteredEffects.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName);
    }
    setRuntimeValue(casterName, 'holyAuraTargets', [], campaignName);
    setRuntimeValue(casterName, 'holyAuraSaveDc', null, campaignName);
}

function cleanupFleshToStoneEffects(casterName, campaignName) {
    const allKeys = getAllStoreKeys();
    for (const key of allKeys) {
        if (typeof key !== 'string') continue;
        const value = getRuntimeValue('campaign', key, campaignName);
        if (!value || !key.startsWith('_fleshToStone_')) continue;
        if (value.casterName !== casterName) continue;
        const targetName = key.replace('_fleshToStone_', '').replace(/_/g, ' ');
        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained');
        if (filtered.length !== conditions.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
        const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'flesh_to_stone' && te.source === casterName));
        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
        setRuntimeValue('campaign', key, null, campaignName);
        clearFleshToStonePrompt(campaignName, targetName);
    }
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Flesh to Stone',
        description: 'Concentration broken; Flesh to Stone ends.',
    }).catch((e) => { console.error("[concentrationService:log-error]", e); });
}

function cleanupBuffsByName(casterName, buffName, campaignName) {
    const cs = getCombatSummary(campaignName)
    if (!cs || !cs.creatures) {
        return
    }
    for (const creature of cs.creatures) {
        const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || []
        if (!Array.isArray(buffs)) continue
        const filtered = buffs.filter(b => b.name !== buffName)
        if (filtered.length !== buffs.length) {
            setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName)
        }
    }
}

export {
    rollConcentrationSave,
    breakConcentration,
    clearAllConcentrations,
    clearBaneEffects,
    clearBladeWardEffects,
    clearBlessEffects,
    clearRayOfEnfeeblementEffects,
    addConcentration,
    buildConcentrationPopup,
    cleanupConcentrationEffects,
}
