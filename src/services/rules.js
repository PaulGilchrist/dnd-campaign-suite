import { cloneDeep, uniqBy } from 'lodash';
import classRules from './class-rules'
import raceRules from './race-rules'
import utils from './utils.js';
import { loadSkills, loadPassiveSkills } from './data-loader';
import { parseMagicItemName, findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, buildSpellAttacks } from './attack-calc.js';
import * as proficiencyUtils from './proficiency-utils.js';

const rules = {
    getAbilityLongName: utils.getAbilityLongName,
                getAbilities: async (playerStats) => {
      // Dependencies: Class, Race, Skill Proficiencies 
      // Sets Abilities, Initiative, and Hit Points
        const skills = await loadSkills();
     const passiveSkills = await loadPassiveSkills();
    return playerStats.abilities.map((ability) => {
		const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
		const newAbility = { ...ability };
		newAbility.totalScore = ability.baseScore + ability.abilityImprovements + ability.miscBonus + raceRules.getRacialBonus(playerStats, ability.name);
		if((newAbility.name === 'Strength' || newAbility.name === 'Constitution') && playerStats.class.name === 'Barbarian' && playerStats.level > 19) {
			newAbility.totalScore += 4; // Primal Champion
		 }
		newAbility.bonus = Math.floor((newAbility.totalScore - 10) / 2);
		newAbility.proficient = playerStats.class.saving_throws.includes(newAbility.name);
		newAbility.save = newAbility.proficient ? newAbility.bonus + proficiency : newAbility.bonus;
		newAbility.skills = skills.filter(skill => skill.ability === newAbility.name);
		newAbility.skills = newAbility.skills.map((skill) => {
			const proficient = playerStats.skillProficiencies.includes(skill.name);
			const newSkill = { ...skill };
			newSkill.bonus = proficient ? newAbility.bonus + proficiency : newAbility.bonus;
			if (playerStats.expertise && playerStats.expertise.includes(skill.name)) {
				newSkill.bonus += proficiency; // Rogues can double their proficiency for two selected areas of expertise
			 }
			return newSkill;
		   });
		return newAbility;
	   });
	},
    getActions: (playerStats) => {
        // Dependencies: Class, Race
        const features = classRules.getFeatures(playerStats);
        const traits = raceRules.getTraits(playerStats);
        const actions = uniqBy([...playerStats.actions ? playerStats.actions : [], ...features.actions, ...traits.actions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const bonusActions = uniqBy([...playerStats.bonusActions ? playerStats.bonusActions : [], ...features.bonusActions, ...traits.bonusActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const reactions = uniqBy([...playerStats.reactions ? playerStats.reactions : [], ...features.reactions, ...traits.reactions], 'name').sort((a, b) => a.name.localeCompare(b.name));
              const specialActions = uniqBy([...playerStats.specialActions ? playerStats.specialActions : [], ...features.specialActions, ...traits.specialActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
              const characterAdvancement = uniqBy([...features.characterAdvancement, ...traits.characterAdvancement], 'name').sort((a, b) => a.name.localeCompare(b.name));
                      return [actions, bonusActions, reactions, specialActions, characterAdvancement];
           },
    getArmorClass: (allEquipment, playerStats) => {
        // Dependencies: Abilities
        const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
        const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        const wisdom = playerStats.abilities.find((ability) => ability.name === 'Wisdom');
        // Find armor in the character's equipment and calculate Armor Class
         let armorName = playerStats.inventory.equipped.find(itemName => {
              let item = allEquipment.find((item) => item.name === parseMagicItemName(itemName).baseName);
             if(item) {
                 return item.equipment_category === 'Armor';
              }
             return false;
          });
        let addedBonus = 0;
        let contributions = [];
        if(playerStats.class.name === 'Monk') {
            addedBonus += wisdom.bonus;
            contributions.push(`Monk Wisdom Bonus (${wisdom.bonus})`);
        } 
        if(playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Defense')) {
            addedBonus += 1;
            contributions.push(`Fighting Style Defense (1)`);
        }
        let armorClass;
        if(armorName) {
            let parsedArmor = parseMagicItemName(armorName);
            contributions.push(`Armor Magic Bonus (${parsedArmor.magicBonus})`);
            let armor = allEquipment.find((item) => item.name === parsedArmor.baseName);
            armorClass = armor.armor_class.base + addedBonus + parsedArmor.magicBonus;
            contributions.push(`Armor (${armor.armor_class.base})`);
            if(armor.armor_class.dex_bonus) {
                let armorBonus = dexterity.bonus;
                contributions.push(`Dexterity Bonus (${dexterity.bonus})`);
                if(armor.armor_class.max_bonus) {
                    armorBonus = Math.min(armor.armor_class.max_bonus, armorBonus);
                 }
                armorClass = armor.armor_class.base + armorBonus + addedBonus + parsedArmor.magicBonus;
            }
        } else {
            armorClass = 10 + dexterity.bonus + addedBonus// Unarmored
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus})`);
        }
        // Check for an equipped magical shield, and if found increase AC
        let shield = playerStats.inventory.equipped.find(item => parseMagicItemName(item).baseName === 'Shield');
        if(shield) {
            const parsedShield = parseMagicItemName(shield);
            armorClass += 2 + parsedShield.magicBonus;
            contributions.push(`Shield (2) + Shield Magic Bonus (${parsedShield.magicBonus})`);
        } else if(playerStats.inventory.equipped.find(item => item === 'Shield')) {
            // Non-magical shield
            armorClass += 2;
            contributions.push(`Shield (2)`);
        }
        // Check for cloak or ring of protection
        if(playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Cloak of Protection')) {
            armorClass += 1;
            contributions.push(`Cloak of Protection (1)`);
        }
        if(playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Ring of Protection')) {
            armorClass += 1;
            contributions.push(`Ring of Protection (1)`);
        }        
        if(playerStats.class.name === 'Barbarian') { // Unarmored Defense
            const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
            if(barbarianAc > armorClass) {
                armorClass = barbarianAc;
                contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`];
            }
        } else if(playerStats.class.subclass && playerStats.class.subclass.name === 'Draconic') { // Dragon Resilience
            const sorcererAc = 13 + dexterity.bonus;
            if(sorcererAc > armorClass) {
                armorClass = sorcererAc;
                contributions = [`Unarmored AC (13) + Dexterity Bonus (${dexterity.bonus})`];
            }
        }
        return [armorClass, contributions.join(' + ')];
    },
    getAttacks: (allEquipment, allSpells, playerStats) => {
        const strength = playerStats.abilities.find(a => a.name === 'Strength');
        const dexterity = playerStats.abilities.find(a => a.name === 'Dexterity');
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const attacks = [];
        const fightingStyles = playerStats.class?.fightingStyles || [];

        // Ranged weapon
        const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
        if (rangedWeapons.length > 0) {
            const rangedWeaponName = rangedWeapons[0];
            const { baseName } = parseMagicItemName(rangedWeaponName);
            const rangedWeapon = allEquipment.find(item => item.name === baseName);
            if (rangedWeapon) {
                const archeryBonus = fightingStyles.includes('Archery') ? 2 : 0;
                attacks.push(buildWeaponAttack({
                    weapon: rangedWeapon,
                    weaponName: rangedWeaponName,
                    abilityBonus: dexterity.bonus,
                    abilityName: 'Dexterity',
                    proficiency,
                    actionType: 'Action',
                    extraHitBonus: archeryBonus,
                    extraHitBonusLabel: archeryBonus ? 'Archery Fighting Style (2)' : '',
                 }));
             }
         }

        // Melee weapons
        const meleeWeaponNames = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Melee');
        if (meleeWeaponNames.length > 0) {
            const bonus = Math.max(strength.bonus, dexterity.bonus);
            const abilityName = strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity';
            const mainHandName = meleeWeaponNames[0];
            const { baseName: mainBaseName } = parseMagicItemName(mainHandName);
            const mainHandWeapon = allEquipment.find(item => item.name === mainBaseName);
            if (mainHandWeapon) {
                const isDueling = fightingStyles.includes('Dueling') && meleeWeaponNames.length === 1;
                attacks.push(buildWeaponAttack({
                    weapon: mainHandWeapon,
                    weaponName: mainHandName,
                    abilityBonus: bonus,
                    abilityName,
                    proficiency,
                    actionType: 'Action',
                    extraDamage: isDueling ? '+2' : '',
                    extraDamageLabel: isDueling ? 'Dueling Fighting Style (2)' : '',
                 }));
             }

            // Off-hand weapon
            if (meleeWeaponNames.length > 1) {
                const offHandName = meleeWeaponNames[1];
                const { baseName: offBaseName } = parseMagicItemName(offHandName);
                const offHandWeapon = allEquipment.find(item => item.name === offBaseName);
                if (offHandWeapon) {
                    const isTwoWeapon = fightingStyles.includes('Two-Weapon Fighting');
                    attacks.push(buildWeaponAttack({
                        weapon: offHandWeapon,
                        weaponName: offHandName,
                        abilityBonus: bonus,
                        abilityName,
                        proficiency,
                        actionType: 'Bonus Action',
                        includeAbilityBonusInDamage: false,
                        extraDamage: isTwoWeapon ? `+${bonus}` : '',
                        extraDamageLabel: isTwoWeapon ? `Two-Weapon Fighting Style (${bonus})` : '',
                     }));
                 }
             }
         }

        // Monk unarmed strikes
        if (playerStats.class?.name === 'Monk') {
            const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
            const martialArts = classLevel?.class_specific?.martial_arts;
            if (martialArts) {
                const diceStr = `${martialArts.dice_count}d${martialArts.dice_value}`;
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
              // Dependencies: Abilities, Class
            const constitution = playerStats.abilities?.find((ability) => ability.name === 'Constitution');
            const conBonus = constitution?.bonus || 0;
            let hitPoints = playerStats.class.hit_die + ((playerStats.class.hit_die / 2 + 1) * (playerStats.level - 1)) + (conBonus * playerStats.level);
        
             // Check for racial hit point bonus (e.g., Hill Dwarf Dwarven Toughness)
            if(playerStats.race?.subrace?.hit_point_bonus_per_level) {
                hitPoints += playerStats.race.subrace.hit_point_bonus_per_level * playerStats.level;
             }
        
             // Check for subclass hit point bonus (e.g., Draconic Sorcerer Draconic Resilience)
            if(playerStats.class.subclass?.hit_point_bonus_per_level) {
                hitPoints += playerStats.class.subclass.hit_point_bonus_per_level * playerStats.level;
             }
            return hitPoints
         },
    getLanguages: (playerStats) => {
                // Dependencies: Class, Race
              let languages = [...(playerStats.race.languages || [])];
              let languagesAllowed = languages.length;
              // dndbeyond allows up to 2 languages from the character's backstory (See Acolyte or Sage)
            languagesAllowed += 2;

             // Check for race language choices (e.g., Half-Elf, Human, High Elf)
            if(playerStats.race.language_choices) {
                languagesAllowed += playerStats.race.language_choices.choose || 0;
              }
            if(playerStats.race.subrace && playerStats.race.subrace.language_options) {
                languages = [...new Set([...languages, ...(playerStats.race.subrace.languages || [])])];
                languagesAllowed += playerStats.race.subrace.language_options.choose || 0;
              }

             // Add class languages from JSON (e.g., Druid adds Druidic, Rogue adds Thieves' Cant)
            languages = [...new Set([...languages, ...(playerStats.class.languages || [])])];

             // Check for class language choices (e.g., Ranger Favored Enemies)
            if(playerStats.class.language_choices) {
                let rangerLanguageBonus = playerStats.class.language_choices.choose || 0;
                languagesAllowed += rangerLanguageBonus;
                // Ranger gets additional languages at levels 6 and 14
                if(playerStats.class.name === 'Ranger') {
                    if(playerStats.level > 5) languagesAllowed += 1;
                    if(playerStats.level > 13) languagesAllowed += 1;
                 }
              }

             // Check for subclass language bonuses (e.g., Cleric/Knowledge Blessings of Knowledge)
            if(playerStats.class.subclass) {
                if(playerStats.class.subclass.language_choices) {
                    languagesAllowed += playerStats.class.subclass.language_choices.choose || 0;
                 }
              }

            if(playerStats.languages) {
                languages = [...new Set([...languages, ...playerStats.languages])];
              }
            return [languagesAllowed, languages.sort()];
          },
    getMagicItems: (allMagicItems, playerSummary) => {
        if(playerSummary.inventory.magicItems) {
            const playerMagicItems = playerSummary.inventory.magicItems.map(playerMagicItem => {
                const magicItem = allMagicItems.find(magicItem => magicItem.name === playerMagicItem.name);
                if(magicItem) {
                    if(magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
                        return {...magicItem, details: magicItem.description, description: playerMagicItem.spell}
                    }
                    return {...magicItem, quantity: playerMagicItem.quantity, rarity: playerMagicItem.rarity ? playerMagicItem.rarity : magicItem.rarity };
                }
                return{...playerMagicItem};
            });
            return playerMagicItems;
        }
        return null;
    },
        getProficiencyChoiceCount: (playerStats, skills = true) => {
         // Dependencies: Class, Race
        let proficiencyChoiceCount = 0;
        (playerStats.class.proficiency_choices || []).forEach((proficiency) => {
            if((skills && proficiency.from[0].startsWith('Skill: ') || (!skills && !proficiency.from[0].startsWith('Skill: ')))) {
                proficiencyChoiceCount += proficiency.choose;
             }
         })
        if(playerStats.race.starting_proficiency_options && ((skills && playerStats.race.starting_proficiency_options.from[0].startsWith('Skill: ')) || (!skills && !playerStats.race.starting_proficiency_options.from[0].startsWith('Skill: ')))) {
            proficiencyChoiceCount += playerStats.race.starting_proficiency_options.choose;
        }
        if(playerStats.race.subrace && playerStats.race.subrace.racial_traits) {
                    playerStats.race.subrace.racial_traits.forEach(racial_trait => {
                        if (racial_trait.proficiency_choices && ((skills && racial_trait.proficiency_choices.from[0].startsWith('Skill: ')) || (!skills && !racial_trait.proficiency_choices.from[0].startsWith('Skill: ')))) {
                            proficiencyChoiceCount += racial_trait.proficiency_choices.choose;
                          }
                      });
                  }
        return proficiencyChoiceCount
    },
    getProficiencies: (playerStats, skill = true) => {
         return proficiencyUtils.getProficiencies(
           playerStats,
           skill,
           rules.getProficiencyChoiceCount,
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
                getSpellAbilities: (allSpells, playerStats) => {
            // Dependencies: Abilities, Class 
        let spellAbilities = null;
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        let spellcasting = classLevel?.spellcasting;
        if(!spellcasting) {
            spellcasting = classRules.getHighestSubclassLevel(playerStats)?.spellcasting;
          }
        if(spellcasting) {
             // Check if spellcasting requires a specific major/subclass
            if (spellcasting.required_major && spellcasting.required_major !== playerStats.class.major?.name && spellcasting.required_major !== playerStats.class.subclass?.name) {
                spellcasting = null;
              }
            if(spellcasting) {
                spellAbilities = {...spellcasting};
              }
         }
        if (spellAbilities) {
            if (playerStats.spells) {
                spellAbilities.spells = playerStats.spells.map(spell => {return { name: spell, prepared: ''};})
                if(playerStats.class.subclass && playerStats.class.subclass.name === 'Arcane Trickster') { // Mage Hand Legerdemain
                    spellAbilities.spells = [...new Set([...spellAbilities.spells, ...['Mage Hand']])];
                    spellAbilities.cantrips_known += 3;                    
                } else if(playerStats.class.subclass && playerStats.class.subclass.name === 'Light') { // Bonus Cantrip
                    spellAbilities.spells = [...new Set([...spellAbilities.spells, ...['Light']])];
                    spellAbilities.cantrips_known += 1;
                } else if(playerStats.class.subclass && playerStats.class.subclass.name === 'Nature') { // Acolyte of Nature
                    spellAbilities.cantrips_known += 1;
                }
            } else {
                spellAbilities.spells = [];
            }
        }
        if (playerStats.race.name === 'Tiefling') {
            if (!spellAbilities) {
                spellAbilities = {
                    cantrips_known: 0,
                    spellCastingAbility: 'Charisma',
                    spells: [],
                    spells_known: 0
                }
            }
            // Tieflings get the "Thaumaturgy" cantrip
            const thaumaturgy = spellAbilities.spells.find(spell => spell.name === 'Thaumaturgy');
            if (thaumaturgy) {
                thaumaturgy.prepared = 'Always';
            } else {
                spellAbilities.spells.push({
                    name: 'Thaumaturgy',
                    prepared: 'Always'
                });
            }
            spellAbilities.cantrips_known += 1;
            // Tieflings get the hellish rebuke spell at level 3
            if (playerStats.level > 2) {
                const hellishRebuke = spellAbilities.spells.find(spell => spell.name === 'Hellish Rebuke');
                if (hellishRebuke) {
                    hellishRebuke.prepared = 'Always';
                } else {
                    spellAbilities.spells.push({
                        name: 'Hellish Rebuke',
                        prepared: 'Always'
                    });
                }
                spellAbilities.spells_known += 1;
            }
        } else if (playerStats.race.subrace && playerStats.race.subrace.name === 'High Elf') {
            // High Elf gets one cantrip from the wizard spell list
            if (!spellAbilities) {
                spellAbilities = {
                    cantrips_known: 0,
                    spellCastingAbility: 'Intelligence',
                    spells: [],
                    spells_known: 0
                }
            }
            spellAbilities.cantrips_known += 1;
        } else if (playerStats.race.subrace && playerStats.race.subrace.name === 'Forest Gnome') {
            if (!spellAbilities) {
                spellAbilities = {
                    cantrips_known: 0,
                    spellCastingAbility: 'Intelligence',
                    spells: [],
                    spells_known: 0
                }
            }
            // Forest Gnome get the "Minor Illusion" cantrip
            const minorIllusion = spellAbilities.spells.find(spell => spell.name === 'Minor Illusion');
            if (minorIllusion) {
                minorIllusion.prepared = 'Always';
            } else {
                spellAbilities.spells.push({
                    name: 'Minor Illusion',
                    prepared: 'Always'
                });
            }
            spellAbilities.cantrips_known += 1;
        }
        if (spellAbilities) {
            if (playerStats.class.spell_casting_ability) {
                spellAbilities.spellCastingAbility = playerStats.class.spell_casting_ability;
            }
            const spellAbility = playerStats.abilities.find(ability => ability.name === spellAbilities.spellCastingAbility);
            spellAbilities.modifier = spellAbility.bonus;
            spellAbilities.toHit = spellAbility.bonus + playerStats.proficiency;
            spellAbilities.saveDc = 8 + spellAbility.bonus + playerStats.proficiency;
            // subclass specific adjustments
            if(playerStats.class.subclass) {
                switch (playerStats.class.subclass.name) {
                    case 'Arcane Trickster':
                        spellAbilities.schoolLimits = ['enchantment', 'illusion'];
                        break;
                    case 'Eldritch Knight':
                        spellAbilities.schoolLimits = ['abjuration', 'evocation'];
                        break;
                    case 'Land':
                        spellAbilities.cantrips_known += 1; // Bonus Cantrip
                        break;
                }
            }
            if(playerStats.class.name === 'Druid' || playerStats.class.name === 'Paladin') {
                spellAbilities.spells_known = null; // All spells known
                let spellMaxLevel = rules.getSpellMaxLevel(spellAbilities);
                allSpells.forEach(spell => {
                    if(spell.level != 0 && spell.level <= spellMaxLevel && spell.classes.includes(playerStats.class.name) && !spellAbilities.spells.find((s) => s.name === spell.name)) {
                        spellAbilities.spells.push({
                            name: spell.name,
                            prepared: ''
                        });
                    }
                });
            }
            // Add any subclass spells to known spells and set them to always prepared
            if (playerStats.level > 2 && playerStats.class.subclass && playerStats.class.subclass.spells) {
                playerStats.class.subclass.spells.forEach((subclassSpell) => {                    
                    const knownSpell = spellAbilities.spells.find((knownSpell) => knownSpell.name === subclassSpell.spell.name);
                    if (knownSpell) {
                        knownSpell.prepared = 'Always';
                    } else {
                        const meetsLevel = (playerStats.level >= subclassSpell.prerequisites[0].index.split('-')[1]);
                        const meetsCircle = (playerStats.class.subclass.name != 'Land' || subclassSpell.prerequisites[1].name.endsWith(playerStats.class.subclass.circle));
                        if (meetsLevel && meetsCircle) {
                            if(spellAbilities.spells_known) spellAbilities.spells_known += 1;
                            spellAbilities.spells.push({
                                name: subclassSpell.spell.name,
                                prepared: 'Always'
                            });
                        }
                    }
                });
            }
            switch (playerStats.class.name) {
                case 'Cleric':
                case 'Druid':
                case 'Wizard':
                    spellAbilities.maxPreparedSpells = spellAbility.bonus + playerStats.level;
                    break;
                case 'Paladin':
                    spellAbilities.maxPreparedSpells = spellAbility.bonus + Math.floor(playerStats.level / 2);
                    break;
                default:
                    // Classes with all spells prepared = Bard, Eldritch Knight Fighter, Ranger, Arcane Trickster Rogue, Sorcerer, Warlock
                    spellAbilities.spells.forEach((spell) => {
                        spell.prepared = 'Always';
                    });
            }
            if (spellAbilities.spells.length > 0) {
                spellAbilities.spells = spellAbilities.spells.map(spell => {
                    let spellDetail = allSpells.find((spellDetail) => spellDetail.name === spell.name);
                    if (spellDetail) {
                        return { ...spellDetail, prepared: spellDetail.level === 0 ? 'Always' : spell.prepared };
                    }
                    return { ...spell };
                });
                // Sort by level (ascending) and then by name
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
        // playerStats must include full class and race objects from getClass() and getRace() 
        let spellMaxLevel = null;
        if(spellAbilities) {
            if(spellAbilities.spell_slots_level_1 != null && spellAbilities.spell_slots_level_1 > 0) spellMaxLevel = 1;
            if(spellAbilities.spell_slots_level_2 != null && spellAbilities.spell_slots_level_2 > 0) spellMaxLevel = 2;
            if(spellAbilities.spell_slots_level_3 != null && spellAbilities.spell_slots_level_3 > 0) spellMaxLevel = 3;
            if(spellAbilities.spell_slots_level_4 != null && spellAbilities.spell_slots_level_4 > 0) spellMaxLevel = 4;
            if(spellAbilities.spell_slots_level_5 != null && spellAbilities.spell_slots_level_5 > 0) spellMaxLevel = 5;
            if(spellAbilities.spell_slots_level_6 != null && spellAbilities.spell_slots_level_6 > 0) spellMaxLevel = 6;
            if(spellAbilities.spell_slots_level_7 != null && spellAbilities.spell_slots_level_7 > 0) spellMaxLevel = 7;
            if(spellAbilities.spell_slots_level_8 != null && spellAbilities.spell_slots_level_8 > 0) spellMaxLevel = 8;
            if(spellAbilities.spell_slots_level_9 != null && spellAbilities.spell_slots_level_9 > 0) spellMaxLevel = 9;
        }
        return spellMaxLevel;
    },
        getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
	const playerStats = cloneDeep(playerSummary);
	playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);
	playerStats.class = classRules.getClass(allClasses, playerSummary);
	playerStats.immunities = raceRules.getImmunities(playerSummary);
	playerStats.inventory.magicItems = rules.getMagicItems(allMagicItems, playerSummary);
	playerStats.race = raceRules.getRace(allRaces, playerSummary);
	playerStats.resistances = raceRules.getResistances(playerSummary);
	 // Dependency on class and race begin here 
	[playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = rules.getActions(playerStats); // Dependencies: Class, Race
	[playerStats.languagesAllowed, playerStats.languages] = rules.getLanguages(playerStats); // Dependencies: Class, Race
	[playerStats.proficienciesAllowed, playerStats.proficiencies] = rules.getProficiencies(playerStats, false); // Dependencies: Class, Race
	[playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = rules.getProficiencies(playerStats, true); // Dependencies: Class, Race
	playerStats.senses = raceRules.getSenses(playerStats); // Dependencies: Race
	 // Dependency on abilities begin here
	playerStats.abilities = await rules.getAbilities(playerStats); // Dependencies: Class, Race, Skill Proficiencies 
	playerStats.hitPoints = rules.getHitPoints(playerStats) // Dependencies: Abilities, Class
	playerStats.initiative = playerStats.abilities.find((ability) => ability.name === 'Dexterity').bonus; // Dependencies: Abilities
	[playerStats.armorClass, playerStats.armorClassFormula] = rules.getArmorClass(allEquipment, playerStats); // Dependencies: Abilities
	playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats); // Dependencies: Abilities, Class
	playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats); // Dependencies: Abilities, Spells 
	return playerStats;
	}
}

export default rules

