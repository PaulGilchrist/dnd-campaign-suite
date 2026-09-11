import { buildBaseAttackContext } from './common/damageRoll.js';
import { getCombatContext } from '../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../encounters/combatData.js';
import { isWithinRange } from '../rules/combat/rangeCheck.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { endSanctuary } from './handlers/spells/sanctuaryHandler.js';
import { isActive as isAvengingAngelActive, isAuraTarget } from '../automation/handlers/class-cleric-paladin/avengingAngelHandler.js';
import { isProtectionFromEvilAndGoodActive, isCreatureWarded } from '../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';
import { resolveCreatureType } from '../combat/creatureTypeResolver.js';
import { isDeathWardActive } from '../automation/handlers/buffs/deathWardHandler.js';
import { collectWeaponMastery } from '../combat/automation/automationService.js';
import { selectBrutalStrikeRiders } from '../combat/brutalStrikeSelection.js';
import { resolveDiceExpression } from '../combat/automation/automationExpressions.js';
import { isResilientSphereActive } from '../combat/automation/automationPassives.js';
import { CONDITIONS_THAT_CANNOT_ACT } from '../combat/conditions/conditionEffects.js';

// Canonical sneak-attack ally clause: the ally must not have the Incapacitated condition.
function allyIsIncapacitated(c) {
    const conds = [...(getRuntimeValue(c.name, 'activeConditions') || []), ...(c.conditions || [])];
    return conds.some(cond => {
        const key = typeof cond === 'object' ? String(cond.key || cond.name || '') : String(cond);
        return CONDITIONS_THAT_CANNOT_ACT.has(key.toLowerCase());
    });
}

// WM-008: consume a one-shot advantage te matched by predicate. Clears the te (and the
// campaign _Vex_appliedTarget auto-apply latch when requested). Returns 'advantage' when
// a match was consumed, otherwise undefined (caller leaves forcedMode unchanged).
function consumeOneShotAdvantageTe(playerName, targetName, campaignName, matchFn, clearVexLatch) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    if (!storedEffects.some(te => matchFn(te, playerName, targetName))) return undefined;
    const cleanedEffects = storedEffects.filter(te => !matchFn(te, playerName, targetName));
    setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
    if (clearVexLatch) {
        setRuntimeValue('campaign', '_Vex_appliedTarget', null, campaignName);
    }
    return 'advantage';
}

function campaignTargetEffects() {
    return getRuntimeValue('campaign', 'targetEffects') || [];
}

// Sanctuary: ends if the warded creature makes an attack roll
function endSanctuaryOnAttackRoll(playerName, campaignName) {
    const sanctuaryEffects = campaignTargetEffects().filter(
        te => te.effect === 'sanctuary' && te.source === playerName
    );
    for (const se of sanctuaryEffects) {
        endSanctuary(playerName, se.target, campaignName,
            `${playerName} made an attack roll, ending Sanctuary.`);
    }
}

// Hunter's Lore: reveal full IRV info for Hunter's Mark target
function buildHunterLoreNotice(playerStats, target) {
    const lorePassives = playerStats.automation?.passives || [];
    const hasHunterLore = lorePassives.some(p => p.type === 'passive_rule' && p.effect === 'hunter_lore');
    if (!hasHunterLore || !target) return null;
    const irvParts = [];
    if (target.vulnerabilities?.length > 0) {
        irvParts.push(`Vulnerabilities: ${target.vulnerabilities.join(', ')}`);
    }
    if (target.resistances?.length > 0) {
        irvParts.push(`Resistances: ${target.resistances.join(', ')}`);
    }
    if (target.immunities?.length > 0) {
        irvParts.push(`Immunities: ${target.immunities.join(', ')}`);
    }
    return irvParts.length > 0 ? irvParts.join('\n') : null;
}

// Check for Stunning Strike save advantage (consumed on use)
function consumeStunningStrikeAdvantage(playerName, targetName, campaignName) {
    if (!targetName) return false;
    const advKey = `_advantageOn_${targetName}`;
    const storedAdvantage = getRuntimeValue(playerName, advKey);
    if (!Array.isArray(storedAdvantage)) return false;
    const idx = storedAdvantage.indexOf(targetName);
    if (idx === -1) return false;
    storedAdvantage.splice(idx, 1);
    setRuntimeValue(playerName, advKey, storedAdvantage, campaignName);
    return true;
}

