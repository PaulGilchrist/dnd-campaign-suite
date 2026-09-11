import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { breakConcentration, cleanupConcentrationEffects } from '../../combat/concentration/concentrationService.js';
import { revertPolymorph } from '../../automation/handlers/spells/polymorphService.js';
import { revertAnimalShapes } from '../../automation/handlers/spells/animalShapesService.js';
import { revertTruePolymorph } from '../../automation/handlers/spells/truePolymorphService.js';
import { revertShapechange } from '../../automation/handlers/spells/shapechangeService.js';
import { addEntry } from '../../ui/logService.js';
import { removeSummonedCreatures } from '../../combat/summons/summonedCreatureService.js';

function removeNpcCondition(targetName, conditionName, campaignName) {
    try {
        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionName.toLowerCase());
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    } catch (_e) { console.error(`[clearExpirationEffects] Failed to remove ${conditionName} from ${targetName}:`, _e); }
}

function removeActiveCondition(targetName, conditionName, campaignName) {
    const condList = Array.isArray(getRuntimeValue(targetName, 'activeConditions')) ? getRuntimeValue(targetName, 'activeConditions') : [];
    const filtered = condList.filter(c => utils.getName(c) !== utils.getName(conditionName));
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
}

function removeConditionEverywhere(targetName, conditionName, campaignName) {
    removeActiveCondition(targetName, conditionName, campaignName);
    removeNpcCondition(targetName, conditionName, campaignName);
}

function readBuffs(targetName) {
    return Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
}

function removeBuffByEffect(targetName, buffEffect, campaignName) {
    const buffs = readBuffs(targetName);
    setRuntimeValue(targetName, 'activeBuffs', buffs.filter(b => b.effect !== buffEffect), campaignName);
}

function removeBuffByName(targetName, buffName, campaignName) {
    const allBuffs = readBuffs(targetName);
    setRuntimeValue(targetName, 'activeBuffs', allBuffs.filter(b => b.name !== buffName), campaignName);
}

// Filter campaign targetEffects and write back only when something was removed.
function removeTargetEffectsIfChanged(campaignName, predicate) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const cleanedEffects = storedEffects.filter(predicate);
    if (cleanedEffects.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
    }
}

function clearKeys(targetName, campaignName, keys) {
    for (const key of keys) {
        setRuntimeValue(targetName, key, null, campaignName);
    }
}

function clearHasteSaveAdvantage(targetName, campaignName) {
    const conditionEffects = getRuntimeValue(targetName, 'conditionEffects') || {};
    const newSaveAdvantageCount = Math.max(0, (conditionEffects.saveAdvantageCount || 1) - 1);
    const newSaveAdvantageAbilities = (conditionEffects.saveAdvantageAbilities || []).filter(a => a !== 'DEX');
    setRuntimeValue(targetName, 'conditionEffects', {
        ...conditionEffects,
        saveAdvantageCount: newSaveAdvantageCount,
        saveAdvantageAbilities: newSaveAdvantageAbilities,
    }, campaignName);
}

// Extra cleanup keyed by buffName, run after the buff itself is removed
// from remove_active_buff expirations.
const ACTIVE_BUFF_NAME_CLEANUP = {
    'Reckless Attack': (targetName, campaignName) => removeTargetEffectsIfChanged(campaignName, te => !(te.effect === 'reckless_attack' && te.target === targetName)),
    'Haste': clearHasteSaveAdvantage,
    // BUG CLA-198: stop the recurring radiant tick when the
    // 1-minute transformation buff expires.
    'Inner Radiance': (targetName, campaignName) => setRuntimeValue(targetName, 'innerRadianceActive', null, campaignName),
    'Barkskin': (targetName, campaignName) => removeTargetEffectsIfChanged(campaignName, te => te.effect !== 'barkskin'),
};

