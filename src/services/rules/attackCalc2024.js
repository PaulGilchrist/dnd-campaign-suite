import { parseMagicItemName, findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, buildSpellAttacks } from './attackCalc.js';
import classRules from '../character/classRules2024.js';

/**
 * Build all attack entries for a character (2024 rules).
 * @param {Array} allEquipment
 * @param {Array} allSpells
 * @param {Object} playerStats
 * @returns {Object[]}
 */
export function getAttacks(allEquipment, allSpells, playerStats) {
    const strength = playerStats.abilities.find(a => a.name === 'Strength');
    const dexterity = playerStats.abilities.find(a => a.name === 'Dexterity');
    const proficiency = Math.floor((playerStats.level - 1) / 4 + 2);
    const attacks = [];

    // Ranged weapon (2024: no Archery fighting style)
    const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
    if (rangedWeapons.length > 0) {
        const rangedWeaponName = rangedWeapons[0];
        const { baseName } = parseMagicItemName(rangedWeaponName);
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
        const { baseName: mainBaseName } = parseMagicItemName(mainHandName);
        const mainHandWeapon = allEquipment.find(item => item.name === mainBaseName);
        if (mainHandWeapon) {
            attacks.push(buildWeaponAttack({
                weapon: mainHandWeapon,
                weaponName: mainHandName,
                abilityBonus: bonus,
                abilityName,
                proficiency,
                actionType: 'Action',
                weaponType: 'melee',
            }));
        }

        // Off-hand (2024: no ability bonus on off-hand damage, no Two-Weapon Fighting style)
        if (meleeWeaponNames.length > 1) {
            const offHandName = meleeWeaponNames[1];
            const { baseName: offBaseName } = parseMagicItemName(offHandName);
            const offHandWeapon = allEquipment.find(item => item.name === offBaseName);
            if (offHandWeapon) {
                attacks.push(buildWeaponAttack({
                    weapon: offHandWeapon,
                    weaponName: offHandName,
                    abilityBonus: bonus,
                    abilityName,
                    proficiency,
                    actionType: 'Bonus Action',
                    weaponType: 'melee',
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

    // College of Dance: Dazzling Footwork unarmed strikes (DEX-based, BI die damage)
    if (playerStats.class?.name === 'Bard' && playerStats.class?.subclass?.name === 'College of Dance' && playerStats.level >= 3) {
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const bardicDie = classLevel?.bardic_die || 6;
        const diceStr = `1d${bardicDie}`;
        attacks.push(...buildMonkAttacks({ diceStr, dexterityBonus: dexterity.bonus, proficiency }).map(a => ({
            ...a,
            name: 'Unarmed Strike (Dance)',
            damageFormula: `Damage Formula = Bardic Inspiration Die (${diceStr}) + Dexterity Bonus (${dexterity.bonus})`,
            hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterity.bonus}) + Proficiency (${proficiency})`,
        })));
    }

    // Spell attacks
    if (playerStats.spellAbilities) {
        attacks.push(...buildSpellAttacks(playerStats.spellAbilities.spells, allSpells, playerStats.spellAbilities, playerStats.level));
    }

    // Starry Form: Archer constellation - ranged spell attack
    const starryFormBuff = (playerStats.activeBuffs || []).find(b => b.name === 'Starry Form' && b.constellation === 'Archer');
    if (starryFormBuff) {
        const wis = playerStats.abilities.find(a => a.name === 'Wisdom');
        const wisMod = wis?.bonus || 0;
        const level = playerStats.level || 1;
        const isTwinkled = level >= 10;
        const damageDice = isTwinkled ? '2d8' : '1d8';
        const spellAttackMod = playerStats.spellAbilities?.toHit || 0;
        attacks.push({
            name: 'Starry Form: Luminous Arrow',
            attackType: 'spell',
            isRanged: true,
            range: '120_ft',
            toHit: spellAttackMod,
            hitBonusFormula: `To Hit Bonus = Spell Attack Modifier (${spellAttackMod})`,
            damageFormula: `Damage Formula = ${damageDice} + Wisdom Modifier (${wisMod})`,
            damage: {
                damage_dice: damageDice,
                damage_type: 'Radiant',
                damage_at_character_level: { [level]: `${damageDice} + ${wisMod}` },
            },
            abilityName: 'Wisdom',
            actionType: 'Bonus Action',
        });
    }

    return attacks;
}
