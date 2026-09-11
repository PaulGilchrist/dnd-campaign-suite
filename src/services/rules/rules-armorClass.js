import { parseMagicItemName } from './core/attackCalc.js';
import { is2024 } from './rules-helpers.js';

function replaceContributions(contributions, items) {
    contributions.length = 0;
    contributions.push(...items);
}

function computeAddedBonus(allEquipment, playerStats, playerSummary, armorName, contributions) {
    let addedBonus = 0;

    if (playerStats.class.name === 'Monk') {
        const wisdom = playerStats.abilities.find((ability) => ability.name === 'Wisdom');
        addedBonus += wisdom.bonus;
        contributions.push(`Monk Wisdom Bonus (${wisdom.bonus})`);
    }

    // 5e-specific: Defense fighting style
    if (!is2024(playerStats, playerSummary)) {
        if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Defense') && armorName) {
            addedBonus += 1;
            contributions.push(`Fighting Style Defense (1)`);
        }
    }

    // Unarmed Fighting fighting style - +2 AC when unarmed and not holding anything in both hands
    const hasUnarmedFighting = playerStats.class?.fightingStyles && playerStats.class.fightingStyles.includes('Unarmed Fighting');
    if (hasUnarmedFighting) {
        const equippedItems = playerStats.inventory?.equipped || [];
        const hasAnyWeapon = equippedItems.some(equipName => {
            const { baseName } = parseMagicItemName(equipName);
            const item = allEquipment.find(e => e.name === baseName);
            return item && item.equipment_category === 'Weapon';
        });
        const hasShield = equippedItems.some(equipName => {
            const { baseName } = parseMagicItemName(equipName);
            return baseName === 'Shield';
        });
        const isUnarmed = !hasAnyWeapon && !hasShield;
        if (isUnarmed) {
            addedBonus += 2;
            contributions.push(`Fighting Style Unarmed (2)`);
        }
    }

    return addedBonus;
}

function computeBaseArmorClass(allEquipment, playerStats, playerSummary, armorName, addedBonus, dexterity, charisma, contributions) {
    if (armorName) {
        let parsedArmor = parseMagicItemName(armorName);
        contributions.push(`Armor Magic Bonus (${parsedArmor.magicBonus})`);
        let armor = allEquipment.find((item) => item.name === parsedArmor.baseName);
        let armorClass = armor.armor_class.base + addedBonus + parsedArmor.magicBonus;
        contributions.push(`Armor (${armor.armor_class.base})`);
        if (armor.armor_class.dex_bonus) {
            let armorBonus = dexterity.bonus;
            if (armor.armor_class.max_bonus) {
                armorBonus = Math.min(armor.armor_class.max_bonus, armorBonus);
            }
            contributions.push(`Dexterity Bonus (${armorBonus})`);
            armorClass = armor.armor_class.base + armorBonus + addedBonus + parsedArmor.magicBonus;
        }
        return armorClass;
    }
    if (is2024(playerStats, playerSummary) && playerStats.class.subclass && playerStats.class.subclass.name === 'College of Dance') {
        replaceContributions(contributions, [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Charisma Bonus (${charisma.bonus})`]);
        return 10 + dexterity.bonus + charisma.bonus + addedBonus;
    }
    const armorClass = 10 + dexterity.bonus + addedBonus;
    contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus})`);
    return armorClass;
}

function applyMediumArmorMaster(armorClass, armorName, dexterity, mediumArmorMasterPassive, allEquipment, contributions) {
    if (!mediumArmorMasterPassive || !armorName) return armorClass;
    const armor = allEquipment.find(item => item.name === parseMagicItemName(armorName).baseName);
    if (armor && armor.armor_category === 'Medium' && dexterity.totalScore >= 16) {
        const dexMod = dexterity.bonus;
        const currentMaxBonus = armor.armor_class.max_bonus != null ? armor.armor_class.max_bonus : 99;
        const bonusToAdd = parseInt(mediumArmorMasterPassive.bonusExpression || mediumArmorMasterPassive.bonus || '1', 10);
        const newMaxBonus = currentMaxBonus + bonusToAdd;
        const actualBonus = Math.min(dexMod, newMaxBonus);
        const originalBonus = Math.min(dexMod, currentMaxBonus);
        if (actualBonus > originalBonus) {
            armorClass += (actualBonus - originalBonus);
            contributions.push(`Medium Armor Master (+${actualBonus - originalBonus})`);
        }
    }
    return armorClass;
}

function applyShield(armorClass, equipped, shield, contributions) {
    if (shield) {
        const parsedShield = parseMagicItemName(shield);
        armorClass += 2 + parsedShield.magicBonus;
        contributions.push(`Shield (2) + Shield Magic Bonus (${parsedShield.magicBonus})`);
    } else if (equipped.find(item => item === 'Shield')) {
        armorClass += 2;
        contributions.push(`Shield (2)`);
    }
    return armorClass;
}

// 5e-specific: Cloak and Ring of Protection
function applyProtectionItems(armorClass, playerStats, contributions) {
    if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Cloak of Protection')) {
        armorClass += 1;
        contributions.push(`Cloak of Protection (1)`);
    }
    if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Ring of Protection')) {
        armorClass += 1;
        contributions.push(`Ring of Protection (1)`);
    }
    return armorClass;
}

