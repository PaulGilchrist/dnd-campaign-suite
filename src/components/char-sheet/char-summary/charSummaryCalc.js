import rulesFactory from '../../../services/rules/rulesFactory.js'
import { parseMagicItemName } from '../../../services/rules/core/attackCalc.js'
import { getProtectionFromEnergyDamageType } from '../../../services/automation/handlers/buffs/protectionFromEnergyHandler.js'
import { getResistanceDamageType } from '../../../services/automation/handlers/buffs/resistanceHandler.js'
import { getStoneSkinDamageTypes } from '../../../services/automation/handlers/buffs/stoneSkinHandler.js'
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

const NON_GENERIC_FLY_EFFECTS = ['fly_speed_20_hover', 'telekinetic_leap', 'avenging_angel_flight', 'dragon_wings']

const RAGE_RESISTANCE_BUFF_NAMES = ['Rage', 'Rage of the Wilds', 'Rage of the Gods', 'Superior Defense']

const LATER_RESISTANCE_BUFF_NAMES = [
    'Aura of Life', 'Aura of Purity', 'Feign Death', "Heroes' Feast",
    'Protection from Poison', 'Stone Skin'
]

const CONDITION_IMMUNITY_BUFF_NAMES = ['Calm Emotions', 'Feign Death', "Heroes' Feast", 'Heroism', 'Faerie Fire']

function isGenericFlyBuff(buff) {
    return !!buff.flySpeed && !NON_GENERIC_FLY_EFFECTS.includes(buff.effect)
}

function computeFlyBuffInfo(activeBuffs) {
    const flyBuff = Array.isArray(activeBuffs)
        ? activeBuffs.find(b => b.effect === 'fly_speed_equals_walk_speed' || isGenericFlyBuff(b))
        : null
    return { flyBuffActive: !!flyBuff, flyBuffName: flyBuff?.name || '' }
}

function isShapeShiftBuff(buff) {
    return buff.effect === 'shape_shift' || buff.effect === 'large_form'
}

// Circle Forms AC override: 13 + WIS modifier when shape_shift is active for Circle of the Moon
function computeCircleFormsACOverride(playerStats, activeBuffs) {
    const isMoonDruid = playerStats.class?.major?.name === 'Moon' || playerStats.class?.subclass?.name === 'Moon'
    if (!isMoonDruid || !(Array.isArray(activeBuffs) && activeBuffs.some(isShapeShiftBuff))) return null
    const wis = playerStats.abilities.find(a => a.name === 'Wisdom')
    return 13 + (wis?.bonus ?? 0)
}

function getBaseSpeed(playerStats) {
    return playerStats.race.subrace && playerStats.race.subrace.speed ? playerStats.race.subrace.speed : playerStats.race.speed
}

// Check if character is wearing armor or wielding a shield (for Unarmored Movement)
function computeHasArmorOrShield(playerStats) {
    const equippedItems = playerStats.inventory?.equipped || []
    const allEquipment = playerStats.equipment || []
    for (const itemName of equippedItems) {
        const baseName = parseMagicItemName(itemName).baseName
        const item = allEquipment.find(eq => eq.name === baseName)
        if (item && item.equipment_category === 'Armor') return true
        if (baseName === 'Shield') return true
    }
    return false
}

function applyClassSpeedBonuses(playerStats, speed, hasArmorOrShield) {
    if (playerStats.class.name === 'Monk') {
        const { classRules: cr } = rulesFactory.getRules(playerStats)
        if (typeof cr.getUnarmoredMovementIncrease === 'function') {
            const unarmoredMovementIncrease = cr.getUnarmoredMovementIncrease(playerStats)
            if (!hasArmorOrShield) speed += unarmoredMovementIncrease
        }
    }
    if (playerStats.class.name === 'Barbarian') {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1]
        const unarmoredMovement = classLevel?.class_specific?.unarmored_movement || 0
        if (!hasArmorOrShield) speed += unarmoredMovement
    }
    return speed
}

function isWearingHeavyArmor(playerStats) {
    if (playerStats.equipment) {
        return playerStats.equipment.find(eq => playerStats.inventory.equipped?.includes(eq.name) && eq.armor_category === 'Heavy')
    }
    return playerStats.armorClassFormula?.includes('Heavy') || false
}

