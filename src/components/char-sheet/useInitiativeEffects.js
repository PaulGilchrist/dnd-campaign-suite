import { useEffect } from 'react'
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue, getAllStoreKeys } from '../../hooks/runtime/useRuntimeState.js';
import utils from '../../services/ui/utils.js'
import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';
import { endInvisibility, endGreaterInvisibility } from '../../services/rules/features/invisibilityService.js';
import { revertPolymorph } from '../../services/automation/handlers/spells/polymorphService.js';
import { revertShapechange } from '../../services/automation/handlers/spells/shapechangeService.js';

// INITIATIVE RESET: When adding a new once-per-turn tracker, reset it with
// setRuntimeValue(playerStats.name, '_TrackerName_usedRound', null, campaignName)
// inside the initiative-rolled handler below. Use the _<Name>_usedRound key pattern.

// Concentration spells that clear their caster-sourced campaign targetEffects on initiative.
// Order matters: each entry re-reads the campaign targetEffects in sequence.
const CONCENTRATION_SOURCE_EFFECTS = [
    ['Bane', 'bane_penalty'],
    ['Blade Ward', 'bane_penalty'],
    ['Bless', 'bless_bonus'],
    ['Ray of Enfeeblement', 'ray_of_enfeeble_debuff'],
    ['Compelled Duel', 'compelled_duel'],
    ['Resistance', 'resistance_damage_reduction'],
];

const LATE_CONCENTRATION_SOURCE_EFFECTS = [
    ['Compulsion', 'compulsion'],
    ['Enhance Ability', 'enhance_ability'],
];

// Campaign targetEffect keys cleared wholesale on initiative (new combat).
const INITIATIVE_CLEARED_EFFECT_KEYS = [
    'pass_without_trace_bonus',
    'blur',
    'globe_barrier',
    'forcecage',
    'antimagic_field',
    'regenerate',
    'beacon_of_hope',
];

const BASTION_WARD_KEYS = [
    'bastionOfLawActive',
    'bastionOfLawWardDice',
    'bastionOfLawWardSource',
    'bastionOfLawWardUsed',
    'bastionOfLawLastAttackDamage',
];

const ONCE_PER_TURN_TRACKER_KEYS = [
    '_Charge_Attack_usedRound',
    '_FastHands_usedRound',
    '_CunningAction_usedRound',
    '_Cleave_UsedRound',
    '_Nick_UsedRound',
    'surgeUsedRound',
    'illusoryRealityUsedRound',
    '_BrutalStrike_usedRound',
    '_fortifiedHealth_usedRound',
    '_Shield_Bash_usedRound',
    'piercerPunctureUsedThisTurn',
    '_Savage_Attacker_usedRound',
    '_Hamstring_usedRound',
    'resistanceUsedThisTurn',
];

// Once-per-round flags batched into setRuntimeBatch at the end of the handler
function buildInitiativeUpdates(playerStats) {
    const updates = {};

    // Reset Action Surge once-per-turn flag + clear Projected Ward recent-damage
    // record (projectedWardDamage) at the start of each new combat
    updates.actionSurgeUsedThisRound = updates.projectedWardDamage = null;

    // Reset Psionic Strike once-per-turn flag on initiative (new combat)
    updates.psionicStrikeUsedThisTurn = null;

    // Reset Dread Ambush once-per-turn flag on initiative (new combat)
    updates.dreadAmbushUsedThisTurn = null;

    // Reset Hurl Through Hell once-per-turn flag on initiative (new combat)
    updates.hurlThroughHellTurnUsed = null;

    // Reset Portent once-per-turn flag on initiative (new combat)
    updates.portentUsedThisTurn = null;

    // Reset Relentless (Battle Master level 15) when the player rolls initiative
    const hasRelentless = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'relentless');
    if (hasRelentless) {
        updates.relentlessUsedRound = null;
    }

    // Reset Boon of Combat Prowess and Stroke of Luck on initiative (new turn)
    updates.boonOfCombatProwessUsed = null;
    updates.strokeOfLuckUsed = null;

    return updates;
}

