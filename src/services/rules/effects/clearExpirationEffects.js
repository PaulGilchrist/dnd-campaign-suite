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

/**
 * Clear expiration effects from a target when an expiration entry is removed.
 * This is the large switch that handles all effect type cleanup.
 */
export function clearExpirationEffects(effects, targetName, attackerName, campaignName) {
    if (!effects || !Array.isArray(effects)) return;

    for (const effect of effects) {
        switch (effect.type) {
            case 'stunned':
                if (effect.condition === 'speed_halved') {
                    setRuntimeValue(targetName, `stunned_speedHalved`, null, campaignName);
                } else if (effect.condition === 'stunned') {
                    removeActiveCondition(targetName, 'stunned', campaignName);
                }
                break;

            case 'advantage_on_target': {
                const advKey = `_advantageOn_${targetName}`;
                const storedAdv = getRuntimeValue(attackerName, advKey);
                if (!Array.isArray(storedAdv)) {
                    break;
                }
                if (storedAdv.includes(targetName)) {
                    setRuntimeValue(
                        attackerName,
                        advKey,
                        storedAdv.filter(tn => tn !== targetName),
                        campaignName
                    );
                }
                break;
            }

            case 'fly_speed_equals_walk_speed': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
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
                break;
            }

            case 'fly_speed_20_hover': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'fly_speed_20_hover'),
                    campaignName
                );
                break;
            }

            case 'dragon_wings': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'dragon_wings'),
                    campaignName
                );
                break;
            }

            case 'ice_walk': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'ice_walk'),
                    campaignName
                );
                break;
            }

            case 'speed_boost': {
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'speed_boost'),
                    campaignName
                );
                break;
            }

            case 'remove_active_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                if (effect.buffName === 'Reckless Attack') {
                    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                    const cleanedEffects = storedEffects.filter(te => !(te.effect === 'reckless_attack' && te.target === targetName));
                    if (cleanedEffects.length !== storedEffects.length) {
                        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
                    }
                }
                if (effect.buffName === 'Haste') {
                    const conditionEffects = getRuntimeValue(targetName, 'conditionEffects') || {};
                    const newSaveAdvantageCount = Math.max(0, (conditionEffects.saveAdvantageCount || 1) - 1);
                    const newSaveAdvantageAbilities = (conditionEffects.saveAdvantageAbilities || []).filter(a => a !== 'DEX');
                    setRuntimeValue(targetName, 'conditionEffects', {
                        ...conditionEffects,
                        saveAdvantageCount: newSaveAdvantageCount,
                        saveAdvantageAbilities: newSaveAdvantageAbilities,
                    }, campaignName);
                }
                if (effect.buffName === 'Inner Radiance') {
                    // BUG CLA-198: stop the recurring radiant tick when the
                    // 1-minute transformation buff expires.
                    setRuntimeValue(targetName, 'innerRadianceActive', null, campaignName);
                }
                if (effect.buffName === 'Barkskin') {
                    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                    const cleanedEffects = storedEffects.filter(te => te.effect !== 'barkskin');
                    if (cleanedEffects.length !== storedEffects.length) {
                        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
                    }
                }
                break;
            }

            case 'remove_faerie_fire': {
                const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const cleanedEffects = storedEffects.filter(te => !(te.effect === 'faerie_fire' && te.target === targetName));
                if (cleanedEffects.length !== storedEffects.length) {
                    setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
                }
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                const filteredBuffs = allBuffs.filter(b => b.name !== 'Faerie Fire');
                if (filteredBuffs.length !== allBuffs.length) {
                    setRuntimeValue(targetName, 'activeBuffs', filteredBuffs, campaignName);
                }
                break;
            }

            case 'peerless_athlete_end': {
                setRuntimeValue(targetName, 'peerlessAthleteActive', false, campaignName);
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'peerless_athlete'),
                    campaignName
                );
                break;
            }

            case 'large_form_end': {
                setRuntimeValue(targetName, 'largeFormActive', false, campaignName);
                const buffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    buffs.filter(b => b.effect !== 'large_form'),
                    campaignName
                );
                break;
            }

            case 'remove_bardic_inspiration': {
                setRuntimeValue(targetName, 'bardicInspirationDie', null, campaignName);
                setRuntimeValue(targetName, 'bardicInspirationGrantedBy', null, campaignName);
                setRuntimeValue(targetName, 'bardicInspirationCombatOptions', null, campaignName);
                break;
            }

            case 'inspiring_movement_no_oa':
                setRuntimeValue(targetName, 'inspiringMovementNoOA', null, campaignName);
                break;

            case 'inspiring_movement_granted':
                setRuntimeValue(targetName, 'inspiringMovementGranted', null, campaignName);
                break;

            case 'maneuvering_step_granted':
                setRuntimeValue(targetName, 'maneuveringStepGranted', null, campaignName);
                setRuntimeValue(targetName, 'maneuveringStepNoOA', null, campaignName);
                setRuntimeValue(targetName, 'maneuveringStepNoOASource', null, campaignName);
                break;

            case 'remove_natures_sanctuary':
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: targetName,
                    abilityName: "Nature's Sanctuary",
                    description: `${targetName}'s Nature's Sanctuary expires as the 1 minute elapses. The spectral trees and vines dissolve.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[expirations] Error:", e); });
                setRuntimeValue(targetName, 'naturesSanctuaryActive', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryMoves', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryRange', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryResistance', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryCreatures', null, campaignName);
                break;

            case 'remove_bulwark_of_force':
                setRuntimeValue(targetName, 'bulwarkOfForceActive', null, campaignName);
                setRuntimeValue(targetName, 'bulwarkOfForceTargets', null, campaignName);
                break;

            case 'unbreakable_majesty':
                setRuntimeValue(targetName, 'unbreakableMajestyActive', null, campaignName);
                setRuntimeValue(targetName, 'unbreakableMajestySaveDc', null, campaignName);
                break;

            case 'remove_cosmic_omen':
                setRuntimeValue(targetName, 'cosmicOmenEffect', null, campaignName);
                break;

            case 'condition':
                removeActiveCondition(targetName, effect.condition, campaignName);
                removeNpcCondition(targetName, effect.condition, campaignName);
                break;

            case 'polymorph':
                revertPolymorph(targetName, campaignName);
                break;

            case 'animal_shapes':
                revertAnimalShapes(targetName, campaignName);
                break;

            case 'true_polymorph':
                revertTruePolymorph(targetName, campaignName);
                break;

            case 'shapechange':
                revertShapechange(targetName, campaignName);
                break;

            case 'charmed':
                removeActiveCondition(targetName, 'charmed', campaignName);
                removeNpcCondition(targetName, 'charmed', campaignName);
                break;

            case 'dominated':
                removeActiveCondition(targetName, 'charmed', campaignName);
                removeNpcCondition(targetName, 'charmed', campaignName);
                break;

            case 'tashas_laughter_expiration':
                setRuntimeValue(targetName, `tashas_laughter_${targetName.replace(/\s+/g, '_')}_damageTrigger`, false, campaignName);
                break;

            case 'speed_zero': {
                removeActiveCondition(targetName, 'speed_zero', campaignName);
                removeNpcCondition(targetName, 'speed_zero', campaignName);
                break;
            }

            case 'remove_feign_death_buff': {
                // Custom cleanup for Feign Death: remove the buff and all associated conditions
                const feignBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    feignBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                // Remove conditions applied by Feign Death
                for (const cond of ['blinded', 'incapacitated', 'speed_zero']) {
                    removeActiveCondition(targetName, cond, campaignName);
                    removeNpcCondition(targetName, cond, campaignName);
                }
                break;
            }

            case 'avenging_angel_aura': {
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
                break;
            }

            case 'remove_heroes_feast_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                const currentIncrease = Number(getRuntimeValue(targetName, effect.hpKey || 'heroesFeastHpMaxIncrease', campaignName)) || 0;
                if (currentIncrease > 0) {
                    const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
                    if (storedCurrentHp != null) {
                        const currentHp = Number(storedCurrentHp);
                        const newCurrentHp = Math.max(0, currentHp - currentIncrease);
                        setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
                    }
                    setRuntimeValue(targetName, effect.hpKey || 'heroesFeastHpMaxIncrease', 0, campaignName);
                }
                break;
            }

            case 'remove_aid_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                const currentIncrease = Number(getRuntimeValue(targetName, effect.hpKey || 'aidHpMaxIncrease', campaignName)) || 0;
                if (currentIncrease > 0) {
                    const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
                    if (storedCurrentHp != null) {
                        const currentHp = Number(storedCurrentHp);
                        const newCurrentHp = Math.max(0, currentHp - currentIncrease);
                        setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
                    }
                    setRuntimeValue(targetName, effect.hpKey || 'aidHpMaxIncrease', 0, campaignName);
                }
                break;
            }

            case 'remove_heroism_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                setRuntimeValue(
                    'campaign',
                    'targetEffects',
                    storedEffects.filter(te => !(te.effect === 'heroism' && te.source === effect.buffName)),
                    campaignName
                );
                break;
            }

            case 'remove_target_effect': {
                const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                setRuntimeValue(
                    'campaign',
                    'targetEffects',
                    storedEffects.filter(te => {
                        if (te.effect !== effect.effectKey) return true;
                        if (te.source !== effect.source) return true;
                        if (effect.target && te.target !== effect.target) return true;
                        // FT-082: optional option scoping so multi-rider sources
                        // (e.g. Slasher Hamstring vs other riders from the same
                        // holder) are not collateral-removed.
                        if (effect.option && te.option !== effect.option) return true;
                        return false;
                    }),
                    campaignName
                );
                break;
            }

            case 'hurl_through_hell_return': {
                removeActiveCondition(targetName, 'incapacitated', campaignName);
                removeNpcCondition(targetName, 'incapacitated', campaignName);
                const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const cleaned = storedEffects.filter(te => !(te.effect === 'incapacitated' && te.source === effect.source && te.target === targetName));
                if (cleaned.length !== storedEffects.length) {
                    setRuntimeValue('campaign', 'targetEffects', cleaned, campaignName);
                }
                addEntry(campaignName, {
                    type: 'condition',
                    action: 'ended',
                    characterName: targetName,
                    condition: 'Incapacitated',
                    source: effect.source,
                    description: `${targetName} returns to the space it previously occupied — the ${effect.source} effect ends.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[expirations] Error:", e); });
                break;
            }

            // SP-114: summon duration clock expiry — the summoned creatures disappear
            // and the caster's matching concentration record is cleared.
            case 'remove_summoned_creatures': {
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
                break;
            }

            case 'break_concentration': {
                const cs = getCombatSummary(campaignName);
                if (cs) {
                    const brokenSpell = breakConcentration(cs, targetName);
                    if (brokenSpell) {
                        cleanupConcentrationEffects(targetName, brokenSpell, campaignName);
                        storage.set('combatSummary', cs, campaignName);
                        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                    }
                }
                break;
            }

            case 'remove_regenerate_buff': {
                setRuntimeValue(targetName, 'regenerateActive', null, campaignName);
                setRuntimeValue(targetName, 'regenerateSource', null, campaignName);
                break;
            }

            case 'remove_aura_of_life_buff': {
                const allBuffs = Array.isArray(getRuntimeValue(targetName, 'activeBuffs')) ? getRuntimeValue(targetName, 'activeBuffs') : [];
                setRuntimeValue(
                    targetName,
                    'activeBuffs',
                    allBuffs.filter(b => b.name !== effect.buffName),
                    campaignName
                );
                setRuntimeValue(targetName, 'auraOfLifeHpMaxProtected', false, campaignName);
                break;
            }

            case 'aura_of_life_hp_protection_end': {
                setRuntimeValue(targetName, 'auraOfLifeHpMaxProtected', false, campaignName);
                break;
            }

            case 'bait_and_switch_clear': {
                const wasActive = getRuntimeValue(targetName, 'baitAndSwitchActive');
                if (wasActive) {
                    setRuntimeValue(targetName, 'baitAndSwitchActive', null, campaignName);
                    setRuntimeValue(targetName, 'baitAndSwitchBonus', null, campaignName);
                    setRuntimeValue(targetName, 'baitAndSwitchSource', null, campaignName);
                }
                break;
            }

            case 'clear_runtime_value': {
                setRuntimeValue(effect.creatureName, effect.key, null, campaignName);
                break;
            }

            case 'remove_smite_of_protection': {
                setRuntimeValue(targetName, 'smiteOfProtectionActive', null, campaignName);
                const refreshCount = getRuntimeValue('campaign', 'coverRefresh') || 0;
                setRuntimeValue('campaign', 'coverRefresh', refreshCount + 1, campaignName);
                break;
            }

            case 'clear_silence_zone': {
                const casterName = effect.casterName || targetName;
                const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
                if (!Array.isArray(targetEffects)) break;

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
                break;
            }

            default:
                break;
        }
    }
}
