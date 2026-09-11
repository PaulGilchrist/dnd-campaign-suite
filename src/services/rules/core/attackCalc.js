import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { collectWeaponMastery } from '../../combat/automation/automationPassives.js';
import { buildStarryFormLuminousArrow } from './starryFormDamage.js';
import {
    parseMagicItemName,
    parseDamageDice,
    resolveWeapon,
    weaponHasLight,
    pickHighestDamageWeapon,
    pushWeaponAttacks,
    buildFallbackUnarmedAttacks,
} from './attackWeaponUtils.js';

export { parseMagicItemName, parseDamageDice };

/**
 * Find equipped weapon names filtered by range (Melee or Ranged).
 * @param {Array} allEquipment
 * @param {Array} equipped
 * @param {string} weaponRange - 'Melee' or 'Ranged'
 * @returns {string[]}
 */
export function findEquippedWeapons(allEquipment, equipped, weaponRange) {
    if (equipped == null) { console.error('[attackCalc] Missing array:', equipped); throw new Error('Expected array, got ' + equipped); }
    return equipped.filter(itemName => {
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
        // Weapon category for automation matching ('melee', 'ranged', 'unarmed', or '')
        weaponType = '',
    } = opts;

    const { magicBonus } = parseMagicItemName(weaponName);

    let damage = weapon.damage.damage_dice;
    let damageFormula = `Damage Formula = Weapon (${weapon.damage.damage_dice})`;

    let toHitBonus = abilityBonus + proficiency;
    let hitBonusFormula = `To Hit Bonus Formula = ${abilityName} Bonus (${abilityBonus}) + Proficiency (${proficiency})`;

    // Calculate the total numeric modifier for display (combines ability, magic, and extra damage)
    let totalDamageModifier = 0;
    if (includeAbilityBonusInDamage) {
        totalDamageModifier += abilityBonus;
    }
    if (magicBonus) {
        totalDamageModifier += magicBonus;
        toHitBonus += magicBonus;
        hitBonusFormula += ` + Weapon Magic Bonus (${magicBonus})`;
    }
    if (extraDamage) {
        const extraMatch = extraDamage.match(/([+-]?\d+)$/);
        if (extraMatch) {
            totalDamageModifier += parseInt(extraMatch[1], 10);
        }
    }

    if (magicBonus || includeAbilityBonusInDamage || extraDamage) {
        damage += totalDamageModifier >= 0 ? `+${totalDamageModifier}` : `${totalDamageModifier}`;
    }

    if (magicBonus) {
        if (includeAbilityBonusInDamage) {
            damageFormula += ` + ${abilityName} Bonus (${abilityBonus})`;
        }
        damageFormula += ` + Weapon Magic Bonus (${magicBonus})`;
    } else if (includeAbilityBonusInDamage) {
        damageFormula += ` + ${abilityName} Bonus (${abilityBonus})`;
    }

    if (extraDamage) {
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
        weaponType,
        mastery: weapon.mastery || null,
        properties: weapon.properties || [],
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
            damage: `${diceStr}${dexterityBonus >= 0 ? '+' : ''}${dexterityBonus}`,
            damageType: 'Bludgeoning',
            damageFormula: `Damage Formula = Monk Open Hand (${diceStr}) + Dexterity Bonus (${dexterityBonus})`,
            hitBonus: dexterityBonus + proficiency,
            hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterityBonus}) + Proficiency (${proficiency})`,
            range: 5,
            type: 'Action',
            weaponType: 'unarmed',
        },
        {
            name: 'Unarmed Strike',
            damage: `${diceStr}${dexterityBonus >= 0 ? '+' : ''}${dexterityBonus}`,
            damageType: 'Bludgeoning',
            damageFormula: `Damage Formula = Monk Open Hand (${diceStr}) + Dexterity Bonus (${dexterityBonus})`,
            hitBonus: dexterityBonus + proficiency,
            hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterityBonus}) + Proficiency (${proficiency})`,
            range: 5,
            type: 'Bonus Action',
            weaponType: 'unarmed',
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
/**
 * Resolves a spell's damage string at the given character level.
 * Handles both damage_at_slot_level and damage_at_character_level formats.
 * For cantrips (level 0), selects the highest applicable tier.
 * For leveled spells, selects the base tier.
 * @param {Object} spell - The spell object with damage property
 * @param {number} playerLevel - The character's level
 * @returns {string} The resolved damage string (e.g. "1d10" or "8d6")
 */
export function resolveSpellDamageAtLevel(spell, playerLevel) {
    if (!spell || !spell.damage) return '';
    const slotDmg = spell.damage.damage_at_slot_level;
    const charDmg = spell.damage.damage_at_character_level;
    const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
    if (!dmgObj) return '';
    if (spell.level === 0) {
        const lvls = Object.keys(dmgObj).map(Number).filter(l => l <= playerLevel);
        const bestLevel = lvls.length > 0 ? Math.max(...lvls) : Object.keys(dmgObj)[0];
        return dmgObj[bestLevel];
    }
    return dmgObj[Object.keys(dmgObj)[0]];
}

/**
 * Determines if a spell uses a spell attack or a saving throw.
 * @param {Object} spell - The spell object with dc property
 * @returns {boolean} true if the spell uses a spell attack (no DC)
 */
export function isSpellAttack(spell) {
    return !spell.dc;
}

/**
 * Determines the combat action type from a spell's casting_time.
 * @param {string} castingTime - The spell's casting_time
 * @returns {string} "Action" or "Bonus Action" or null
 */
export function getSpellActionType(castingTime) {
    const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];
    const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];
    if (actionCastingTimes.includes(castingTime)) return 'Action';
    if (bonusActionCastingTimes.includes(castingTime)) return 'Bonus Action';
    return null;
}

