import { cloneDeep, uniqBy } from 'lodash';
import classRules from './class-rules';
import raceRules from './race-rules';
import utils from './utils.js';
import { loadSkills, loadPassiveSkills } from './data-loader';
import { parseMagicItemName } from './attack-calc.js';
import * as proficiencyUtils from './proficiency-utils.js';
import { getAbilities, getHitPoints } from './ability-calc.js';
import { getSpellAbilities, getSpellMaxLevel } from './spell-calc.js';
import { getAttacks } from './attack-calc.js';

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
    getProficiencyChoiceCount: proficiencyUtils.getProficiencyChoiceCount,
    getActions: (playerStats) => {
        const features = classRules.getFeatures(playerStats);
        const traits = raceRules.getTraits(playerStats);
        const actions = uniqBy([...(playerStats.actions || []), ...features.actions, ...traits.actions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const bonusActions = uniqBy([...(playerStats.bonusActions || []), ...features.bonusActions, ...traits.bonusActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const reactions = uniqBy([...(playerStats.reactions || []), ...features.reactions, ...traits.reactions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const specialActions = uniqBy([...(playerStats.specialActions || []), ...features.specialActions, ...traits.specialActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
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
        if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Defense')) {
            addedBonus += 1;
            contributions.push(`Fighting Style Defense (1)`);
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
        if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Cloak of Protection')) {
            armorClass += 1;
            contributions.push(`Cloak of Protection (1)`);
        }
        if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Ring of Protection')) {
            armorClass += 1;
            contributions.push(`Ring of Protection (1)`);
        }
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
        return [armorClass, contributions.join(' + ')];
    },
    getLanguages: (playerStats) => {
        let languages = [...(playerStats.race.languages || [])];
        let languagesAllowed = languages.length;
        languagesAllowed += 2;
        if (playerStats.race.language_choices) {
            languagesAllowed += playerStats.race.language_choices.choose || 0;
        }
        if (playerStats.race.subrace && playerStats.race.subrace.language_options) {
            languages = [...new Set([...languages, ...(playerStats.race.subrace.languages || [])])];
            languagesAllowed += playerStats.race.subrace.language_options.choose || 0;
        }
        languages = [...new Set([...languages, ...(playerStats.class.languages || [])])];
        if (playerStats.class.language_choices) {
            let rangerLanguageBonus = playerStats.class.language_choices.choose || 0;
            languagesAllowed += rangerLanguageBonus;
            if (playerStats.class.name === 'Ranger') {
                if (playerStats.level > 5) languagesAllowed += 1;
                if (playerStats.level > 13) languagesAllowed += 1;
            }
        }
        if (playerStats.class.subclass) {
            if (playerStats.class.subclass.language_choices) {
                languagesAllowed += playerStats.class.subclass.language_choices.choose || 0;
            }
        }
        if (playerStats.languages) {
            languages = [...new Set([...languages, ...playerStats.languages])];
        }
        return [languagesAllowed, languages.sort()];
    },
    getMagicItems: (allMagicItems, playerSummary) => {
        if (playerSummary.inventory.magicItems) {
            const playerMagicItems = playerSummary.inventory.magicItems.map(playerMagicItem => {
                const magicItem = allMagicItems.find(magicItem => magicItem.name === playerMagicItem.name);
                if (magicItem) {
                    if (magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
                        return { ...magicItem, details: magicItem.description, description: playerMagicItem.spell };
                    }
                    return { ...magicItem, quantity: playerMagicItem.quantity, rarity: playerMagicItem.rarity ? playerMagicItem.rarity : magicItem.rarity };
                }
                return { ...playerMagicItem };
            });
            return playerMagicItems;
        }
        return null;
    },
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
        const playerStats = cloneDeep(playerSummary);
        playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);
        playerStats.class = classRules.getClass(allClasses, playerSummary);
        playerStats.immunities = raceRules.getImmunities(playerSummary);
        playerStats.inventory.magicItems = rules.getMagicItems(allMagicItems, playerSummary);
        playerStats.race = raceRules.getRace(allRaces, playerSummary);
        playerStats.resistances = raceRules.getResistances(playerSummary);
        [playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = rules.getActions(playerStats);
        [playerStats.languagesAllowed, playerStats.languages] = rules.getLanguages(playerStats);
        [playerStats.proficienciesAllowed, playerStats.proficiencies] = rules.getProficiencies(playerStats, false);
        [playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = rules.getProficiencies(playerStats, true);
        playerStats.senses = raceRules.getSenses(playerStats);
        playerStats.abilities = await rules.getAbilities(playerStats);
        playerStats.hitPoints = rules.getHitPoints(playerStats);
        playerStats.initiative = playerStats.abilities.find((ability) => ability.name === 'Dexterity').bonus;
        [playerStats.armorClass, playerStats.armorClassFormula] = rules.getArmorClass(allEquipment, playerStats);
        playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats);
        playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats);
        return playerStats;
    }
};

export default rules;