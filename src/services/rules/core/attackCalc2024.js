import { findEquippedWeapons, buildWeaponAttack, buildMonkAttacks } from './attackCalc.js';
import {
    resolveWeapon,
    weaponHasLight,
    pickHighestDamageWeapon,
    pushWeaponAttacks,
    buildFallbackUnarmedAttacks,
} from './attackWeaponUtils.js';
import classRules from '../../character/classRules2024.js';
import { checkAnyArmor, checkShieldEquipped } from './speedUtils.js';
import { getCombatSummary, getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { collectWeaponMastery } from '../../combat/automation/automationPassives.js';
import { buildStarryFormLuminousArrow } from './starryFormDamage.js';

/**
 * Build an Action attack for a ranged weapon (2024) with Archery / Thrown Weapon Fighting damage.
 * @param {Object} weapon
 * @param {string} weaponName
 * @param {Object} ctx - { dexterity, proficiency, fightingStyles2024, thrownDamageFor, thrownLabelFor }
 * @returns {Object} attack
 */
function buildRangedActionAttack(weapon, weaponName, ctx) {
    const archeryBonus = ctx.fightingStyles2024.includes('Archery') ? 2 : 0;
    const thrownDamage = ctx.thrownDamageFor(weapon);
    return buildWeaponAttack({
        weapon,
        weaponName,
        abilityBonus: ctx.dexterity.bonus,
        abilityName: 'Dexterity',
        proficiency: ctx.proficiency,
        actionType: 'Action',
        extraHitBonus: archeryBonus,
        extraHitBonusLabel: archeryBonus ? 'Archery Fighting Style (2)' : '',
        extraDamage: thrownDamage,
        extraDamageLabel: ctx.thrownLabelFor(thrownDamage),
    });
}

/**
 * Build all ranged weapon attacks (2024 rules).
 * @param {Object} ctx
 * @returns {Object[]}
 */
function buildRangedAttacks(ctx) {
    const { allEquipment, playerStats, dexterity, proficiency } = ctx;
    const attacks = [];
    const rangedWeapons = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Ranged');
    ctx.rangedCount = rangedWeapons.length;
    if (rangedWeapons.length === 0) return attacks;

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
            const thrownDamage = ctx.thrownDamageFor(rangedWeapon);
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
                extraDamageLabel: ctx.thrownLabelFor(thrownDamage),
            }));
        }
    }
    return attacks;
}

/**
 * Build a main-hand (Action) melee attack (2024) with Dueling / Blessed Warrior / Druidic Warrior bonuses.
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
    const currentRound = getCurrentCombatRound(playerStats.campaignName);
    const nickUsedRound = getRuntimeValue(playerStats.name, '_Nick_UsedRound', playerStats.campaignName);
    return nickUsedRound === currentRound ? 'Action' : 'Bonus Action';
}

/**
 * FT-104: pick the Dual Wielder off-hand weapon: an equipped melee weapon
 * lacking Two-Handed, different from the main hand (highest-damage eligible),
 * with at least one Light weapon among the pair (feats.json trigger
 * attack_action_with_light_weapon).
 * @param {Array} allEquipment
 * @param {string[]} meleeWeaponNames
 * @returns {{ name: string, weapon: Object, magicBonus: number }|null}
 */
function resolveDualWielderOffHand(allEquipment, meleeWeaponNames) {
    const eligible = meleeWeaponNames.filter(name => {
        const { weapon } = resolveWeapon(allEquipment, name);
        return weapon && !(weapon.properties || []).some(p => String(p).toLowerCase() === 'two-handed');
    });
    if (eligible.length < 2) return null;
    if (!eligible.some(name => weaponHasLight(resolveWeapon(allEquipment, name).weapon))) return null;
    const mainHand = pickHighestDamageWeapon(allEquipment, eligible);
    if (!mainHand) return null;
    const mainIdx = eligible.indexOf(mainHand.name);
    const offHandName = eligible.find((name, i) => i !== mainIdx);
    if (!offHandName) return null;
    const { weapon: offHandWeapon, magicBonus } = resolveWeapon(allEquipment, offHandName);
    return { name: offHandName, weapon: offHandWeapon, magicBonus };
}