function passiveSpeedContribution(playerStats, passive, hasArmorOrShield) {
    if (passive.type !== 'passive_buff') return 0
    if (passive.effect === 'speed_bonus') {
        const bonus = passive.bonusExpression ? parseInt(passive.bonusExpression, 10) : 10
        if (passive.condition === 'no_heavy_armor') return isWearingHeavyArmor(playerStats) ? 0 : bonus
        if (passive.condition === 'no_armor_no_shield') return hasArmorOrShield ? 0 : bonus
        return 0
    }
    if (passive.effect === 'speed_increase' && passive.bonusExpression) {
        const bonus = parseInt(passive.bonusExpression, 10)
        return isNaN(bonus) ? 0 : bonus
    }
    return 0
}

// Apply passive_buff speed_bonus / speed_increase effects (e.g., Fast Movement: +10 speed without heavy armor)
function computePassiveSpeedBonus(playerStats, hasArmorOrShield) {
    let buffSpeedBonus = 0
    for (const passive of playerStats.automation?.passives || []) {
        buffSpeedBonus += passiveSpeedContribution(playerStats, passive, hasArmorOrShield)
    }
    return buffSpeedBonus
}

function applySpeedConditions(speed, conditionEffects, exhaustionLevel) {
    let result = Math.max(0, speed - (5 * exhaustionLevel))
    if (conditionEffects?.speedZero) return 0
    if (conditionEffects?.speedHalved) result = Math.floor(result / 2)
    if (conditionEffects?.speedReduction) result = Math.max(0, result - conditionEffects.speedReduction)
    return result
}

function resistancesFromBuffs(activeBuffs, matches) {
    if (!Array.isArray(activeBuffs)) return []
    return activeBuffs.filter(b => matches(b) && b.resistanceTypes?.length).flatMap(b => b.resistanceTypes)
}

function conditionImmunitiesFromBuff(activeBuffs, name) {
    if (!Array.isArray(activeBuffs)) return []
    return (activeBuffs.find(b => b.name === name)?.conditionImmunity || []).map(c => String(c).toLowerCase())
}

function singleToArray(value) {
    return value ? [value] : []
}

function collectElementalAdeptTypes(playerStats, campaignName) {
    return (playerStats.automation?.passives || [])
        .filter(p => p.type === 'damage_type_choice' && p.effect === 'elemental_adept')
        .map(p => {
            const key = '_' + (p.name || '').replace(/\s+/g, '_') + '_chosenType'
            return getRuntimeValue(playerStats.name, key, campaignName)
        })
        .filter(Boolean)
}

function collectRageConditionalImmunities(playerStats, activeBuffs) {
    if (!Array.isArray(activeBuffs) || !activeBuffs.some(b => b.name === 'Rage')) return []
    return (playerStats.automationConditionalImmunities || [])
        .filter(ci => ci.requiresActive === 'Rage')
        .flatMap(ci => ci.immunities || [])
}

