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
        if (spell.damage.damage_at_slot_level) {
            damage = spell.damage.damage_at_slot_level[Object.keys(spell.damage.damage_at_slot_level)[0]];
        } else if (spell.damage.damage_at_character_level) {
            damage = spell.damage.damage_at_character_level[Object.keys(spell.damage.damage_at_character_level)[0]];
        }

        attacks.push({
            name: spell.name,
            damage,
            damageType: spell.damage.damage_type,
            hitBonus: spellAbilities.modifier,
            range: spell.range,
            type: spell.casting_time === '1 action' ? 'Action' : 'Bonus Action',
        });
    });

    return attacks;
}
