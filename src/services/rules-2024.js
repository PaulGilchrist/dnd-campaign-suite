import { cloneDeep, uniqBy } from 'lodash';
import classRules from './class-rules-2024.js';
import raceRules from './race-rules-2024.js';
import utils from './utils.js';
import { loadSkills, loadPassiveSkills } from './data-loader';
import { parseMagicWeaponName, findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, buildSpellAttacks } from './attack-calc.js';

const rules = {
    getAbilityLongName: utils.getAbilityLongName,
    getAbilities: async (playerStats) => {
        // 2024 Rules: Simpler ability calculation, no racial bonuses
        const skills = await loadSkills();
        const passiveSkills = await loadPassiveSkills();
        return playerStats.abilities.map((ability) => {
            const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
            const newAbility = { ...ability };
            newAbility.totalScore = ability.baseScore + ability.abilityImprovements + ability.miscBonus;
            // No racial bonuses in 2024
            newAbility.bonus = Math.floor((newAbility.totalScore - 10) / 2);
            newAbility.proficient = playerStats.class.saving_throw_proficiencies ? playerStats.class.saving_throw_proficiencies.includes(newAbility.name) : false;
            newAbility.save = newAbility.proficient ? newAbility.bonus + proficiency : newAbility.bonus;
            newAbility.skills = skills.filter(skill => skill.ability === newAbility.name);
            newAbility.skills = newAbility.skills.map((skill) => {
                const proficient = playerStats.skillProficiencies.includes(skill.name);
                const newSkill = { ...skill };
                newSkill.bonus = proficient ? newAbility.bonus + proficiency : newAbility.bonus;
                if (playerStats.expertise && playerStats.expertise.includes(skill.name)) {
                    newSkill.bonus += proficiency;
                }
                return newSkill;
             });
            return newAbility;
         });
    },
    getActions: (playerStats) => {
        // 2024 Rules: Includes Magic, Utilize, and Craft actions
        const features = classRules.getFeatures(playerStats);
        const traits = raceRules.getTraits(playerStats);

        // Convert string actions to objects with name/description/details
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

        // Convert string specialActions to objects with name/description/details
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
        // 2024 Rules: Simplified AC calculation
        const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
        const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        const wisdom = playerStats.abilities.find((ability) => ability.name === 'Wisdom');

        let armorName = playerStats.inventory.equipped.find(itemName => {
            if (itemName.charAt(0) === "+") {
                itemName = itemName.substring(3);
            }
            let item = allEquipment.find((item) => item.name === itemName);
            if (item) {
                return item.equipment_category === 'Armor';
            }
            return false;
        });

        let addedBonus = 0;
        let contributions = [];

        // 2024: Monk Unarmored Defense
        if (playerStats.class.name === 'Monk') {
            addedBonus += wisdom.bonus;
            contributions.push(`Monk Wisdom Bonus (${wisdom.bonus})`);
        }

        let armorClass;
        if (armorName) {
            let magicBonus = 0;
            if (armorName.charAt(0) === '+') {
                magicBonus = Number(armorName.charAt(1));
                contributions.push(`Armor Magic Bonus (${magicBonus})`);
                armorName = armorName.substring(3);
            }
            let armor = allEquipment.find((item) => item.name === armorName);
            armorClass = armor.armor_class.base + addedBonus + magicBonus;
            contributions.push(`Armor (${armor.armor_class.base})`);

            if (armor.armor_class.dex_bonus) {
                let armorBonus = dexterity.bonus;
                contributions.push(`Dexterity Bonus (${dexterity.bonus})`);
                if (armor.armor_class.max_bonus) {
                    armorBonus = Math.min(armor.armor_class.max_bonus, armorBonus);
                }
                armorClass = armor.armor_class.base + armorBonus + addedBonus + magicBonus;
            }
        } else {
            // 2024: Default unarmored defense
            armorClass = 10 + dexterity.bonus + addedBonus;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus})`);
        }

        // Shield
        let shield = playerStats.inventory.equipped.find(item => item.substring(3) === 'Shield');
        if (shield) {
            const magicBonus = Number(shield.charAt(1));
            armorClass += 2 + magicBonus;
            contributions.push(`Shield (2) + Shield Magic Bonus (${magicBonus})`);
        } else if (playerStats.inventory.equipped.find(item => item === 'Shield')) {
            armorClass += 2;
            contributions.push(`Shield (2)`);
        }

        return [armorClass, contributions.join(' + ')];
    },
    getAttacks: (allEquipment, allSpells, playerStats) => {
        const strength = playerStats.abilities.find(a => a.name === 'Strength');
        const dexterity = playerStats.abilities.find(a => a.name === 'Dexterity');
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const attacks = [];

         // Ranged weapon (2024: no Archery fighting style)
        const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
        if (rangedWeapons.length > 0) {
            const rangedWeaponName = rangedWeapons[0];
            const { baseName } = parseMagicWeaponName(rangedWeaponName);
            const rangedWeapon = allEquipment.find(item => item.name === baseName);
            if (rangedWeapon) {
                attacks.push(buildWeaponAttack({
                      weapon: rangedWeapon,
                      weaponName: rangedWeaponName,
                      abilityBonus: dexterity.bonus,
                      abilityName: 'Dexterity',
                      proficiency,
                      actionType: 'Action',
                    }));
              }
          }

         // Melee weapons (2024: no fighting style bonuses)
        const meleeWeaponNames = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Melee');
        if (meleeWeaponNames.length > 0) {
            const bonus = Math.max(strength.bonus, dexterity.bonus);
            const abilityName = strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity';
            const mainHandName = meleeWeaponNames[0];
            const { baseName: mainBaseName } = parseMagicWeaponName(mainHandName);
            const mainHandWeapon = allEquipment.find(item => item.name === mainBaseName);
            if (mainHandWeapon) {
                attacks.push(buildWeaponAttack({
                      weapon: mainHandWeapon,
                      weaponName: mainHandName,
                      abilityBonus: bonus,
                      abilityName,
                      proficiency,
                      actionType: 'Action',
                    }));
              }

             // Off-hand (2024: no ability bonus on off-hand damage, no Two-Weapon Fighting style)
            if (meleeWeaponNames.length > 1) {
                const offHandName = meleeWeaponNames[1];
                const { baseName: offBaseName } = parseMagicWeaponName(offHandName);
                const offHandWeapon = allEquipment.find(item => item.name === offBaseName);
                if (offHandWeapon) {
                    attacks.push(buildWeaponAttack({
                          weapon: offHandWeapon,
                          weaponName: offHandName,
                          abilityBonus: bonus,
                          abilityName,
                          proficiency,
                          actionType: 'Bonus Action',
                          includeAbilityBonusInDamage: false,
                        }));
                  }
              }
          }

         // Monk unarmed strikes (2024: delegates to classRules)
        if (playerStats.class?.name === 'Monk') {
            const martialArtsDie = classRules.getMartialArtsDie(playerStats);
            if (martialArtsDie) {
                const diceStr = `1d${martialArtsDie}`;
                attacks.push(...buildMonkAttacks({ diceStr, dexterityBonus: dexterity.bonus, proficiency }));
              }
          }

         // Spell attacks
        if (playerStats.spellAbilities) {
            attacks.push(...buildSpellAttacks(playerStats.spellAbilities.spells, allSpells, playerStats.spellAbilities));
          }

        return attacks;
      },
    getHitPoints: (playerStats) => {
        // 2024 Rules: Simplified HP calculation
        const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
        // 2024: hit_point_die may be a string like 'D12' or '8', or may not exist (fallback to hit_die)
        const hitDieStr = playerStats.class.hit_point_die || playerStats.class.hit_die;
        let hitPointDie = parseInt(String(hitDieStr).replace(/[^0-9]/g, ''), 10);
        if (isNaN(hitPointDie)) {
            hitPointDie = 8; // Default fallback
        }
        let hitPoints = hitPointDie + ((hitPointDie / 2 + 1) * (playerStats.level - 1)) + (constitution.bonus * playerStats.level);

        // Check for racial hit point bonus (e.g., Hill Dwarf Dwarven Toughness)
        if (playerStats.race.subrace && playerStats.race.subrace.hit_point_bonus_per_level) {
            hitPoints += playerStats.race.subrace.hit_point_bonus_per_level * playerStats.level;
        }

        // Check for major hit point bonus (e.g., Draconic Sorcerer Draconic Resilience)
        if (playerStats.class.major && playerStats.class.major.hit_point_bonus_per_level) {
            hitPoints += playerStats.class.major.hit_point_bonus_per_level * playerStats.level;
        }

        return hitPoints;
    },
    getLanguages: (playerStats) => {
        // 2024 Rules: Read languages from class and race JSON data
        let languages = [...(playerStats.race?.languages || [])];
        let languagesAllowed = languages.length;

        // Background languages (2024: from background JSON, default to 2)
        languagesAllowed += 2;

        // Check for race language choices (e.g., Half-Elf, Human, High Elf)
        if (playerStats.race.language_choices) {
            languagesAllowed += playerStats.race.language_choices.choose || 0;
        }
        if (playerStats.race.subrace && playerStats.race.subrace.language_options) {
            languages = [...new Set([...languages, ...(playerStats.race.subrace.languages || [])])];
            languagesAllowed += playerStats.race.subrace.language_options.choose || 0;
        }

        // Add class languages from JSON (e.g., Druid adds Druidic, Rogue adds Thieves' Cant)
        languages = [...new Set([...languages, ...(playerStats.class?.languages || [])])];

        // Check for class language choices (e.g., Ranger Favored Enemies)
        if (playerStats.class?.language_choices) {
            let rangerLanguageBonus = playerStats.class.language_choices.choose || 0;
            languagesAllowed += rangerLanguageBonus;
            // Ranger gets additional languages at levels 6 and 14
            if (playerStats.class.name === 'Ranger') {
                if (playerStats.level > 5) languagesAllowed += 1;
                if (playerStats.level > 13) languagesAllowed += 1;
            }
        }

        // Check for major language bonuses (e.g., Cleric/Knowledge Blessings of Knowledge)
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
        // Check for magic items in inventory (2024 standard location)
        const inventoryMagicItems = playerSummary.inventory?.magicItems || [];

        if (!allMagicItems) {
            return [];
        }

        if (inventoryMagicItems.length === 0) {
            return [];
        }

        const processedItems = inventoryMagicItems.map(itemNameOrObj => {
            // Handle both string names and objects
            let itemName = typeof itemNameOrObj === 'string' ? itemNameOrObj : itemNameOrObj.name;

            const magicItem = allMagicItems.find(m => m.name === itemName);

            if (!magicItem) {
                return null;
            }

            // Handle special cases (Ring of Spell Storing, etc.)
            if (magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
                return { ...magicItem, details: magicItem.description, description: itemNameOrObj.spell };
            }

            // Merge any additional properties from the object
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
    getProficiencyChoiceCount: (playerStats, skills = true) => {
        // 2024 Rules: Different proficiency structure
        let proficiencyChoiceCount = 0;
        // 2024: Parse skill_proficiency_choices string (e.g. "Choose 2 from...")
        if (skills && playerStats.class.skill_proficiency_choices) {
            const match = playerStats.class.skill_proficiency_choices.match(/Choose\s+(\d+)/);
            if (match) {
                proficiencyChoiceCount = parseInt(match[1], 10);
            }
        }

        if (playerStats.race.starting_proficiency_options && ((skills && playerStats.race.starting_proficiency_options.from[0].startsWith('Skill: ')) || (!skills && !playerStats.race.starting_proficiency_options.from[0].startsWith('Skill: ')))) {
            proficiencyChoiceCount += playerStats.race.starting_proficiency_options.choose;
        }

        return proficiencyChoiceCount;
    },
    getProficiencies: (playerStats, skill = true) => {
        // 2024 Rules: Simplified proficiency calculation
        let proficienciesAllowed = 0;
        const raceStartingProfs = playerStats.race?.starting_proficiencies || [];
        let proficiencies = [...new Set([...(playerStats.class.proficiencies || []), ...raceStartingProfs])];

        if (skill) {
            proficiencies = proficiencies.filter((proficiency) => proficiency.startsWith('Skill'));
            proficiencies = proficiencies.map((proficiency) => {
                return proficiency.substring(7);
            });
            proficienciesAllowed = proficiencies.length + 2; // Background proficiencies

            // Check for major skill proficiency bonuses from JSON (e.g., Bard/Lore, Cleric/Knowledge, Cleric/Nature)
            if (playerStats.class.major && playerStats.class.major.bonus_skill_proficiencies) {
                proficienciesAllowed += playerStats.class.major.bonus_skill_proficiencies;
            }

            if (playerStats.skillProficiencies) {
                proficiencies = [...new Set([...proficiencies, ...playerStats.skillProficiencies])];
            }
        } else {
            proficiencies = proficiencies.filter((proficiency) => !proficiency.startsWith('Skill'));
            // Add major proficiencies from JSON (e.g., Bard/Valor, Cleric majors, Rogue/Assassin)
            if (playerStats.class.major && playerStats.class.major.bonus_proficiencies) {
                proficiencies = [...new Set([...proficiencies, ...playerStats.class.major.bonus_proficiencies])];
            }
            proficienciesAllowed = proficiencies.length + rules.getProficiencyChoiceCount(playerStats, false);

            if (playerStats.proficiencies) {
                proficiencies = [...new Set([...proficiencies, ...playerStats.proficiencies])];
            }
        }

        return [proficienciesAllowed, proficiencies.sort()];
    },
    getSpellAbilities: (allSpells, playerStats) => {
        // 2024 Rules: Simplified spellcasting
        let spellAbilities = null;
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        let spellcasting = classLevel?.spellcasting;

        if (!spellcasting) {
            spellcasting = classRules.getHighestMajorLevel(playerStats)?.spellcasting;
        }

        if (spellcasting) {
            // Check if spellcasting requires a specific major (subclass)
            const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
            if (spellcasting.required_major && spellcasting.required_major !== majorName) {
                spellcasting = null;
            }
            if (spellcasting) {
                spellAbilities = { ...spellcasting };
            }
        }

        if (spellAbilities) {
            if (playerStats.spells) {
                spellAbilities.spells = playerStats.spells.map(spell => { return { name: spell, prepared: '' } });
            } else {
                spellAbilities.spells = [];
            }

            // 2024: Spellcasting ability
            if (playerStats.class.spell_casting_ability) {
                spellAbilities.spellCastingAbility = playerStats.class.spell_casting_ability;
            }

            const spellAbility = playerStats.abilities.find(ability => ability.name === spellAbilities.spellCastingAbility);
            if (!spellAbility) {
                spellAbilities.modifier = 0;
                spellAbilities.toHit = playerStats.proficiency;
                spellAbilities.saveDc = 8 + playerStats.proficiency;
            } else {
                spellAbilities.modifier = spellAbility.bonus;
                spellAbilities.toHit = spellAbility.bonus + playerStats.proficiency;
                spellAbilities.saveDc = 8 + spellAbility.bonus + playerStats.proficiency;
            }

            // All spells prepared for full caster classes
            spellAbilities.spells.forEach((spell) => {
                spell.prepared = 'Always';
            });

            if (spellAbilities.spells.length > 0) {
                spellAbilities.spells = spellAbilities.spells.map(spell => {
                    let spellDetail = allSpells.find((spellDetail) => spellDetail.name === spell.name);
                    if (spellDetail) {
                        return { ...spellDetail, prepared: spellDetail.level === 0 ? 'Always' : spell.prepared };
                    }
                    return { ...spell };
                });

                spellAbilities.spells.sort((a, b) => {
                    if (a.level !== b.level) {
                        return a.level - b.level;
                    } else {
                        return a.name.localeCompare(b.name);
                    }
                });
            }
        }

        return spellAbilities;
    },
    getSpellMaxLevel: (spellAbilities) => {
        let spellMaxLevel = null;
        if (spellAbilities) {
            if (spellAbilities.spell_slots_level_1 != null && spellAbilities.spell_slots_level_1 > 0) spellMaxLevel = 1;
            if (spellAbilities.spell_slots_level_2 != null && spellAbilities.spell_slots_level_2 > 0) spellMaxLevel = 2;
            if (spellAbilities.spell_slots_level_3 != null && spellAbilities.spell_slots_level_3 > 0) spellMaxLevel = 3;
            if (spellAbilities.spell_slots_level_4 != null && spellAbilities.spell_slots_level_4 > 0) spellMaxLevel = 4;
            if (spellAbilities.spell_slots_level_5 != null && spellAbilities.spell_slots_level_5 > 0) spellMaxLevel = 5;
            if (spellAbilities.spell_slots_level_6 != null && spellAbilities.spell_slots_level_6 > 0) spellMaxLevel = 6;
            if (spellAbilities.spell_slots_level_7 != null && spellAbilities.spell_slots_level_7 > 0) spellMaxLevel = 7;
            if (spellAbilities.spell_slots_level_8 != null && spellAbilities.spell_slots_level_8 > 0) spellMaxLevel = 8;
            if (spellAbilities.spell_slots_level_9 != null && spellAbilities.spell_slots_level_9 > 0) spellMaxLevel = 9;
        }
        return spellMaxLevel;
    },
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
            const playerStats = cloneDeep(playerSummary);
            playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);

             // Initialize senses array early to prevent undefined errors
            playerStats.senses = [];

             // Store equipment reference for mastery lookup
            playerStats.equipment = allEquipment;

            playerStats.class = classRules.getClass(allClasses, playerSummary);
            playerStats.race = raceRules.getRace(allRaces, playerSummary);
            const resultMagicItems = rules.getMagicItems(allMagicItems, playerSummary);
            playerStats.inventory.magicItems = resultMagicItems;

        // Dependency on class and race begin here 
        [playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = rules.getActions(playerStats);
        [playerStats.languagesAllowed, playerStats.languages] = rules.getLanguages(playerStats);
        [playerStats.proficienciesAllowed, playerStats.proficiencies] = rules.getProficiencies(playerStats, false);
        [playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = rules.getProficiencies(playerStats, true);

        // Dependency on abilities begin here
        playerStats.abilities = await rules.getAbilities(playerStats);
        playerStats.hitPoints = rules.getHitPoints(playerStats);
        playerStats.initiative = playerStats.abilities.find((ability) => ability.name === 'Dexterity').bonus;
        [playerStats.armorClass, playerStats.armorClassFormula] = rules.getArmorClass(allEquipment, playerStats);
        playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats);
        playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats);

        // Merge race senses with ability-based senses
        playerStats.senses = raceRules.getSenses(playerStats);

        return playerStats;
    }
};

export default rules;