/**
 * Build an Action attack for a ranged weapon with Archery / Thrown Weapon Fighting bonuses.
 * @param {Object} weapon
 * @param {string} weaponName
 * @param {Object} ctx - { dexterity, proficiency, fightingStyles, hasThrownWeaponFighting }
 * @returns {Object} attack
 */
function buildRangedActionAttack(weapon, weaponName, ctx) {
    const archeryBonus = ctx.fightingStyles.includes('Archery') ? 2 : 0;
    const thrownProfBonus = ctx.hasThrownWeaponFighting && weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'thrown') ? ctx.proficiency : 0;
    return buildWeaponAttack({
        weapon,
        weaponName,
        abilityBonus: ctx.dexterity.bonus,
        abilityName: 'Dexterity',
        proficiency: ctx.proficiency,
        actionType: 'Action',
        extraHitBonus: archeryBonus + thrownProfBonus,
        extraHitBonusLabel: [
            archeryBonus ? 'Archery Fighting Style (2)' : '',
            thrownProfBonus ? 'Thrown Weapon Fighting (Proficiency)' : ''
        ].filter(Boolean).join(' + ') || '',
    });
}

/**
 * Build all ranged weapon attacks (5e).
 * @param {Object} ctx
 * @returns {Object[]}
 */
function buildRangedAttacks(ctx) {
    const { allEquipment, playerStats, fightingStyles, dexterity, proficiency } = ctx;
    const attacks = [];
    const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
    ctx.rangedCount = rangedWeapons.length;
    ctx.hasThrownWeaponFighting = fightingStyles.includes('Thrown Weapon Fighting');
    if (rangedWeapons.length === 0) return attacks;

    // Separate non-light and light ranged weapons
    const nonLightRanged = rangedWeapons.filter(name => {
        const { weapon } = resolveWeapon(allEquipment, name);
        return weapon && !weaponHasLight(weapon);
    });
    const lightRanged = rangedWeapons.filter(name => weaponHasLight(resolveWeapon(allEquipment, name).weapon));

    // All non-light ranged weapons → Action
    pushWeaponAttacks(attacks, allEquipment, nonLightRanged,
        (weapon, name) => buildRangedActionAttack(weapon, name, ctx));

    if (lightRanged.length === 0) return attacks;

    const hasCrossbowExpert = (playerStats.feats || []).some(f => f && f.toLowerCase && f.toLowerCase().includes('crossbow expert'));

    // < 2 light ranged → all Action
    if (lightRanged.length < 2) {
        pushWeaponAttacks(attacks, allEquipment, lightRanged,
            (weapon, name) => buildRangedActionAttack(weapon, name, ctx));
        return attacks;
    }

    // >= 2 light ranged → highest damage Action, rest Bonus Action
    const bestWeapon = pickHighestDamageWeapon(allEquipment, lightRanged);
    if (bestWeapon) {
        attacks.push(buildRangedActionAttack(bestWeapon.weapon, bestWeapon.name, ctx));
    }
    let bestSkipped = false;
    for (const rangedWeaponName of lightRanged) {
        if (rangedWeaponName === bestWeapon.name && !bestSkipped) {
            bestSkipped = true;
            continue;
        }
        const { baseName, weapon: rangedWeapon } = resolveWeapon(allEquipment, rangedWeaponName);
        if (rangedWeapon) {
            const isHandCrossbow = baseName === 'Hand Crossbow';
            const includeAbilityBonus = hasCrossbowExpert && isHandCrossbow;
            attacks.push(buildWeaponAttack({
                weapon: rangedWeapon,
                weaponName: rangedWeaponName,
                abilityBonus: dexterity.bonus,
                abilityName: 'Dexterity',
                proficiency,
                actionType: 'Bonus Action',
                weaponType: 'ranged',
                includeAbilityBonusInDamage: includeAbilityBonus,
            }));
        }
    }
    return attacks;
}