function computeResistances(playerStats, activeBuffs, campaignName, auraComboEffects) {
    const stormbornResistances = (playerStats.automation?.passives || [])
        .filter(p => p.type === 'resistance' && p.name === 'Stormborn')
        .flatMap(p => p.damageTypes || [])

    const wrathOfTheSeaActive = getRuntimeValue(playerStats.name, 'wrathOfTheSeaActive', campaignName)
    const stormbornResistancesActive = wrathOfTheSeaActive && stormbornResistances.length > 0
        ? stormbornResistances
        : []

    const epitomeResistanceType = getRuntimeValue(playerStats.name, 'epitomeResistanceType', campaignName)
    const fiendishResilienceType = getRuntimeValue(playerStats.name, '_Fiendish_Resilience_chosenType', campaignName)
    const boonEnergyResistanceTypes = getRuntimeValue(playerStats.name, '_Energy_Resistances_chosenTypes', campaignName) || []

    const elementalAdeptTypes = collectElementalAdeptTypes(playerStats, campaignName)

    const rageConditionalImmunities = collectRageConditionalImmunities(playerStats, activeBuffs)

    const resistanceDamageType = getResistanceDamageType(playerStats.name, campaignName)
    const protectionFromEnergyDamageType = getProtectionFromEnergyDamageType(playerStats.name, campaignName)
    const stoneSkinDamageTypes = getStoneSkinDamageTypes(playerStats.name, campaignName) || []

    const allImmunities = [...new Set([
        ...(playerStats.immunities || []),
        ...(auraComboEffects?.immunities || []),
        ...(playerStats.automationConditionImmunities || []),
        ...rageConditionalImmunities,
        ...CONDITION_IMMUNITY_BUFF_NAMES.map(name => conditionImmunitiesFromBuff(activeBuffs, name)).flat()
    ])]

    const rageResistances = RAGE_RESISTANCE_BUFF_NAMES.map(name => resistancesFromBuffs(activeBuffs, b => b.name === name)).flat()
    const laterResistances = LATER_RESISTANCE_BUFF_NAMES.map(name => resistancesFromBuffs(activeBuffs, b => b.name === name)).flat()

    const allResistances = [...new Set([
        ...(playerStats.resistances || []),
        ...(auraComboEffects?.resistances || []),
        ...stormbornResistancesActive,
        ...rageResistances,
        ...singleToArray(epitomeResistanceType),
        ...singleToArray(fiendishResilienceType),
        ...singleToArray(resistanceDamageType),
        ...singleToArray(protectionFromEnergyDamageType),
        ...boonEnergyResistanceTypes,
        ...elementalAdeptTypes,
        ...laterResistances,
        ...stoneSkinDamageTypes,
        ...resistancesFromBuffs(activeBuffs, b => b.effect === 'warding_bond'),
        ...resistancesFromBuffs(activeBuffs, b => b.name === 'Starry Form')
    ])]

    return {
        allImmunities, allResistances,
        auraResistances: auraComboEffects?.resistances || [],
        auraResistanceSource: auraComboEffects?.resistanceSource || null,
        heroesFeastResistances: resistancesFromBuffs(activeBuffs, b => b.name === "Heroes' Feast"),
        heroesFeastConditionImmunities: conditionImmunitiesFromBuff(activeBuffs, "Heroes' Feast"),
        wrathOfTheSeaActive
    }
}

const buffEffectHandlers = new Map([
    ['fly_speed_equals_walk_speed', (buff, acc) => { acc.hasFlySpeedBuff = true }],
    ['fly_speed_20_hover', (buff, acc) => { acc.flySpeed = 20; acc.starryFormHover = true }],
    ['telekinetic_leap', (buff, acc) => { acc.flySpeed = buff.flySpeed }],
    ['avenging_angel_flight', (buff, acc) => { acc.flySpeed = buff.flySpeed || 60 }],
    ['speed_boost', (buff, acc) => { if (buff.speedBonus) acc.buffSpeedBonus += buff.speedBonus }],
    ['large_form', (buff, acc) => { acc.buffSpeedBonus += 10 }],
    ['mage_armor', (buff, acc) => { acc.mageArmorActive = true; acc.mageArmorAc = buff.baseAc || 13 }],
    ['shield', (buff, acc) => { acc.shieldAcBonus = 5 }],
    ['barkskin', (buff, acc) => { acc.barkskinActive = true }],
    ['defensive_duelist', (buff, acc) => { if (buff.acBonus) acc.defensiveDuelistBonus += buff.acBonus }],
    ['ice_walk', (buff, acc) => { acc.iceWalkActive = true }],
    ['glistening_flight', (buff, acc) => { acc.hasFlySpeedBuff = true; acc.glisteningFlightHover = true }],
    ['dragon_wings', (buff, acc) => { acc.flySpeed = buff.flySpeed || 60; acc.dragonWingsHover = true }],
    ['aquatic_adaptation', (buff, acc) => { acc.swimSpeed = acc.speed * 2 }],
    ['tremorsense_60ft', (buff, acc) => { acc.tremorsenseActive = true }]
])

function applyBuffEffect(buff, acc) {
    const handler = buffEffectHandlers.get(buff.effect)
    if (handler) handler(buff, acc)
    if (isGenericFlyBuff(buff)) acc.hasFlySpeedBuff = true
}

