import { cloneDeep, uniqBy } from 'lodash';
import utils from '../ui/utils.js';
import { getSpellMaxLevel } from '../shared/spell-utils.js';
import { getSubModules } from './rules-core.js';
import { is2024, mergeAutomationSpecialActions, applyFeyShadowTouchedSpells, applyRulesType } from './rules-helpers.js';
import { getActions } from './rules-actions.js';
import { getProficiencies } from './rules-proficiencies.js';
import { getArmorClass } from './rules-armorClass.js';
import { getLanguages } from './rules-languages.js';
import { getMagicItems } from './rules-magicItems.js';
import { applyFightingStyleReactions5e, applyFightingStyleReactions2024, applyFightingStyleSpecialActions5e, applyFightingStyleSpecialActionsUniversal, addFightingStyleFeatFeatures, addBackgroundFeatures, sortActionArrays } from './rules-fightingStyles.js';
import { addHunterPreyAttack } from './rules-hunterPrey.js';
import { computeInitiative } from './rules-initiative.js';
import { computeSenses } from './rules-senses.js';
import { applyPowerfulBuild, applyHalflingNimbleness } from './core/raceTraits.js';
import { processManeuvers } from './core/maneuvers.js';
import { applyElfisLineageSpeed, applySpeedIncreasePassives } from './core/speedUtils.js';
import { renameMagicInitiateFeatures } from './core/magicSpells.js';
import { getCategories } from '../character/featureCategories.js';
import { normalizeCastingTime } from '../shared/castingTimeUtils.js';
import {
    collectAutomationFromFeatures,
    collectSaveModifiers,
    collectTurnStartEffects,
    getConditionImmunities,
    getConditionalImmunities,
    getEvasionEffects,
    getAllSaveProficiencies,
} from '../combat/automation/automationService.js';
import { reresolveAutomationUsesMax } from '../combat/automation/automationExpressions.js';
import { loadFeatData, loadSkills, loadWildMagicSurgeTable } from '../ui/dataLoader.js';
import { computeAllFeatBuffs } from '../character/featBuffService.js';

// Re-export everything for consumers
export { getSubModules } from './rules-core.js';
export { is2024, getRulesType, mergeAutomationSpecialActions } from './rules-helpers.js';
export { getActions } from './rules-actions.js';
export { getProficiencies } from './rules-proficiencies.js';
export { getArmorClass } from './rules-armorClass.js';
export { getLanguages } from './rules-languages.js';
export { getMagicItems } from './rules-magicItems.js';

const byName = (a, b) => a.name.localeCompare(b.name);

function resortActionArrays(playerStats) {
    playerStats.actions = uniqBy(playerStats.actions, 'name').sort(byName);
    playerStats.bonusActions = uniqBy(playerStats.bonusActions, 'name').sort(byName);
    playerStats.reactions = uniqBy(playerStats.reactions, 'name').sort(byName);
    playerStats.specialActions = uniqBy(playerStats.specialActions, 'name').sort(byName);
    playerStats.characterAdvancement = uniqBy(playerStats.characterAdvancement, 'name').sort(byName);
}

function applyAbilityScoreFeatIncreases(playerStats, featBuffs) {
    const computedFeatIncreases = {};
    featBuffs.abilityScoreIncreases.forEach(inc => {
        if (inc.name && inc.name !== 'any') {
            const key = inc.name.toLowerCase();
            computedFeatIncreases[key] = (computedFeatIncreases[key] || 0) + (typeof inc.amount === 'number' ? inc.amount : 1);
        }
    });
    playerStats.abilities.forEach(ability => {
        const computed = computedFeatIncreases[String(ability.name).toLowerCase()] || 0;
        ability.featIncrease = Math.max(ability.featIncrease || 0, computed);
    });
}