// Accumulate advantage/disadvantage counts so they cancel per rules
function accumulateStoredEffectCounts(playerName, targetName, hasSaveAdvantage, innateSorceryBonus) {
    let adv = 0;
    let dis = 0;
    const storedEffects = campaignTargetEffects();
    if (storedEffects.some(te => te.effect === 'disadvantage_next_attack' && te.target === playerName)) {
        dis++;
    }
    if (storedEffects.some(te => te.effect === 'slasher_enhanced_critical' && te.target === playerName)) {
        dis++;
    }
    if (targetName && storedEffects.some(te => te.effect === 'reckless_attack' && te.target === targetName)) {
        adv++;
    }
    if (targetName && storedEffects.some(te => te.effect === 'crusher_enhanced_critical' && te.target === targetName)) {
        adv++;
    }
    if (hasSaveAdvantage) {
        adv++;
    }
    if (innateSorceryBonus.spellAdvantage) {
        adv++;
    }
    return { adv, dis };
}

// Add stance damage bonus (e.g. Rage) if an active combat buff provides one
function computeStanceDamageBonus(activeBuffs, playerStats) {
    let stanceDamageBonus = 0;
    for (const buff of activeBuffs) {
        if (!buff.damageBonusExpression) continue;
        if (buff.damageBonusExpression !== 'rage_damage') continue;
        stanceDamageBonus += playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2;
    }
    return stanceDamageBonus;
}

// Frenzy: extra rage_damage_d6 when reckless, raging, strength-based (once per turn)
function computeFrenzyDamageFormula(playerStats, attack, activeBuffs, campaignName) {
    const frenzyActions = (playerStats.automation?.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'reckless_attack_hit_while_raging');
    if (frenzyActions.length === 0) return null;
    if (frenzyActions[0].oncePerTurn) {
        const usedRound = getRuntimeValue(playerStats.name, '_frenzyUsedRound', campaignName);
        const currentRound = getCurrentCombatRound(campaignName);
        if (usedRound === currentRound) return null;
    }
    const isReckless = activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');
    const isRaging = activeBuffs.some(b => b.damageBonusExpression);
    const attackAbilityName = attack?.abilityName;
    const strMod = playerStats.abilities?.find(a => a.name === 'Strength')?.bonus ?? 0;
    const dexMod = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0;
    const isStrFinal = attackAbilityName ? attackAbilityName.toLowerCase() === 'strength' : strMod >= dexMod;
    if (!isReckless || !isRaging || !isStrFinal) return null;
    return resolveDiceExpression(frenzyActions[0].damageExpression, playerStats) || null;
}

// Grant attack advantage if Reckless Attack (or similar buff) is active
function scanBuffsForAdvantage(activeBuffs) {
    let adv = 0;
    let ramActive = false;
    for (const buff of activeBuffs) {
        if (buff.effect === 'advantage_attacks_advantage_against') {
            adv++;
        }
        if (buff.effect === 'advantage_attacks_and_saves') {
            adv++;
        }
        if (buff.optionName === 'Ram') {
            ramActive = true;
        }
    }
    return { adv, ramActive };
}

function activeConditionSet(targetName, campaignName) {
    const targetConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    if (!Array.isArray(targetConditions)) return undefined;
    return new Set(targetConditions.map(c => String(c).toLowerCase()));
}

function countIn(condSet, names) {
    return names.some(name => condSet.has(name)) ? 1 : 0;
}

// Target conditions that grant advantage (blinded, charmed, paralyzed, petrified, restrained, stunned, unconscious, dazed, slow)
function countTargetConditionAdvantage(targetName, campaignName) {
    const condSet = activeConditionSet(targetName, campaignName);
    if (!condSet) return 0;
    let adv = 0;
    adv += countIn(condSet, ['blinded']);
    adv += countIn(condSet, ['charmed']);
    adv += countIn(condSet, ['paralyzed', 'petrified', 'stunned', 'unconscious']);
    adv += countIn(condSet, ['restrained']);
    adv += countIn(condSet, ['dazed', 'slow']);
    return adv;
}