/**
 * Build a Dual Wielder feat extra bonus action attack.
 * FT-104: canonical buildWeaponAttack shape (type/hitBonus/weaponType/
 * range/properties/mastery) so sheet consumers render the row; damage is
 * dice-only (+magic) per feats.json — no ability modifier unless negative.
 * @param {Object} opts { offHandWeapon, offHandName, magicBonus, abilityBonus, abilityName, proficiency }
 * @returns {Object} attack
 */
function buildDualWielderAttack({ offHandWeapon, offHandName, magicBonus, abilityBonus, abilityName, proficiency }) {
    const dice = offHandWeapon.damage.damage_dice;
    // feats.json: no ability modifier on the extra attack's damage unless negative.
    const negativeMod = abilityBonus < 0 ? abilityBonus : 0;
    const totalMod = magicBonus + negativeMod;
    const dmg = totalMod === 0 ? dice : (totalMod > 0 ? `${dice}+${totalMod}` : `${dice}-${Math.abs(totalMod)}`);
    const formulaParts = [dice];
    if (magicBonus) formulaParts.push(`Weapon Magic Bonus (${magicBonus})`);
    if (negativeMod) formulaParts.push(`${abilityName} Modifier (${negativeMod})`);
    const magicSuffix = magicBonus ? ` + Weapon Magic Bonus (${magicBonus})` : '';
    return {
        name: 'Dual Wielder Extra Attack',
        weaponName: offHandName || offHandWeapon.name,
        attackType: 'melee',
        isRanged: false,
        weaponType: 'melee',
        range: 5,
        toHit: abilityBonus + proficiency + magicBonus,
        hitBonus: abilityBonus + proficiency + magicBonus,
        hitBonusFormula: `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${proficiency})${magicSuffix}`,
        damageFormula: `Damage Formula = ${formulaParts.join(' + ')}`,
        damage: dmg,
        damageType: offHandWeapon.damage.damage_type,
        abilityName,
        type: 'Bonus Action',
        actionType: 'Bonus Action',
        mastery: offHandWeapon.mastery || null,
        properties: offHandWeapon.properties || ['Melee'],
    };
}

function pushDualWielderRow(attacks, dwOffHand, abilityBonus, abilityName, proficiency) {
    if (!dwOffHand) return;
    attacks.push(buildDualWielderAttack({
        offHandWeapon: dwOffHand.weapon,
        offHandName: dwOffHand.name,
        magicBonus: dwOffHand.magicBonus,
        abilityBonus,
        abilityName,
        proficiency,
    }));
}

/**
 * Build all melee weapon attacks (2024 rules).
 * @param {Object} ctx
 * @returns {Object[]}
 */
function isDuelingStyle(fightingStyles2024, meleeCount, rangedCount) {
    return fightingStyles2024.includes('Dueling') && meleeCount === 1 && rangedCount === 0;
}