async function applyProficiencyFeatBuffs(playerStats, featBuffs) {
    // Apply all_skills proficiency feat buffs to skillProficiencies
    const allSkillProfs = featBuffs.proficiencies.filter(p => p.name === 'all_skills' && p.type === 'skill');
    if (allSkillProfs.length > 0) {
        const skills = await loadSkills();
        const allSkillNames = skills.map(s => s.name);
        playerStats.skillProficiencies = [...new Set([...playerStats.skillProficiencies, ...allSkillNames])];
    }

    // Proficiency choice feat buffs (tool choices handled by toolLimits, skill/armor choices handled by wizard)
    // No placeholder strings are added to proficiencies — the user makes explicit choices elsewhere.

    // Apply expertise feat buffs (e.g., Keen Mind Lore Knowledge, Observant's Keen Observer)
    // The user's expertise choices are stored in formData.expertSkills and merged here.
    // The wizard enforces proficiency-first and feat-restricted skill lists.
    // Also support expertSkills field (wizard form field name) for both 5e and 2024
    if (playerStats.expertSkills && Array.isArray(playerStats.expertSkills)) {
        playerStats.expertSkills.forEach(s => {
            if (typeof s === 'string' && s.length > 0 && playerStats.expertise) {
                playerStats.expertise.push(s);
            }
        });
    }

    // Apply non-choice, non-skill proficiency feat buffs (e.g., Heavily Armored → Heavy Armor)
    const featNonChoiceProfs = featBuffs.proficiencies.filter(p => p.type === 'proficiency' && !p.isChoice);
    if (featNonChoiceProfs.length > 0) {
        let profs = playerStats.proficiencies;
        if (!Array.isArray(profs)) {
            console.error('rules: expected proficiencies to be an array for', playerStats.name);
            throw new Error('Missing array: proficiencies for ' + playerStats.name);
        }
        const existingProfs = new Set(profs);
        featNonChoiceProfs.forEach(fp => {
            if (fp.name && !existingProfs.has(fp.name)) {
                profs = [...profs, fp.name];
                existingProfs.add(fp.name);
            }
        });
        playerStats.proficiencies = profs;
    }
}

function initActionArrays(playerStats) {
    playerStats.actions = playerStats.actions || [];
    playerStats.bonusActions = playerStats.bonusActions || [];
    playerStats.reactions = playerStats.reactions || [];
    playerStats.specialActions = playerStats.specialActions || [];
    playerStats.characterAdvancement = playerStats.characterAdvancement || [];
    playerStats.expertise = playerStats.expertise || [];
    if (playerStats.class?.expertise) {
        playerStats.expertise = [...playerStats.expertise, ...playerStats.class.expertise];
    }
}

function applyFightingStyleEffects(playerStats) {
    applyFightingStyleReactions5e(playerStats);
    applyFightingStyleReactions2024(playerStats);
    applyFightingStyleSpecialActions5e(playerStats);
    applyFightingStyleSpecialActionsUniversal(playerStats);
    sortActionArrays(playerStats);
}

function findProcessedAttackRider(playerStats, name) {
    return (playerStats.automation?.passives || []).find(
        p => p.name === name && p.type === 'attack_rider'
    ) || (playerStats.automation?.actions || []).find(
        p => p.name === name && p.type === 'attack_rider'
    ) || (playerStats.automation?.bonusActions || []).find(
        p => p.name === name && p.type === 'attack_rider'
    ) || (playerStats.automation?.reactions || []).find(
        p => p.name === name && p.type === 'attack_rider'
    );
}