function clearCampaignEffectsWith(predicate, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = storedEffects.filter(predicate);
    if (filtered.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    }
}

function clearSourceEffects(effectKey, playerName, campaignName) {
    clearCampaignEffectsWith(te => !(te.effect === effectKey && te.source === playerName), campaignName);
}

function clearActiveBuffsWhere(targetName, predicate, campaignName) {
    const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const filtered = buffs.filter(predicate);
    if (filtered.length !== buffs.length) {
        setRuntimeValue(targetName, 'activeBuffs', filtered, campaignName);
    }
}

function clearBuffByName(targetName, buffName, campaignName) {
    clearActiveBuffsWhere(targetName, b => b.name !== buffName, campaignName);
}

function clearBuffsFromAllCreatures(buffName, campaignName) {
    const cs = getCombatSummary(campaignName);
    if (cs?.creatures) {
        for (const creature of cs.creatures) {
            clearBuffByName(creature.name, buffName, campaignName);
        }
    }
}

function clearLivingLegend(playerName, campaignName) {
    setRuntimeValue(playerName, 'livingLegendActive', null, campaignName);
    setRuntimeValue(playerName, 'unerringStrikeUsed', null, campaignName);
}

function clearVowOfEnmity(playerName, campaignName) {
    const vowTarget = getRuntimeValue(playerName, 'vowOfEnmityTarget', campaignName);
    setRuntimeValue(playerName, 'vowOfEnmityTarget', null, campaignName);
    setRuntimeValue(playerName, 'vowOfEnmityCostPaid', null, campaignName);
    if (vowTarget) {
        const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || [];
        const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
        setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName);
    }
}

// Restore conditions suppressed by this caster's calm_emotions effects, then strip the
// effects and every creature's "Calm Emotions" activeBuffs
function restoreCalmEmotions(playerName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const calmEffects = storedEffects.filter(te => te.effect === 'calm_emotions' && te.source === playerName);
    for (const effect of calmEffects) {
        if (effect.mode !== 'immunity' || !Array.isArray(effect.suppressedConditions) || effect.suppressedConditions.length === 0 || !effect.target) continue;
        const storedConditions = getRuntimeValue(effect.target, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const lowerConditions = conditions.map(c => String(c).toLowerCase());
        for (const suppressedCond of effect.suppressedConditions) {
            const lowerSuppressed = String(suppressedCond).toLowerCase();
            if (!lowerConditions.includes(lowerSuppressed)) {
                setRuntimeValue(effect.target, 'activeConditions', [...conditions, suppressedCond], campaignName);
            }
        }
    }
    const cleanedEffects = storedEffects.filter(te => !(te.effect === 'calm_emotions' && te.source === playerName));
    if (cleanedEffects.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName, true);
    }
    // Remove "Calm Emotions" activeBuffs from all creatures
    clearBuffsFromAllCreatures('Calm Emotions', campaignName);
}

function revertShapeEffects(effectKey, revert, playerName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const shapeEffects = storedEffects.filter(te => te.effect === effectKey && te.source === playerName);
    for (const effect of shapeEffects) {
        revert(effect.target, campaignName);
    }
}