/**
 * Thrown Weapon Fighting: treat equipped short swords as thrown ranged weapons.
 * @param {Object} ctx
 * @returns {Object[]}
 */
function buildThrownShortSwordAttacks(ctx) {
    const { allEquipment, playerStats, dexterity, proficiency, hasThrownWeaponFighting } = ctx;
    const attacks = [];
    if (!hasThrownWeaponFighting) return attacks;

    for (const equippedName of playerStats.inventory.equipped) {
        if (!equippedName || typeof equippedName !== 'string') continue;
        const { weapon } = resolveWeapon(allEquipment, equippedName);
        if (weapon && weapon.name === 'Short Sword' && weapon.weapon_range === 'Melee') {
            attacks.push(buildWeaponAttack({
                weapon,
                weaponName: equippedName,
                abilityBonus: dexterity.bonus,
                abilityName: 'Dexterity',
                proficiency,
                actionType: 'Action',
                extraHitBonus: proficiency,
                extraHitBonusLabel: 'Thrown Weapon Fighting (Proficiency)',
            }));
            break;
        }
    }
    return attacks;
}

/**
 * Build a main-hand (Action) melee attack with Dueling / Blessed Warrior / Druidic Warrior bonuses.
 * @param {Object} weapon
 * @param {string} weaponName
 * @param {Object} ctx
 * @param {boolean} isDueling
 * @returns {Object} attack
 */
function buildMeleeMainHandAttack(weapon, weaponName, ctx, isDueling) {
    const blessedWarriorHitBonus = ctx.hasBlessedWarrior ? 2 : 0;
    const druidicWarriorDamage = ctx.hasDruidicWarrior ? '+2' : '';
    const druidicWarriorLabel = ctx.hasDruidicWarrior ? 'Druidic Warrior (2)' : '';
    return buildWeaponAttack({
        weapon,
        weaponName,
        abilityBonus: ctx.bonus,
        abilityName: ctx.abilityName,
        proficiency: ctx.proficiency,
        actionType: 'Action',
        weaponType: 'melee',
        extraDamage: [isDueling ? '+2' : '', druidicWarriorDamage].filter(Boolean).join(' + '),
        extraDamageLabel: [isDueling ? 'Dueling Fighting Style (2)' : '', druidicWarriorLabel].filter(Boolean).join(' + ') || '',
        extraHitBonus: blessedWarriorHitBonus,
        extraHitBonusLabel: blessedWarriorHitBonus ? 'Blessed Warrior (2)' : '',
    });
}

/**
 * Resolve off-hand action type, honoring Nick mastery used this round.
 * Reads the runtime store when a campaign is active.
 * @param {string} offBaseName
 * @param {Object} playerStats
 * @returns {string} 'Action' or 'Bonus Action'
 */
function resolveOffHandActionType(offBaseName, playerStats) {
    if (!playerStats.campaignName) return 'Bonus Action';
    const nickAvailable = collectWeaponMastery(offBaseName, playerStats);
    const hasNick = nickAvailable.baseMastery === 'Nick' || (nickAvailable.extraMasteries || []).includes('Nick');
    if (!hasNick) return 'Bonus Action';
    const currentRound = getCurrentCombatRound();
    const nickUsedRound = getRuntimeValue(playerStats.name, '_Nick_UsedRound', playerStats.campaignName);
    return nickUsedRound === currentRound ? 'Action' : 'Bonus Action';
}

/**
 * Build all melee weapon attacks (5e).
 * @param {Object} ctx
 * @returns {Object[]}
 */