// Grappler feat: advantage on attacks against grappled targets
function countGrapplerAdvantage(playerStats, targetName, campaignName) {
    const hasGrapplerAdvantage = (playerStats.saveModifiers || []).some(
        mod => mod.target === 'attack_roll' || mod.target === 'attack_rolls'
    );
    if (!hasGrapplerAdvantage) return 0;
    const condSet = activeConditionSet(targetName, campaignName);
    if (!condSet) return 0;
    return countIn(condSet, ['grappled']);
}

// Dodge: attackers have disadvantage on attacks against the target
function countDodgeDisadvantage(targetName, campaignName) {
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    if (!Array.isArray(targetBuffs)) return 0;
    return targetBuffs.some(b => b.effect === 'dodge') ? 1 : 0;
}

// Protection from Evil and Good: warded creature types have disadvantage on attack rolls against the target
async function countProtectionFromEvilAndGoodDisadvantage(playerName, targetName, campaignName) {
    if (!isProtectionFromEvilAndGoodActive(targetName, campaignName)) return 0;
    const combatSummary = await getCombatContext(campaignName);
    const attackerCreature = combatSummary?.creatures?.find(c => c.name === playerName);
    if (!attackerCreature) return 0;
    return isCreatureWarded(resolveCreatureType(attackerCreature), targetName, campaignName) ? 1 : 0;
}

function resolveAdvantageMode(adv, dis) {
    if (adv > dis) return 'advantage';
    if (dis > adv) return 'disadvantage';
    return undefined;
}

function isAntimagicBlockedAttack(attack) {
    return attack.type !== 'weapon_attack' && !attack.weaponType && attack.isWeaponAttack === false;
}

function buildBlockedAttackContext(attack, playerName, targetName, playerStats, rangeReason, notice) {
    return {
        isAutoMiss: true,
        rangeReason,
        notice,
        damageType: attack.damageType || attack.damage_type_primary || '',
        resistanceNotice: null,
        hunterLoreNotice: null,
        targetName,
        saveDc: attack.saveDc || 0,
        saveType: attack.saveType,
        dcSuccess: attack.saveSuccess,
        attackerName: playerName,
        forcedMode: undefined,
        advantageReason: null,
        autoDamageFormula: null,
        autoDamageName: attack.name,
        ramActive: false,
        isMelee: false,
        isWeaponAttack: false,
        criticalRange: '',
        hitBonus: 0,
        hitBonusFormula: null,
        sacredWeaponBonus: 0,
        defensiveDuelistBonus: 0,
        baitAndSwitchBonus: 0,
        strokeOfLuck: false,
        boonOfCombatProwess: false,
        boonOfFate: false,
        isPsychicBlade: attack.isPsychicBlade === true,
        playerStats,
        grazeDamage: false,
        grazeAbilityName: null,
        grazeAbilityMod: 0,
        weaponType: attack.weaponType,
        weaponName: attack.name,
        sneakAttackDice: 0,
    };
}

function buildBrutalStrikeEffect(option, playerName, targetName) {
    return {
        target: targetName,
        source: playerName,
        option: option.name,
        effect: option.effect,
        value: option.effect === 'next_attack_bonus' ? (option.value || 5) : (option.value || null),
        noOpportunityAttacks: option.noOpportunityAttacks || false,
        duration: 'until_start_of_next_turn',
    };
}