function categorizeFeatEntry(playerStats, featFeature, featEntry, featureCategories) {
    // Categorize by automation.casting_time
    const castingTime = featFeature.automation?.casting_time;
    if (castingTime) {
        const ct = normalizeCastingTime(castingTime);
        if (ct === '1 action' && !playerStats.actions.some(f => f.name === featFeature.name)) {
            playerStats.actions = [...playerStats.actions, featEntry];
        } else if (ct === '1 bonus action' && !playerStats.bonusActions.some(f => f.name === featFeature.name)) {
            playerStats.bonusActions = [...playerStats.bonusActions, featEntry];
        } else if (ct === '1 reaction' && !playerStats.reactions.some(f => f.name === featFeature.name)) {
            playerStats.reactions = [...playerStats.reactions, featEntry];
        } else if (ct === 'passive' && featureCategories.characterAdvancement.includes(featFeature.name) && !playerStats.characterAdvancement.some(f => f.name === featFeature.name)) {
            playerStats.characterAdvancement = [...playerStats.characterAdvancement, featEntry];
        } else {
            playerStats.specialActions = [...playerStats.specialActions, featEntry];
        }
    } else {
        // No automation.casting_time — go to specialActions unless name matches a category
        if (featureCategories.characterAdvancement.includes(featFeature.name) && !playerStats.characterAdvancement.some(f => f.name === featFeature.name)) {
            playerStats.characterAdvancement = [...playerStats.characterAdvancement, featEntry];
        } else if (featureCategories.actions.includes(featFeature.name) && !playerStats.actions.some(f => f.name === featFeature.name)) {
            playerStats.actions = [...playerStats.actions, featEntry];
        } else if (featureCategories.bonusActions.includes(featFeature.name) && !playerStats.bonusActions.some(f => f.name === featFeature.name)) {
            playerStats.bonusActions = [...playerStats.bonusActions, featEntry];
        } else if (featureCategories.reactions.includes(featFeature.name) && !playerStats.reactions.some(f => f.name === featFeature.name)) {
            playerStats.reactions = [...playerStats.reactions, featEntry];
        } else if (featFeature.isBonusAction && !playerStats.bonusActions.some(f => f.name === featFeature.name)) {
            // FT-047: bonus_action feat benefits without automation.casting_time
            // (e.g. Keen Mind "Quiet Study") were silently dropped by this
            // replace-only fallback. featBuffService tags them isBonusAction —
            // append them to Bonus Actions as informational no-roll rows.
            playerStats.bonusActions = [...playerStats.bonusActions, featEntry];
        } else {
            const existingIndex = playerStats.specialActions.findIndex(f => f.name === featFeature.name);
            if (existingIndex !== -1 && !playerStats.specialActions[existingIndex].description && featEntry.description) {
                playerStats.specialActions = [...playerStats.specialActions.slice(0, existingIndex), featEntry, ...playerStats.specialActions.slice(existingIndex + 1)];
            }
        }
    }
}

// Add feat features to their proper action arrays based on casting_time for display
// Feat names are stored in the character's JSON and are sufficient to compute
// automation when playerStats are computed - feat features are NOT stored in
// formData.specialActions during character creation
function addFeatFeatures(playerStats, playerSummary, featFeatures, allFeatures) {
    if (featFeatures.length === 0) return;

    // Add feat features to allFeatures for automation processing
    featFeatures.forEach(featFeature => {
        if (!featFeature.name) return;
        allFeatures.push({
            name: featFeature.name,
            description: featFeature.description || '',
            type: featFeature.type || 'passive',
            source: 'feat',
            automation: featFeature.automation,
            featName: featFeature.featName,
        });
    });
    // Re-process automation with feat features included
    playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
    renameMagicInitiateFeatures(playerStats, playerSummary);
    mergeAutomationSpecialActions(playerStats);

    const featureCategories = getCategories(playerStats.rules || '5e');

    // Now create feat entries with processed automation (options instead of effects)
    for (const featFeature of featFeatures) {
        if (!featFeature.name) continue;

        // Look up the processed automation info from playerStats.automation
        // This ensures feat actions have 'options' (processed) instead of 'effects' (raw)
        const processedAutomation = findProcessedAttackRider(playerStats, featFeature.name);

        const featEntry = {
            name: featFeature.name,
            description: featFeature.description || '',
            type: featFeature.type || 'passive',
            source: 'feat',
            automation: processedAutomation || featFeature.automation,
        };

        categorizeFeatEntry(playerStats, featFeature, featEntry, featureCategories);
    }
}

function freeSpellAlreadyAdded(playerStats, predicate) {
    return (playerStats.automation?.specialActions || []).some(predicate);
}

// Add Magic Initiate level 1 spell free_spell features
function addMagicInitiateFreeCasts(playerStats) {
    const miInstances = playerStats.magicInitiateInstances || [];
    miInstances.forEach((inst, idx) => {
        if (!inst.level1Spell) return;
        const featureName = `Level 1 Spell [Instance ${idx + 1}]`;
        // Check if this specific spell is already in automation.specialActions
        const alreadyAdded = freeSpellAlreadyAdded(playerStats, a =>
            a.type === 'free_spell' &&
            (a.spell === inst.level1Spell || (Array.isArray(a.spell) && a.spell.includes(inst.level1Spell)))
        );
        if (alreadyAdded) return;
        const newFeature = {
            name: featureName,
            description: `Magic Initiate (${inst.class}): Cast ${inst.level1Spell} once for free. Recharges on long rest.`,
            type: 'free_spell',
            automation: {
                type: 'free_spell',
                spell: inst.level1Spell,
                name: featureName,
                uses: 1,
                recharge: 'long_rest',
            },
        };
        playerStats.specialActions.push(newFeature);
        playerStats.automation.specialActions.push({
            type: 'free_spell',
            spell: inst.level1Spell,
            name: featureName,
            uses: 1,
            recharge: 'long_rest',
        });
    });
}

