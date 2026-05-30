/**
 * Strip magic item prefix (+1, +2, +3) from an item name.
 * @param {string} itemName
 * @returns {{ baseName: string, magicBonus: number }}
 */
export function parseMagicItemName(itemName) {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
        const magicBonus = Number(itemName.charAt(1));
        return {
            baseName: itemName.substring(3),
            magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
        };
    }
    return { baseName: itemName, magicBonus: 0 };
}

/**
 * Find equipped weapon names filtered by range (Melee or Ranged).
 * @param {Array} allEquipment
 * @param {Array} equipped
 * @param {string} weaponRange - 'Melee' or 'Ranged'
 * @returns {string[]}
 */
export function findEquippedWeapons(allEquipment, equipped, weaponRange) {
    return (equipped || []).filter(itemName => {
        if (!itemName || typeof itemName !== 'string') return false;
        const { baseName } = parseMagicItemName(itemName);
        const item = allEquipment.find(item => item.name === baseName);
        return item && item.equipment_category === 'Weapon' && item.weapon_range === weaponRange;
    });
}

/**
 * Build a weapon attack object from the given parameters.
 * @param {Object} opts
 * @returns {Object} attack
 */
export function buildWeaponAttack(opts) {
    const {
        weapon,
        weaponName,
        abilityBonus,
        abilityName,
        proficiency,
        actionType,
        // Extra damage components (e.g., Dueling +2, Two-Weapon Fighting +bonus)
        extraDamage = '',
        extraDamageLabel = '',
        // Extra hit bonus components (e.g., Archery +2)
        extraHitBonus = 0,
        extraHitBonusLabel = '',
        // When false, skip adding ability bonus to damage string (used for off-hand)
        includeAbilityBonusInDamage = true,
    } = opts;

    const { magicBonus } = parseMagicItemName(weaponName);

    let damage = weapon.damage.damage_dice;
    let damageFormula = `Damage Formula = Weapon (${weapon.damage.damage_dice})`;

    let toHitBonus = abilityBonus + proficiency;
    let hitBonusFormula = `To Hit Bonus Formula = ${abilityName} Bonus (${abilityBonus}) + Proficiency (${proficiency})`;

    if (magicBonus) {
        if (includeAbilityBonusInDamage) {
            damage += `+${abilityBonus + magicBonus}`;
            damageFormula += ` + ${abilityName} Bonus (${abilityBonus}) + Weapon Magic Bonus (${magicBonus})`;
        } else {
            damage += `+${magicBonus}`;
            damageFormula += ` + Weapon Magic Bonus (${magicBonus})`;
        }
        toHitBonus += magicBonus;
        hitBonusFormula += ` + Weapon Magic Bonus (${magicBonus})`;
    } else if (includeAbilityBonusInDamage) {
        damage += `+${abilityBonus}`;
        damageFormula += ` + ${abilityName} Bonus (${abilityBonus})`;
    }

    if (extraDamage) {
        damage += extraDamage;
        damageFormula += ` + ${extraDamageLabel}`;
    }

    if (extraHitBonus) {
        toHitBonus += extraHitBonus;
        hitBonusFormula += ` + ${extraHitBonusLabel}`;
    }

    return {
        name: weaponName,
        damage,
        damageType: weapon.damage.damage_type,
        damageFormula,
        hitBonus: toHitBonus,
        hitBonusFormula,
        range: weapon.range.normal,
        type: actionType,
    };
}

/**
 * Build monk unarmed strike attacks.
 * @param {Object} opts
 * @returns {Object[]} two attack objects (Action and Bonus Action)
 */
export function buildMonkAttacks(opts) {
    const { diceStr, dexterityBonus, proficiency } = opts;

    return [
        {
            name: 'Unarmed Strike',
            damage: `${diceStr}+${dexterityBonus}`,
            damageType: 'Bludgeoning',
            damageFormula: `Damage Formula = Monk Open Hand (${diceStr}) + Dexterity Bonus (${dexterityBonus})`,
            hitBonus: dexterityBonus + proficiency,
            hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterityBonus}) + Proficiency (${proficiency})`,
            range: 5,
            type: 'Action',
        },
        {
            name: 'Unarmed Strike',
            damage: `${diceStr}+${dexterityBonus}`,
            damageType: 'Bludgeoning',
            damageFormula: `Damage Formula = Monk Open Hand (${diceStr}) + Dexterity Bonus (${dexterityBonus})`,
            hitBonus: dexterityBonus + proficiency,
            hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterityBonus}) + Proficiency (${proficiency})`,
            range: 5,
            type: 'Bonus Action',
        },
    ];
}

/**
 * Build spell attack entries from prepared/always spells.
 * @param {Array} playerSpells - player's spell list with .name and .prepared
 * @param {Array} allSpells - full spell catalog
 * @param {Object} spellAbilities - { modifier }
 * @returns {Object[]}
 */
export function buildSpellAttacks(playerSpells, allSpells, spellAbilities) {
    const attacks = [];

    const spells = (playerSpells || []).map(spell => {
        const spellDetail = allSpells.find(d => d.name === spell.name);
        if (spellDetail) return { ...spellDetail, prepared: spell.prepared };
        return { ...spell };
    }).filter(s => s.damage && (s.prepared === 'Always' || s.prepared === 'Prepared'));

    spells.forEach(spell => {
        if (attacks.find(a => a.name === spell.name)) return;

        let damage = '';
        const slotDmg = spell.damage.damage_at_slot_level;
        const charDmg = spell.damage.damage_at_character_level;
        const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
        if (dmgObj) {
            damage = dmgObj[Object.keys(dmgObj)[0]];
        }

        const attackEntry = {
            name: spell.name,
            damage,
            damageType: spell.damage.damage_type,
            range: spell.range,
            type: spell.casting_time,
         };

        // Only include spells cast as an Action or Bonus Action in the attacks list
        const isCombatCastingTime = ['1 action', 'Action', '1 bonus action', 'Bonus Action'].includes(attackEntry.type);
        if (!isCombatCastingTime) return;

        attackEntry.type = (attackEntry.type === '1 action' || attackEntry.type === 'Action') ? 'Action' : 'Bonus Action';

        if (spell.dc) {
            attackEntry.saveDc = spellAbilities.saveDc;
            attackEntry.saveType = spell.dc.dc_type;
            attackEntry.saveSuccess = spell.dc.dc_success;
         } else {
            attackEntry.hitBonus = spellAbilities.modifier;
         }
        attacks.push(attackEntry);
    });

    return attacks;
}

/**
 * Build all attack entries for a character (5e rules).
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
}