// Brutal Strike: add extra damage dice when active
function applyBrutalStrikeEffects(playerName, targetName, playerStats, campaignName) {
    if (!getRuntimeValue(playerName, '_brutalStrikeActive', campaignName)) return null;
    const allAutomation = [...(playerStats.automation?.actions || []), ...(playerStats.automation?.passives || [])];
    const brutalStrikeRider = selectBrutalStrikeRiders(allAutomation)[0];
    if (!brutalStrikeRider) return null;

    let brutalStrikeFormulaPart = null;
    if (brutalStrikeRider.damageExpression.match(/^(\d+)d(\d+)/)) {
        brutalStrikeFormulaPart = `${brutalStrikeRider.damageExpression} [Brutal Strike]`;
    }

    // Read pre-existing next_attack_bonus effects before adding new ones
    const preExistingEffects = campaignTargetEffects();
    const preExistingBonusKeys = preExistingEffects.filter(
        te => te.effect === 'next_attack_bonus' && te.target === targetName
    ).map(te => JSON.stringify(te));

    // Apply chosen effects to targetEffects
    const effectChoices = getRuntimeValue(playerName, '_brutalStrikeEffects', campaignName) || [];
    if (effectChoices.length > 0) {
        let storedEffects = campaignTargetEffects();
        const riderOptions = brutalStrikeRider.options || [];
        for (const choiceName of effectChoices) {
            const option = riderOptions.find(o => o.name === choiceName);
            if (!option) continue;
            if (option.effect === 'disadvantage_on_next_save' || option.effect === 'next_attack_bonus') {
                storedEffects = [...storedEffects, buildBrutalStrikeEffect(option, playerName, targetName)];
            }
        }
        setRuntimeValue('campaign', 'targetEffects', storedEffects, campaignName);
    }

    // Consume pre-existing next_attack_bonus effects (Sundering Blow consumed on this attack)
    if (preExistingBonusKeys.length > 0) {
        const currentEffects = campaignTargetEffects();
        const cleanedEffects = currentEffects.filter(
            te => !(te.effect === 'next_attack_bonus' && te.target === targetName && preExistingBonusKeys.includes(JSON.stringify(te)))
        );
        if (cleanedEffects.length !== currentEffects.length) {
            setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
        }
    }
    setRuntimeValue(playerName, '_brutalStrikeActive', null, campaignName);
    setRuntimeValue(playerName, '_brutalStrikeEffects', null, campaignName);
    return brutalStrikeFormulaPart;
}

// Sacred Weapon: Add Charisma modifier to attack rolls (minimum +1) for melee attacks
function computeSacredWeaponBonus(activeBuffs, playerStats, isMelee) {
    if (!isMelee || !activeBuffs.some(b => b.effect === 'sacred_weapon')) return 0;
    const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
    return Math.max(1, cha?.bonus || 0);
}

// Blessed Warrior: +2 bonus to attack rolls with melee weapons
function computeBlessedWarriorBonus(activeBuffs, isMelee) {
    if (!isMelee || !activeBuffs.some(b => b.effect === 'blessed_warrior')) return 0;
    return 2;
}

// Vow of Enmity: Advantage on attack rolls against the vowed creature
function hasVowOfEnmity(targetName, campaignName) {
    const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'vow_of_enmity');
}

// Clairvoyant Combatant: Advantage on attack rolls against the bonded creature (on failed save)
function resolveClairvoyantCombatant(playerName, targetName, activeBuffs, campaignName) {
    if (!activeBuffs.some(b => b.effect === 'clairvoyant_combatant')) return undefined;
    const clairvoyantTarget = getRuntimeValue(playerName, 'clairvoyantCombatantTarget', campaignName);
    if (clairvoyantTarget && targetName === clairvoyantTarget) return { mode: 'advantage' };
    return undefined;
}

// Precise Hunter (2024 Ranger level 17): Advantage on attack rolls against Hunter's Mark target
async function resolvePreciseHunter(playerName, targetName, playerStats, campaignName) {
    const hasPreciseHunter = (playerStats.automation?.passives || []).some(
        p => p.type === 'passive_rule' && p.effect === 'precise_hunter'
    );
    if (!hasPreciseHunter || !targetName) return undefined;
    const combatSummary = await getCombatContext(campaignName);
    const attackerCreature = combatSummary?.creatures?.find(c => c.name === playerName);
    if (attackerCreature?.concentration?.spell === "Hunter's Mark" && attackerCreature?.concentration?.target === targetName) {
        return { mode: 'advantage', reason: 'Precise Hunter (Hunter\'s Mark)' };
    }
    return undefined;
}

// Aura checks when no map is active — all creatures considered in range
async function resolveWolfAura(playerName, campaignName) {
    const noMapWolf = await getWolfAdvantageAgainst({
        attackerName: playerName,
        campaignName,
        skipRangeCheck: true,
    });
    return noMapWolf.advantage ? { mode: 'advantage' } : undefined;
}