function buildMeleeAttacks(ctx) {
    const { allEquipment, playerStats, fightingStyles2024, rangedCount } = ctx;
    const attacks = [];
    const meleeWeaponNames = findEquippedWeapons(allEquipment, playerStats.inventory.equipped, 'Melee');
    if (meleeWeaponNames.length === 0) return attacks;

    const bonus = Math.max(ctx.strength.bonus, ctx.dexterity.bonus);
    const abilityName = ctx.strength.bonus > ctx.dexterity.bonus ? 'Strength' : 'Dexterity';
    const duelCtx = { ...ctx, bonus, abilityName };
    const isDueling = isDuelingStyle(fightingStyles2024, meleeWeaponNames.length, rangedCount);

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

    const passives = playerStats.automation?.passives ?? [];
    const addAbilityToDamage = passives.some(p => p.effect === 'two_weapon_fighting');

    // FT-104: Dual Wielder feat row is granted BEFORE the Light-only gate so
    // holders wielding Light + one-handed non-Light (Longsword+Shortsword) get
    // the canonical off-hand bonus row. Non-holders never enter this lane.
    const hasDualWielder = (playerStats.automation?.bonusActions ?? []).some(
        a => a && (a.type === 'dual_wielder_attack' || a.trigger === 'attack_action_with_light_weapon')
    );
    const dwOffHand = hasDualWielder ? resolveDualWielderOffHand(allEquipment, meleeWeaponNames) : null;

    // < 2 light melee → all Action
    if (lightMelee.length < 2) {
        pushWeaponAttacks(attacks, allEquipment, lightMelee,
            (weapon, name) => buildMeleeMainHandAttack(weapon, name, duelCtx, isDueling));
        pushDualWielderRow(attacks, dwOffHand, bonus, abilityName, ctx.proficiency);
        return attacks;
    }

    // >= 2 light melee → highest damage Action, rest Bonus Action with Nick mastery
    const bestWeapon = pickHighestDamageWeapon(allEquipment, lightMelee);
    if (bestWeapon) {
        attacks.push(buildMeleeMainHandAttack(bestWeapon.weapon, bestWeapon.name, duelCtx, isDueling));
    }

    let bestSkipped = false;
    for (const meleeWeaponName of lightMelee) {
        if (meleeWeaponName === bestWeapon.name && !bestSkipped) {
            bestSkipped = true;
            continue;
        }
        const { baseName: offBaseName, weapon: offHandWeapon } = resolveWeapon(allEquipment, meleeWeaponName);
        if (offHandWeapon) {
            const actionType = resolveOffHandActionType(offBaseName, playerStats);
            attacks.push(buildWeaponAttack({
                weapon: offHandWeapon,
                weaponName: meleeWeaponName,
                abilityBonus: bonus,
                abilityName,
                proficiency: ctx.proficiency,
                actionType,
                weaponType: 'melee',
                includeAbilityBonusInDamage: addAbilityToDamage,
            }));
        }
    }

    pushDualWielderRow(attacks, dwOffHand, bonus, abilityName, ctx.proficiency);
    return attacks;
}

/**
 * Tavern Brawler unarmed strikes for non-monk characters.
 * @param {Object} playerStats
 * @param {number} proficiency
 * @param {boolean} hasBlessedWarrior
 * @returns {Object[]}
 */
function buildTavernBrawlerAttacks(playerStats, proficiency, hasBlessedWarrior) {
    const passives = playerStats.automation?.passives ?? [];
    const hasTavernBrawler = passives.some(
        p => p.effect === 'tavern_brawler_push' || p.effect === 'tavern_brawler_reroll_ones'
    );
    if (!hasTavernBrawler || playerStats.class?.name === 'Monk') return [];

    const str = playerStats.abilities.find(a => a.name === 'Strength');
    const strMod = str?.bonus || 0;
    const tbDice = '1d4';
    const blessedWarriorHit = hasBlessedWarrior ? 2 : 0;
    return [{
        name: 'Unarmed Strike',
        damage: `${tbDice}+${strMod}`,
        damageType: 'Bludgeoning',
        damageFormula: `Damage Formula = Tavern Brawler Unarmed Strike (${tbDice}) + Strength Modifier (${strMod})`,
        hitBonus: strMod + proficiency + blessedWarriorHit,
        hitBonusFormula: `To Hit Bonus Formula = Strength Bonus (${strMod}) + Proficiency (${proficiency})${blessedWarriorHit ? ' + Blessed Warrior (2)' : ''}`,
        range: 5,
        type: 'Action',
        weaponType: 'unarmed',
    }];
}

/**
 * College of Dance: Dazzling Footwork unarmed strikes (DEX-based, BI die damage).
 * @param {Object} playerStats
 * @param {Object} dexterity
 * @param {number} proficiency
 * @returns {Object[]}
 */
