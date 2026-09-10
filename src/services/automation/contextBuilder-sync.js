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

export async function buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, _featRangeEffects, opts = {}) {
    // WM-008: one-shot attack te (vex/distracting) is consumed by the NEXT attack ROLL
    // only. Damage-phase ctx rebuilds (proceedWithDamage / buildContext / cunningStrike)
    // run after the roll and must not consume the te the same attack's tacticalMaster
    // step has just stamped — that self-erase meant Vex advantage was never produced.
    const consumeAttackTe = opts.consumeAttackTe !== false;
    const playerName = playerStats.name;

    return buildBaseAttackContext(playerName, campaignName, attack.damageType).then(async ({ target, targetName, resistanceNotice }) => {

        // Sanctuary: ends if the warded creature makes an attack roll
        const sanctuaryEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(
            te => te.effect === 'sanctuary' && te.source === playerName
        );
        if (sanctuaryEffects.length > 0) {
            for (const se of sanctuaryEffects) {
                endSanctuary(playerName, se.target, campaignName,
                    `${playerName} made an attack roll, ending Sanctuary.`);
            }
        }

        // Hunter's Lore: reveal full IRV info for Hunter's Mark target
        let hunterLoreNotice = null;
        const lorePassives = playerStats.automation?.passives || [];
        const hasHunterLore = lorePassives.some(p => p.type === 'passive_rule' && p.effect === 'hunter_lore');
        if (hasHunterLore && target) {
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
            if (irvParts.length > 0) {
                hunterLoreNotice = irvParts.join('\n');
            }
        }

        // Check for Stunning Strike save advantage (consumed on use)
        let hasSaveAdvantage = false;
        if (targetName) {
            const advKey = `_advantageOn_${targetName}`;
            const storedAdvantage = getRuntimeValue(playerName, advKey);
            if (Array.isArray(storedAdvantage)) {
                const idx = storedAdvantage.indexOf(targetName);
                if (idx !== -1) {
                    hasSaveAdvantage = true;
                    storedAdvantage.splice(idx, 1);
                    setRuntimeValue(playerName, advKey, storedAdvantage, campaignName);
                }
            }
        }

        const innateSorceryBonus = getInnateSorceryBonus(playerName, campaignName);

        // !!! ADDING A NEW TARGET EFFECT? !!!
        // First check if it exists in src/services/combat/conditions/targetEffectDefinitions.js
        // Every new te.effect value MUST be added there with label/description/group/icon.
        // The GM UI depends on this registry to display manual-add options.

        // Accumulate advantage/disadvantage counts so they cancel per rules
        let adv = 0;
        let dis = 0;

        let forcedMode = conditionAttackMode !== 'normal' ? conditionAttackMode : undefined;
        let sunderingBonus = 0;
        if (forcedMode === undefined) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const sapEffect = storedEffects.find(
                te => te.effect === 'disadvantage_next_attack' && te.target === playerName
            );
            if (sapEffect) {
                dis++;
            }
            const slasherEffect = storedEffects.find(
                te => te.effect === 'slasher_enhanced_critical' && te.target === playerName
            );
            if (slasherEffect) {
                dis++;
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const recklessEffect = storedEffects.find(
                te => te.effect === 'reckless_attack' && te.target === targetName
            );
            if (recklessEffect) {
                adv++;
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const crusherEffect = storedEffects.find(
                te => te.effect === 'crusher_enhanced_critical' && te.target === targetName
            );
            if (crusherEffect) {
                adv++;
            }
        }
        if (hasSaveAdvantage && forcedMode === undefined) {
            adv++;
        }
        if (innateSorceryBonus.spellAdvantage && forcedMode === undefined) {
            adv++;
        }

        // Add stance damage bonus (e.g. Rage) if an active combat buff provides one
        let stanceDamageBonus = 0;
        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        for (const buff of activeBuffs) {
            if (buff.damageBonusExpression) {
                const resolved = buff.damageBonusExpression === 'rage_damage'
                    ? (playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2)
                    : 0;
                stanceDamageBonus += resolved;
            }
        }

        // Frenzy: extra rage_damage_d6 when reckless, raging, strength-based (once per turn)
        let frenzyDamageFormula = null;
        const frenzyActions = (playerStats.automation?.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'reckless_attack_hit_while_raging');
        if (frenzyActions.length > 0) {
            const frenzyOncePerTurn = frenzyActions[0].oncePerTurn;
            let skipFrenzy = false;
            if (frenzyOncePerTurn) {
                const usedRound = getRuntimeValue(playerName, '_frenzyUsedRound', campaignName);
                const currentRound = getCurrentCombatRound(campaignName);
                if (usedRound === currentRound) {
                    skipFrenzy = true;
                }
            }
            if (!skipFrenzy) {
                const isReckless = activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');
                const isRaging = activeBuffs.some(b => b.damageBonusExpression);
                const attackAbilityName = attack?.abilityName;
                const isStr = attackAbilityName ? attackAbilityName.toLowerCase() === 'strength' : null;
                const strMod = playerStats.abilities?.find(a => a.name === 'Strength')?.bonus ?? 0;
                const dexMod = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0;
                const inferredIsStr = strMod >= dexMod;
                const isStrFinal = isStr !== null ? isStr : inferredIsStr;
                if (isReckless && isRaging && isStrFinal) {
                    const frenzyResolved = resolveDiceExpression(frenzyActions[0].damageExpression, playerStats);
                    if (frenzyResolved) {
                        frenzyDamageFormula = frenzyResolved;
                    }

                }
            }
        }

        // Grant attack advantage if Reckless Attack (or similar buff) is active
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

        // Target conditions that grant advantage (blinded, charmed, paralyzed, petrified, restrained, stunned, unconscious, dazed, slow)
        if (targetName && forcedMode === undefined) {
            const targetConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            if (Array.isArray(targetConditions)) {
                const condSet = new Set(targetConditions.map(c => String(c).toLowerCase()));
                if (condSet.has('blinded')) {
                    adv++;
                }
                if (condSet.has('charmed')) {
                    adv++;
                }
                if (condSet.has('paralyzed') || condSet.has('petrified') || condSet.has('stunned') || condSet.has('unconscious')) {
                    adv++;
                }
                if (condSet.has('restrained')) {
                    adv++;
                }
                if (condSet.has('dazed') || condSet.has('slow')) {
                    adv++;
                }
            }
        }

        // Grappler feat: advantage on attacks against grappled targets
        if (targetName && forcedMode === undefined) {
            const hasGrapplerAdvantage = (playerStats.saveModifiers || []).some(
                mod => mod.target === 'attack_roll' || mod.target === 'attack_rolls'
            );
            if (hasGrapplerAdvantage) {
                const targetConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                if (Array.isArray(targetConditions)) {
                    const condSet = new Set(targetConditions.map(c => String(c).toLowerCase()));
                    if (condSet.has('grappled')) {
                        adv++;
                    }
                }
            }
        }

        // Dodge: attackers have disadvantage on attacks against the target
        if (targetName && forcedMode === undefined) {
            const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
            if (Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'dodge')) {
                dis++;
            }
        }

        // Protection from Evil and Good: warded creature types have disadvantage on attack rolls against the target
        if (targetName && forcedMode === undefined) {
            if (isProtectionFromEvilAndGoodActive(targetName, campaignName)) {
                const combatSummary = await getCombatContext(campaignName);
                const attackerCreature = combatSummary?.creatures?.find(c => c.name === playerName);
                if (attackerCreature && isCreatureWarded(resolveCreatureType(attackerCreature), targetName, campaignName)) {
                    dis++;
                }
            }
        }

        // Death Ward: attackers have disadvantage on attack rolls against the target
        if (targetName && forcedMode === undefined) {
            if (isDeathWardActive(targetName, campaignName)) {
                dis++;
            }
        }

        // Resolve accumulated adv/dis to forcedMode (they cancel per rules)
        if (forcedMode === undefined) {
            if (adv > dis) {
                forcedMode = 'advantage';
            } else if (dis > adv) {
                forcedMode = 'disadvantage';
            }
        }

        // Antimagic Field — allow only weapon attacks when either attacker or target is affected
        const amfStoredEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const amfEffects = amfStoredEffects.filter(te => te.effect === 'antimagic_field');
        const attackerAffected = amfEffects.some(te => te.target === playerName);
        const targetAffected = targetName ? amfEffects.some(te => te.target === targetName) : false;

        if ((attackerAffected || targetAffected) && targetName) {
            const isWeaponAttack = attack.type === 'weapon_attack' || attack.weaponType || attack.isWeaponAttack !== false;
            if (!isWeaponAttack) {
                return {
                    isAutoMiss: true,
                    rangeReason: 'Antimagic Field blocks non-weapon attacks',
                    notice: 'Attack blocked by Antimagic Field — only weapon attacks are allowed.',
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
        }

        // Resilient Sphere — block all attacks when attacker or target is enclosed
        const rsAttackerSphere = isResilientSphereActive(playerName, campaignName);
        const rsTargetSphere = targetName ? isResilientSphereActive(targetName, campaignName) : false;

        if ((rsAttackerSphere || rsTargetSphere) && targetName) {
            return {
                isAutoMiss: true,
                rangeReason: 'Resilient Sphere blocks attacks — nothing passes through the barrier',
                notice: 'Attack blocked by Resilient Sphere — nothing can pass through the barrier.',
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

        // Brutal Strike: override to normal when chosen
        const brutalStrikeNoAdvantage = getRuntimeValue(playerStats.name, '_brutalStrikeNoAdvantage', campaignName);
        if (brutalStrikeNoAdvantage) {
            forcedMode = 'normal';
        }

        // Sacred Weapon: Add Charisma modifier to attack rolls (minimum +1) for melee attacks
        let sacredWeaponBonus = 0;
        const sacredWeaponActive = activeBuffs.some(b => b.effect === 'sacred_weapon');
        if (sacredWeaponActive && (attack.weaponType === 'melee' || attack.weaponType === 'unarmed')) {
            const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
            const chaMod = Math.max(1, cha?.bonus || 0);
            sacredWeaponBonus = chaMod;
        }

        // Blessed Warrior: +2 bonus to attack rolls with melee weapons
        let blessedWarriorBonus = 0;
        const hasBlessedWarrior = activeBuffs.some(b => b.effect === 'blessed_warrior');
        if (hasBlessedWarrior && (attack.weaponType === 'melee' || attack.weaponType === 'unarmed')) {
            blessedWarriorBonus = 2;
        }

        // Brutal Strike: add extra damage dice when active
        let brutalStrikeFormulaPart = null;
        let brutalStrikeRider = null;
        const brutalStrikeActive = getRuntimeValue(playerName, '_brutalStrikeActive', campaignName);
        if (brutalStrikeActive) {
            const allAutomation = [...(playerStats.automation?.actions || []), ...(playerStats.automation?.passives || [])];
            brutalStrikeRider = selectBrutalStrikeRiders(allAutomation)[0];
            if (brutalStrikeRider) {
                const diceMatch = brutalStrikeRider.damageExpression.match(/^(\d+)d(\d+)/);
                if (diceMatch) {
                    brutalStrikeFormulaPart = `${brutalStrikeRider.damageExpression} [Brutal Strike]`;
                }

                // Read pre-existing next_attack_bonus effects before adding new ones
                const preExistingEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const preExistingBonusKeys = preExistingEffects.filter(
                    te => te.effect === 'next_attack_bonus' && te.target === targetName
                ).map(te => JSON.stringify(te));

                // Apply chosen effects to targetEffects
                const effectChoices = getRuntimeValue(playerName, '_brutalStrikeEffects', campaignName) || [];
                if (effectChoices.length > 0) {
                    let storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                    const riderOptions = brutalStrikeRider.options || [];
                    for (const choiceName of effectChoices) {
                        const option = riderOptions.find(o => o.name === choiceName);
                        if (!option) continue;
                        if (option.effect === 'disadvantage_on_next_save' || option.effect === 'next_attack_bonus') {
                            const newEffect = {
                                target: targetName,
                                source: playerName,
                                option: option.name,
                                effect: option.effect,
                                value: option.effect === 'next_attack_bonus' ? (option.value || 5) : (option.value || null),
                                noOpportunityAttacks: option.noOpportunityAttacks || false,
                                duration: 'until_start_of_next_turn',
                            };
                            storedEffects = [...storedEffects, newEffect];
                        }
                    }
                    setRuntimeValue('campaign', 'targetEffects', storedEffects, campaignName);
                }

                // Consume pre-existing next_attack_bonus effects (Sundering Blow consumed on this attack)
                if (preExistingBonusKeys.length > 0) {
                    const currentEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                    const cleanedEffects = currentEffects.filter(
                        te => !(te.effect === 'next_attack_bonus' && te.target === targetName && preExistingBonusKeys.includes(JSON.stringify(te)))
                    );
                    if (cleanedEffects.length !== currentEffects.length) {
                        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
                    }
                }
                setRuntimeValue(playerName, '_brutalStrikeActive', null, campaignName);
                setRuntimeValue(playerName, '_brutalStrikeEffects', null, campaignName);
            }
        }

        // Vow of Enmity: Advantage on attack rolls against the vowed creature
        if (targetName && forcedMode === undefined) {
            const targetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
            if (Array.isArray(targetBuffs) && targetBuffs.some(b => b.effect === 'vow_of_enmity')) {
                forcedMode = 'advantage';
            }
        }

        // Clairvoyant Combatant: Advantage on attack rolls against the bonded creature (on failed save)
        const clairvoyantActive = activeBuffs.some(b => b.effect === 'clairvoyant_combatant');
        if (clairvoyantActive && targetName) {
            const clairvoyantTarget = getRuntimeValue(playerName, 'clairvoyantCombatantTarget', campaignName);
            if (clairvoyantTarget && targetName === clairvoyantTarget && forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Avenging Angel: Advantage on attack rolls against Frightened creatures in the aura
        const avengingAngelActive = isAvengingAngelActive(playerName, campaignName);
        if (avengingAngelActive && targetName && forcedMode === undefined) {
            if (isAuraTarget(playerName, targetName, campaignName)) {
                forcedMode = 'advantage';
            }
        }

        const primaryDamage = attack.damage || attack.damage_dice_primary || '';
        const autoDamageFormula = [primaryDamage, stanceDamageBonus > 0 ? stanceDamageBonus : null, frenzyDamageFormula, brutalStrikeFormulaPart].filter(v => v !== null).join(' plus ');

        const effectiveHitBonus = (attack.hitBonus ?? 0) + sacredWeaponBonus + blessedWarriorBonus + sunderingBonus;
        const hitBonusFormulaParts = [attack.hitBonusFormula];
        if (sacredWeaponBonus > 0) hitBonusFormulaParts.push(`Sacred Weapon (${sacredWeaponBonus})`);
        if (blessedWarriorBonus > 0) hitBonusFormulaParts.push(`Blessed Warrior (${blessedWarriorBonus})`);
        if (sunderingBonus > 0) hitBonusFormulaParts.push(`Sundering Blow (+${sunderingBonus})`);
        const hitBonusFormula = hitBonusFormulaParts.join(' + ');

        const isMelee = attack.weaponType === 'melee' || attack.weaponType === 'unarmed';

        // Invoke Duplicity: Distract grants Advantage on attack rolls while the illusion is active
        if (activeBuffs.some(b => b.effect === 'create_illusion')) {
            if (forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Precise Hunter (2024 Ranger level 17): Advantage on attack rolls against Hunter's Mark target
        let advantageReason = undefined;
        const hasPreciseHunter = (playerStats.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'precise_hunter'
        );
        if (hasPreciseHunter && targetName && forcedMode === undefined) {
            const combatSummary = await getCombatContext(campaignName);
            const attackerCreature = combatSummary?.creatures?.find(c => c.name === playerName);
            if (attackerCreature?.concentration?.spell === "Hunter's Mark" && attackerCreature?.concentration?.target === targetName) {
                forcedMode = 'advantage';
                advantageReason = 'Precise Hunter (Hunter\'s Mark)';
            }
        }

        // Aura checks when no map is active — all creatures considered in range
        if (forcedMode === undefined) {
            const noMapWolf = await getWolfAdvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapWolf.advantage) {
                forcedMode = 'advantage';
            }
        }
        if (forcedMode === undefined) {
            const noMapDuplicity = await getDuplicityAdvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapDuplicity.advantage) {
                forcedMode = 'advantage';
                advantageReason = 'Improved Duplicity';
            }
        }
        if (forcedMode === undefined) {
            const noMapLion = await getLionDisadvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapLion.disadvantage) {
                forcedMode = 'disadvantage';
            }
        }
        if (forcedMode === undefined && targetName && consumeAttackTe) {
            forcedMode = consumeOneShotAdvantageTe(
                playerName,
                targetName,
                campaignName,
                (te, pn, tn) => te.effect === 'distracting_strike_advantage' && te.target === tn && te.source !== pn
            );
        }
        if (forcedMode === undefined && targetName && consumeAttackTe) {
            forcedMode = consumeOneShotAdvantageTe(
                playerName,
                targetName,
                campaignName,
                (te, pn, tn) => te.effect === 'next_attack_advantage' && te.target === pn && te.vexTarget === tn,
                true
            );
        }
        if (targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const bonusEffects = storedEffects.filter(
                te => te.effect === 'next_attack_bonus' && te.target === targetName
            );
            if (bonusEffects.length > 0) {
                for (const be of bonusEffects) {
                    sunderingBonus += (parseInt(be.value, 10) || 5);
                }
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const protectionEffect = storedEffects.find(
                te => te.effect === 'protection' && te.target === targetName
            );
            if (protectionEffect) {
                forcedMode = 'disadvantage';
            }
        }
        // Blur and Foresight: attackers without Blindsight or Truesight have disadvantage on attacks against the target
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const hasBlindsightOrTruesight = (playerStats.senses || []).some(s => {
                const name = (s.name || s.type || '').toLowerCase();
                return name === 'blindsight' || name === 'truesight';
            });
            if (!hasBlindsightOrTruesight) {
                const blurEffect = storedEffects.find(te => te.effect === 'blur' && te.target === targetName);
                const foresightEffect = storedEffects.find(te => te.effect === 'foresight' && te.target === targetName);
                if (blurEffect || foresightEffect) {
                    dis++;
                }
            }
        }
        if (forcedMode === undefined && targetName) {
            const noMapCorona = getCoronaSaveDisadvantage({
                targetName,
                campaignName,
                damageType: attack.damageType,
                skipRangeCheck: true,
            });
            if (noMapCorona.disadvantage) {
                forcedMode = 'disadvantage';
            }
        }

        // Compute critical range from passives (e.g., Improved Critical, Superior Critical)
        let criticalRange = '';
        const passives = playerStats.automation?.passives || [];
        for (const passive of passives) {
            if (passive.type === 'passive_rule' && passive.effect === 'critical_range' && passive.criticalRange) {
                criticalRange = passive.criticalRange;
            }
        }

        // Compute Defensive Duelist AC bonus (2024 rules)
        let defensiveDuelistBonus = 0;
        const ddActiveBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        const ddBuff = ddActiveBuffs.find(b => b.effect === 'defensive_duelist');
        if (ddBuff) {
            defensiveDuelistBonus = playerStats.proficiency || 0;
        }

        // Compute Bait and Switch AC bonus (2024 rules)
        let baitAndSwitchBonus = 0;
        const baitAndSwitchActive = getRuntimeValue(targetName, 'baitAndSwitchActive', campaignName);
        if (baitAndSwitchActive) {
            baitAndSwitchBonus = Number(getRuntimeValue(targetName, 'baitAndSwitchBonus', campaignName) || 0);
        }

        // Stroke of Luck: check if the player has the passive available
        const hasStrokeOfLuck = (playerStats.automation?.passives || []).some(
            p => p.type === 'stroke_of_luck'
        );
        const strokeOfLuckUsed = hasStrokeOfLuck ? getRuntimeValue(playerName, 'strokeOfLuckUsed', campaignName) : false;
        const strokeOfLuckAvailable = hasStrokeOfLuck && !strokeOfLuckUsed;

        // Boon of Combat Prowess: check if the player has auto_reroll for attacks (stored in actions/reactions, not passives)
        const allAutomation = [
            ...(playerStats.automation?.actions || []),
            ...(playerStats.automation?.reactions || []),
            ...(playerStats.automation?.passives || []),
        ];
        const hasBoonOfCombatProwess = allAutomation.some(
            p => p.type === 'auto_reroll' && (p.effect === 'convert_miss_to_hit' || p.automation?.effect === 'convert_miss_to_hit')
        );
        const boonOfCombatProwessUsed = hasBoonOfCombatProwess ? getRuntimeValue(playerName, 'boonOfCombatProwessUsed') : false;
        const boonOfCombatProwessAvailable = hasBoonOfCombatProwess && !boonOfCombatProwessUsed;

        // Graze: check if the player has Graze weapon mastery for this weapon
        let grazeDamage = false;
        let grazeAbilityName = null;
        let grazeAbilityMod = 0;
        const available = collectWeaponMastery(attack.name, playerStats);
        const hasGraze = available.baseMastery === 'Graze' || available.extraMasteries?.includes('Graze');
        if (hasGraze) {
            grazeDamage = true;
            grazeAbilityName = attack.abilityName || 'Strength';
            const grazeAbility = playerStats.abilities?.find(a => a.name === grazeAbilityName);
            grazeAbilityMod = grazeAbility?.bonus || 0;
        }

        // Boon of Fate: check if the player has the passive available
        const hasBoonOfFate = (playerStats.automation?.passives || []).some(
            p => p.type === 'modify_d20_roll'
        );
        const boonOfFateUsed = hasBoonOfFate ? getRuntimeValue(playerName, 'boonOfFateUsed', campaignName) : false;
        const boonOfFateAvailable = hasBoonOfFate && !boonOfFateUsed;

        // Determine sneak attack eligibility
        let sneakAttackDice = 0;
        const isRogue = playerStats.class?.name === 'Rogue';
        if (isRogue) {
            const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
            // 2024 rules: sneak_attack_num_d6 directly on class level
            // 5e rules: class_specific.sneak_attack.dice_count
            const sneakAttackNumD6 = classLevel?.sneak_attack_num_d6 || classLevel?.class_specific?.sneak_attack?.dice_count || 0;
            const hasSneakAttack = sneakAttackNumD6 > 0;
            const weaponProperties = attack.properties || [];
            const hasFinesse = weaponProperties.some(p => p.toLowerCase() === 'finesse');
            const hasRanged = attack.weaponType === 'ranged';
            const isSneakAttackWeapon = hasFinesse || hasRanged;
            const hasDisadvantage = forcedMode === 'disadvantage';
            const hasAdvantage = forcedMode === 'advantage';
            if (hasSneakAttack && isSneakAttackWeapon && !hasDisadvantage) {
                const sneakUsedRound = getRuntimeValue(playerStats.name, '_SneakAttack_usedRound', campaignName);
                if (sneakUsedRound === getCurrentCombatRound(campaignName)) {
                    sneakAttackDice = 0;
                } else if (hasAdvantage) {
                    sneakAttackDice = sneakAttackNumD6;
                } else {
                    const combatSummary = await getCombatContext(campaignName);
                    if (combatSummary) {
                        const targetCreature = combatSummary.creatures?.find(c => c.name === targetName);
                        if (targetCreature) {
                            const hasAllyInRange = await (async () => {
                                for (const c of combatSummary.creatures) {
                                    if (c.name === playerName || c.name === targetName) continue;
                                    if (c.type === 'player' || (c.type === 'npc' && c.attitude !== 'hostile')) {
                                        if (allyIsIncapacitated(c)) continue;
                                        const inRange = await isWithinRange(targetName, c.name, 5);
                                        if (inRange) return true;
                                    }
                                }
                                return false;
                            })();
                            if (hasAllyInRange) {
                                sneakAttackDice = sneakAttackNumD6;
                            }
                        }
                    }
                }
            }
        }

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