// Clear concentration (and its spell-specific leftovers) on initiative roll (new combat round)
function clearConcentrationOnInitiative(playerStats, campaignName) {
    const cs = getCombatSummary(campaignName);
    if (!cs || !cs.creatures) return;
    const creature = cs.creatures.find(c => c.name === playerStats.name);
    if (!creature?.concentration) return;

    const concentrationSpell = creature.concentration.spell;
    creature.concentration = null;
    storageService.default.set('combatSummary', cs, campaignName);

    for (const [spell, effectKey] of CONCENTRATION_SOURCE_EFFECTS) {
        if (concentrationSpell === spell) clearSourceEffects(effectKey, playerStats.name, campaignName);
    }
    if (concentrationSpell === 'Protection from Energy') {
        // Clear Protection from Energy buffs from ALL creatures
        clearBuffsFromAllCreatures('Protection from Energy', campaignName);
    }
    if (concentrationSpell === 'Calm Emotions') {
        restoreCalmEmotions(playerStats.name, campaignName);
    }
    if (concentrationSpell === 'Circle of Power') {
        clearSourceEffects('circle_of_power', playerStats.name, campaignName);
        clearBuffsFromAllCreatures('Circle of Power', campaignName);
    }
    for (const [spell, effectKey] of LATE_CONCENTRATION_SOURCE_EFFECTS) {
        if (concentrationSpell === spell) clearSourceEffects(effectKey, playerStats.name, campaignName);
    }
    if (concentrationSpell === 'Polymorph') {
        revertShapeEffects('polymorph', revertPolymorph, playerStats.name, campaignName);
    }
    if (concentrationSpell === 'Shapechange') {
        revertShapeEffects('shapechange', revertShapechange, playerStats.name, campaignName);
    }
}

function clearActiveInvisibility(playerName, campaignName) {
    const invisKey = `_activeInvisibility_${playerName}`
    const invisCaster = getRuntimeValue('campaign', invisKey, campaignName)
    if (invisCaster) {
        endInvisibility(playerName, campaignName, 'target rolled initiative')
        setRuntimeValue('campaign', invisKey, null, campaignName)
    }
}

function clearActiveGreaterInvisibility(playerName, campaignName) {
    const greaterInvisKey = `_activeGreaterInvisibility_${playerName}`
    const greaterInvisCaster = getRuntimeValue('campaign', greaterInvisKey, campaignName)
    if (greaterInvisCaster) {
        endGreaterInvisibility(playerName, campaignName, 'target rolled initiative')
        setRuntimeValue('campaign', greaterInvisKey, null, campaignName)
    }
}

// Set all regenerate targets to full HP on initiative roll
function restoreRegenerateTargets(campaignName) {
    const allKeys = getAllStoreKeys();
    for (const key of allKeys) {
        if (typeof key !== 'string') continue;
        const regenActive = getRuntimeValue(key, 'regenerateActive', campaignName);
        if (!regenActive) continue;
        setRuntimeValue(key, 'regenerateActive', false, campaignName);
        const storedMaxHp = getRuntimeValue(key, 'hitPoints', campaignName);
        if (storedMaxHp != null) {
            setRuntimeValue(key, 'currentHitPoints', storedMaxHp, campaignName);
        }
    }
}

// Perfect Focus (Monk level 15): recover to 4 if <= 3 and Uncanny Metabolism not used
function recoverPerfectFocus(playerStats, campaignName) {
    const hasPerfectFocus = (playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.effect === 'perfect_focus');
    const uncannyMetabolismUsed = getRuntimeValue(playerStats.name, 'uncannyMetabolismUsed', campaignName) === true;
    if (!hasPerfectFocus || uncannyMetabolismUsed) return;

    const focusPointsTarget = 4;
    const focusPointsThreshold = 3;
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxFP = classLevel?.focus_points || 0;
    const currentFP = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? 0);
    if (currentFP > focusPointsThreshold || currentFP >= maxFP) return;

    const newFP = Math.min(focusPointsTarget, maxFP);
    if (newFP > currentFP) {
        setRuntimeValue(playerStats.name, 'focusPoints', newFP, campaignName);
    }
}

// Recover Wild Shape use on initiative (Archdruid Evergreen Wild Shape)
function recoverWildShapeUse(playerStats, campaignName) {
    const hasEvergreen = (playerStats.automation?.specialActions ?? []).some(a => a.type === 'initiative_action' && a.effect === 'wild_shape_regen_on_initiative');
    if (!hasEvergreen) return;

    const druidLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxWS = druidLevel?.wild_shape || 0;
    if (maxWS <= 0) return;

    const currentWS = Number(getRuntimeValue(playerStats.name, 'wildShapeUses', campaignName) ?? 0);
    if (currentWS === 0) {
        setRuntimeValue(playerStats.name, 'wildShapeUses', 1, campaignName);
    }
}