function buildDanceFootworkAttacks(playerStats, dexterity, proficiency) {
    if (playerStats.class?.name !== 'Bard' || playerStats.class?.subclass?.name !== 'College of Dance' || playerStats.level < 3) return [];
    const classLevel = (playerStats.class?.class_levels ?? []).find(cl => cl.level === playerStats.level);
    const bardicDie = classLevel?.bardic_die || 6;
    const diceStr = `1d${bardicDie}`;
    return buildMonkAttacks({ diceStr, dexterityBonus: dexterity.bonus, proficiency }).map(a => ({
        ...a,
        name: 'Unarmed Strike (Dance)',
        damageFormula: `Damage Formula = Bardic Inspiration Die (${diceStr}) + Dexterity Bonus (${dexterity.bonus})`,
        hitBonusFormula: `To Hit Bonus Formula = Dexterity Bonus (${dexterity.bonus}) + Proficiency (${proficiency})`,
    }));
}

/**
 * Soulknife (2024): Psychic Blade action weapon + bonus action off-hand.
 * @param {Object} playerStats
 * @param {Object} dexterity
 * @param {number} proficiency
 * @returns {Object[]}
 */
function buildPsychicBladeAttacks(playerStats, dexterity, proficiency) {
    if (playerStats.class?.name !== 'Rogue' || playerStats.class?.major?.name !== 'Soulknife' || playerStats.level < 3) return [];

    const dexMod = dexterity?.bonus || 0;
    const intAbility = playerStats.abilities.find(a => a.name === 'Intelligence');
    const intMod = intAbility?.bonus || 0;
    const abilityBonus = Math.max(dexMod, intMod);
    const abilityName = dexMod >= intMod ? 'Dexterity' : 'Intelligence';
    const hitBonusFormula = `To Hit Bonus = ${abilityName} Modifier (${abilityBonus}) + Proficiency (${proficiency})`;
    const bladeProps = {
        attackType: 'melee',
        isRanged: false,
        abilityName,
        properties: ['Finesse', 'Thrown (60/120)'],
        damageType: 'Psychic',
        mastery: 'Vex',
        isPsychicBlade: true,
    };

    return [
        // Psychic Blade (1d6 Psychic, Finesse, Thrown 60/120, Vex) — Action
        {
            name: 'Psychic Blade',
            type: 'Action',
            actionType: 'Action',
            range: '5 ft',
            toHit: abilityBonus + proficiency,
            hitBonus: abilityBonus + proficiency,
            hitBonusFormula,
            damageFormula: `Damage Formula = 1d6 + ${abilityName} Modifier (${abilityBonus})`,
            damage: `1d6+${abilityBonus}`,
            ...bladeProps,
        },
        // Psychic Blade (1d4 Psychic, Finesse, Thrown 60/120, Vex) — Bonus Action (off-hand)
        {
            name: 'Psychic Blade',
            type: 'Bonus Action',
            actionType: 'Bonus Action',
            range: '60 ft',
            toHit: abilityBonus + proficiency,
            hitBonus: abilityBonus + proficiency,
            hitBonusFormula,
            damageFormula: 'Damage Formula = 1d4',
            damage: '1d4',
            ...bladeProps,
        },
    ];
}

/**
 * Find the first equipped bow/bolt weapon for Swift Quiver.
 * @param {Array} allEquipment
 * @param {string[]} equippedWeapons
 * @returns {{ weapon: Object, baseName: string, equippedName: string }|null}
 */
function findSwiftQuiverBow(allEquipment, equippedWeapons) {
    for (const equippedName of equippedWeapons) {
        const { baseName, weapon } = resolveWeapon(allEquipment, equippedName);
        if (!weapon) continue;
        const props = weapon?.properties ?? [];
        const isBow = weapon.weapon_category === 'Ranged' && (props.includes('Ammunition') || props.includes('Heavy') || props.includes('Light'));
        const isBoltWeapon = ['Longbow', 'Light Crossbow', 'Hand Crossbow', 'Crossbow, Heavy', 'Crossbow, Light'].includes(weapon.name);
        if (isBow || isBoltWeapon) {
            return { weapon, baseName, equippedName };
        }
    }
    return null;
}

