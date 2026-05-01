import { cloneDeep, uniqBy } from 'lodash';
import classRules from './class-rules-2024.js';
import raceRules from './race-rules-2024.js';
import utils from './utils.js';

// Load passive skills from public/data/passive-skills.json
const loadPassiveSkills = async () => {
    try {
        const response = await fetch('/data/passive-skills.json');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error loading passive skills:', error);
    }
    // Fallback
    return ['Insight', 'Investigation', 'Perception'];
};

let cachedPassiveSkills = null;

const getPassiveSkills = async () => {
    if (cachedPassiveSkills) {
        return cachedPassiveSkills;
    }
    cachedPassiveSkills = await loadPassiveSkills();
    return cachedPassiveSkills;
};

// Load skills from public/data/ability-scores.json
const loadSkills = async () => {
    try {
        const response = await fetch('/data/ability-scores.json');
        if (response.ok) {
            const abilities = await response.json();
            const skills = [];
            abilities.forEach(ability => {
                ability.skills.forEach(skillName => {
                    skills.push({ name: skillName, ability: ability.full_name });
                });
            });
            return skills;
        }
    } catch (error) {
        console.error('Error loading skills:', error);
    }
    // Fallback
    return [
        { name: 'Acrobatics', ability: 'Dexterity' },
        { name: 'Animal Handling', ability: 'Wisdom' },
        { name: 'Arcana', ability: 'Intelligence' },
        { name: 'Athletics', ability: 'Strength' },
        { name: 'Deception', ability: 'Charisma' },
        { name: 'History', ability: 'Intelligence' },
        { name: 'Insight', ability: 'Wisdom' },
        { name: 'Intimidation', ability: 'Charisma' },
        { name: 'Investigation', ability: 'Intelligence' },
        { name: 'Medicine', ability: 'Wisdom' },
        { name: 'Nature', ability: 'Intelligence' },
        { name: 'Perception', ability: 'Wisdom' },
        { name: 'Performance', ability: 'Charisma' },
        { name: 'Persuasion', ability: 'Charisma' },
        { name: 'Religion', ability: 'Intelligence' },
        { name: 'Sleight of Hand', ability: 'Dexterity' },
        { name: 'Stealth', ability: 'Dexterity' },
        { name: 'Survival', ability: 'Wisdom' }
    ];
};

let cachedSkills = null;

const getSkills = async () => {
    if (cachedSkills) {
        return cachedSkills;
    }
    cachedSkills = await loadSkills();
    return cachedSkills;
};