async function resolveDuplicityAura(playerName, campaignName) {
    const noMapDuplicity = await getDuplicityAdvantageAgainst({
        attackerName: playerName,
        campaignName,
        skipRangeCheck: true,
    });
    return noMapDuplicity.advantage ? { mode: 'advantage', reason: 'Improved Duplicity' } : undefined;
}

async function resolveLionAura(playerName, campaignName) {
    const noMapLion = await getLionDisadvantageAgainst({
        attackerName: playerName,
        campaignName,
        skipRangeCheck: true,
    });
    return noMapLion.disadvantage ? { mode: 'disadvantage' } : undefined;
}

function resolveCoronaAura(targetName, campaignName, damageType) {
    const noMapCorona = getCoronaSaveDisadvantage({
        targetName,
        campaignName,
        damageType,
        skipRangeCheck: true,
    });
    return noMapCorona.disadvantage ? { mode: 'disadvantage' } : undefined;
}

// Blur and Foresight: attackers without Blindsight or Truesight have disadvantage on attacks against the target
function hasBlurOrForesightWithoutCounter(playerStats, targetName) {
    const hasBlindsightOrTruesight = (playerStats.senses || []).some(s => {
        const name = (s.name || s.type || '').toLowerCase();
        return name === 'blindsight' || name === 'truesight';
    });
    if (hasBlindsightOrTruesight) return false;
    const storedEffects = campaignTargetEffects();
    return storedEffects.some(te => te.effect === 'blur' && te.target === targetName)
        || storedEffects.some(te => te.effect === 'foresight' && te.target === targetName);
}

function computeSunderingBonus(targetName) {
    if (!targetName) return 0;
    const bonusEffects = campaignTargetEffects().filter(
        te => te.effect === 'next_attack_bonus' && te.target === targetName
    );
    let sunderingBonus = 0;
    for (const be of bonusEffects) {
        sunderingBonus += (parseInt(be.value, 10) || 5);
    }
    return sunderingBonus;
}

// Compute critical range from passives (e.g., Improved Critical, Superior Critical)
function computeCriticalRange(playerStats) {
    const passives = playerStats.automation?.passives || [];
    let criticalRange = '';
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'critical_range' && passive.criticalRange) {
            criticalRange = passive.criticalRange;
        }
    }
    return criticalRange;
}

function computeGraze(attack, playerStats) {
    const available = collectWeaponMastery(attack.name, playerStats);
    const hasGraze = available.baseMastery === 'Graze' || available.extraMasteries?.includes('Graze');
    if (!hasGraze) return { grazeDamage: false, grazeAbilityName: null, grazeAbilityMod: 0 };
    const grazeAbilityName = attack.abilityName || 'Strength';
    const grazeAbility = playerStats.abilities?.find(a => a.name === grazeAbilityName);
    return { grazeDamage: true, grazeAbilityName, grazeAbilityMod: grazeAbility?.bonus || 0 };
}

function buildHitBonusFormula(attack, sacredWeaponBonus, blessedWarriorBonus, sunderingBonus) {
    const hitBonusFormulaParts = [attack.hitBonusFormula];
    if (sacredWeaponBonus > 0) hitBonusFormulaParts.push(`Sacred Weapon (${sacredWeaponBonus})`);
    if (blessedWarriorBonus > 0) hitBonusFormulaParts.push(`Blessed Warrior (${blessedWarriorBonus})`);
    if (sunderingBonus > 0) hitBonusFormulaParts.push(`Sundering Blow (+${sunderingBonus})`);
    return hitBonusFormulaParts.join(' + ');
}

