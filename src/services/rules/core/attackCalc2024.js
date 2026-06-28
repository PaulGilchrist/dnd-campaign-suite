import { parseMagicItemName, findEquippedWeapons, buildWeaponAttack, buildMonkAttacks, buildSpellAttacks } from './attackCalc.js';
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

    // Ranged weapon
    const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
    const fightingStyles2024 = playerStats.class?.fightingStyles != null ? playerStats.class.fightingStyles : [];
    if (rangedWeapons.length > 0) {
        const rangedWeaponName = rangedWeapons[0];
        const { baseName } = parseMagicItemName(rangedWeaponName);
        const rangedWeapon = allEquipment.find(item => item.name === baseName);
        if (rangedWeapon) {
            const archeryBonus = fightingStyles2024.includes('Archery') ? 2 : 0;
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
        const fightingStyles2024 = playerStats.class?.fightingStyles != null ? playerStats.class.fightingStyles : [];
        const hasBlessedWarrior = fightingStyles2024.includes('Blessed Warrior');
        const hasDruidicWarrior = fightingStyles2024.includes('Druidic Warrior');
        if (mainHandWeapon) {
            const isDueling = fightingStyles2024.includes('Dueling') && meleeWeaponNames.length === 1 && rangedWeapons.length === 0;
            const blessedWarriorHitBonus = hasBlessedWarrior ? 2 : 0;
            const druidicWarriorDamage = hasDruidicWarrior ? '+2' : '';
            const druidicWarriorLabel = hasDruidicWarrior ? 'Druidic Warrior (2)' : '';
            const combinedExtraDamage = [isDueling ? '+2' : '', druidicWarriorDamage].filter(Boolean).join(' + ');
            const combinedExtraDamageLabel = [isDueling ? 'Dueling Fighting Style (2)' : '', druidicWarriorLabel].filter(Boolean).join(' + ') || '';
            attacks.push(buildWeaponAttack({
                weapon: mainHandWeapon,
                weaponName: mainHandName,
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

        // Off-hand (2024: no ability bonus on off-hand damage, no Two-Weapon Fighting style)
        if (meleeWeaponNames.length > 1) {
            const offHandName = meleeWeaponNames[1];
            const { baseName: offBaseName, magicBonus: offMagicBonus } = parseMagicItemName(offHandName);
            const offHandWeapon = allEquipment.find(item => item.name === offBaseName);
            if (offHandWeapon) {
                const passives = playerStats.automation?.passives ?? [];
                const hasTwoWeaponFighting = passives.some(
                    p => p.effect === 'two_weapon_fighting'
                );
                const addAbilityToDamage = hasTwoWeaponFighting;

                // Nick mastery: if off-hand weapon is Light and Nick is available, check if Nick was used this turn
                // If Nick was used, generate the attack as part of the Attack action instead of Bonus Action
                const isLightWeapon = offHandWeapon.properties && offHandWeapon.properties.some(p => p.toLowerCase() === 'light');
                let actionType = 'Bonus Action';
                if (isLightWeapon && playerStats.campaignName) {
                    const nickAvailable = collectWeaponMastery(offBaseName, playerStats);
                    const hasNick = nickAvailable.baseMastery === 'Nick' || (nickAvailable.extraMasteries || []).includes('Nick');
                    if (hasNick) {
                        const currentRound = getCurrentCombatRound();
                        const nickUsedRound = getRuntimeValue(playerStats.name, '_Nick_UsedRound', playerStats.campaignName);
                        if (nickUsedRound === currentRound) {
                            actionType = 'Action';
                        }
                    }
                }

                attacks.push(buildWeaponAttack({
                    weapon: offHandWeapon,
                    weaponName: offHandName,
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

    return attacks;
}