function handleRemoveActiveBuff(effect, targetName, _attackerName, campaignName) {
    removeBuffByName(targetName, effect.buffName, campaignName);
    const cleanup = ACTIVE_BUFF_NAME_CLEANUP[effect.buffName];
    if (cleanup) {
        cleanup(targetName, campaignName);
    }
}

function handleStunned(effect, targetName, _attackerName, campaignName) {
    if (effect.condition === 'speed_halved') {
        setRuntimeValue(targetName, `stunned_speedHalved`, null, campaignName);
    } else if (effect.condition === 'stunned') {
        removeActiveCondition(targetName, 'stunned', campaignName);
    }
}

function handleAdvantageOnTarget(_effect, targetName, attackerName, campaignName) {
    const advKey = `_advantageOn_${targetName}`;
    const storedAdv = getRuntimeValue(attackerName, advKey);
    if (!Array.isArray(storedAdv)) return;
    if (storedAdv.includes(targetName)) {
        setRuntimeValue(attackerName, advKey, storedAdv.filter(tn => tn !== targetName), campaignName);
    }
}

function handleFlySpeedEqualsWalkSpeed(_effect, targetName, _attackerName, campaignName) {
    const buffs = readBuffs(targetName);
    const conditions = Array.isArray(getRuntimeValue(targetName, 'activeConditions')) ? getRuntimeValue(targetName, 'activeConditions') : [];
    const conditionSet = new Set(conditions);
    if (conditionSet.has('incapacitated')) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: targetName,
            abilityName: 'Draconic Flight',
            description: `${targetName}'s spectral wings dissolve due to the Incapacitated condition.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[expirations] Error:", e); });
    }
    setRuntimeValue(
        targetName,
        'activeBuffs',
        buffs.filter(b => b.effect !== 'fly_speed_equals_walk_speed'),
        campaignName
    );
}

function handleRemoveFaerieFire(_effect, targetName, _attackerName, campaignName) {
    removeTargetEffectsIfChanged(campaignName, te => !(te.effect === 'faerie_fire' && te.target === targetName));
    const allBuffs = readBuffs(targetName);
    const filteredBuffs = allBuffs.filter(b => b.name !== 'Faerie Fire');
    if (filteredBuffs.length !== allBuffs.length) {
        setRuntimeValue(targetName, 'activeBuffs', filteredBuffs, campaignName);
    }
}

function handleWrathOfTheSeaEnd(_effect, targetName, _attackerName, campaignName) {
    setRuntimeValue(targetName, 'wrathOfTheSeaActive', false, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: 'Wrath of the Sea',
        description: `${targetName}'s Wrath of the Sea emanation ended (10-minute duration expired).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[clearExpirationEffects:wrath-of-the-sea-end-log-error]', e); });
}