// Determine sneak attack eligibility
async function computeSneakAttackDice(playerStats, attack, targetName, forcedMode, campaignName) {
    if (playerStats.class?.name !== 'Rogue') return 0;
    const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
    // 2024 rules: sneak_attack_num_d6 directly on class level
    // 5e rules: class_specific.sneak_attack.dice_count
    const sneakAttackNumD6 = classLevel?.sneak_attack_num_d6 || classLevel?.class_specific?.sneak_attack?.dice_count || 0;
    if (sneakAttackNumD6 <= 0) return 0;
    const weaponProperties = attack.properties || [];
    const hasFinesse = weaponProperties.some(p => p.toLowerCase() === 'finesse');
    const hasRanged = attack.weaponType === 'ranged';
    const isSneakAttackWeapon = hasFinesse || hasRanged;
    const hasDisadvantage = forcedMode === 'disadvantage';
    if (!isSneakAttackWeapon || hasDisadvantage) return 0;
    const sneakUsedRound = getRuntimeValue(playerStats.name, '_SneakAttack_usedRound', campaignName);
    if (sneakUsedRound === getCurrentCombatRound(campaignName)) return 0;
    if (forcedMode === 'advantage') return sneakAttackNumD6;
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return 0;
    const targetCreature = combatSummary.creatures?.find(c => c.name === targetName);
    if (!targetCreature) return 0;
    for (const c of combatSummary.creatures) {
        if (c.name === playerStats.name || c.name === targetName) continue;
        const friendly = c.type === 'player' || (c.type === 'npc' && c.attitude !== 'hostile');
        if (!friendly) continue;
        if (allyIsIncapacitated(c)) continue;
        const inRange = await isWithinRange(targetName, c.name, 5);
        if (inRange) return sneakAttackNumD6;
    }
    return 0;
}