function resolveSwiftQuiverStats(bowWeapon, dexMod, proficiency) {
    const weapon = bowWeapon?.weapon;
    const rawRange = weapon?.range?.long || weapon?.range?.normal || '80_ft';
    const damageDie = weapon?.damage?.damage_dice || '1d8';
    const damageType = weapon?.damage?.damage_type || 'Piercing';
    return {
        range: typeof rawRange === 'number' ? rawRange : rawRange.replace(/_ft$/, '').replace(/_ft/g, ' ft'),
        damageType,
        damage: `${damageDie}+${dexMod}`,
        hitBonusFormula: `To Hit Bonus = Dexterity Modifier (${dexMod}) + Proficiency (${proficiency})`,
        damageFormula: `Damage Formula = ${damageDie} + Dexterity Modifier (${dexMod})`,
    };
}

function buildSwiftQuiverAttack(name, toHit, stats) {
    return {
        name,
        attackType: 'ranged',
        isRanged: true,
        range: stats.range,
        toHit,
        hitBonus: toHit,
        hitBonusFormula: stats.hitBonusFormula,
        damageFormula: stats.damageFormula,
        damage: stats.damage,
        damageType: stats.damageType,
        abilityName: 'Dexterity',
        type: 'Bonus Action',
        actionType: 'Bonus Action',
        properties: ['Ammunition'],
        isSwiftQuiver: true,
    };
}

/**
 * Swift Quiver: two bonus action ranged attacks while concentration is active.
 * @param {Array} allEquipment
 * @param {Object} playerStats
 * @param {number} proficiency
 * @returns {Object[]}
 */
function buildSwiftQuiverAttacks(allEquipment, playerStats, proficiency) {
    const combatSummary = getCombatSummary(playerStats.campaignName);
    const swiftQuiverCreature = combatSummary?.creatures?.find(c => c.name === playerStats.name);
    const hasSwiftQuiverConcentration = swiftQuiverCreature?.concentration?.spell === 'Swift Quiver';
    if (!hasSwiftQuiverConcentration) return [];

    const dex = playerStats.abilities.find(a => a.name === 'Dexterity');
    const dexMod = dex?.bonus || 0;
    const toHit = dexMod + proficiency;
    const bowWeapon = findSwiftQuiverBow(allEquipment ?? [], playerStats.inventory?.equipped ?? []);
    const stats = resolveSwiftQuiverStats(bowWeapon, dexMod, proficiency);

    return [
        buildSwiftQuiverAttack('Swift Quiver (1st Attack)', toHit, stats),
        buildSwiftQuiverAttack('Swift Quiver (2nd Attack)', toHit, stats),
    ];
}

/**
 * CLA-225: canonical 2024 Martial Arts gate (classes.json lv1) — "Benefits
 * while unarmed or wielding only Monk weapons and not wearing armor or
 * wielding a Shield".
 * @param {Object} playerStats
 * @param {Array} allEquipment
 * @returns {boolean}
 */
function canUseMartialArts(playerStats, allEquipment) {
    if (playerStats.class?.name !== 'Monk') return false;
    const equippedItems = playerStats.inventory?.equipped || [];
    if (checkAnyArmor(equippedItems, allEquipment) || checkShieldEquipped(equippedItems)) return false;
    return equippedItems.every(itemName => {
        const { weapon } = resolveWeapon(allEquipment, itemName);
        const isWeapon = weapon && weapon.equipment_category === 'Weapon';
        return !isWeapon || (weapon.properties || []).some(p => String(p).toLowerCase() === 'monk');
    });
}

