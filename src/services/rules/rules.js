import { cloneDeep, uniqBy } from 'lodash';
import classRules from '../character/classRules.js';
import classRules2024 from '../character/classRules2024.js';
import { rules5e } from '../character/race-rules/index.js';
import { rules2024 } from '../character/race-rules/index.js';
import utils from '../ui/utils.js';
import { parseMagicItemName } from './attackCalc.js';
import * as proficiencyUtils from '../character/proficiencyUtils.js';
import * as proficiencyUtils2024 from '../character/proficiencyUtils2024.js';
import { getAbilities as getAbilities5e, getHitPoints as getHitPoints5e } from './abilityCalc.js';
import { getAbilities as getAbilities2024, getHitPoints as getHitPoints2024 } from './abilityCalc2024.js';
import { getSpellAbilities as getSpellAbilities5e } from './spellCalc.js';
import { getSpellAbilities as getSpellAbilities2024 } from './spellCalc2024.js';
import { getAttacks as getAttacks5e } from './attackCalc.js';
import { getAttacks as getAttacks2024 } from './attackCalc2024.js';
import { getSpellMaxLevel } from '../shared/spell-utils.js';
import { loadFeatData } from '../ui/dataLoader.js';
import { computeAllFeatBuffs } from '../character/featBuffService.js';
import {
    collectAutomationFromFeatures,
    collectSaveModifiers,
    getConditionImmunities,
    getConditionalImmunities,
    getEvasionEffects,
} from '../combat/automationService.js';

/**
 * Determine which ruleset to use. Checks playerStats.rules first,
 * then falls back to playerSummary.rules, then defaults to '5e'.
 */
function getRulesType(playerStats, playerSummary) {
    if (playerStats && playerStats.rules) return playerStats.rules;
    if (playerSummary && playerSummary.rules) return playerSummary.rules;
    return '5e';
}

function is2024(playerStats, playerSummary) {
    return getRulesType(playerStats, playerSummary) === '2024';
}