// Regain Bardic Inspiration on initiative (Bard level 18/20 Superior Inspiration)
function regainBardicInspiration(playerStats, campaignName) {
    const hasSuperiorInspiration = (playerStats.automation?.specialActions ?? []).some(a => a.type === 'initiative_action' && a.effect === 'regain_bardic_inspiration_on_initiative');
    if (!hasSuperiorInspiration || playerStats.class?.name !== 'Bard') return;

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxBI = classLevel?.bardic_inspiration_uses ?? playerStats?.proficiency ?? 0;
    const currentBI = Number(getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName) ?? maxBI);
    const minTarget = 2;
    if (currentBI < minTarget) {
        const newBI = Math.min(maxBI, minTarget);
        setRuntimeValue(playerStats.name, 'bardicInspirationUses', newBI, campaignName);
    }
}

export default function useInitiativeEffects(playerStats, campaignName, rollDamage) {
    // Passive: recover Focus Points and Wild Shape uses when anyone rolls initiative
    useEffect(() => {
        const handleInitiativeRolled = (e) => {
            if (!playerStats) return;

            const updates = buildInitiativeUpdates(playerStats);

            if (!e.detail || !e.detail.characterName) return;
            const rollingName = utils.getName(e.detail.characterName);
            const myName = utils.getName(playerStats.name);
            if (rollingName !== myName) return;

            // Clear War God's Blessing active state on new combat
            setRuntimeValue(playerStats.name, '_War_Gods_Blessing_active', null, campaignName);

            // Clear Living Legend active state on initiative roll (new combat)
            clearLivingLegend(playerStats.name, campaignName);

            // Reset Boon of Combat Prowess and Stroke of Luck for the rolling character
            setRuntimeValue(playerStats.name, 'boonOfCombatProwessUsed', null, campaignName);
            setRuntimeValue(playerStats.name, 'strokeOfLuckUsed', null, campaignName);

            // Clear Living Legend active state on initiative roll (new combat)
            clearLivingLegend(playerStats.name, campaignName);

            // Clear Holy Nimbus active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'holyNimbusActive', null, campaignName);

            // Clear Elder Champion active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'elderChampionActive', false, campaignName);

            // Clear Avenging Angel active state on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'avengingAngelActive', false, campaignName);

            // Clear Vow of Enmity active state on initiative roll (new combat)
            clearVowOfEnmity(playerStats.name, campaignName);

            // Clear Revelation in Flesh active state on initiative roll (new combat)
            clearBuffByName(playerStats.name, 'Revelation in Flesh', campaignName);

            // Clear Starry Form active state on initiative roll (new combat)
            clearBuffByName(playerStats.name, 'Starry Form', campaignName);
            clearSourceEffects('starry_form', playerStats.name, campaignName);

            // Clear concentration on initiative roll (new combat round)
            clearConcentrationOnInitiative(playerStats, campaignName);

            // Clear Invisibility on initiative roll (new combat)
            clearActiveInvisibility(playerStats.name, campaignName);

            // Clear Greater Invisibility on initiative roll (new combat)
            clearActiveGreaterInvisibility(playerStats.name, campaignName);

            // Clear Bastion of Law ward on initiative roll (new combat)
            for (const key of BASTION_WARD_KEYS) {
                setRuntimeValue(playerStats.name, key, null, campaignName);
            }

            // Clear Pass Without Trace, Blur, Globe of Invulnerability, Forcecage,
            // Antimagic Field, Regenerate and Beacon of Hope on initiative roll (new combat)
            for (const effectKey of INITIATIVE_CLEARED_EFFECT_KEYS) {
                clearCampaignEffectsWith(te => te.effect !== effectKey, campaignName);
            }

            // Set all regenerate targets to full HP on initiative roll
            restoreRegenerateTargets(campaignName);

            // Clear Trance of Order on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'tranceOfOrderActive', null, campaignName);

            // Reset once-per-turn trackers on initiative roll (new combat)
            for (const key of ONCE_PER_TURN_TRACKER_KEYS) {
                setRuntimeValue(playerStats.name, key, null, campaignName);
            }

            // Clear Large Form active state on initiative roll (rest-used flag persists)
            setRuntimeValue(playerStats.name, 'largeFormActive', null, campaignName);

            // Clear Superior Defense buff on initiative roll (new combat)
            clearBuffByName(playerStats.name, 'Superior Defense', campaignName);

            // Clear Awakened Mind buff and target on initiative roll (new combat)
            clearBuffByName(playerStats.name, 'Awakened Mind', campaignName);
            setRuntimeValue(playerStats.name, 'awakenedMindTarget', null, campaignName);

            // Clear Poisoned Weapons badge on initiative roll (new combat)
            setRuntimeValue(playerStats.name, 'poisonedWeaponsActive', null, campaignName);

            // Clear Haste buff on initiative roll (new combat)
            clearBuffByName(playerStats.name, 'Haste', campaignName);

            // Clear See Invisibility buff on initiative roll (new combat)
            clearActiveBuffsWhere(playerStats.name, b => b.effect !== 'see_invisibility', campaignName);

            // Perfect Focus (Monk level 15)
            recoverPerfectFocus(playerStats, campaignName);

            // Recover Wild Shape use on initiative (Archdruid Evergreen Wild Shape)
            recoverWildShapeUse(playerStats, campaignName);

            // Regain Bardic Inspiration on initiative (Bard level 18/20 Superior Inspiration)
            regainBardicInspiration(playerStats, campaignName);

            if (Object.keys(updates).length > 0) {
                setRuntimeBatch(playerStats.name, updates, campaignName);
            }
        };

        window.addEventListener('initiative-rolled', handleInitiativeRolled);

        return () => {
            window.removeEventListener('initiative-rolled', handleInitiativeRolled);
        };
    }, [playerStats, campaignName]);

    // Apply Searing Undead Radiant damage when Turn Undead resolves
    useEffect(() => {
        const handleTurnUndeadResult = async (e) => {
            if (!playerStats || !e.detail) return;
            const { failedTargets, attackerName, campaignName: eventCampaign } = e.detail;
            if (attackerName !== playerStats.name) return;
            if (campaignName !== eventCampaign) return;

            const searingUndead = playerStats.automation?.actions?.find(
                a => a.type === 'damage_bonus' && a.trigger === 'turn_undead_fail'
            );
            if (!searingUndead) return;

            const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
            const wisMod = Math.max(1, wis?.bonus || 0);
            const expr = `${wisMod}d8`;
            const result = rollExpression(expr);
            if (!result) return;

            // CLA-303: the Turn Undead save is already resolved by SetConditionModal —
            // do NOT pass saveDc/saveType here or handleNpcSaveDamage re-rolls a phantom
            // second save that can null the damage. Plain-damage path applies full total.
            const baseContext = {
                damageType: searingUndead.damageType || 'Radiant',
                attackerName: playerStats.name,
            };

            // CLA-303: sequential awaits — concurrent rollDamage calls each POST the
            // FULL combatSummary snapshot and the earlier POST can land last,
            // silently reverting another target's damage (pitfall 21).
            for (const targetName of failedTargets) {
                await rollDamage(
                    searingUndead.name,
                    expr,
                    result.total,
                    result.rolls,
                    result.modifier,
                    { ...baseContext, targetName }
                );
            }
        };

        window.addEventListener('turn-undead-result', handleTurnUndeadResult);
        return () => window.removeEventListener('turn-undead-result', handleTurnUndeadResult);
    }, [playerStats, campaignName, rollDamage]);
}