/**
 * CLA-225: with the gate open the Martial Arts die replaces the normal
 * damage dice of every Monk weapon attack row, mirroring how the Unarmed
 * Strike rows already receive it from buildMonkAttacks.
 * @param {Object[]} attacks
 * @param {string} diceStr e.g. '1d12'
 */
function applyMartialArtsDie(attacks, diceStr) {
    for (const attack of attacks) {
        if (attack.weaponType === 'unarmed') continue;
        if (!(attack.properties || []).some(p => String(p).toLowerCase() === 'monk')) continue;
        const diceMatch = String(attack.damage || '').match(/^\d+d\d+/);
        if (!diceMatch) continue;
        attack.damage = diceStr + attack.damage.slice(diceMatch[0].length);
        attack.damageFormula = String(attack.damageFormula || '').replace(diceMatch[0], diceStr);
    }
}

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

    const fightingStyles2024 = playerStats.class?.fightingStyles != null ? playerStats.class.fightingStyles : [];
    const hasBlessedWarrior = fightingStyles2024.includes('Blessed Warrior');
    const hasDruidicWarrior = fightingStyles2024.includes('Druidic Warrior');
    // 2024 feats.json canonical: "When you hit with a ranged attack roll using a
    // weapon that has the Thrown property, you gain a +2 bonus to the damage roll."
    const hasThrownWeaponFighting = fightingStyles2024.includes('Thrown Weapon Fighting');
    const thrownDamageFor = (weapon) => (hasThrownWeaponFighting && weapon.properties && weapon.properties.some(p => p.toLowerCase() === 'thrown') ? '+2' : '');
    const thrownLabelFor = (thrownDamage) => (thrownDamage ? 'Thrown Weapon Fighting (2)' : '');

    const ctx = {
        allEquipment,
        playerStats,
        strength,
        dexterity,
        proficiency,
        fightingStyles2024,
        hasBlessedWarrior,
        hasDruidicWarrior,
        thrownDamageFor,
        thrownLabelFor,
        rangedCount: 0,
    };

    const attacks = [
        ...buildRangedAttacks(ctx),
        ...buildMeleeAttacks(ctx),
    ];

    // CLA-225: Martial Arts rows and the Monk weapon die swap are offered
    // only while the canonical gate passes (no armor, no Shield, unarmed or
    // only Monk weapons); armored monks get plain weapon rows with no MA
    // unarmed strikes.
    if (canUseMartialArts(playerStats, allEquipment)) {
        const diceStr = `1d${classRules.getMartialArtsDie(playerStats)}`;
        applyMartialArtsDie(attacks, diceStr);
        attacks.push(...buildMonkAttacks({ diceStr, dexterityBonus: dexterity.bonus, proficiency }));
    }

    // Tavern Brawler: Add unarmed strike attacks for non-monk characters
    attacks.push(...buildTavernBrawlerAttacks(playerStats, proficiency, hasBlessedWarrior));

    // College of Dance: Dazzling Footwork unarmed strikes (DEX-based, BI die damage)
    attacks.push(...buildDanceFootworkAttacks(playerStats, dexterity, proficiency));

    // Soulknife (2024): Psychic Blade action weapon + bonus action off-hand
    attacks.push(...buildPsychicBladeAttacks(playerStats, dexterity, proficiency));

    // Swift Quiver: two bonus action ranged attacks with bow/crossbow while concentration active
    attacks.push(...buildSwiftQuiverAttacks(allEquipment, playerStats, proficiency));

    // Starry Form: Archer constellation - ranged spell attack
    const starryArrow = buildStarryFormLuminousArrow(playerStats);
    if (starryArrow) attacks.push(starryArrow);

    // Fallback unarmed strike when no weapons are equipped
    if (attacks.length === 0) {
        const str = playerStats.abilities?.find(a => a.name === 'Strength');
        const strMod = str?.bonus || 0;
        attacks.push(...buildFallbackUnarmedAttacks(strMod, proficiency, fightingStyles2024.includes('Two-Weapon Fighting'), hasBlessedWarrior));
    }

    return attacks;
}