function handleRemoveNaturesSanctuary(_effect, targetName, _attackerName, campaignName) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: targetName,
        abilityName: "Nature's Sanctuary",
        description: `${targetName}'s Nature's Sanctuary expires as the 1 minute elapses. The spectral trees and vines dissolve.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[expirations] Error:", e); });
    clearKeys(targetName, campaignName, [
        'naturesSanctuaryActive',
        'naturesSanctuaryMoves',
        'naturesSanctuaryRange',
        'naturesSanctuaryResistance',
        'naturesSanctuaryCreatures',
    ]);
}

// Custom cleanup for Feign Death: remove the buff and all associated conditions
function handleRemoveFeignDeathBuff(effect, targetName, _attackerName, campaignName) {
    removeBuffByName(targetName, effect.buffName, campaignName);
    for (const cond of ['blinded', 'incapacitated', 'speed_zero']) {
        removeConditionEverywhere(targetName, cond, campaignName);
    }
}

function handleAvengingAngelAura(_effect, targetName, attackerName, campaignName) {
    const auraTargets = getRuntimeValue(attackerName, 'avengingAngelAuraTargets', campaignName);
    if (!Array.isArray(auraTargets)) {
        console.error('expirations: expected avengingAngelAuraTargets to be an array for', attackerName);
        throw new Error('Missing array: avengingAngelAuraTargets for ' + attackerName);
    }
    setRuntimeValue(
        attackerName,
        'avengingAngelAuraTargets',
        auraTargets.filter(t => t !== targetName),
        campaignName
    );
}

// Reduce max-HP buff increase and current HP back down on buff expiry.
function revertHpMaxIncrease(targetName, hpKey, campaignName) {
    const currentIncrease = Number(getRuntimeValue(targetName, hpKey, campaignName)) || 0;
    if (currentIncrease <= 0) return;
    const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    if (storedCurrentHp != null) {
        const currentHp = Number(storedCurrentHp);
        const newCurrentHp = Math.max(0, currentHp - currentIncrease);
        setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
    }
    setRuntimeValue(targetName, hpKey, 0, campaignName);
}

function handleRemoveHeroismBuff(effect, targetName, _attackerName, campaignName) {
    removeBuffByName(targetName, effect.buffName, campaignName);
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    setRuntimeValue(
        'campaign',
        'targetEffects',
        storedEffects.filter(te => !(te.effect === 'heroism' && te.source === effect.buffName)),
        campaignName
    );
}

// FT-082: optional option scoping so multi-rider sources
// (e.g. Slasher Hamstring vs other riders from the same
// holder) are not collateral-removed.
function handleRemoveTargetEffect(effect, _targetName, _attackerName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    setRuntimeValue(
        'campaign',
        'targetEffects',
        storedEffects.filter(te => {
            if (te.effect !== effect.effectKey) return true;
            if (te.source !== effect.source) return true;
            if (effect.target && te.target !== effect.target) return true;
            if (effect.option && te.option !== effect.option) return true;
            return false;
        }),
        campaignName
    );
}

function handleHurlThroughHellReturn(effect, targetName, _attackerName, campaignName) {
    removeConditionEverywhere(targetName, 'incapacitated', campaignName);
    removeTargetEffectsIfChanged(campaignName, te => !(te.effect === 'incapacitated' && te.source === effect.source && te.target === targetName));
    addEntry(campaignName, {
        type: 'condition',
        action: 'ended',
        characterName: targetName,
        condition: 'Incapacitated',
        source: effect.source,
        description: `${targetName} returns to the space it previously occupied — the ${effect.source} effect ends.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[expirations] Error:", e); });
}

