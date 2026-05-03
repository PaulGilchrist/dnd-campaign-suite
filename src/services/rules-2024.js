import { cloneDeep, uniqBy } from 'lodash';
import classRules from './class-rules-2024.js';
import raceRules from './race-rules-2024.js';
import utils from './utils.js';
import { loadSkills, loadPassiveSkills } from './data-loader';
import { parseMagicItemName } from './attack-calc.js';
import * as proficiencyUtils from './proficiency-utils-2024.js';
import { getAbilities, getHitPoints } from './ability-calc-2024.js';
import { getSpellAbilities, getSpellMaxLevel } from './spell-calc-2024.js';
import { getAttacks } from './attack-calc-2024.js';

const rules = {
    getAbilityLongName: utils.getAbilityLongName,
    getAbilities,
    getHitPoints,
    getSpellAbilities,
    getSpellMaxLevel,
    getAttacks,
    getProficiencies: (playerStats, skill = true) => {
        return proficiencyUtils.getProficiencies(
            playerStats,
            skill,
            proficiencyUtils.getProficiencyChoiceCount,
              {
                raceProficiencies: () => [],
                bonusSource: playerStats.class.major || {},
              }
          );
      },
    getProficiencyChoiceCount: proficiencyUtils.getProficiencyChoiceCount,
    getActions: (playerStats) => {
        const features = classRules.getFeatures(playerStats);
        const traits = raceRules.getTraits(playerStats);

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
      },
    getArmorClass: (allEquipment, playerStats) => {
        const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
        const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        const wisdom = playerStats.abilities.find((ability) => ability.name === 'Wisdom');

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

        return [armorClass, contributions.join(' + ')];
      },
    getLanguages: (playerStats) => {
        let languages = [...(playerStats.race?.languages || [])];
        let languagesAllowed = languages.length;
        languagesAllowed += 2;
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
        if (playerStats.class.major) {
            if (playerStats.class.major.language_choices) {
                languagesAllowed += playerStats.class.major.language_choices.choose || 0;
              }
          }
        if (playerStats.languages) {
            languages = [...new Set([...languages, ...playerStats.languages])];
          }

        return [languagesAllowed, languages.sort()];
      },
    getMagicItems: (allMagicItems, playerSummary) => {
        const inventoryMagicItems = playerSummary.inventory?.magicItems || [];

        if (!allMagicItems) {
            return [];
          }

        if (inventoryMagicItems.length === 0) {
            return [];
          }

        const processedItems = inventoryMagicItems.map(itemNameOrObj => {
            let itemName = typeof itemNameOrObj === 'string' ? itemNameOrObj : itemNameOrObj.name;

            const magicItem = allMagicItems.find(m => m.name === itemName);

            if (!magicItem) {
                return null;
               }

            if (magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
                return { ...magicItem, details: magicItem.description, description: itemNameOrObj.spell };
               }

            const result = { ...magicItem };
            if (typeof itemNameOrObj === 'object' && itemNameOrObj.quantity) {
                result.quantity = itemNameOrObj.quantity;
               }
            if (typeof itemNameOrObj === 'object' && itemNameOrObj.rarity) {
                result.rarity = itemNameOrObj.rarity;
               }

            return result;
           }).filter(item => item !== null);

        return processedItems;
      },
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
            const playerStats = cloneDeep(playerSummary);
            playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);

            playerStats.senses = [];

            playerStats.equipment = allEquipment;

            playerStats.class = classRules.getClass(allClasses, playerSummary);
            playerStats.race = raceRules.getRace(allRaces, playerSummary);
            const resultMagicItems = rules.getMagicItems(allMagicItems, playerSummary);
            playerStats.inventory.magicItems = resultMagicItems;

             [playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = rules.getActions(playerStats);
             [playerStats.languagesAllowed, playerStats.languages] = rules.getLanguages(playerStats);
             [playerStats.proficienciesAllowed, playerStats.proficiencies] = rules.getProficiencies(playerStats, false);
             [playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = rules.getProficiencies(playerStats, true);

            playerStats.abilities = await rules.getAbilities(playerStats);
            playerStats.hitPoints = rules.getHitPoints(playerStats);
            playerStats.initiative = playerStats.abilities.find((ability) => ability.name === 'Dexterity').bonus;
             [playerStats.armorClass, playerStats.armorClassFormula] = rules.getArmorClass(allEquipment, playerStats);
            playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats);
            playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats);

            playerStats.senses = raceRules.getSenses(playerStats);

            return playerStats;
        }
};

export default rules;