// Add Fey Touched level 1 spell free_spell feature
function addFeyTouchedFreeCast(playerStats) {
    const ftSpell = playerStats.feyTouchedSpell;
    if (!ftSpell) return;
    const ftAlreadyAdded = freeSpellAlreadyAdded(playerStats, a =>
        a.type === 'free_spell' &&
        (a.spell === ftSpell || (Array.isArray(a.spell) && a.spell.includes(ftSpell)))
    );
    if (ftAlreadyAdded) return;
    const ftFeatureName = 'Fey Magic';
    const newFtFeature = {
        name: ftFeatureName,
        description: `Fey Touched: Cast ${ftSpell} once for free. Recharges on long rest.`,
        type: 'free_spell',
        automation: {
            type: 'free_spell',
            spell: ftSpell,
            name: ftFeatureName,
            uses: 1,
            recharge: 'long_rest',
        },
    };
    playerStats.specialActions.push(newFtFeature);
    playerStats.automation.specialActions.push({
        type: 'free_spell',
        spell: ftSpell,
        name: ftFeatureName,
        uses: 1,
        recharge: 'long_rest',
    });
}

// FT-070: Shadow Touched free casts — BOTH the chosen spell and Invisibility,
// one free cast PER SPELL per Long Rest (RAW: "cast each of these spells… can't
// cast that spell in this way again until you finish a Long Rest"). The entry is
// built with perSpellTracking so spellPreparationService consumes a per-spell
// counter (`_Shadow_Magic_<Spell>_freeCastCount`, CLA-308 naming) — the previous
// chosen-spell-only entry left Invisibility inert (slot always consumed) and a
// shared feature counter let either spell steal the other's free cast.
function addShadowTouchedFreeCasts(playerStats) {
    const stSpell = playerStats.shadowTouchedSpell;
    if (!stSpell) return;
    const stSpells = [...new Set([stSpell, 'Invisibility'])];
    const stAlreadyAdded = freeSpellAlreadyAdded(playerStats, a =>
        a.type === 'free_spell' && a.name === 'Shadow Magic'
    );
    if (stAlreadyAdded) return;
    const stFeatureName = 'Shadow Magic';
    const stAutomationEntry = {
        type: 'free_spell',
        spell: stSpells,
        name: stFeatureName,
        uses: 1,
        recharge: 'long_rest',
        perSpellTracking: true,
    };
    const newStFeature = {
        name: stFeatureName,
        description: `Shadow Touched: Cast ${stSpells.join(' or ')} once each for free. Recharges on long rest.`,
        type: 'free_spell',
        automation: stAutomationEntry,
    };
    playerStats.specialActions.push(newStFeature);
    playerStats.automation.specialActions.push(stAutomationEntry);
}

