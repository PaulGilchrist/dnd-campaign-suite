import rulesFactory from '../../../services/rules/rulesFactory.js'
import { parseMagicItemName } from '../../../services/rules/core/attackCalc.js'
import { getProtectionFromEnergyDamageType } from '../../../services/automation/handlers/buffs/protectionFromEnergyHandler.js'
import { getResistanceDamageType } from '../../../services/automation/handlers/buffs/resistanceHandler.js'
import { getStoneSkinDamageTypes } from '../../../services/automation/handlers/buffs/stoneSkinHandler.js'
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'

export function computeCharSummaryContext(playerStats, campaignName, characters, conditionEffects, auraComboEffects, exhaustionLevel) {
    const storedBuffs = getActiveBuffs(playerStats.name, campaignName);
    const runtimeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(runtimeBuffs) ? runtimeBuffs : storedBuffs;
    const flyBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.effect === 'fly_speed_equals_walk_speed' || (b.flySpeed && !['fly_speed_20_hover', 'telekinetic_leap', 'avenging_angel_flight', 'dragon_wings'].includes(b.effect))) : null;
    const flyBuffActive = !!flyBuff;
    const flyBuffName = flyBuff?.name || '';
    
    // Circle Forms AC override: 13 + WIS modifier when shape_shift is active for Circle of the Moon
    const isMoonDruid = playerStats.class?.major?.name === 'Moon' || playerStats.class?.subclass?.name === 'Moon';
    const shapeShiftActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shape_shift' || b.effect === 'large_form');
    let circleFormsACOverride = null;
    if (isMoonDruid && shapeShiftActive) {
        const wis = playerStats.abilities.find(a => a.name === 'Wisdom');
        const wisMod = wis?.bonus ?? 0;
        circleFormsACOverride = 13 + wisMod;
    }
    let speed = playerStats.race.subrace && playerStats.race.subrace.speed ? playerStats.race.subrace.speed : playerStats.race.speed;
    
    // Check if character is wearing armor or wielding a shield (for Unarmored Movement)
    const equippedItems = playerStats.inventory?.equipped || [];
    const allEquipment = playerStats.equipment || [];
    let isWearingArmor = false;
    let isWieldingShield = false;
    for (const itemName of equippedItems) {
        const parsedName = parseMagicItemName(itemName);
        const baseName = parsedName.baseName;
        const item = allEquipment.find(eq => eq.name === baseName);
        if (item && item.equipment_category === 'Armor') {
            isWearingArmor = true;
            break;
        }
        if (baseName === 'Shield') {
            isWieldingShield = true;
            break;
        }
    }
    const hasArmorOrShield = isWearingArmor || isWieldingShield;
    
    if (playerStats.class.name === 'Monk') {
        const { classRules: cr } = rulesFactory.getRules(playerStats);
        if (typeof cr.getUnarmoredMovementIncrease === 'function') {
            const unarmoredMovementIncrease = cr.getUnarmoredMovementIncrease(playerStats);
            if (!hasArmorOrShield) {
                speed += unarmoredMovementIncrease;
            }
         }
     }
        if (playerStats.class.name === 'Barbarian') {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const unarmoredMovement = classLevel?.class_specific?.unarmored_movement || 0;
        if (!hasArmorOrShield) {
            speed += unarmoredMovement;
        }
      }
    
    // Apply passive_buff speed_bonus effects (e.g., Fast Movement: +10 speed without heavy armor)
    let buffSpeedBonus = 0;
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
      if (passive.type === 'passive_buff' && passive.effect === 'speed_bonus') {
        const bonus = passive.bonusExpression ? parseInt(passive.bonusExpression, 10) : 10;
        if (passive.condition === 'no_heavy_armor') {
          const isWearingHeavy = playerStats.equipment
            ? playerStats.equipment.find(eq => playerStats.inventory.equipped?.includes(eq.name) && eq.armor_category === 'Heavy')
            : (playerStats.armorClassFormula?.includes('Heavy') || false);
          if (!isWearingHeavy) {
            buffSpeedBonus += bonus;
          }
        } else if (passive.condition === 'no_armor_no_shield') {
          if (!hasArmorOrShield) {
            buffSpeedBonus += bonus;
          }
        }
      }
      if (passive.type === 'passive_buff' && passive.effect === 'speed_increase' && passive.bonusExpression) {
        const bonus = parseInt(passive.bonusExpression, 10);
        if (!isNaN(bonus)) {
          buffSpeedBonus += bonus;
        }
      }
    }
    
    speed = Math.max(0, speed - (5 * exhaustionLevel));
    if (conditionEffects?.speedZero) speed = 0;
    if (conditionEffects?.speedHalved) speed = Math.floor(speed / 2);
    if (conditionEffects?.speedReduction) speed = Math.max(0, speed - conditionEffects.speedReduction);
    const auraSpeedBonus = auraComboEffects?.speedBonus || 0;
    const auraSpeedSource = auraComboEffects?.speedSource || null;
    const totalSpeed = speed + auraSpeedBonus;
    
    const baseImmunities = playerStats.immunities || [];
    const auraImmunities = auraComboEffects?.immunities || [];
    
    const baseResistances = playerStats.resistances || [];
    const auraResistances = auraComboEffects?.resistances || [];
    const auraResistanceSource = auraComboEffects?.resistanceSource || null;
    
    const stormbornResistances = (playerStats.automation?.passives || [])
        .filter(p => p.type === 'resistance' && p.name === 'Stormborn')
        .flatMap(p => p.damageTypes || []);
    
    const wrathOfTheSeaActive = getRuntimeValue(playerStats.name, 'wrathOfTheSeaActive', campaignName);
    const stormbornResistancesActive = wrathOfTheSeaActive && stormbornResistances.length > 0
        ? stormbornResistances
        : [];
    
    const rageResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Rage').flatMap(b => b.resistanceTypes || [])
        : [];
    
    const wildHeartResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Rage of the Wilds' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const rageOfTheGodsResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Rage of the Gods' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const superiorDefenseResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Superior Defense' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const epitomeResistanceType = getRuntimeValue(playerStats.name, 'epitomeResistanceType', campaignName);
    const fiendishResilienceType = getRuntimeValue(playerStats.name, '_Fiendish_Resilience_chosenType', campaignName);
    const boonEnergyResistanceTypes = getRuntimeValue(playerStats.name, '_Energy_Resistances_chosenTypes', campaignName) || [];
    
    const auraOfLifeResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Aura of Life' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const auraOfPurityResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Aura of Purity' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const feignDeathResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Feign Death' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const heroesFeastResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === "Heroes' Feast" && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const protectionFromPoisonResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Protection from Poison' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const stoneSkinResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Stone Skin' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const wardingBondResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.effect === 'warding_bond' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const starryFormResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Starry Form' && b.resistanceTypes?.length)
            .flatMap(b => b.resistanceTypes || [])
        : [];
    
    const heroesFeastConditionImmunities = Array.isArray(activeBuffs)
        ? (activeBuffs.find(b => b.name === "Heroes' Feast")?.conditionImmunity || [])
            .map(c => String(c).toLowerCase())
        : [];
    
    const elementalAdeptTypes = (playerStats.automation?.passives || [])
        .filter(p => p.type === 'damage_type_choice' && p.effect === 'elemental_adept')
        .map(p => {
            const key = '_' + (p.name || '').replace(/\s+/g, '_') + '_chosenType';
            return getRuntimeValue(playerStats.name, key, campaignName);
        })
        .filter(Boolean);
    
    const rageActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Rage');
    const rageConditionalImmunities = rageActive
        ? (playerStats.automationConditionalImmunities || [])
            .filter(ci => ci.requiresActive === 'Rage')
            .flatMap(ci => ci.immunities || [])
        : [];
    
    const calmEmotionsImmunities = Array.isArray(activeBuffs)
        ? (activeBuffs.find(b => b.name === 'Calm Emotions')?.conditionImmunity || [])
            .map(c => String(c).toLowerCase())
        : [];
    
    const feignDeathConditionImmunities = Array.isArray(activeBuffs)
        ? (activeBuffs.find(b => b.name === 'Feign Death')?.conditionImmunity || [])
            .map(c => String(c).toLowerCase())
        : [];
    
    const heroismConditionImmunities = Array.isArray(activeBuffs)
        ? (activeBuffs.find(b => b.name === "Heroism")?.conditionImmunity || [])
            .map(c => String(c).toLowerCase())
        : [];
    
    const faerieFireConditionImmunities = Array.isArray(activeBuffs)
        ? (activeBuffs.find(b => b.name === 'Faerie Fire')?.conditionImmunity || [])
            .map(c => String(c).toLowerCase())
        : [];
    
    const automationImmunities = playerStats.automationConditionImmunities || [];
    const resistanceDamageType = getResistanceDamageType(playerStats.name, campaignName);
    const protectionFromEnergyDamageType = getProtectionFromEnergyDamageType(playerStats.name, campaignName);
    const stoneSkinDamageTypes = getStoneSkinDamageTypes(playerStats.name, campaignName) || [];
    const allImmunities = [...new Set([...baseImmunities, ...auraImmunities, ...automationImmunities, ...rageConditionalImmunities, ...calmEmotionsImmunities, ...feignDeathConditionImmunities, ...heroesFeastConditionImmunities, ...heroismConditionImmunities, ...faerieFireConditionImmunities])];
    
    const allResistances = [...new Set([...baseResistances, ...auraResistances, ...stormbornResistancesActive, ...rageResistances, ...wildHeartResistances, ...rageOfTheGodsResistances, ...superiorDefenseResistances, ...(epitomeResistanceType ? [epitomeResistanceType] : []), ...(fiendishResilienceType ? [fiendishResilienceType] : []), ...(resistanceDamageType ? [resistanceDamageType] : []), ...(protectionFromEnergyDamageType ? [protectionFromEnergyDamageType] : []), ...boonEnergyResistanceTypes, ...elementalAdeptTypes, ...auraOfLifeResistances, ...auraOfPurityResistances, ...feignDeathResistances, ...heroesFeastResistances, ...protectionFromPoisonResistances, ...stoneSkinResistances, ...stoneSkinDamageTypes, ...wardingBondResistances, ...starryFormResistances])];
    
    let flySpeed = null;
    let hasFlySpeedBuff = false;
    let swimSpeed = null;
    let climbSpeed = null;
    let hasteAcBonus = 0;
    let shieldAcBonus = 0;
    let baitAndSwitchBonus = 0;
    let shieldOfFaithBonus = 0;
    let defensiveDuelistBonus = 0;
    let barkskinActive = false;
    let mageArmorActive = false;
    let mageArmorAc = 0;
    let iceWalkActive = false;
    let acrobaticMovementActive = false;
    let glisteningFlightHover = false;
    let dragonWingsHover = false;
    let starryFormHover = false;
    let tremorsenseActive = false;
    const largeFormActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'large_form');
    const huntersMarkActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === "Hunter's Mark");
    const aspectBuff = Array.isArray(activeBuffs) ? (activeBuffs.find(b => b.name === 'Aspect of the Wilds') || null) : null;
    const aspectOption = aspectBuff?.optionName || null;
    activeBuffs.forEach(buff => {
        if (buff.effect === 'fly_speed_equals_walk_speed') hasFlySpeedBuff = true;
        if (buff.effect === 'fly_speed_20_hover') { flySpeed = 20; starryFormHover = true; }
        if (buff.effect === 'telekinetic_leap') flySpeed = buff.flySpeed;
        if (buff.effect === 'avenging_angel_flight') flySpeed = buff.flySpeed || 60;
        if (buff.effect === 'speed_boost' && buff.speedBonus) buffSpeedBonus += buff.speedBonus;
        if (buff.effect === 'large_form') buffSpeedBonus += 10;
        if (buff.effect === 'mage_armor') {
            mageArmorActive = true;
            mageArmorAc = buff.baseAc || 13;
        }
        if (buff.effect === 'shield') shieldAcBonus = 5;
        if (buff.effect === 'barkskin') barkskinActive = true;
        if (buff.effect === 'defensive_duelist' && buff.acBonus) defensiveDuelistBonus += buff.acBonus;
        if (buff.effect === 'ice_walk') iceWalkActive = true;
        if (buff.effect === 'glistening_flight') { hasFlySpeedBuff = true; glisteningFlightHover = true; }
        if (buff.effect === 'dragon_wings') { flySpeed = buff.flySpeed || 60; dragonWingsHover = true; }
        if (buff.flySpeed && !['fly_speed_20_hover', 'telekinetic_leap', 'avenging_angel_flight', 'dragon_wings'].includes(buff.effect)) hasFlySpeedBuff = true;
        if (buff.effect === 'aquatic_adaptation') swimSpeed = speed * 2;
        if (buff.effect === 'tremorsense_60ft') tremorsenseActive = true;
    });
    if (aspectOption === 'Panther') {
        climbSpeed = totalSpeed + buffSpeedBonus;
    }
    if (!climbSpeed && playerStats.climbSpeed) {
        climbSpeed = playerStats.climbSpeed;
    }
    if (aspectOption === 'Salmon' && swimSpeed === null) {
        swimSpeed = totalSpeed + buffSpeedBonus;
    }
    if (!swimSpeed && playerStats.swimSpeed) {
        swimSpeed = playerStats.swimSpeed;
    }
    const dexBonus = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0;
    const hasteActive = activeBuffs.some(b => b.effect === 'haste');
    if (hasteActive) {
        speed = speed * 2;
        hasteAcBonus = 2;
    }
    const totalSpeedWithHaste = speed + auraSpeedBonus;
    const shieldOfFaithActive = activeBuffs.some(b => b.effect === 'shield_of_faith');
    if (shieldOfFaithActive) {
        shieldOfFaithBonus = 2;
    }
    const baitAndSwitchActive = getRuntimeValue(playerStats.name, 'baitAndSwitchActive', campaignName);
    const baitAndSwitchBonusValue = getRuntimeValue(playerStats.name, 'baitAndSwitchBonus', campaignName);
    const baitAndSwitchSource = getRuntimeValue(playerStats.name, 'baitAndSwitchSource', campaignName);
    if (baitAndSwitchActive && baitAndSwitchBonusValue) {
        baitAndSwitchBonus = Number(baitAndSwitchBonusValue);
    }
    
    // Cover source badges — buff-based cover that applies against all attackers
    let smiteOfProtectionCoverActive = false;
    if (characters) {
        for (const other of characters) {
            const smiteActive = getRuntimeValue(other.name, 'smiteOfProtectionActive', campaignName);
            if (!smiteActive) continue;
            const hasAura = other.computedStats?.automation?.passives?.some(p => p.name === 'Aura of Protection');
            if (!hasAura) continue;
            smiteOfProtectionCoverActive = true;
            break;
        }
    }
    let bulwarkOfForceCoverActive = false;
    let naturesSanctuaryCoverActive = false;
    if (characters) {
        for (const other of characters) {
            if (other.name === playerStats.name) continue;
            if (!bulwarkOfForceCoverActive) {
                const bulwarkActive = getRuntimeValue(other.name, 'bulwarkOfForceActive');
                if (bulwarkActive) {
                    const bulwarkTargets = getRuntimeValue(other.name, 'bulwarkOfForceTargets') || [];
                    if (bulwarkTargets.includes(playerStats.name)) {
                        bulwarkOfForceCoverActive = true;
                    }
                }
            }
            if (!naturesSanctuaryCoverActive) {
                const sanctuaryCreatures = getRuntimeValue(other.name, 'naturesSanctuaryCreatures', campaignName) || [];
                if (sanctuaryCreatures.includes(playerStats.name)) {
                    naturesSanctuaryCoverActive = true;
                }
            }
            if (bulwarkOfForceCoverActive && naturesSanctuaryCoverActive) break;
        }
    }
    const acrobaticMovementPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'acrobatic_movement');
    if (acrobaticMovementPassive && !hasArmorOrShield) {
        acrobaticMovementActive = true;
    }
    const elementalMovementPassive = (playerStats.passives || []).find(p => p.effect === 'elemental_attunement_movement');
    if (elementalMovementPassive) {
        hasFlySpeedBuff = true;
        swimSpeed = speed;
    }
    const aquaticAffinityPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'aquatic_affinity');
    if (aquaticAffinityPassive && swimSpeed === null) {
        swimSpeed = speed;
    }
    const stormbornPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'fly_speed_equals_walk_speed');
    if (stormbornPassive && flySpeed === null && wrathOfTheSeaActive) {
        hasFlySpeedBuff = true;
    }

    const totalSpeedWithBuff = totalSpeedWithHaste + buffSpeedBonus;
    if (hasFlySpeedBuff) flySpeed = totalSpeedWithBuff;

    const effectiveInitiative = playerStats.initiative - (2 * exhaustionLevel);

    const seeInvisibilityActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'see_invisibility');

    return {
        flyBuffActive, flyBuffName, circleFormsACOverride, buffSpeedBonus, auraSpeedBonus, auraSpeedSource,
        allImmunities, allResistances, auraResistances, auraResistanceSource,
        flySpeed, hasFlySpeedBuff, swimSpeed, climbSpeed, seeInvisibilityActive,
        hasteAcBonus, shieldAcBonus, baitAndSwitchBonus, shieldOfFaithBonus, defensiveDuelistBonus,
        barkskinActive, mageArmorActive, mageArmorAc, iceWalkActive, acrobaticMovementActive,
        glisteningFlightHover, dragonWingsHover, starryFormHover, tremorsenseActive, largeFormActive,
        huntersMarkActive, dexBonus, shieldOfFaithActive, baitAndSwitchActive, baitAndSwitchBonusValue,
        baitAndSwitchSource, smiteOfProtectionCoverActive, bulwarkOfForceCoverActive,
        naturesSanctuaryCoverActive, effectiveInitiative, totalSpeedWithBuff,
        wrathOfTheSeaActive, heroesFeastResistances, heroesFeastConditionImmunities,
    };
}