const rules = {
     // === SHARED METHODS (identical in both rulesets) ===

    getAbilityLongName: utils.getAbilityLongName,

    getSpellMaxLevel,

     /**
      * Get the appropriate sub-module imports for the ruleset.
      */
    getSubModules(playerStats, playerSummary) {
        const use2024 = is2024(playerStats, playerSummary);
        return {
            abilityCalc: use2024 ? { getAbilities: getAbilities2024, getHitPoints: getHitPoints2024 } : { getAbilities: getAbilities5e, getHitPoints: getHitPoints5e },
            spellCalc: use2024 ? { getSpellAbilities: getSpellAbilities2024 } : { getSpellAbilities: getSpellAbilities5e },
            attackCalc: use2024 ? getAttacks2024 : getAttacks5e,
            proficiencyUtils: use2024 ? proficiencyUtils2024 : proficiencyUtils,
            classRules: use2024 ? classRules2024 : classRules,
            raceRules: use2024 ? rules2024 : rules5e,
            use2024
         };
     },

     // === RULESET-SPECIFIC: getAbilities ===
    getAbilities: async (playerStats, playerSummary) => {
        if (is2024(playerStats, playerSummary)) {
            return getAbilities2024(playerStats);
         }
        return getAbilities5e(playerStats);
     },

     // === RULESET-SPECIFIC: getHitPoints ===
    getHitPoints: (playerStats, playerSummary) => {
        if (is2024(playerStats, playerSummary)) {
            return getHitPoints2024(playerStats);
         }
        return getHitPoints5e(playerStats);
     },

     // === RULESET-SPECIFIC: getSpellAbilities ===
    getSpellAbilities: (allSpells, playerStats, playerSummary) => {
        if (is2024(playerStats, playerSummary)) {
            return getSpellAbilities2024(allSpells, playerStats);
         }
        return getSpellAbilities5e(allSpells, playerStats);
     },

     // === RULESET-SPECIFIC: getAttacks ===
    getAttacks: (allEquipment, allSpells, playerStats, playerSummary) => {
        if (is2024(playerStats, playerSummary)) {
            return getAttacks2024(allEquipment, allSpells, playerStats);
         }
        return getAttacks5e(allEquipment, allSpells, playerStats);
     },

     // === SHARED: getProficiencesChoiceCount (ruleset-specific) ===
    getProficiencyChoiceCount: (playerStats, skills, playerSummary) => {
        const { proficiencyUtils: pu } = rules.getSubModules(playerStats, playerSummary);
        return pu.getProficiencyChoiceCount(playerStats, skills);
     },

     // === RULESET-SPECIFIC: getProficiencies ===
     getProficiencies: (playerStats, skill = true, playerSummary) => {
         const { proficiencyUtils: pu } = rules.getSubModules(playerStats, playerSummary);

        if (is2024(playerStats, playerSummary)) {
             // 2024: no racial extra proficiencies, uses class.major
            return pu.getProficiencies(
                playerStats,
                skill,
                pu.getProficiencyChoiceCount,
                 {
                    raceProficiencies: () => [],
                    bonusSource: playerStats.class.major || {},
                 }
             );
         }

         // 5e: race proficiencies from traits/subrace, uses class.subclass
        return pu.getProficiencies(
            playerStats,
            skill,
            pu.getProficiencyChoiceCount,
             {
                raceProficiencies: (ps) => {
                    const extra = [];
                    ps.race.traits.forEach(trait => {
                        if (trait.proficiencies && trait.proficiencies.length > 0) {
                            extra.push(...trait.proficiencies);
                         }
                     });
                    if (ps.race.subrace) {
                        extra.push(...(ps.race.subrace.starting_proficiencies || []));
                        if (ps.race.subrace.racial_traits) {
                            ps.race.subrace.racial_traits.forEach(racial_trait => {
                                if (racial_trait.proficiencies && racial_trait.proficiencies.length > 0) {
                                    extra.push(...racial_trait.proficiencies);
                                 }
                             });
                         }
                     }
                    return extra;
                 },
                bonusSource: playerStats.class.subclass || {},
             }
         );
     },

     // === RULESET-SPECIFIC: getActions ===
    getActions: (playerStats, playerSummary) => {
        const { classRules: cr, raceRules: rr } = rules.getSubModules(playerStats, playerSummary);
        const features = cr.getFeatures(playerStats);
        const traits = rr.getTraits(playerStats);

        if (is2024(playerStats, playerSummary)) {
             // 2024: normalize string actions, include magic/utilize/craft actions
            const playerActions = (playerStats.actions || []).map(action =>
                typeof action === 'string' ? { name: action, description: '', details: null } : action
             );

            const actions = uniqBy([
                 ...playerActions,
                 ...features.actions,
                 ...traits.actions,
                 ...(playerStats.magicActions ? playerStats.magicActions : []),
                 ...(playerStats.utilizeActions ? playerStats.utilizeActions : []),
                 ...(playerStats.craftActions ? playerStats.craftActions : [])
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const bonusActions = uniqBy([
                 ...(playerStats.bonusActions ? playerStats.bonusActions : []),
                 ...features.bonusActions,
                 ...traits.bonusActions
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const reactions = uniqBy([
                 ...(playerStats.reactions ? playerStats.reactions : []),
                 ...features.reactions,
                 ...traits.reactions
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const playerSpecialActions = (playerStats.specialActions || []).map(action =>
                typeof action === 'string' ? { name: action, description: '', details: null } : action
             );

            const specialActions = uniqBy([
                 ...playerSpecialActions,
                 ...features.specialActions,
                 ...traits.specialActions,
                 ...(playerStats.magicSpecialActions ? playerStats.magicSpecialActions : []),
                 ...(playerStats.utilizeSpecialActions ? playerStats.utilizeSpecialActions : []),
                 ...(playerStats.craftSpecialActions ? playerStats.craftSpecialActions : [])
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const characterAdvancement = uniqBy([...features.characterAdvancement, ...traits.characterAdvancement], 'name').sort((a, b) => a.name.localeCompare(b.name));

            return [actions, bonusActions, reactions, specialActions, characterAdvancement];
         }

         // 5e: original action handling
        const actions = uniqBy([...(playerStats.actions || []), ...features.actions, ...traits.actions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const bonusActions = uniqBy([...(playerStats.bonusActions || []), ...features.bonusActions, ...traits.bonusActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const reactions = uniqBy([...(playerStats.reactions || []), ...features.reactions, ...traits.reactions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const specialActions = uniqBy([...(playerStats.specialActions || []), ...features.specialActions, ...traits.specialActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const characterAdvancement = uniqBy([...features.characterAdvancement, ...traits.characterAdvancement], 'name').sort((a, b) => a.name.localeCompare(b.name));

        return [actions, bonusActions, reactions, specialActions, characterAdvancement];
     },

     // === SHARED: getArmorClass (mostly shared, 5e-specific features at bottom) ===
    getArmorClass: (allEquipment, playerStats, playerSummary) => {
        const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
        const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        const wisdom = playerStats.abilities.find((ability) => ability.name === 'Wisdom');
        const charisma = playerStats.abilities.find((ability) => ability.name === 'Charisma');

        let armorName = playerStats.inventory.equipped.find(itemName => {
            let item = allEquipment.find((item) => item.name === parseMagicItemName(itemName).baseName);
            if (item) {
                return item.equipment_category === 'Armor';
             }
            return false;
         });

        let addedBonus = 0;
        let contributions = [];

        if (playerStats.class.name === 'Monk') {
            addedBonus += wisdom.bonus;
            contributions.push(`Monk Wisdom Bonus (${wisdom.bonus})`);
         }

         // 5e-specific: Defense fighting style
        if (!is2024(playerStats, playerSummary)) {
            if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Defense')) {
                addedBonus += 1;
                contributions.push(`Fighting Style Defense (1)`);
             }
         }

        let armorClass;
        if (armorName) {
            let parsedArmor = parseMagicItemName(armorName);
            contributions.push(`Armor Magic Bonus (${parsedArmor.magicBonus})`);
            let armor = allEquipment.find((item) => item.name === parsedArmor.baseName);
            armorClass = armor.armor_class.base + addedBonus + parsedArmor.magicBonus;
            contributions.push(`Armor (${armor.armor_class.base})`);
            if (armor.armor_class.dex_bonus) {
                let armorBonus = dexterity.bonus;
                contributions.push(`Dexterity Bonus (${dexterity.bonus})`);
                if (armor.armor_class.max_bonus) {
                    armorBonus = Math.min(armor.armor_class.max_bonus, armorBonus);
                 }
                armorClass = armor.armor_class.base + armorBonus + addedBonus + parsedArmor.magicBonus;
             }
         } else {
            armorClass = 10 + dexterity.bonus + addedBonus;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus})`);
         }

        let shield = playerStats.inventory.equipped.find(item => parseMagicItemName(item).baseName === 'Shield');
        if (shield) {
            const parsedShield = parseMagicItemName(shield);
            armorClass += 2 + parsedShield.magicBonus;
            contributions.push(`Shield (2) + Shield Magic Bonus (${parsedShield.magicBonus})`);
         } else if (playerStats.inventory.equipped.find(item => item === 'Shield')) {
            armorClass += 2;
            contributions.push(`Shield (2)`);
         }

         // 5e-specific: Cloak and Ring of Protection
        if (!is2024(playerStats, playerSummary)) {
            if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Cloak of Protection')) {
                armorClass += 1;
                contributions.push(`Cloak of Protection (1)`);
             }
            if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Ring of Protection')) {
                armorClass += 1;
                contributions.push(`Ring of Protection (1)`);
             }
         }

        // 5e-specific: Barbarian and Draconic Sorcerer unarmored defense
        if (!is2024(playerStats, playerSummary)) {
            if (playerStats.class.name === 'Barbarian') {
                const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
                if (barbarianAc > armorClass) {
                    armorClass = barbarianAc;
                    contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`];
                 }
             } else if (playerStats.class.subclass && playerStats.class.subclass.name === 'Draconic') {
                const sorcererAc = 13 + dexterity.bonus;
                if (sorcererAc > armorClass) {
                    armorClass = sorcererAc;
                    contributions = [`Unarmored AC (13) + Dexterity Bonus (${dexterity.bonus})`];
                 }
             }
         }

          // 2024: College of Dance unarmored defense (AC = 10 + DEX + CHA, no armor or shield)
         if (is2024(playerStats, playerSummary)) {
             if (playerStats.class.subclass && playerStats.class.subclass.name === 'College of Dance' && !armorName && !shield) {
                 const danceAc = 10 + dexterity.bonus + charisma.bonus;
                 if (danceAc > armorClass) {
                     armorClass = danceAc;
                     contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Charisma Bonus (${charisma.bonus})`];
                  }
              }
              if (playerStats.class.name === 'Barbarian' && !armorName) {
                 const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
                 if (barbarianAc > armorClass) {
                     armorClass = barbarianAc;
                     contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`];
                  }
              }
          }

        return [armorClass, contributions.join(' + ')];
     },

     // === SHARED: getLanguages (handles both rulesets internally) ===
    getLanguages: (playerStats, playerSummary) => {
        let languages = [...(playerStats.race?.languages || [])];
        let languagesAllowed = languages.length;
        languagesAllowed += 2; // Background languages

        if (playerStats.race.language_choices) {
            languagesAllowed += playerStats.race.language_choices.choose || 0;
         }

        if (playerStats.race.subrace && playerStats.race.subrace.language_options) {
            languages = [...new Set([...languages, ...(playerStats.race.subrace.languages || [])])];
            languagesAllowed += playerStats.race.subrace.language_options.choose || 0;
         }

        languages = [...new Set([...languages, ...(playerStats.class?.languages || [])])];

        if (playerStats.class?.language_choices) {
            let rangerLanguageBonus = playerStats.class.language_choices.choose || 0;
            languagesAllowed += rangerLanguageBonus;
            if (playerStats.class.name === 'Ranger') {
                if (playerStats.level > 5) languagesAllowed += 1;
                if (playerStats.level > 13) languagesAllowed += 1;
             }
         }

         // 5e: class.subclass.language_choices, 2024: class.major.language_choices
        const use2024 = is2024(playerStats, playerSummary);
        if (use2024) {
            if (playerStats.class.major && playerStats.class.major.language_choices) {
                languagesAllowed += playerStats.class.major.language_choices.choose || 0;
             }
         } else {
            if (playerStats.class.subclass && playerStats.class.subclass.language_choices) {
                languagesAllowed += playerStats.class.subclass.language_choices.choose || 0;
             }
         }

        if (playerStats.languages) {
            languages = [...new Set([...languages, ...playerStats.languages])];
         }

        return [languagesAllowed, languages.sort()];
     },

     // === SHARED: getMagicItems (handles both rulesets internally) ===
    getMagicItems: (allMagicItems, playerSummary, playerStats) => {
        const inventoryMagicItems = playerSummary.inventory?.magicItems || [];

        if (!allMagicItems || inventoryMagicItems.length === 0) {
             // 2024 returns [], 5e returns null
            if (is2024(playerStats, playerSummary)) {
                return [];
             }
            return null;
         }

        const processedItems = inventoryMagicItems.map(itemNameOrObj => {
            let itemName = typeof itemNameOrObj === 'string' ? itemNameOrObj : itemNameOrObj.name;
            const magicItem = allMagicItems.find(m => m.name === itemName);

            if (!magicItem) {
                if (is2024(playerStats, playerSummary)) {
                    return null; // 2024 filters out nulls
                 }
                return { ...itemNameOrObj }; // 5e keeps the item even if not found
             }

            if (magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
                return { ...magicItem, details: magicItem.description, description: itemNameOrObj.spell || itemNameOrObj.description };
             }

            const result = { ...magicItem };
            if (typeof itemNameOrObj === 'object' && itemNameOrObj.quantity) {
                result.quantity = itemNameOrObj.quantity;
             }
            if (typeof itemNameOrObj === 'object' && itemNameOrObj.rarity) {
                result.rarity = itemNameOrObj.rarity;
             }

            return result;
         });

         // 2024 filters out nulls, 5e does not
        if (is2024(playerStats, playerSummary)) {
            return processedItems.filter(item => item !== null);
         }

        return processedItems;
     },

     // === SHARED: getPlayerStats (handles both rulesets internally) ===
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
        const playerStats = cloneDeep(playerSummary);

         // Preserve rules type for downstream dispatch
        playerStats.rules = playerSummary.rules || '5e';

        playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);

        const { classRules: cr, raceRules: rr } = rules.getSubModules(playerStats, playerSummary);

        playerStats.class = cr.getClass(allClasses, playerSummary);
        playerStats.race = rr.getRace(allRaces, playerSummary);
        playerStats.inventory.magicItems = rules.getMagicItems(allMagicItems, playerSummary, playerStats);

         // 2024-specific: set senses early, store equipment
        if (is2024(playerStats, playerSummary)) {
            playerStats.senses = [];
            playerStats.equipment = allEquipment;
         }

           [playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = rules.getActions(playerStats, playerSummary);

        const allFeatures = [
          ...(playerStats.actions || []),
          ...(playerStats.bonusActions || []),
          ...(playerStats.reactions || []),
          ...(playerStats.specialActions || []),
          ...(playerStats.characterAdvancement || []),
        ];
        playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
        playerStats.saveModifiers = collectSaveModifiers(allFeatures);
        playerStats.evasionEffects = getEvasionEffects(allFeatures);
        playerStats.automationConditionImmunities = getConditionImmunities(allFeatures);
        playerStats.automationConditionalImmunities = getConditionalImmunities(allFeatures);
          [playerStats.languagesAllowed, playerStats.languages] = rules.getLanguages(playerStats, playerSummary);
          [playerStats.proficienciesAllowed, playerStats.proficiencies] = rules.getProficiencies(playerStats, false, playerSummary);
          [playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = rules.getProficiencies(playerStats, true, playerSummary);

        // Apply feat buffs to ability miscBonus before computing abilities
        const featData = await loadFeatData(is2024(playerStats, playerSummary) ? '2024' : '5e');
        const featBuffs = computeAllFeatBuffs(playerStats, featData);
        featBuffs.abilityScoreIncreases.forEach(inc => {
            if (inc.name && inc.name !== 'any') {
                const ability = playerStats.abilities.find(
                    a => a.name.toLowerCase() === inc.name.toLowerCase()
                );
                if (ability) {
                    ability.miscBonus = (ability.miscBonus || 0) + inc.amount;
                }
            }
        });

        playerStats.abilities = await rules.getAbilities(playerStats, playerSummary);
        playerStats.hitPoints = rules.getHitPoints(playerStats, playerSummary);
        playerStats.initiative = playerStats.abilities.find((ability) => ability.name === 'Dexterity').bonus;
        playerStats.initiativeAdvantage = (playerStats.automation?.passives ?? []).some(
            p => p.type === 'passive_rule' && p.effect === 'initiative_advantage'
        );
         [playerStats.armorClass, playerStats.armorClassFormula] = rules.getArmorClass(allEquipment, playerStats, playerSummary);
        playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats, playerSummary);
        playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats, playerSummary);

         // Apply feat features to special actions
        const existingActionNames = new Set(
            (playerStats.specialActions || []).map(a => a.name)
        );
        featBuffs.features.forEach(f => {
            if (!existingActionNames.has(f.name)) {
                playerStats.specialActions = playerStats.specialActions || [];
                playerStats.specialActions.push({
                    name: f.name,
                    description: f.description,
                    type: f.type || 'passive',
                    source: 'feat',
                });
                existingActionNames.add(f.name);
            }
        });

         // 2024-specific: senses set later (override), 5e-specific: immunities/resistances
        if (is2024(playerStats, playerSummary)) {
            playerStats.senses = rr.getSenses(playerStats);
         } else {
            playerStats.immunities = rr.getImmunities(playerSummary);
            playerStats.resistances = rr.getResistances(playerSummary);
            playerStats.senses = rr.getSenses(playerStats);
         }

        return playerStats;
     }
};

export default rules;