function applyMovementPassives(playerStats, acc, hasArmorOrShield, wrathOfTheSeaActive) {
    let acrobaticMovementActive = false
    const acrobaticMovementPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'acrobatic_movement')
    if (acrobaticMovementPassive && !hasArmorOrShield) acrobaticMovementActive = true

    const elementalMovementPassive = (playerStats.passives || []).find(p => p.effect === 'elemental_attunement_movement')
    if (elementalMovementPassive) {
        acc.hasFlySpeedBuff = true
        acc.swimSpeed = acc.speed
    }

    const aquaticAffinityPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'aquatic_affinity')
    if (aquaticAffinityPassive && acc.swimSpeed === null) acc.swimSpeed = acc.speed

    const stormbornPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'fly_speed_equals_walk_speed')
    if (stormbornPassive && acc.flySpeed === null && wrathOfTheSeaActive) acc.hasFlySpeedBuff = true

    return acrobaticMovementActive
}

function deriveAspectSpeeds(aspectOption, totalSpeed, acc, playerStats) {
    let climbSpeed = null
    if (aspectOption === 'Panther') climbSpeed = totalSpeed + acc.buffSpeedBonus
    if (!climbSpeed && playerStats.climbSpeed) climbSpeed = playerStats.climbSpeed
    if (aspectOption === 'Salmon' && acc.swimSpeed === null) acc.swimSpeed = totalSpeed + acc.buffSpeedBonus
    if (!acc.swimSpeed && playerStats.swimSpeed) acc.swimSpeed = playerStats.swimSpeed
    return climbSpeed
}

function computeMovementSection(playerStats, activeBuffs, hasArmorOrShield, speed, totalSpeed, buffSpeedBonus, auraSpeedBonus, wrathOfTheSeaActive) {
    const largeFormActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'large_form')
    const huntersMarkActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === "Hunter's Mark")
    const aspectOption = Array.isArray(activeBuffs) ? (activeBuffs.find(b => b.name === 'Aspect of the Wilds')?.optionName || null) : null

    const acc = {
        flySpeed: null, hasFlySpeedBuff: false, swimSpeed: null,
        buffSpeedBonus, speed,
        hasteAcBonus: 0, shieldAcBonus: 0, defensiveDuelistBonus: 0,
        barkskinActive: false, mageArmorActive: false, mageArmorAc: 0,
        iceWalkActive: false, glisteningFlightHover: false, dragonWingsHover: false,
        starryFormHover: false, tremorsenseActive: false
    }
    activeBuffs.forEach(buff => applyBuffEffect(buff, acc))

    const climbSpeed = deriveAspectSpeeds(aspectOption, totalSpeed, acc, playerStats)

    if (activeBuffs.some(b => b.effect === 'haste')) {
        acc.speed = acc.speed * 2
        acc.hasteAcBonus = 2
    }
    const totalSpeedWithHaste = acc.speed + auraSpeedBonus

    const shieldOfFaithActive = activeBuffs.some(b => b.effect === 'shield_of_faith')
    const shieldOfFaithBonus = shieldOfFaithActive ? 2 : 0

    const acrobaticMovementActive = applyMovementPassives(playerStats, acc, hasArmorOrShield, wrathOfTheSeaActive)

    const totalSpeedWithBuff = totalSpeedWithHaste + acc.buffSpeedBonus
    if (acc.hasFlySpeedBuff) acc.flySpeed = totalSpeedWithBuff

    return {
        flySpeed: acc.flySpeed, hasFlySpeedBuff: acc.hasFlySpeedBuff,
        swimSpeed: acc.swimSpeed, climbSpeed,
        buffSpeedBonus: acc.buffSpeedBonus,
        hasteAcBonus: acc.hasteAcBonus, shieldAcBonus: acc.shieldAcBonus,
        defensiveDuelistBonus: acc.defensiveDuelistBonus,
        barkskinActive: acc.barkskinActive, mageArmorActive: acc.mageArmorActive, mageArmorAc: acc.mageArmorAc,
        iceWalkActive: acc.iceWalkActive, glisteningFlightHover: acc.glisteningFlightHover,
        dragonWingsHover: acc.dragonWingsHover, starryFormHover: acc.starryFormHover,
        tremorsenseActive: acc.tremorsenseActive,
        acrobaticMovementActive, largeFormActive, huntersMarkActive,
        shieldOfFaithActive, shieldOfFaithBonus,
        dexBonus: playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0,
        seeInvisibilityActive: Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'see_invisibility'),
        totalSpeedWithBuff
    }
}

