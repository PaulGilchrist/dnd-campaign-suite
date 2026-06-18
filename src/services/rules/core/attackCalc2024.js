import { parseMagicItemName, findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, buildSpellAttacks } from './attackCalc.js';
import classRules from '../../character/classRules2024.js';
import { getCombatSummary } from '../../encounters/combatData.js';

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
            const { baseName: offBaseName, magicBonus: offMagicBonus } = parseMagicItemName(offHandName);
            const offHandWeapon = allEquipment.find(item => item.name === offBaseName);
            if (offHandWeapon) {
                const passives = playerStats.automation?.passives;
                if (passives == null) {
                    console.error('[attackCalc2024] Missing array:', passives);
                    throw new Error('Expected array, got ' + passives);
                }
                const hasCrossbowExpertDualWielding = passives.some(
                    p => p.effect === 'two_weapon_fighting' && p.name === 'Dual Wielding'
                );
                const isLightCrossbow = !!(offHandWeapon.properties && offHandWeapon.properties.some(p => p.toLowerCase() === 'light') && ['Hand Crossbow', 'Light Crossbow'].includes(offHandWeapon.name));
                const addAbilityToDamage = isLightCrossbow && hasCrossbowExpertDualWielding;
                attacks.push(buildWeaponAttack({
                    weapon: offHandWeapon,
                    weaponName: offHandName,
                    abilityBonus: bonus,
                    abilityName,
                    proficiency,
                    actionType: 'Bonus Action',
                    weaponType: 'melee',
                    includeAbilityBonusInDamage: addAbilityToDamage,
                }));

                // Dual Wielder feat: extra bonus action attack beyond standard off-hand
            const bonusActions = playerStats.automation?.bonusActions;
            if (bonusActions == null) {
                console.error('[attackCalc2024] Missing array:', bonusActions);
                throw new Error('Expected array, got ' + bonusActions);
            }
            const hasDualWielder = bonusActions.some(
                a => a.type === 'bonus_attacks' && a.trigger === 'attack_action_with_light_weapon'
            );
            if (hasDualWielder) {
                    const dmgFormula = `Damage Formula = ${offHandWeapon.damage.damage_dice}${offMagicBonus ? ` + Weapon Magic Bonus (${offMagicBonus})` : ''}`;
                    const dmg = offMagicBonus ? `${offHandWeapon.damage.damage_dice}+${offMagicBonus}` : offHandWeapon.damage.damage_dice;
                    attacks.push({
                        name: 'Dual Wielder Extra Attack',
                        attackType: 'melee',
                        isRanged: false,
                        range: '5_ft',
                        toHit: bonus + proficiency,
                        hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${bonus}) + Proficiency (${proficiency})`,
                        damageFormula: dmgFormula,
                        damage: dmg,
                        damageType: offHandWeapon.damage.damage_type,
                        abilityName,
                        actionType: 'Bonus Action',
                        properties: ['Melee'],
                    });
                }
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

    // Tavern Brawler: Add unarmed strike attacks for non-monk characters
    // Damage: 1d4 + Strength modifier (Bludgeoning)
    const passives2 = playerStats.automation?.passives;
    if (passives2 == null) {
        console.error('[attackCalc2024] Missing array:', passives2);
        throw new Error('Expected array, got ' + passives2);
    }
    const hasTavernBrawler = passives2.some(
        p => p.effect === 'tavern_brawler_push' || p.effect === 'tavern_brawler_reroll_ones'
    );
    if (hasTavernBrawler && playerStats.class?.name !== 'Monk') {
        const str = playerStats.abilities.find(a => a.name === 'Strength');
        const strMod = str?.bonus || 0;
        const tbDice = '1d4';
        attacks.push({
            name: 'Unarmed Strike (Tavern Brawler)',
            damage: `${tbDice}+${strMod}`,
            damageType: 'Bludgeoning',
            damageFormula: `Damage Formula = Tavern Brawler Unarmed Strike (${tbDice}) + Strength Modifier (${strMod})`,
            hitBonus: strMod + proficiency,
            hitBonusFormula: `To Hit Bonus Formula = Strength Bonus (${strMod}) + Proficiency (${proficiency})`,
            range: 5,
            type: 'Action',
            weaponType: 'unarmed',
        });
    }

    // College of Dance: Dazzling Footwork unarmed strikes (DEX-based, BI die damage)
    if (playerStats.class?.name === 'Bard' && playerStats.class?.subclass?.name === 'College of Dance' && playerStats.level >= 3) {
        const classLevels = playerStats.class?.class_levels;
        if (classLevels == null) {
            console.error('[attackCalc2024] Missing array:', classLevels);
            throw new Error('Expected array, got ' + classLevels);
        }
        const classLevel = classLevels.find(cl => cl.level === playerStats.level);
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

    // Soulknife (2024): Psychic Blade attacks
    if (playerStats.class?.name === 'Rogue' && playerStats.class?.major?.name === 'Soulknife' && playerStats.level >= 3) {
        const dexAbility = dexterity;
        const dexMod = dexAbility?.bonus || 0;
        const prof = proficiency;
        const intAbility = playerStats.abilities.find(a => a.name === 'Intelligence');
        const intMod = intAbility?.bonus || 0;
        const abilityBonus = Math.max(dexMod, intMod);
        const abilityName = dexMod >= intMod ? 'Dexterity' : 'Intelligence';

        // Primary Psychic Blade (1d6 Psychic, Finesse, Thrown 60/120)
        attacks.push({
            name: 'Psychic Blade',
            attackType: 'melee',
            isRanged: false,
            range: '5_ft',
            toHit: abilityBonus + prof,
            hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${prof})`,
            damageFormula: `Damage Formula = 1d6 + ${abilityName} Modifier (${abilityBonus})`,
            damage: {
                damage_dice: '1d6',
                damage_type: 'Psychic',
                damage_at_character_level: { [playerStats.level]: `1d6 + ${abilityBonus}` },
            },
            abilityName,
            actionType: 'Action',
            properties: ['Finesse', 'Thrown (60/120)'],
            damageType: 'Psychic',
            isPsychicBlade: true,
        });

        // Ranged Psychic Blade variant
        attacks.push({
            name: 'Psychic Blade (Ranged)',
            attackType: 'ranged',
            isRanged: true,
            range: '60_ft',
            toHit: abilityBonus + prof,
            hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${prof})`,
            damageFormula: `Damage Formula = 1d6 + ${abilityName} Modifier (${abilityBonus})`,
            damage: {
                damage_dice: '1d6',
                damage_type: 'Psychic',
                damage_at_character_level: { [playerStats.level]: `1d6 + ${abilityBonus}` },
            },
            abilityName,
            actionType: 'Action',
            properties: ['Finesse', 'Thrown (60/120)'],
            damageType: 'Psychic',
            isPsychicBlade: true,
        });

        // Bonus Action Psychic Blade (1d4 Psychic)
        attacks.push({
            name: 'Psychic Blade (Bonus Action)',
            attackType: 'melee',
            isRanged: false,
            range: '5_ft',
            toHit: abilityBonus + prof,
            hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${prof})`,
            damageFormula: `Damage Formula = 1d4 + ${abilityName} Modifier (${abilityBonus})`,
            damage: {
                damage_dice: '1d4',
                damage_type: 'Psychic',
                damage_at_character_level: { [playerStats.level]: `1d4 + ${abilityBonus}` },
            },
            abilityName,
            actionType: 'Bonus Action',
            properties: ['Finesse'],
            damageType: 'Psychic',
            isPsychicBlade: true,
            isBonusActionBlade: true,
        });
    }

    // Swift Quiver: two bonus action ranged attacks with bow/crossbow while concentration active
    const combatSummary = getCombatSummary();
    const swiftQuiverCreature = combatSummary?.creatures?.find(c => c.name === playerStats.name);
    const hasSwiftQuiverConcentration = swiftQuiverCreature?.concentration?.spell === 'Swift Quiver';
    if (hasSwiftQuiverConcentration) {
        const dex = playerStats.abilities.find(a => a.name === 'Dexterity');
        const dexMod = dex?.bonus || 0;
        const prof = proficiency;
        const toHit = dexMod + prof;
        const equippedWeapons = playerStats.inventory?.equipped;
        if (equippedWeapons == null) {
            console.error('[attackCalc2024] Missing array:', equippedWeapons);
            throw new Error('Expected array, got ' + equippedWeapons);
        }
        const allEquip = allEquipment;
        if (allEquip == null) {
            console.error('[attackCalc2024] Missing array:', allEquip);
            throw new Error('Expected array, got ' + allEquip);
        }
        let bowWeapon = null;
        for (const equippedName of equippedWeapons) {
            let baseName = equippedName;
            if (equippedName && typeof equippedName === 'string' && equippedName.charAt(0) === '+') {
                baseName = equippedName.substring(3);
            }
            const weapon = allEquip.find(w => w.name === baseName);
            if (!weapon) continue;
            const props = weapon.properties;
            if (props == null) {
                console.error('[attackCalc2024] Missing array:', props);
                throw new Error('Expected array, got ' + props);
            }
            const isBow = weapon.weapon_category === 'Ranged' && (props.includes('Ammunition') || props.includes('Heavy') || props.includes('Light'));
            const isBoltWeapon = ['Longbow', 'Light Crossbow', 'Hand Crossbow', 'Crossbow, Heavy', 'Crossbow, Light'].includes(weapon.name);
            if (isBow || isBoltWeapon) {
                bowWeapon = { weapon, baseName, equippedName };
                break;
            }
        }
        const range = bowWeapon?.weapon?.range?.long || bowWeapon?.weapon?.range?.normal || '80_ft';
        const damageDie = bowWeapon?.weapon?.damage?.damage_dice || '1d8';
        const damageType = bowWeapon?.weapon?.damage?.damage_type || 'Piercing';
        const hitBonus = toHit;
        const hitBonusFormula = `To Hit Bonus = Dexterity Modifier (${dexMod}) + Proficiency (${prof})`;
        const damageFormula = `Damage Formula = ${damageDie} + Dexterity Modifier (${dexMod})`;
        const damage = `${damageDie}+${dexMod}`;
        for (let i = 0; i < 2; i++) {
            attacks.push({
                name: i === 0 ? 'Swift Quiver (1st Attack)' : 'Swift Quiver (2nd Attack)',
                attackType: 'ranged',
                isRanged: true,
                range: range.replace(/_ft$/, '').replace(/_ft/g, ' ft'),
                toHit: hitBonus,
                hitBonusFormula,
                damageFormula,
                damage,
                damageType,
                abilityName: 'Dexterity',
                actionType: 'Bonus Action',
                properties: ['Ammunition'],
                isSwiftQuiver: true,
            });
        }
    }

    // Starry Form: Archer constellation - ranged spell attack
    const activeBuffs = playerStats.activeBuffs;
    if (activeBuffs == null) {
        console.error('[attackCalc2024] Missing array:', activeBuffs);
        throw new Error('Expected array, got ' + activeBuffs);
    }
    const starryFormBuff = activeBuffs.find(b => b.name === 'Starry Form' && b.constellation === 'Archer');
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