// 5e-specific: Barbarian and Draconic Sorcerer unarmored defense
function applyUnarmoredDefense5e(armorClass, playerStats, dexterity, constitution, contributions) {
    if (playerStats.class.name === 'Barbarian') {
        const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
        if (barbarianAc > armorClass) {
            contributions.length = 0;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`);
            return barbarianAc;
        }
    } else if (playerStats.class.subclass && playerStats.class.subclass.name === 'Draconic') {
        const sorcererAc = 13 + dexterity.bonus;
        if (sorcererAc > armorClass) {
            contributions.length = 0;
            contributions.push(`Unarmored AC (13) + Dexterity Bonus (${dexterity.bonus})`);
            return sorcererAc;
        }
    }
    return armorClass;
}

// 2024: College of Dance (AC = 10 + DEX + CHA, no armor or shield),
// Draconic Sorcery (AC = 10 + DEX + CHA, no armor),
// and Barbarian (AC = 10 + DEX + CON, no armor) unarmored defenses
function applyUnarmoredDefense2024(armorClass, playerStats, armorName, shield, dexterity, charisma, constitution, contributions) {
    if (playerStats.class.subclass && playerStats.class.subclass.name === 'College of Dance' && !armorName && !shield) {
        const danceAc = 10 + dexterity.bonus + charisma.bonus;
        if (danceAc > armorClass) {
            contributions.length = 0;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Charisma Bonus (${charisma.bonus})`);
            return danceAc;
        }
    }
    if (playerStats.class.major && playerStats.class.major.name === 'Draconic Sorcery' && !armorName) {
        const draconicAc = 10 + dexterity.bonus + charisma.bonus;
        if (draconicAc > armorClass) {
            contributions.length = 0;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Charisma Bonus (${charisma.bonus})`);
            return draconicAc;
        }
    }
    if (playerStats.class.name === 'Barbarian' && !armorName) {
        const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
        if (barbarianAc > armorClass) {
            contributions.length = 0;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`);
            return barbarianAc;
        }
    }
    return armorClass;
}

// 2024: Apply ac_bonus from passive_buff automation (e.g., Defense feat)
function applyAcBonusPassives(armorClass, passives, armorName, allEquipment, contributions) {
    for (const passive of passives) {
        if (passive.type === 'passive_buff' && passive.effect === 'ac_bonus' && passive.bonus) {
            const bonus = typeof passive.bonus === 'number' ? passive.bonus : parseInt(passive.bonus, 10);
            if (!isNaN(bonus) && bonus > 0) {
                const condition = passive.condition || '';
                if (condition === 'wearing_light_medium_or_heavy_armor') {
                    if (armorName) {
                        const armor = allEquipment.find(item => item.name === parseMagicItemName(armorName).baseName);
                        if (armor && ['Light', 'Medium', 'Heavy'].includes(armor.armor_category)) {
                            armorClass += bonus;
                            contributions.push(`${passive.name || 'Defense'} (+${bonus})`);
                        }
                    }
                } else if (!condition) {
                    armorClass += bonus;
                    contributions.push(`${passive.name || 'Passive Buff'} (+${bonus})`);
                }
            }
        }
    }
    return armorClass;
}

/**
 * Get armor class for a character (handles both rulesets internally).
 */
export function getArmorClass(allEquipment, playerStats, playerSummary) {
    const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
    const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
    const charisma = playerStats.abilities.find((ability) => ability.name === 'Charisma');

    let armorName = playerStats.inventory.equipped.find(itemName => {
        let item = allEquipment.find((item) => item.name === parseMagicItemName(itemName).baseName);
        if (item) {
            return item.equipment_category === 'Armor' && item.armor_category !== 'Shield';
        }
        return false;
    });

    let contributions = [];

    const addedBonus = computeAddedBonus(allEquipment, playerStats, playerSummary, armorName, contributions);

    let armorClass = computeBaseArmorClass(allEquipment, playerStats, playerSummary, armorName, addedBonus, dexterity, charisma, contributions);

    // 5e: Medium Armor Master – increase medium armor dex bonus cap from 2 to 3 when Dex >= 16
    if (!is2024(playerStats, playerSummary)) {
        const passives = playerStats.automation?.passives;
        if (Array.isArray(passives)) {
            const mediumArmorMasterPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'medium_armor_dex_bonus_increase');
            armorClass = applyMediumArmorMaster(armorClass, armorName, dexterity, mediumArmorMasterPassive, allEquipment, contributions);
        }
    }

    const shield = playerStats.inventory.equipped.find(item => parseMagicItemName(item).baseName === 'Shield');
    armorClass = applyShield(armorClass, playerStats.inventory.equipped, shield, contributions);

    if (!is2024(playerStats, playerSummary)) {
        armorClass = applyProtectionItems(armorClass, playerStats, contributions);
        armorClass = applyUnarmoredDefense5e(armorClass, playerStats, dexterity, constitution, contributions);
    }

    if (is2024(playerStats, playerSummary)) {
        armorClass = applyUnarmoredDefense2024(armorClass, playerStats, armorName, shield, dexterity, charisma, constitution, contributions);

        const passives = playerStats.automation?.passives;
        if (!Array.isArray(passives)) {
            console.error('rules: expected passives to be an array for', playerStats.name);
            throw new Error('Missing array: passives for ' + playerStats.name);
        }
        armorClass = applyAcBonusPassives(armorClass, passives, armorName, allEquipment, contributions);

        // 2024: Medium Armor Master – increase medium armor dex bonus cap from 2 to 3 when Dex >= 16
        const mediumArmorMasterPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'medium_armor_dex_bonus_increase');
        armorClass = applyMediumArmorMaster(armorClass, armorName, dexterity, mediumArmorMasterPassive, allEquipment, contributions);
    }

    return [armorClass, contributions.join(' + ')];
}