const rules = {
    getAbilityLongName: utils.getAbilityLongName,
    getAbilities: async (playerStats) => {
        // 2024 Rules: Simpler ability calculation, no racial bonuses
        const skills = await getSkills();
        const passiveSkills = await getPassiveSkills();
        return playerStats.abilities.map((ability) => {
            const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
            ability.totalScore = ability.baseScore + ability.abilityImprovements + ability.miscBonus;
            // No racial bonuses in 2024
            ability.bonus = Math.floor((ability.totalScore - 10) / 2);
            ability.proficient = playerStats.class.saving_throw_proficiencies ? playerStats.class.saving_throw_proficiencies.includes(ability.name) : false;
            ability.save = ability.proficient ? ability.bonus + proficiency : ability.bonus;
            ability.skills = skills.filter(skill => skill.ability === ability.name);
            ability.skills = ability.skills.map((skill) => {
                const proficient = playerStats.skillProficiencies.includes(skill.name);
                skill.bonus = proficient ? ability.bonus + proficiency : ability.bonus;
                if (playerStats.expertise && playerStats.expertise.includes(skill.name)) {
                    skill.bonus += proficiency;
                }
                if (passiveSkills.includes(skill.name)) {
                    const newSense = {
                        name: `Passive ${skill.name}`,
                        value: 10 + skill.bonus
                    }
                    if (playerStats.senses && !playerStats.senses.some((sense) => sense.name === newSense.name)) {
                        playerStats.senses.push(newSense);
                    }
                }
                return skill;
            });
            return ability;
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
        // 2024 Rules: Simplified attack calculation
        const strength = playerStats.abilities.find((ability) => ability.name === 'Strength');
        const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
        const attacks = [];

        // Ranged weapons
        let rangedWeaponName = playerStats.inventory.equipped.find(itemName => {
            if (!itemName || typeof itemName !== 'string') {
                return false;
            }
            if (itemName.charAt(0) === '+') {
                itemName = itemName.substring(3);
            }
            let item = allEquipment.find((item) => item.name === itemName);
            if (item) {
                return item.equipment_category === 'Weapon' && item.weapon_range === 'Ranged';
            }
            return false;
        });

        if (rangedWeaponName) {
            let nonMagicalName = rangedWeaponName;
            if (rangedWeaponName.charAt(0) === '+') {
                nonMagicalName = rangedWeaponName.substring(3);
            }
            let rangedWeapon = allEquipment.find((item) => item.name === nonMagicalName);
            if (rangedWeapon) {
                let damage = rangedWeapon.damage.damage_dice;
                let damageFormula = `Damage Formula = Weapon (${rangedWeapon.damage.damage_dice})`;
                let toHitBonus = dexterity.bonus + proficiency;
                let hitBonusFormula = `To Hit Bonus Formula = Dexterity Bonus (${dexterity.bonus}) + Proficiency (${proficiency})`;

                if (rangedWeaponName.charAt(0) === '+') {
                    let magicBonus = Number(rangedWeaponName.charAt(1));
                    damage += `+${dexterity.bonus + magicBonus}`;
                    damageFormula += ` + Dexterity Bonus (${dexterity.bonus}) + Weapon Magic Bonus (${magicBonus})`;
                    toHitBonus += magicBonus;
                    hitBonusFormula += ` + Weapon Magic Bonus (${magicBonus})`;
                } else {
                    damage += `+${dexterity.bonus}`;
                    damageFormula += ` + Dexterity Bonus (${dexterity.bonus})`;
                }

                attacks.push({
                    "name": rangedWeaponName,
                    "damage": damage,
                    "damageType": rangedWeapon.damage.damage_type,
                    "damageFormula": damageFormula,
                    "hitBonus": toHitBonus,
                    "hitBonusFormula": hitBonusFormula,
                    "range": rangedWeapon.range.normal,
                    "type": "Action"
                });
            }
        }

        // Melee weapons
        let meleeWeaponNames = playerStats.inventory.equipped.filter(itemName => {
            if (!itemName || typeof itemName !== 'string') {
                return false;
            }
            if (itemName.charAt(0) === '+') {
                itemName = itemName.substring(3);
            }
            let item = allEquipment.find((item) => item.name === itemName);
            if (item) {
                return item.equipment_category === 'Weapon' && item.weapon_range === 'Melee';
            }
            return false;
        });

        if (meleeWeaponNames && meleeWeaponNames.length > 0) {
            let bonus = Math.max(strength.bonus, dexterity.bonus);
            let nonMagicalName = meleeWeaponNames[0];
            if (meleeWeaponNames[0].charAt(0) === '+') {
                nonMagicalName = meleeWeaponNames[0].substring(3);
            }
            let mainHandWeapon = allEquipment.find((item) => item.name === nonMagicalName);
            if (mainHandWeapon) {
                let damage = mainHandWeapon.damage.damage_dice;
                let damageFormula = `Damage Formula = Weapon (${mainHandWeapon.damage.damage_dice})`;
                let toHitBonus = bonus + proficiency;
                let hitBonusFormula = `To Hit Bonus Formula = ${strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity'} Bonus (${bonus}) + Proficiency (${proficiency})`;

                let magicBonus = 0;
                if (meleeWeaponNames[0].charAt(0) === '+') {
                    magicBonus = Number(meleeWeaponNames[0].charAt(1));
                    damage += `+${bonus + magicBonus}`;
                    damageFormula += ` + ${strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity'} Bonus (${bonus}) + Weapon Magic Bonus (${magicBonus})`;
                    toHitBonus += magicBonus;
                    hitBonusFormula += ` + Weapon Magic Bonus (${magicBonus})`;
                } else {
                    damage += `+${bonus}`;
                    damageFormula += ` + ${strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity'} Bonus (${bonus})`;
                }

                attacks.push({
                    "name": meleeWeaponNames[0],
                    "damage": damage,
                    "damageType": mainHandWeapon.damage.damage_type,
                    "damageFormula": damageFormula,
                    "hitBonus": toHitBonus,
                    "hitBonusFormula": hitBonusFormula,
                    "range": mainHandWeapon.range.normal,
                    "type": "Action"
                });
            }

            // Off-hand weapon (2024: Two-Weapon Fighting)
            if (meleeWeaponNames.length > 1) {
                let bonus = Math.max(strength.bonus, dexterity.bonus);
                let nonMagicalName = meleeWeaponNames[1];
                if (meleeWeaponNames[1].charAt(0) === '+') {
                    nonMagicalName = meleeWeaponNames[1].substring(3);
                }
                let offHandWeapon = allEquipment.find((item) => item.name === nonMagicalName);
                let damage = offHandWeapon.damage.damage_dice;
                let damageFormula = `Damage Formula = Weapon (${offHandWeapon.damage.damage_dice})`;
                let hitBonus = bonus + proficiency;
                let hitBonusFormula = `To Hit Bonus Formula = ${strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity'} Bonus (${bonus}) + Proficiency (${proficiency})`;

                let magicBonus = 0;
                if (meleeWeaponNames[1].charAt(0) === "+") {
                    magicBonus = Number(meleeWeaponNames[1].charAt(1));
                    damage += `+${magicBonus}`;
                    damageFormula += ` + Weapon Magic Bonus (${magicBonus})`;
                    hitBonus += magicBonus;
                    hitBonusFormula += ` + Weapon Magic Bonus (${magicBonus})`;
                }

                attacks.push({
                    "name": meleeWeaponNames[1],
                    "damage": damage,
                    "damageType": offHandWeapon.damage.damage_type,
                    "damageFormula": damageFormula,
                    "hitBonus": hitBonus,
                    "hitBonusFormula": hitBonusFormula,
                    "range": offHandWeapon.range.normal,
                    "type": "Bonus Action"
                });
            }
        }

        // Monk unarmed strikes
        if (playerStats.class.name === 'Monk') {
            const martialArtsDie = classRules.getMartialArtsDie(playerStats);
            attacks.push({
                "name": 'Unarmed Strike',
                "damage": `1d${martialArtsDie}+${dexterity.bonus}`,
                "damageType": 'Bludgeoning',
                "damageFormula": `Damage Formula = Monk Open Hand (1d${martialArtsDie}) + Dexterity Bonus (${dexterity.bonus})`,
                "hitBonus": dexterity.bonus + proficiency,
                "hitBonusFormula": `To Hit Bonus Formula = Dexterity Bonus (${dexterity.bonus}) + Proficiency (${proficiency})`,
                "range": 5,
                "type": "Action"
            });
            attacks.push({
                "name": 'Unarmed Strike',
                "damage": `1d${martialArtsDie}+${dexterity.bonus}`,
                "damageType": 'Bludgeoning',
                "damageFormula": `Damage Formula = Monk Open Hand (1d${martialArtsDie}) + Dexterity Bonus (${dexterity.bonus})`,
                "hitBonus": dexterity.bonus + proficiency,
                "hitBonusFormula": `To Hit Bonus Formula = Dexterity Bonus (${dexterity.bonus}) + Proficiency (${proficiency})`,
                "range": 5,
                "type": "Bonus Action"
            });
        }

        // Spell attacks
        if (playerStats.spellAbilities) {
            let spells = playerStats.spellAbilities.spells.map(spell => {
                let spellDetail = allSpells.find((spellDetail) => spellDetail.name === spell.name);
                if (spellDetail) {
                    return { ...spellDetail, prepared: spell.prepared };
                }
                return { ...spell };
            });

            spells = spells.filter(spell => spell.damage && (spell.prepared === 'Always' || spell.prepared === 'Prepared'));
            spells.forEach(spell => {
                if (!attacks.find((attack) => attack.name === spell.name)) {
                    let damage = '';
                    if (spell.damage.damage_at_slot_level) {
                        damage = spell.damage.damage_at_slot_level[Object.keys(spell.damage.damage_at_slot_level)[0]];
                    } else if (spell.damage.damage_at_character_level) {
                        damage = spell.damage.damage_at_character_level[Object.keys(spell.damage.damage_at_character_level)[0]];
                    }

                    attacks.push({
                        "name": spell.name,
                        "damage": damage,
                        "damageType": spell.damage.damage_type,
                        "hitBonus": playerStats.spellAbilities.modifier,
                        "range": spell.range,
                        "type": spell.casting_time === "1 action" ? "Action" : "Bonus Action"
                    });
                }
            });
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

            console.log('[Rules2024 getMagicItems] Processing item:', itemName);
            const magicItem = allMagicItems.find(m => m.name === itemName);

            if (!magicItem) {
                console.warn(`[Rules2024 getMagicItems] Item not found in database: ${itemName}`);
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
        let spellcasting = playerStats.class.class_levels[playerStats.level - 1].spellcasting;

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
                delete playerStats.spells;
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
        console.log('[Rules2024 getPlayerStats] START');
        const playerStats = cloneDeep(playerSummary);
        playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);

        // Initialize senses array early to prevent undefined errors
        playerStats.senses = [];

        // Store equipment reference for mastery lookup
        playerStats.equipment = allEquipment;

        console.log('[Rules2024 getPlayerStats] Before getMagicItems:', {
            hasInventory: !!playerSummary.inventory,
            hasMagicItemsInInventory: !!playerSummary.inventory?.magicItems,
            magicItemsData: JSON.stringify(playerSummary.inventory?.magicItems)
        });
        playerStats.class = classRules.getClass(allClasses, playerSummary);
        playerStats.race = raceRules.getRace(allRaces, playerSummary);
        const resultMagicItems = rules.getMagicItems(allMagicItems, playerSummary);
        console.log('[Rules2024 getPlayerStats] getMagicItems returned:', {
            hasResult: !!resultMagicItems,
            length: resultMagicItems?.length || 0,
            data: JSON.stringify(resultMagicItems)
        });
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