const rules = {
     // === SHARED METHODS (identical in both rulesets) ===

    getAbilityLongName: utils.getAbilityLongName,
    getSpellMaxLevel,

    getSubModules,

    // === RULESET-SPECIFIC: getAbilities ===
    getAbilities: async (playerStats, playerSummary) => {
        const { abilityCalc } = getSubModules(playerStats, playerSummary);
        return is2024(playerStats, playerSummary)
            ? abilityCalc.getAbilities(playerStats)
            : abilityCalc.getAbilities(playerStats);
     },

      // === RULESET-SPECIFIC: getHitPoints ===
     getHitPoints: (playerStats, playerSummary) => {
         const { abilityCalc } = getSubModules(playerStats, playerSummary);
         return is2024(playerStats, playerSummary)
             ? abilityCalc.getHitPoints(playerStats)
             : abilityCalc.getHitPoints(playerStats);
      },

     // === SHARED: getCarryingCapacity ===
     getCarryingCapacity: (playerStats) => {
         const { abilityCalc } = getSubModules(playerStats, null);
         return is2024(playerStats, null)
             ? abilityCalc.getHitPoints(playerStats)
             : abilityCalc.getHitPoints(playerStats);
      },

     // === RULESET-SPECIFIC: getSpellAbilities ===
     getSpellAbilities: (allSpells, playerStats, playerSummary) => {
         const { spellCalc } = getSubModules(playerStats, playerSummary);
         return is2024(playerStats, playerSummary)
             ? spellCalc.getSpellAbilities(allSpells, playerStats, playerSummary)
             : spellCalc.getSpellAbilities(allSpells, playerStats);
      },

     // === RULESET-SPECIFIC: getAttacks ===
    getAttacks: (allEquipment, allSpells, playerStats, playerSummary) => {
        const { attackCalc } = getSubModules(playerStats, playerSummary);
        return is2024(playerStats, playerSummary)
            ? attackCalc(allEquipment, allSpells, playerStats)
            : attackCalc(allEquipment, allSpells, playerStats);
     },

    // === SHARED: getProficiencesChoiceCount (ruleset-specific) ===
    getProficiencyChoiceCount: (playerStats, skills, playerSummary) => {
        const { proficiencyUtils: pu } = getSubModules(playerStats, playerSummary);
        return pu.getProficiencyChoiceCount(playerStats, skills);
     },

    // === Delegate to extracted modules ===
    getActions,
    getProficiencies,
    getArmorClass,
    getLanguages,
    getMagicItems,

    // === SHARED: getPlayerStats ===
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
        const playerStats = cloneDeep(playerSummary);

        // Read Fey Touched and Shadow Touched spells from runtime store
        applyFeyShadowTouchedSpells(playerStats);

        // Preserve rules type for downstream dispatch
        applyRulesType(playerStats, playerSummary);

        playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);

        const { classRules: cr, raceRules: rr } = getSubModules(playerStats, playerSummary);

          playerStats.class = cr.getClass(allClasses, playerSummary);
          // Map top-level fightingStyles to class.fightingStyles for fighting style handlers
          if (playerStats.fightingStyles && !playerStats.class.fightingStyles) {
              playerStats.class.fightingStyles = playerStats.fightingStyles;
          }
          playerStats.wildMagicSurgeTable = await loadWildMagicSurgeTable();
          playerStats.race = rr.getRace(allRaces, playerSummary);
          applyPowerfulBuild(playerStats);
          applyHalflingNimbleness(playerStats);
          playerStats.inventory.magicItems = getMagicItems(allMagicItems, playerSummary, playerStats);

        // 2024-specific: set senses early, store equipment
        if (is2024(playerStats, playerSummary)) {
            playerStats.senses = [];
            playerStats.equipment = allEquipment;
        }

        initActionArrays(playerStats);

            [playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = getActions(playerStats, playerSummary);

        // Apply fighting style reactions and special actions, then sort all action arrays
        applyFightingStyleEffects(playerStats);

        const allFeatures = [
            ...playerStats.actions,
            ...playerStats.bonusActions,
            ...playerStats.reactions,
            ...playerStats.specialActions,
            ...playerStats.characterAdvancement,
          ];

        // 2024: add background features to automation (e.g., Hermit's Wit)
        if (is2024(playerStats, playerSummary)) {
            await addBackgroundFeatures(playerStats, allFeatures);

            // 2024: Add fighting style feat features to allFeatures so their passive_buff automation is collected
            await addFightingStyleFeatFeatures(playerStats, allFeatures);
        }

          playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
          mergeAutomationSpecialActions(playerStats);
        playerStats.saveModifiers = collectSaveModifiers(allFeatures);
        playerStats.evasionEffects = getEvasionEffects(allFeatures);
      playerStats.automationConditionImmunities = getConditionImmunities(allFeatures);
       playerStats.automationConditionalImmunities = getConditionalImmunities(allFeatures);
       playerStats.turnStartEffects = collectTurnStartEffects(allFeatures);
         [playerStats.languagesAllowed, playerStats.languages] = getLanguages(playerStats, playerSummary);
         [playerStats.proficienciesAllowed, playerStats.proficiencies] = getProficiencies(playerStats, false, playerSummary);
         [playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = getProficiencies(playerStats, true, playerSummary);

      // Clean up any leftover placeholder proficiency entries from previous saves
      // (e.g., "1 from: Arcana, History" for skill expertise, "3 from: Musical Instruments" for Musician feat)
      if (Array.isArray(playerStats.proficiencies)) {
          playerStats.proficiencies = playerStats.proficiencies.filter(p => {
              if (typeof p !== 'string') return true;
              return !/^(\d+) from: (.+)$/.test(p);
          });
      }

      // Apply feat buffs to ability featIncrease before computing abilities.
      // FT-047: the Edit wizard ALREADY persists feat ASIs into the stored
      // featIncrease (useWizardFeatBuffs.js) — accumulating the recomputed
      // increases on top double-applied them (Keen Mind INT 17→19). Reconcile
      // idempotently: each ability's featIncrease becomes the MAX of the
      // stored value and the total computed from feats[], so re-loading a
      // saved character applies an ASI exactly once while characters whose
      // JSON predates feat persistence still receive their computed increases.
      const featData = await loadFeatData(is2024(playerStats, playerSummary) ? '2024' : '5e');
      const featBuffs = computeAllFeatBuffs(playerStats, featData);

      applyAbilityScoreFeatIncreases(playerStats, featBuffs);
      await applyProficiencyFeatBuffs(playerStats, featBuffs);

      const featFeatures = featBuffs.features;
      addFeatFeatures(playerStats, playerSummary, featFeatures, allFeatures);

      // CLA-396: Recompute save proficiencies unconditionally — allFeatures is
      // complete (class/subclass/racial/background pushed earlier, feat features
      // pushed above). Gating on featFeatures.length silently dropped every
      // feature-based save grant (e.g. Iron Mind) for zero-feat characters.
      playerStats.saveProficiencies = getAllSaveProficiencies(allFeatures, playerStats);

      addMagicInitiateFreeCasts(playerStats);
      addFeyTouchedFreeCast(playerStats);
      addShadowTouchedFreeCasts(playerStats);

      // Re-sort all action arrays after feat features are merged
      resortActionArrays(playerStats);

      await processManeuvers(playerStats, playerSummary, allFeatures, collectAutomationFromFeatures, mergeAutomationSpecialActions);

      resortActionArrays(playerStats);
      playerStats.saveModifiers = collectSaveModifiers(allFeatures);
      // CLA-209: Add Powerful Build grapple escape advantage after the FINAL saveModifiers
      // collection — any earlier push is clobbered by the re-collection above.
      if (playerStats.hasPowerfulBuild && Array.isArray(playerStats.saveModifiers)) {
          playerStats.saveModifiers.push({
              source: 'Powerful Build',
              target: 'ability_check',
              condition: 'powerful_build_grapple_escape',
              effect: 'advantage',
              abilities: ['STR'],
          });
      }

  playerStats.allFeatures = allFeatures;

  playerStats.abilities = await rules.getAbilities(playerStats, playerSummary);
  // CLA-229: automation was collected at :171/:266 with abilities not yet
  // computed, so uses_expression pools (Misty Wanderer, Steps of the Fey,
  // every `uses_expression` free-cast family) baked usesMax at the min-1
  // floor. Re-resolve those expressions now that ability bonuses exist.
  // Runs after the CLA-209 saveModifiers push — order-independent.
  reresolveAutomationUsesMax(playerStats);
  playerStats.hitPoints = rules.getHitPoints(playerStats, playerSummary);
  playerStats.carryingCapacity = rules.getCarryingCapacity(playerStats);
  playerStats.speed = applyElfisLineageSpeed(playerStats, playerSummary);
  playerStats.speed = applySpeedIncreasePassives(playerStats);
  computeInitiative(playerStats);
  [playerStats.armorClass, playerStats.armorClassFormula] = getArmorClass(allEquipment, playerStats, playerSummary);
  playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats, playerSummary);
   playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats, playerSummary);

   // Add Hunter's Prey bonus action attack if the player has the Hunter class
   addHunterPreyAttack(playerStats);


   // 2024-specific: senses set later (override), 5e-specific: immunities/resistances
   computeSenses(playerStats, playerSummary);

  return playerStats;
 }
};

export default rules;