function computeBaitAndSwitch(playerStats, campaignName) {
    const baitAndSwitchActive = getRuntimeValue(playerStats.name, 'baitAndSwitchActive', campaignName)
    const baitAndSwitchBonusValue = getRuntimeValue(playerStats.name, 'baitAndSwitchBonus', campaignName)
    const baitAndSwitchSource = getRuntimeValue(playerStats.name, 'baitAndSwitchSource', campaignName)
    let baitAndSwitchBonus = 0
    if (baitAndSwitchActive && baitAndSwitchBonusValue) {
        baitAndSwitchBonus = Number(baitAndSwitchBonusValue)
    }
    return { baitAndSwitchActive, baitAndSwitchBonusValue, baitAndSwitchSource, baitAndSwitchBonus }
}

function checkSmiteOfProtectionCover(characters, campaignName) {
    if (!characters) return false
    // Cover source badges — buff-based cover that applies against all attackers
    for (const other of characters) {
        if (!getRuntimeValue(other.name, 'smiteOfProtectionActive', campaignName)) continue
        if (!other.computedStats?.automation?.passives?.some(p => p.name === 'Aura of Protection')) continue
        return true
    }
    return false
}

function checkBulwarkOfForce(other, playerName) {
    if (!getRuntimeValue(other.name, 'bulwarkOfForceActive')) return false
    const bulwarkTargets = getRuntimeValue(other.name, 'bulwarkOfForceTargets') || []
    return bulwarkTargets.includes(playerName)
}

function checkNaturesSanctuary(other, playerName, campaignName) {
    const sanctuaryCreatures = getRuntimeValue(other.name, 'naturesSanctuaryCreatures', campaignName) || []
    return sanctuaryCreatures.includes(playerName)
}

function computeCoverBadges(playerStats, characters, campaignName) {
    const cover = { bulwarkOfForceCoverActive: false, naturesSanctuaryCoverActive: false }
    if (!characters) return cover
    for (const other of characters) {
        if (other.name === playerStats.name) continue
        if (!cover.bulwarkOfForceCoverActive && checkBulwarkOfForce(other, playerStats.name)) {
            cover.bulwarkOfForceCoverActive = true
        }
        if (!cover.naturesSanctuaryCoverActive && checkNaturesSanctuary(other, playerStats.name, campaignName)) {
            cover.naturesSanctuaryCoverActive = true
        }
        if (cover.bulwarkOfForceCoverActive && cover.naturesSanctuaryCoverActive) break
    }
    return cover
}

export function computeCharSummaryContext(playerStats, campaignName, characters, conditionEffects, auraComboEffects, exhaustionLevel) {
    const storedBuffs = getActiveBuffs(playerStats.name, campaignName);
    const runtimeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(runtimeBuffs) ? runtimeBuffs : storedBuffs;

    const flyInfo = computeFlyBuffInfo(activeBuffs)
    const circleFormsACOverride = computeCircleFormsACOverride(playerStats, activeBuffs)

    const hasArmorOrShield = computeHasArmorOrShield(playerStats)
    let speed = applyClassSpeedBonuses(playerStats, getBaseSpeed(playerStats), hasArmorOrShield)
    let buffSpeedBonus = computePassiveSpeedBonus(playerStats, hasArmorOrShield)

    speed = applySpeedConditions(speed, conditionEffects, exhaustionLevel)
    const auraSpeedBonus = auraComboEffects?.speedBonus || 0
    const auraSpeedSource = auraComboEffects?.speedSource || null
    const totalSpeed = speed + auraSpeedBonus

    const resistances = computeResistances(playerStats, activeBuffs, campaignName, auraComboEffects)
    const movement = computeMovementSection(playerStats, activeBuffs, hasArmorOrShield, speed, totalSpeed, buffSpeedBonus, auraSpeedBonus, resistances.wrathOfTheSeaActive)
    buffSpeedBonus = movement.buffSpeedBonus

    const baitAndSwitch = computeBaitAndSwitch(playerStats, campaignName)
    const smiteOfProtectionCoverActive = checkSmiteOfProtectionCover(characters, campaignName)
    const cover = computeCoverBadges(playerStats, characters, campaignName)

    const effectiveInitiative = playerStats.initiative - (2 * exhaustionLevel)

    return {
        ...flyInfo,
        circleFormsACOverride,
        buffSpeedBonus, auraSpeedBonus, auraSpeedSource,
        ...resistances,
        ...movement,
        ...baitAndSwitch,
        ...cover,
        smiteOfProtectionCoverActive,
        effectiveInitiative
    };
}