// SP-114: summon duration clock expiry — the summoned creatures disappear
// and the caster's matching concentration record is cleared.
function handleRemoveSummonedCreatures(effect, targetName, _attackerName, campaignName) {
    const cs = getCombatSummary(campaignName);
    if (cs) {
        const casterCreature = cs.creatures.find(c => c.name === targetName);
        if (casterCreature?.concentration && (!effect.spell || casterCreature.concentration.spell === effect.spell)) {
            casterCreature.concentration = null;
            storage.set('combatSummary', cs, campaignName);
        }
    }
    removeSummonedCreatures(targetName, campaignName);
    addEntry(campaignName, {
        type: 'summons',
        characterName: targetName,
        summonName: effect.spell || 'Summon',
        description: `${effect.spell || 'Summon'} ends — summoned creatures disappear.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[clearExpirationEffects:summon-expire-log-error]', e); });
}

function handleBreakConcentration(_effect, targetName, _attackerName, campaignName) {
    const cs = getCombatSummary(campaignName);
    if (!cs) return;
    const brokenSpell = breakConcentration(cs, targetName);
    if (brokenSpell) {
        cleanupConcentrationEffects(targetName, brokenSpell, campaignName);
        storage.set('combatSummary', cs, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }
}

function handleRemoveAuraOfLifeBuff(effect, targetName, _attackerName, campaignName) {
    removeBuffByName(targetName, effect.buffName, campaignName);
    setRuntimeValue(targetName, 'auraOfLifeHpMaxProtected', false, campaignName);
}

function handleBaitAndSwitchClear(_effect, targetName, _attackerName, campaignName) {
    const wasActive = getRuntimeValue(targetName, 'baitAndSwitchActive');
    if (wasActive) {
        clearKeys(targetName, campaignName, ['baitAndSwitchActive', 'baitAndSwitchBonus', 'baitAndSwitchSource']);
    }
}

function handleRemoveSmiteOfProtection(_effect, targetName, _attackerName, campaignName) {
    setRuntimeValue(targetName, 'smiteOfProtectionActive', null, campaignName);
    const refreshCount = getRuntimeValue('campaign', 'coverRefresh') || 0;
    setRuntimeValue('campaign', 'coverRefresh', refreshCount + 1, campaignName);
}

function handleClearSilenceZone(effect, targetName, _attackerName, campaignName) {
    const casterName = effect.casterName || targetName;
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (!Array.isArray(targetEffects)) return;

    const silencedTargetsList = targetEffects.filter(
        te => te.effect === 'silenced' && te.source === casterName
    );

    for (const te of silencedTargetsList) {
        const storedConditions = getRuntimeValue(te.target, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'deafened');
        if (filtered.length !== conditions.length) {
            setRuntimeValue(te.target, 'activeConditions', filtered, campaignName);
        }
    }

    const cleaned = targetEffects.filter(
        te => !(te.effect === 'silenced' && te.source === casterName)
    );
    if (cleaned.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', cleaned, campaignName);
    }
}

// Handler factories — each produces a uniform (effect, targetName, attackerName, campaignName) handler.
const clearFlagKeys = (keys) => (_effect, targetName, _attackerName, campaignName) => clearKeys(targetName, campaignName, keys);
const clearConditionEverywhere = (conditionName) => (_effect, targetName, _attackerName, campaignName) => removeConditionEverywhere(targetName, conditionName, campaignName);
const endFlagAndClearBuff = (flagKey, buffEffect) => (_effect, targetName, _attackerName, campaignName) => {
    setRuntimeValue(targetName, flagKey, false, campaignName);
    removeBuffByEffect(targetName, buffEffect, campaignName);
};
const revertHpBuff = (defaultHpKey) => (effect, targetName, _attackerName, campaignName) => {
    removeBuffByName(targetName, effect.buffName, campaignName);
    revertHpMaxIncrease(targetName, effect.hpKey || defaultHpKey, campaignName);
};

// Expiration type → cleanup handler. Each handler performs exactly the
// runtime reads/writes, log entries, and SSE posts its original switch
// case did, in the same order. Unknown types fall through to a no-op.
const EXPIRATION_HANDLERS = {
    'stunned': handleStunned,
    'advantage_on_target': handleAdvantageOnTarget,
    'fly_speed_equals_walk_speed': handleFlySpeedEqualsWalkSpeed,
    'fly_speed_20_hover': (_effect, targetName, _attackerName, campaignName) => removeBuffByEffect(targetName, 'fly_speed_20_hover', campaignName),
    'dragon_wings': (_effect, targetName, _attackerName, campaignName) => removeBuffByEffect(targetName, 'dragon_wings', campaignName),
    'ice_walk': (_effect, targetName, _attackerName, campaignName) => removeBuffByEffect(targetName, 'ice_walk', campaignName),
    'speed_boost': (_effect, targetName, _attackerName, campaignName) => removeBuffByEffect(targetName, 'speed_boost', campaignName),
    'remove_active_buff': handleRemoveActiveBuff,
    'remove_faerie_fire': handleRemoveFaerieFire,
    'peerless_athlete_end': endFlagAndClearBuff('peerlessAthleteActive', 'peerless_athlete'),
    'wrath_of_the_sea_end': handleWrathOfTheSeaEnd,
    'large_form_end': endFlagAndClearBuff('largeFormActive', 'large_form'),
    'remove_bardic_inspiration': clearFlagKeys(['bardicInspirationDie', 'bardicInspirationGrantedBy', 'bardicInspirationCombatOptions']),
    'inspiring_movement_no_oa': clearFlagKeys(['inspiringMovementNoOA']),
    'inspiring_movement_granted': clearFlagKeys(['inspiringMovementGranted']),
    'maneuvering_step_granted': clearFlagKeys(['maneuveringStepGranted', 'maneuveringStepNoOA', 'maneuveringStepNoOASource']),
    'remove_natures_sanctuary': handleRemoveNaturesSanctuary,
    'remove_bulwark_of_force': clearFlagKeys(['bulwarkOfForceActive', 'bulwarkOfForceTargets']),
    'unbreakable_majesty': clearFlagKeys(['unbreakableMajestyActive', 'unbreakableMajestySaveDc']),
    'remove_cosmic_omen': clearFlagKeys(['cosmicOmenEffect']),
    'condition': (effect, targetName, _attackerName, campaignName) => removeConditionEverywhere(targetName, effect.condition, campaignName),
    'polymorph': (_effect, targetName, _attackerName, campaignName) => revertPolymorph(targetName, campaignName),
    'animal_shapes': (_effect, targetName, _attackerName, campaignName) => revertAnimalShapes(targetName, campaignName),
    'true_polymorph': (_effect, targetName, _attackerName, campaignName) => revertTruePolymorph(targetName, campaignName),
    'shapechange': (_effect, targetName, _attackerName, campaignName) => revertShapechange(targetName, campaignName),
    'charmed': clearConditionEverywhere('charmed'),
    'dominated': clearConditionEverywhere('charmed'),
    'tashas_laughter_expiration': (_effect, targetName, _attackerName, campaignName) => setRuntimeValue(targetName, `tashas_laughter_${targetName.replace(/\s+/g, '_')}_damageTrigger`, false, campaignName),
    'speed_zero': clearConditionEverywhere('speed_zero'),
    'remove_feign_death_buff': handleRemoveFeignDeathBuff,
    'avenging_angel_aura': handleAvengingAngelAura,
    'remove_heroes_feast_buff': revertHpBuff('heroesFeastHpMaxIncrease'),
    'remove_aid_buff': revertHpBuff('aidHpMaxIncrease'),
    'remove_heroism_buff': handleRemoveHeroismBuff,
    'remove_target_effect': handleRemoveTargetEffect,
    'hurl_through_hell_return': handleHurlThroughHellReturn,
    'remove_summoned_creatures': handleRemoveSummonedCreatures,
    'break_concentration': handleBreakConcentration,
    'remove_regenerate_buff': clearFlagKeys(['regenerateActive', 'regenerateSource']),
    'remove_aura_of_life_buff': handleRemoveAuraOfLifeBuff,
    'aura_of_life_hp_protection_end': (_effect, targetName, _attackerName, campaignName) => setRuntimeValue(targetName, 'auraOfLifeHpMaxProtected', false, campaignName),
    'bait_and_switch_clear': handleBaitAndSwitchClear,
    'clear_runtime_value': (effect, _targetName, _attackerName, campaignName) => setRuntimeValue(effect.creatureName, effect.key, null, campaignName),
    'remove_smite_of_protection': handleRemoveSmiteOfProtection,
    'clear_silence_zone': handleClearSilenceZone,
};

/**
 * Clear expiration effects from a target when an expiration entry is removed.
 * This is the large switch that handles all effect type cleanup.
 */
export function clearExpirationEffects(effects, targetName, attackerName, campaignName) {
    if (!effects || !Array.isArray(effects)) return;

    for (const effect of effects) {
        const handler = EXPIRATION_HANDLERS[effect.type];
        if (handler) {
            handler(effect, targetName, attackerName, campaignName);
        }
    }
}