function buildMeleeAttacks(ctx) {
    const { allEquipment, playerStats, fightingStyles, rangedCount } = ctx;
    const attacks = [];
    const meleeWeaponNames = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Melee');
    if (meleeWeaponNames.length === 0) return attacks;

    const bonus = Math.max(ctx.strength.bonus, ctx.dexterity.bonus);
    const abilityName = ctx.strength.bonus > ctx.dexterity.bonus ? 'Strength' : 'Dexterity';
    const duelCtx = { ...ctx, bonus, abilityName };
    const isDueling = fightingStyles.includes('Dueling') && meleeWeaponNames.length === 1 && rangedCount === 0;

    // Separate non-light and light melee weapons
    const nonLightMelee = meleeWeaponNames.filter(name => {
        const { weapon } = resolveWeapon(allEquipment, name);
        return weapon && !weaponHasLight(weapon);
    });
    const lightMelee = meleeWeaponNames.filter(name => weaponHasLight(resolveWeapon(allEquipment, name).weapon));

    // All non-light melee weapons → Action
    pushWeaponAttacks(attacks, allEquipment, nonLightMelee,
        (weapon, name) => buildMeleeMainHandAttack(weapon, name, duelCtx, isDueling));

    if (lightMelee.length === 0) return attacks;

    // < 2 light melee → all Action
    if (lightMelee.length < 2) {
        pushWeaponAttacks(attacks, allEquipment, lightMelee,
            (weapon, name) => buildMeleeMainHandAttack(weapon, name, duelCtx, isDueling));
        return attacks;
    }

    // >= 2 light melee → highest damage Action, rest Bonus Action with Nick + Two-Weapon Fighting
    const bestWeapon = pickHighestDamageWeapon(allEquipment, lightMelee);
    if (bestWeapon) {
        attacks.push(buildMeleeMainHandAttack(bestWeapon.weapon, bestWeapon.name, duelCtx, isDueling));
    }

    const isTwoWeapon = fightingStyles.includes('Two-Weapon Fighting');
    const equippedItems = playerStats.inventory?.equipped || [];
    const hasShield = equippedItems.some(name => {
        const parsedName = name.includes('(') ? name.substring(0, name.indexOf('(')).trim() : name;
        return parsedName === 'Shield';
    });
    // Use the highest damage light weapon as "main hand" for TWF check
    const mainHandIsLight = weaponHasLight(bestWeapon?.weapon);

    let bestSkipped = false;
    for (const meleeWeaponName of lightMelee) {
        if (meleeWeaponName === bestWeapon.name && !bestSkipped) {
            bestSkipped = true;
            continue;
        }
        const { baseName: offBaseName, weapon: offHandWeapon } = resolveWeapon(allEquipment, meleeWeaponName);
        if (offHandWeapon) {
            const actionType = resolveOffHandActionType(offBaseName, playerStats);
            const appliesTwoWeapon = isTwoWeapon && mainHandIsLight && !hasShield;
            const blessedWarriorOffHandHitBonus = ctx.hasBlessedWarrior ? 2 : 0;
            const druidicWarriorOffHandLabel = ctx.hasDruidicWarrior ? 'Druidic Warrior (2)' : '';
            attacks.push(buildWeaponAttack({
                weapon: offHandWeapon,
                weaponName: meleeWeaponName,
                abilityBonus: bonus,
                abilityName,
                proficiency: ctx.proficiency,
                actionType,
                weaponType: 'melee',
                includeAbilityBonusInDamage: false,
                extraDamage: [appliesTwoWeapon ? `+${bonus}` : '', ctx.hasDruidicWarrior ? '+2' : ''].filter(Boolean).join(' + '),
                extraDamageLabel: [appliesTwoWeapon ? `Two-Weapon Fighting Style (${bonus})` : '', druidicWarriorOffHandLabel].filter(Boolean).join(' + ') || '',
                extraHitBonus: blessedWarriorOffHandHitBonus,
                extraHitBonusLabel: blessedWarriorOffHandHitBonus ? 'Blessed Warrior (2)' : '',
            }));
        }
    }
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
    const fightingStyles = playerStats.class?.fightingStyles != null ? playerStats.class.fightingStyles : [];

    const ctx = {
        allEquipment,
        playerStats,
        strength,
        dexterity,
        proficiency,
        fightingStyles,
        hasBlessedWarrior: fightingStyles.includes('Blessed Warrior'),
        hasDruidicWarrior: fightingStyles.includes('Druidic Warrior'),
        hasThrownWeaponFighting: false,
        rangedCount: 0,
    };

    const attacks = [
        ...buildRangedAttacks(ctx),
        ...buildThrownShortSwordAttacks(ctx),
        ...buildMeleeAttacks(ctx),
    ];

    // Monk unarmed strikes
    if (playerStats.class?.name === 'Monk') {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const martialArts = classLevel?.class_specific?.martial_arts;
        if (martialArts) {
            const diceStr = `${martialArts.dice_count}d${martialArts.dice_value}`;
            attacks.push(...buildMonkAttacks({ diceStr, dexterityBonus: dexterity.bonus, proficiency }));
        }
    }

    // Fallback unarmed strike when no weapons are equipped
    if (attacks.length === 0) {
        const strMod = strength?.bonus || 0;
        attacks.push(...buildFallbackUnarmedAttacks(strMod, proficiency, fightingStyles.includes('Two-Weapon Fighting'), ctx.hasBlessedWarrior));
    }

    // Starry Form: Archer constellation - ranged spell attack
    const starryArrow = buildStarryFormLuminousArrow(playerStats);
    if (starryArrow) attacks.push(starryArrow);

    return attacks;
}
