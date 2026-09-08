import { parseMagicItemName, findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, parseDamageDice } from './attackCalc.js';
import classRules from '../../character/classRules2024.js';
import { getCombatSummary, getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { collectWeaponMastery } from '../../combat/automation/automationPassives.js';
import { buildStarryFormLuminousArrow } from './starryFormDamage.js';

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

    // Ranged weapons
    const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
    const fightingStyles2024 = playerStats.class?.fightingStyles != null ? playerStats.class.fightingStyles : [];
    const hasBlessedWarrior = fightingStyles2024.includes('Blessed Warrior');
    const hasDruidicWarrior = fightingStyles2024.includes('Druidic Warrior');
    // 2024 feats.json canonical: "When you hit with a ranged attack roll using a
    // weapon that has the Thrown property, you gain a +2 bonus to the damage roll."
    const hasThrownWeaponFighting = fightingStyles2024.includes('Thrown Weapon Fighting');
    const thrownDamageFor = (weapon) => (hasThrownWeaponFighting && weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'thrown') ? '+2' : '');
    const thrownLabelFor = (thrownDamage) => (thrownDamage ? 'Thrown Weapon Fighting (2)' : '');
    if (rangedWeapons.length > 0) {
        const nonLightRanged = rangedWeapons.filter(name => {
            const { baseName } = parseMagicItemName(name);
            const weapon = allEquipment.find(item => item.name === baseName);
            return weapon && !(weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'light'));
        });
        const lightRanged = rangedWeapons.filter(name => {
            const { baseName } = parseMagicItemName(name);
            const weapon = allEquipment.find(item => item.name === baseName);
            return weapon && weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'light');
        });

        // All non-light ranged weapons → Action
        for (const rangedWeaponName of nonLightRanged) {
            const { baseName } = parseMagicItemName(rangedWeaponName);
            const rangedWeapon = allEquipment.find(item => item.name === baseName);
            if (rangedWeapon) {
                const archeryBonus = fightingStyles2024.includes('Archery') ? 2 : 0;
                const thrownDamage = thrownDamageFor(rangedWeapon);
                attacks.push(buildWeaponAttack({
                    weapon: rangedWeapon,
                    weaponName: rangedWeaponName,
                    abilityBonus: dexterity.bonus,
                    abilityName: 'Dexterity',
                    proficiency,
                    actionType: 'Action',
                    extraHitBonus: archeryBonus,
                    extraHitBonusLabel: archeryBonus ? 'Archery Fighting Style (2)' : '',
                    extraDamage: thrownDamage,
                    extraDamageLabel: thrownLabelFor(thrownDamage),
                }));
            }
        }

        // Light ranged weapons: < 2 → all Action, >= 2 → highest damage Action, rest Bonus Action
        if (lightRanged.length > 0) {
            const hasCrossbowExpert = (playerStats.feats || []).some(f => f && f.toLowerCase && f.toLowerCase().includes('crossbow expert'));
            if (lightRanged.length < 2) {
                for (const rangedWeaponName of lightRanged) {
                    const { baseName } = parseMagicItemName(rangedWeaponName);
                    const rangedWeapon = allEquipment.find(item => item.name === baseName);
                    if (rangedWeapon) {
                        const archeryBonus = fightingStyles2024.includes('Archery') ? 2 : 0;
                        const thrownDamage = thrownDamageFor(rangedWeapon);
                        attacks.push(buildWeaponAttack({
                            weapon: rangedWeapon,
                            weaponName: rangedWeaponName,
                            abilityBonus: dexterity.bonus,
                            abilityName: 'Dexterity',
                            proficiency,
                            actionType: 'Action',
                            extraHitBonus: archeryBonus,
                            extraHitBonusLabel: archeryBonus ? 'Archery Fighting Style (2)' : '',
                            extraDamage: thrownDamage,
                            extraDamageLabel: thrownLabelFor(thrownDamage),
                        }));
                    }
                }
            } else {
                // Find highest damage light ranged weapon
                let bestWeapon = null;
                let bestAvgDamage = -1;
                for (const rangedWeaponName of lightRanged) {
                    const { baseName } = parseMagicItemName(rangedWeaponName);
                    const rangedWeapon = allEquipment.find(item => item.name === baseName);
                    if (rangedWeapon) {
                        const avg = parseDamageDice(rangedWeapon.damage.damage_dice);
                        if (avg > bestAvgDamage) {
                            bestAvgDamage = avg;
                            bestWeapon = { name: rangedWeaponName, weapon: rangedWeapon };
                        }
                    }
                }
                // Highest damage → Action
                if (bestWeapon) {
                    const { name: bestName, weapon: bestWpn } = bestWeapon;
                    const archeryBonus = fightingStyles2024.includes('Archery') ? 2 : 0;
                    const thrownDamage = thrownDamageFor(bestWpn);
                    attacks.push(buildWeaponAttack({
                        weapon: bestWpn,
                        weaponName: bestName,
                        abilityBonus: dexterity.bonus,
                        abilityName: 'Dexterity',
                        proficiency,
                        actionType: 'Action',
                        extraHitBonus: archeryBonus,
                        extraHitBonusLabel: archeryBonus ? 'Archery Fighting Style (2)' : '',
                        extraDamage: thrownDamage,
                        extraDamageLabel: thrownLabelFor(thrownDamage),
                    }));
                }
                // Rest → Bonus Action
                let bestSkipped = false;
                for (const rangedWeaponName of lightRanged) {
                    if (rangedWeaponName === bestWeapon.name && !bestSkipped) {
                        bestSkipped = true;
                        continue;
                    }
                    const { baseName } = parseMagicItemName(rangedWeaponName);
                    const rangedWeapon = allEquipment.find(item => item.name === baseName);
                    if (rangedWeapon) {
                        const isHandCrossbow = baseName === 'Hand Crossbow';
                        const includeAbilityBonus = hasCrossbowExpert && isHandCrossbow;
                        const thrownDamage = thrownDamageFor(rangedWeapon);
                        attacks.push(buildWeaponAttack({
                            weapon: rangedWeapon,
                            weaponName: rangedWeaponName,
                            abilityBonus: dexterity.bonus,
                            abilityName: 'Dexterity',
                            proficiency,
                            actionType: 'Bonus Action',
                            weaponType: 'ranged',
                            includeAbilityBonusInDamage: includeAbilityBonus,
                            extraDamage: thrownDamage,
                            extraDamageLabel: thrownLabelFor(thrownDamage),
                        }));
                    }
                }
            }
        }
    }

    // Melee weapons
    const meleeWeaponNames = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Melee');
    if (meleeWeaponNames.length > 0) {
        const bonus = Math.max(strength.bonus, dexterity.bonus);
        const abilityName = strength.bonus > dexterity.bonus ? 'Strength' : 'Dexterity';

        // Separate non-light and light melee weapons
        const nonLightMelee = meleeWeaponNames.filter(name => {
            const { baseName } = parseMagicItemName(name);
            const weapon = allEquipment.find(item => item.name === baseName);
            return weapon && !(weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'light'));
        });
        const lightMelee = meleeWeaponNames.filter(name => {
            const { baseName } = parseMagicItemName(name);
            const weapon = allEquipment.find(item => item.name === baseName);
            return weapon && weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'light');
        });

        // All non-light melee weapons → Action
        for (const meleeWeaponName of nonLightMelee) {
            const { baseName: mainBaseName } = parseMagicItemName(meleeWeaponName);
            const mainHandWeapon = allEquipment.find(item => item.name === mainBaseName);
            if (mainHandWeapon) {
                const isDueling = fightingStyles2024.includes('Dueling') && meleeWeaponNames.length === 1 && rangedWeapons.length === 0;
                const blessedWarriorHitBonus = hasBlessedWarrior ? 2 : 0;
                const druidicWarriorDamage = hasDruidicWarrior ? '+2' : '';
                const druidicWarriorLabel = hasDruidicWarrior ? 'Druidic Warrior (2)' : '';
                const combinedExtraDamage = [isDueling ? '+2' : '', druidicWarriorDamage].filter(Boolean).join(' + ');
                const combinedExtraDamageLabel = [isDueling ? 'Dueling Fighting Style (2)' : '', druidicWarriorLabel].filter(Boolean).join(' + ') || '';
                attacks.push(buildWeaponAttack({
                    weapon: mainHandWeapon,
                    weaponName: meleeWeaponName,
                    abilityBonus: bonus,
                    abilityName,
                    proficiency,
                    actionType: 'Action',
                    weaponType: 'melee',
                    extraDamage: combinedExtraDamage,
                    extraDamageLabel: combinedExtraDamageLabel,
                    extraHitBonus: blessedWarriorHitBonus,
                    extraHitBonusLabel: blessedWarriorHitBonus ? 'Blessed Warrior (2)' : '',
                }));
            }
        }

        // Light melee weapons: < 2 → all Action, >= 2 → highest damage Action, rest Bonus Action
        if (lightMelee.length > 0) {
            const passives = playerStats.automation?.passives ?? [];
            const hasTwoWeaponFighting = passives.some(
                p => p.effect === 'two_weapon_fighting'
            );
            const addAbilityToDamage = hasTwoWeaponFighting;

            if (lightMelee.length < 2) {
                // All light melee weapons → Action
                for (const meleeWeaponName of lightMelee) {
                    const { baseName: mainBaseName } = parseMagicItemName(meleeWeaponName);
                    const mainHandWeapon = allEquipment.find(item => item.name === mainBaseName);
                    if (mainHandWeapon) {
                        const isDueling = fightingStyles2024.includes('Dueling') && meleeWeaponNames.length === 1 && rangedWeapons.length === 0;
                        const blessedWarriorHitBonus = hasBlessedWarrior ? 2 : 0;
                        const druidicWarriorDamage = hasDruidicWarrior ? '+2' : '';
                        const druidicWarriorLabel = hasDruidicWarrior ? 'Druidic Warrior (2)' : '';
                        const combinedExtraDamage = [isDueling ? '+2' : '', druidicWarriorDamage].filter(Boolean).join(' + ');
                        const combinedExtraDamageLabel = [isDueling ? 'Dueling Fighting Style (2)' : '', druidicWarriorLabel].filter(Boolean).join(' + ') || '';
                        attacks.push(buildWeaponAttack({
                            weapon: mainHandWeapon,
                            weaponName: meleeWeaponName,
                            abilityBonus: bonus,
                            abilityName,
                            proficiency,
                            actionType: 'Action',
                            weaponType: 'melee',
                            extraDamage: combinedExtraDamage,
                            extraDamageLabel: combinedExtraDamageLabel,
                            extraHitBonus: blessedWarriorHitBonus,
                            extraHitBonusLabel: blessedWarriorHitBonus ? 'Blessed Warrior (2)' : '',
                        }));
                    }
                }
            } else {
                // Find highest damage light melee weapon
                let bestWeapon = null;
                let bestAvgDamage = -1;
                for (const meleeWeaponName of lightMelee) {
                    const { baseName } = parseMagicItemName(meleeWeaponName);
                    const weapon = allEquipment.find(item => item.name === baseName);
                    if (weapon) {
                        const avg = parseDamageDice(weapon.damage.damage_dice);
                        if (avg > bestAvgDamage) {
                            bestAvgDamage = avg;
                            bestWeapon = { name: meleeWeaponName, weapon, baseName };
                        }
                    }
                }

                // Highest damage → Action
                if (bestWeapon) {
                    const isDueling = fightingStyles2024.includes('Dueling') && meleeWeaponNames.length === 1 && rangedWeapons.length === 0;
                    const blessedWarriorHitBonus = hasBlessedWarrior ? 2 : 0;
                    const druidicWarriorDamage = hasDruidicWarrior ? '+2' : '';
                    const druidicWarriorLabel = hasDruidicWarrior ? 'Druidic Warrior (2)' : '';
                    const combinedExtraDamage = [isDueling ? '+2' : '', druidicWarriorDamage].filter(Boolean).join(' + ');
                    const combinedExtraDamageLabel = [isDueling ? 'Dueling Fighting Style (2)' : '', druidicWarriorLabel].filter(Boolean).join(' + ') || '';
                    attacks.push(buildWeaponAttack({
                        weapon: bestWeapon.weapon,
                        weaponName: bestWeapon.name,
                        abilityBonus: bonus,
                        abilityName,
                        proficiency,
                        actionType: 'Action',
                        weaponType: 'melee',
                        extraDamage: combinedExtraDamage,
                        extraDamageLabel: combinedExtraDamageLabel,
                        extraHitBonus: blessedWarriorHitBonus,
                        extraHitBonusLabel: blessedWarriorHitBonus ? 'Blessed Warrior (2)' : '',
                    }));
                }

                // Rest → Bonus Action with Nick mastery + Two-Weapon Fighting logic
                let bestSkipped = false;
                for (const meleeWeaponName of lightMelee) {
                    if (meleeWeaponName === bestWeapon.name && !bestSkipped) {
                        bestSkipped = true;
                        continue;
                    }
                    const { baseName: offBaseName, magicBonus: offMagicBonus } = parseMagicItemName(meleeWeaponName);
                    const offHandWeapon = allEquipment.find(item => item.name === offBaseName);
                    if (offHandWeapon) {
                        let actionType = 'Bonus Action';
                        if (playerStats.campaignName) {
                            const nickAvailable = collectWeaponMastery(offBaseName, playerStats);
                            const hasNick = nickAvailable.baseMastery === 'Nick' || (nickAvailable.extraMasteries || []).includes('Nick');
                            if (hasNick) {
                                const currentRound = getCurrentCombatRound(playerStats.campaignName);
                                const nickUsedRound = getRuntimeValue(playerStats.name, '_Nick_UsedRound', playerStats.campaignName);
                                if (nickUsedRound === currentRound) {
                                    actionType = 'Action';
                                }
                            }
                        }

                        attacks.push(buildWeaponAttack({
                            weapon: offHandWeapon,
                            weaponName: meleeWeaponName,
                            abilityBonus: bonus,
                            abilityName,
                            proficiency,
                            actionType,
                            weaponType: 'melee',
                            includeAbilityBonusInDamage: addAbilityToDamage,
                        }));

                        // Dual Wielder feat: extra bonus action attack beyond standard off-hand
                        const bonusActions = playerStats.automation?.bonusActions ?? [];
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
    const passives2 = playerStats.automation?.passives ?? [];
    const hasTavernBrawler = passives2.some(
        p => p.effect === 'tavern_brawler_push' || p.effect === 'tavern_brawler_reroll_ones'
    );
    if (hasTavernBrawler && playerStats.class?.name !== 'Monk') {
        const str = playerStats.abilities.find(a => a.name === 'Strength');
        const strMod = str?.bonus || 0;
        const tbDice = '1d4';
        const blessedWarriorHit = hasBlessedWarrior ? 2 : 0;
        attacks.push({
            name: 'Unarmed Strike',
            damage: `${tbDice}+${strMod}`,
            damageType: 'Bludgeoning',
            damageFormula: `Damage Formula = Tavern Brawler Unarmed Strike (${tbDice}) + Strength Modifier (${strMod})`,
            hitBonus: strMod + proficiency + blessedWarriorHit,
            hitBonusFormula: `To Hit Bonus Formula = Strength Bonus (${strMod}) + Proficiency (${proficiency})${blessedWarriorHit ? ' + Blessed Warrior (2)' : ''}`,
            range: 5,
            type: 'Action',
            weaponType: 'unarmed',
        });
    }

    // College of Dance: Dazzling Footwork unarmed strikes (DEX-based, BI die damage)
    if (playerStats.class?.name === 'Bard' && playerStats.class?.subclass?.name === 'College of Dance' && playerStats.level >= 3) {
        const classLevel = (playerStats.class?.class_levels ?? []).find(cl => cl.level === playerStats.level);
        const bardicDie = classLevel?.bardic_die || 6;
        const diceStr = `1d${bardicDie}`;
        attacks.push(...buildMonkAttacks({ diceStr, dexterityBonus: dexterity.bonus, proficiency }).map(a => ({
            ...a,
            name: 'Unarmed Strike (Dance)',
            damageFormula: `Damage Formula = Bardic Inspiration Die (${diceStr}) + Dexterity Bonus (${dexterity.bonus})`,
            hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterity.bonus}) + Proficiency (${proficiency})`,
        })));
    }

    // Soulknife (2024): Psychic Blade action weapon + bonus action off-hand
    if (playerStats.class?.name === 'Rogue' && playerStats.class?.major?.name === 'Soulknife' && playerStats.level >= 3) {
        const dexAbility = dexterity;
        const dexMod = dexAbility?.bonus || 0;
        const prof = proficiency;
        const intAbility = playerStats.abilities.find(a => a.name === 'Intelligence');
        const intMod = intAbility?.bonus || 0;
        const abilityBonus = Math.max(dexMod, intMod);
        const abilityName = dexMod >= intMod ? 'Dexterity' : 'Intelligence';

        // Psychic Blade (1d6 Psychic, Finesse, Thrown 60/120, Vex) — Action
        attacks.push({
            name: 'Psychic Blade',
            type: 'Action',
            actionType: 'Action',
            attackType: 'melee',
            isRanged: false,
            range: '5 ft',
            toHit: abilityBonus + prof,
            hitBonus: abilityBonus + prof,
            hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${prof})`,
            damageFormula: `Damage Formula = 1d6 + ${abilityName} Modifier (${abilityBonus})`,
            damage: `1d6+${abilityBonus}`,
            abilityName,
            properties: ['Finesse', 'Thrown (60/120)'],
            damageType: 'Psychic',
            mastery: 'Vex',
            isPsychicBlade: true,
        });

        // Psychic Blade (1d4 Psychic, Finesse, Thrown 60/120, Vex) — Bonus Action (off-hand)
        attacks.push({
            name: 'Psychic Blade',
            type: 'Bonus Action',
            actionType: 'Bonus Action',
            attackType: 'melee',
            isRanged: false,
            range: '60 ft',
            toHit: abilityBonus + prof,
            hitBonus: abilityBonus + prof,
            hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${prof})`,
            damageFormula: 'Damage Formula = 1d4',
            damage: '1d4',
            abilityName,
            properties: ['Finesse', 'Thrown (60/120)'],
            damageType: 'Psychic',
            mastery: 'Vex',
            isPsychicBlade: true,
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
        const equippedWeapons = playerStats.inventory?.equipped ?? [];
        const allEquip = allEquipment ?? [];
        let bowWeapon = null;
        for (const equippedName of equippedWeapons) {
            let baseName = equippedName;
            if (equippedName && typeof equippedName === 'string' && equippedName.charAt(0) === '+') {
                baseName = equippedName.substring(3);
            }
            const weapon = allEquip.find(w => w.name === baseName);
            if (!weapon) continue;
            const props = weapon?.properties ?? [];
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
    const starryArrow = buildStarryFormLuminousArrow(playerStats);
    if (starryArrow) attacks.push(starryArrow);

    // Fallback unarmed strike when no weapons are equipped
    if (attacks.length === 0) {
        const str = playerStats.abilities?.find(a => a.name === 'Strength');
        const strMod = str?.bonus || 0;
        const blessedWarriorHit = hasBlessedWarrior ? 2 : 0;
        const unarmedDamage = strMod >= 0 ? `1d4+${strMod}` : `1d4${strMod}`;
        const unarmedFormula = `Damage Formula = Unarmed Strike (1d4) + Strength Bonus (${strMod})`;
        const unarmedHitFormula = `To Hit Bonus Formula = Strength Bonus (${strMod}) + Proficiency (${proficiency})${blessedWarriorHit ? ' + Blessed Warrior (2)' : ''}`;
        attacks.push({
            name: 'Unarmed Strike',
            damage: unarmedDamage,
            damageType: 'Bludgeoning',
            damageFormula: unarmedFormula,
            hitBonus: strMod + proficiency + blessedWarriorHit,
            hitBonusFormula: unarmedHitFormula,
            range: 5,
            type: 'Action',
            weaponType: 'unarmed',
        });
        // Two-Weapon Fighting: add bonus action unarmed strike
        const hasTwoWeapon = fightingStyles2024.includes('Two-Weapon Fighting');
        if (hasTwoWeapon) {
            attacks.push({
                name: 'Unarmed Strike',
                damage: unarmedDamage,
                damageType: 'Bludgeoning',
                damageFormula: unarmedFormula,
                hitBonus: strMod + proficiency + blessedWarriorHit,
                hitBonusFormula: unarmedHitFormula,
                range: 5,
                type: 'Bonus Action',
                weaponType: 'unarmed',
            });
        }
    }

    return attacks;
}