export async function buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, _featRangeEffects, opts = {}) {
    // WM-008: one-shot attack te (vex/distracting) is consumed by the NEXT attack ROLL
    // only. Damage-phase ctx rebuilds (proceedWithDamage / buildContext / cunningStrike)
    // run after the roll and must not consume the te the same attack's tacticalMaster
    // step has just stamped — that self-erase meant Vex advantage was never produced.
    const consumeAttackTe = opts.consumeAttackTe !== false;
    const playerName = playerStats.name;

    return buildBaseAttackContext(playerName, campaignName, attack.damageType).then(async ({ target, targetName, resistanceNotice }) => {

        endSanctuaryOnAttackRoll(playerName, campaignName);

        const hunterLoreNotice = buildHunterLoreNotice(playerStats, target);

        // !!! ADDING A NEW TARGET EFFECT? !!!
        // First check if it exists in src/services/combat/conditions/targetEffectDefinitions.js
        // Every new te.effect value MUST be added there with label/description/group/icon.
        // The GM UI depends on this registry to display manual-add options.
        const hasSaveAdvantage = consumeStunningStrikeAdvantage(playerName, targetName, campaignName);

        const innateSorceryBonus = getInnateSorceryBonus(playerName, campaignName);

        let forcedMode = conditionAttackMode !== 'normal' ? conditionAttackMode : undefined;
        let adv = 0;
        let dis = 0;
        if (forcedMode === undefined) {
            const stored = accumulateStoredEffectCounts(playerName, targetName, hasSaveAdvantage, innateSorceryBonus);
            adv += stored.adv;
            dis += stored.dis;
        }

        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        const stanceDamageBonus = computeStanceDamageBonus(activeBuffs, playerStats);
        const frenzyDamageFormula = computeFrenzyDamageFormula(playerStats, attack, activeBuffs, campaignName);

        const buffScan = scanBuffsForAdvantage(activeBuffs);
        const ramActive = buffScan.ramActive;
        if (forcedMode === undefined) {
            adv += buffScan.adv;
        }

        if (forcedMode === undefined && targetName) {
            adv += countTargetConditionAdvantage(targetName, campaignName);
        }
        if (forcedMode === undefined && targetName) {
            adv += countGrapplerAdvantage(playerStats, targetName, campaignName);
        }
        if (forcedMode === undefined && targetName) {
            dis += countDodgeDisadvantage(targetName, campaignName);
        }
        if (forcedMode === undefined && targetName) {
            dis += await countProtectionFromEvilAndGoodDisadvantage(playerName, targetName, campaignName);
        }
        // Death Ward: attackers have disadvantage on attack rolls against the target
        if (forcedMode === undefined && targetName && isDeathWardActive(targetName, campaignName)) {
            dis++;
        }

        // Resolve accumulated adv/dis to forcedMode (they cancel per rules)
        if (forcedMode === undefined) {
            forcedMode = resolveAdvantageMode(adv, dis);
        }

        // Antimagic Field — allow only weapon attacks when either attacker or target is affected
        if (targetName && campaignTargetEffects().some(te => (te.effect === 'antimagic_field') && (te.target === playerName || te.target === targetName)) && isAntimagicBlockedAttack(attack)) {
            return buildBlockedAttackContext(attack, playerName, targetName, playerStats,
                'Antimagic Field blocks non-weapon attacks',
                'Attack blocked by Antimagic Field — only weapon attacks are allowed.');
        }

        // Resilient Sphere — block all attacks when attacker or target is enclosed
        if (targetName && isResilientSphereActive(playerName, campaignName)) {
            return buildBlockedAttackContext(attack, playerName, targetName, playerStats,
                'Resilient Sphere blocks attacks — nothing passes through the barrier',
                'Attack blocked by Resilient Sphere — nothing can pass through the barrier.');
        }
        if (targetName && isResilientSphereActive(targetName, campaignName)) {
            return buildBlockedAttackContext(attack, playerName, targetName, playerStats,
                'Resilient Sphere blocks attacks — nothing passes through the barrier',
                'Attack blocked by Resilient Sphere — nothing can pass through the barrier.');
        }

        // Brutal Strike: override to normal when chosen
        if (getRuntimeValue(playerStats.name, '_brutalStrikeNoAdvantage', campaignName)) {
            forcedMode = 'normal';
        }

        const isMelee = attack.weaponType === 'melee' || attack.weaponType === 'unarmed';
        const sacredWeaponBonus = computeSacredWeaponBonus(activeBuffs, playerStats, isMelee);
        const blessedWarriorBonus = computeBlessedWarriorBonus(activeBuffs, isMelee);

        const brutalStrikeFormulaPart = applyBrutalStrikeEffects(playerName, targetName, playerStats, campaignName);

        const avengingAngelActive = isAvengingAngelActive(playerName, campaignName);

        // Ordered forced-mode resolvers — first match wins, mirroring original guard order.
        const modeResolvers = [
            // Vow of Enmity: Advantage on attack rolls against the vowed creature
            () => (targetName && hasVowOfEnmity(targetName, campaignName) ? { mode: 'advantage' } : undefined),
            () => (targetName && resolveClairvoyantCombatant(playerName, targetName, activeBuffs, campaignName)),
            // Avenging Angel: Advantage on attack rolls against Frightened creatures in the aura
            () => (targetName && avengingAngelActive && isAuraTarget(playerName, targetName, campaignName) ? { mode: 'advantage' } : undefined),
            // Invoke Duplicity: Distract grants Advantage on attack rolls while the illusion is active
            () => (activeBuffs.some(b => b.effect === 'create_illusion') ? { mode: 'advantage' } : undefined),
            () => resolvePreciseHunter(playerName, targetName, playerStats, campaignName),
            () => resolveWolfAura(playerName, campaignName),
            () => resolveDuplicityAura(playerName, campaignName),
            () => resolveLionAura(playerName, campaignName),
            // WM-008 one-shot te consumption (attack roll only)
            () => {
                if (!targetName || !consumeAttackTe) return undefined;
                const mode = consumeOneShotAdvantageTe(
                    playerName,
                    targetName,
                    campaignName,
                    (te, pn, tn) => te.effect === 'distracting_strike_advantage' && te.target === tn && te.source !== pn
                );
                return mode ? { mode } : undefined;
            },
            () => {
                if (!targetName || !consumeAttackTe) return undefined;
                const mode = consumeOneShotAdvantageTe(
                    playerName,
                    targetName,
                    campaignName,
                    (te, pn, tn) => te.effect === 'next_attack_advantage' && te.target === pn && te.vexTarget === tn,
                    true
                );
                return mode ? { mode } : undefined;
            },
            () => (targetName && campaignTargetEffects().some(te => te.effect === 'protection' && te.target === targetName) ? { mode: 'disadvantage' } : undefined),
            () => (targetName ? resolveCoronaAura(targetName, campaignName, attack.damageType) : undefined),
        ];

        let advantageReason = undefined;
        for (const resolveMode of modeResolvers) {
            if (forcedMode !== undefined) break;
            const outcome = await resolveMode();
            if (outcome) {
                forcedMode = outcome.mode;
                advantageReason = outcome.reason;
            }
        }

        if (forcedMode === undefined && targetName && hasBlurOrForesightWithoutCounter(playerStats, targetName)) {
            dis++;
        }

        const primaryDamage = attack.damage || attack.damage_dice_primary || '';
        const autoDamageFormula = [primaryDamage, stanceDamageBonus > 0 ? stanceDamageBonus : null, frenzyDamageFormula, brutalStrikeFormulaPart].filter(v => v !== null).join(' plus ');

        let sunderingBonus = 0;
        const effectiveHitBonus = (attack.hitBonus ?? 0) + sacredWeaponBonus + blessedWarriorBonus + sunderingBonus;
        const hitBonusFormula = buildHitBonusFormula(attack, sacredWeaponBonus, blessedWarriorBonus, sunderingBonus);

        // Sundering Blow: accumulate next_attack_bonus effects on the target (post-formula, as before)
        sunderingBonus += computeSunderingBonus(targetName);

        const criticalRange = computeCriticalRange(playerStats);

        // Compute Defensive Duelist AC bonus (2024 rules)
        const ddBuff = (getRuntimeValue(playerName, 'activeBuffs', campaignName) || []).find(b => b.effect === 'defensive_duelist');
        const defensiveDuelistBonus = ddBuff ? (playerStats.proficiency || 0) : 0;

        // Compute Bait and Switch AC bonus (2024 rules)
        const baitAndSwitchActive = getRuntimeValue(targetName, 'baitAndSwitchActive', campaignName);
        const baitAndSwitchBonus = baitAndSwitchActive ? Number(getRuntimeValue(targetName, 'baitAndSwitchBonus', campaignName) || 0) : 0;

        // Stroke of Luck: check if the player has the passive available
        const hasStrokeOfLuck = (playerStats.automation?.passives || []).some(
            p => p.type === 'stroke_of_luck'
        );
        const strokeOfLuckAvailable = hasStrokeOfLuck && !getRuntimeValue(playerName, 'strokeOfLuckUsed', campaignName);

        // Boon of Combat Prowess: check if the player has auto_reroll for attacks (stored in actions/reactions, not passives)
        const allAutomation = [
            ...(playerStats.automation?.actions || []),
            ...(playerStats.automation?.reactions || []),
            ...(playerStats.automation?.passives || []),
        ];
        const hasBoonOfCombatProwess = allAutomation.some(
            p => p.type === 'auto_reroll' && (p.effect === 'convert_miss_to_hit' || p.automation?.effect === 'convert_miss_to_hit')
        );
        const boonOfCombatProwessAvailable = hasBoonOfCombatProwess && !getRuntimeValue(playerName, 'boonOfCombatProwessUsed');

        const { grazeDamage, grazeAbilityName, grazeAbilityMod } = computeGraze(attack, playerStats);

        // Boon of Fate: check if the player has the passive available
        const hasBoonOfFate = (playerStats.automation?.passives || []).some(
            p => p.type === 'modify_d20_roll'
        );
        const boonOfFateAvailable = hasBoonOfFate && !getRuntimeValue(playerName, 'boonOfFateUsed', campaignName);

        const sneakAttackDice = await computeSneakAttackDice(playerStats, attack, targetName, forcedMode, campaignName);

        return {
            damageType: attack.damageType || attack.damage_type_primary || '',
            resistanceNotice,
            hunterLoreNotice,
            targetName,
            saveDc: attack.saveDc + innateSorceryBonus.saveDcBonus,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerName,
            forcedMode,
            advantageReason,
            autoDamageFormula,
            autoDamageName: attack.name,
            ramActive,
            isMelee,
            isWeaponAttack: attack.isWeaponAttack !== false,
            criticalRange,
            hitBonus: effectiveHitBonus,
            hitBonusFormula,
            sacredWeaponBonus,
            defensiveDuelistBonus,
            baitAndSwitchBonus,
            strokeOfLuck: strokeOfLuckAvailable,
            boonOfCombatProwess: boonOfCombatProwessAvailable,
            boonOfFate: boonOfFateAvailable,
            isPsychicBlade: attack.isPsychicBlade === true,
            playerStats,
            grazeDamage,
            grazeAbilityName,
            grazeAbilityMod,
            weaponType: attack.weaponType,
            weaponName: attack.name,
            sneakAttackDice,
        };
    });
}
