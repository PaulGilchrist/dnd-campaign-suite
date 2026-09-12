import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { infoPopup } from '../../common/infoPopup.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

async function applyMissTurnedHitDamage({ campaignName, attackEvent, playerStats, characterName, logName }) {
    const damageFormula = attackEvent.damageFormula;
    if (!damageFormula) return;
    const damageResult = rollExpression(damageFormula);
    if (!damageResult || damageResult.total <= 0) return;
    const cs = await getCombatContext(campaignName);
    const characters = [playerStats];
    try {
        const appliedDmg = applyDamageToTarget(cs, attackEvent.targetName, damageResult.total, [attackEvent.damageType || 'unknown'], characters, false, { ignoreResistance: characterName });
        if (appliedDmg) {
            addEntry(campaignName, {
                type: 'roll',
                characterName,
                rollType: 'damage',
                name: logName,
                formula: damageFormula,
                rolls: damageResult.rolls,
                total: damageResult.total,
                modifier: damageResult.modifier,
                damageType: attackEvent.damageType || 'unknown',
                targetName: attackEvent.targetName,
                finalDamage: appliedDmg.finalDamage,
            }).catch((e) => { console.error("[autoReroll] Damage log error:", e); });
        }
    } catch (e) {
        console.error('[autoReroll] applyDamageToTarget failed:', e);
    }
}

async function handleAttackRoll(action, bonus, lastAttack, playerStats, campaignName, skipDamageRoll = false) {
    const auto = action.automation;
    if (!lastAttack || lastAttack.rollType !== 'attack') {
        return infoPopup(action.name, `No recent attack roll found. This feature can only be used shortly after an attack roll.`, auto);
    }

    const { d20, bonus: atkBonus, targetAc, hit } = lastAttack;
    const ac = targetAc;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + atkBonus;
    const modifiedHit = ac != null ? (modifiedTotal >= ac) : null;

    let description = `<b>${action.name}</b><br/>`;
    description += `Bonus: +${bonus}<br/>`;
    description += `Attack roll: d20(${d20}) + ${atkBonus} = ${d20 + atkBonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Modified: d20(${modifiedD20}) + ${atkBonus} = ${modifiedTotal} vs AC ${ac != null ? ac : '—'} → <b>${modifiedHit == null ? 'N/A' : modifiedHit ? 'HIT' : 'MISS'}</b><br/>`;

    if (hit === true) {
        description += `<br/><i>Attack already hit — no effect.</i>`;
    } else if (hit === false && modifiedHit === true) {
        description += `<br/><i>Miss turned into a hit!</i>`;

        if (!skipDamageRoll) {
            await applyMissTurnedHitDamage({ campaignName, attackEvent: lastAttack, playerStats, characterName: playerStats.name, logName: action.name });
        }
    } else if (hit === false && modifiedHit === false) {
        description += `<br/><i>Still a miss.</i>`;
    }

    return infoPopup(action.name, description, auto);
}

function handleAbilityCheck(action, bonus, lastAttack) {
    const auto = action.automation;
    const isCheck = lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill';
    if (!isCheck) {
        return infoPopup(action.name, `No recent ability check found. This feature can only be used shortly after an ability check.`, auto);
    }

    const { d20, bonus: checkBonus, checkName } = lastAttack;
    const originalTotal = d20 + checkBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + checkBonus;

    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${checkName}: d20(${d20}) + ${checkBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${checkBonus} = <b>${modifiedTotal}</b>`;

    return infoPopup(action.name, description, auto);
}

function handleSaveRoll(action, bonus, lastAttack) {
    const auto = action.automation;
    if (!lastAttack || lastAttack.rollType !== 'save') {
        return infoPopup(action.name, `No recent saving throw found. This feature can only be used shortly after a saving throw.`, auto);
    }

    const { d20, bonus: saveBonus, saveType } = lastAttack;
    const originalTotal = d20 + saveBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + saveBonus;

    const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${saveLabel}: d20(${d20}) + ${saveBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${saveBonus} = <b>${modifiedTotal}</b>`;

    return infoPopup(action.name, description, auto);
}

async function consumeChannelDivinity(auto, playerStats, campaignName) {
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return infoPopup(playerStats.name, 'No Channel Divinity charges remaining.', auto);
    }

    await setRuntimeValue(playerStats.name, 'channelDivinityCharges', currentCharges - 1, campaignName);
    return null;
}

async function consumeFocusPoints(auto, playerStats, campaignName) {
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxFocus = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
    const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints') ?? maxFocus);

    if (currentFocus <= 0) {
        return infoPopup(playerStats.name, 'No Focus Points remaining.', auto);
    }

    await setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
    return null;
}

async function consumeResourceCost(auto, playerStats, campaignName) {
    if (auto.resourceCost === 'channel_divinity') {
        return consumeChannelDivinity(auto, playerStats, campaignName);
    }
    if (auto.resourceCost === 'focus_points') {
        return consumeFocusPoints(auto, playerStats, campaignName);
    }
    return null;
}

async function findAllyMissedAttack(playerStats, campaignName, _mapName, rangeFt) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) return null;
    if (lastAttack.rollType !== 'attack' || lastAttack.hit !== false) return null;
    if (lastAttack.attackerName === playerStats.name) return null;

    if (_mapName && rangeFt != null) {
        const inRange = await isWithinRange(playerStats.name, lastAttack.attackerName, rangeFt);
        if (!inRange) return null;
    }

    return { name: lastAttack.attackerName, attackEvent: lastAttack };
}

function getBardicDieSize(playerStats) {
    if (!playerStats.class?.class_levels) return 0;
    const classLevel = playerStats.class.class_levels.find(cl => cl.level === playerStats.level);
    return classLevel?.bardic_die || 0;
}

function isFreshPlayerRoll(lastAttack, playerName) {
    const isAttackMiss = lastAttack?.rollType === 'attack' && lastAttack.hit === false;
    const isPlayerAttack = lastAttack?.attackerName === playerName;
    const isCheck = (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill');
    const isPlayerCheck = lastAttack?.attackerName === playerName;

    return { attackFresh: isAttackMiss && isPlayerAttack, abilityFresh: isCheck && isPlayerCheck };
}

async function handleGuardedMind(action, auto, playerName, lastAttack, campaignName) {
    const trackingKey = `_guardedMind_usedRest`;
    const usedRest = getRuntimeValue(playerName, trackingKey);
    if (usedRest === 'rest') {
        return infoPopup(action.name, `${action.name} can only be used once per Short or Long Rest.`, auto);
    }

    const isSave = lastAttack?.rollType === 'save';
    const isPlayerSave = lastAttack?.targetName === playerName;

    if (!isSave || !isPlayerSave) {
        return infoPopup(action.name, `No recent saving throw found for ${playerName}. This feature can only be used shortly after a saving throw.`, auto);
    }

    const { saveType } = lastAttack;
    const validAbilities = ['Intelligence', 'Wisdom', 'Charisma'];
    const abbr = saveType ? saveType.substring(0, 3).toUpperCase() : '';
    const abilityAbbrMap = { INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
    const isValidSave = validAbilities.includes(saveType) || Object.keys(abilityAbbrMap).includes(abbr);

    if (!isValidSave) {
        return infoPopup(action.name, `${action.name} only works on Intelligence, Wisdom, or Charisma saving throws.`, auto);
    }

    await setRuntimeValue(playerName, trackingKey, 'rest', campaignName);

    const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
    const description = `<b>${action.name}</b><br/>` +
        `${saveLabel}: d20(${lastAttack.d20}) + ${lastAttack.bonus} = ${lastAttack.d20 + lastAttack.bonus}` +
        ` → <strong>SUCCESS (Guarded Mind)</strong>`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to override a failed ${saveLabel} save.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[autoReroll] Error:", e); });

    return infoPopup(action.name, description, auto);
}

async function handleSavingThrowReroll(action, auto, playerName, playerStats, lastAttack, campaignName) {
    const costError = await consumeResourceCost(auto, playerStats, campaignName);
    if (costError) return costError;

    const isSave = lastAttack?.rollType === 'save';
    const isPlayerSave = lastAttack?.targetName === playerName;

    if (!isSave || !isPlayerSave) {
        return infoPopup(action.name, `No recent saving throw found for ${playerName}. This feature can only be used shortly after a saving throw.`, auto);
    }

    const result = handleSaveRoll(action, 0, lastAttack);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to reroll a saving throw.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[autoReroll] Error:", e); });

    return result;
}

async function bardicAttackOutcome({ action, playerName, playerStats, lastAttack, campaignName, biDieRoll, bardicDieSize }) {
    const { d20, bonus: atkBonus, targetAc, hit } = lastAttack;
    const ac = targetAc;
    const modifiedD20 = d20 + biDieRoll;
    const modifiedTotal = modifiedD20 + atkBonus;
    const modifiedHit = ac != null ? (modifiedTotal >= ac) : null;
    const originalTotal = d20 + atkBonus;

    const logDescription = `${playerName} used ${action.name} on attack: d20(${d20}) + ${atkBonus} = ${originalTotal} vs AC ${ac != null ? ac : '—'} → ${hit ? 'HIT' : 'MISS'}. Bonus: +${biDieRoll} → Modified: d20(${modifiedD20}) + ${atkBonus} = ${modifiedTotal} vs AC ${ac != null ? ac : '—'} → ${modifiedHit == null ? 'N/A' : modifiedHit ? 'HIT' : 'MISS'}. Bardic Inspiration die: 1d${bardicDieSize} (${biDieRoll}).`;
    const result = await handleAttackRoll(action, biDieRoll, lastAttack, playerStats, campaignName);
    return { logDescription, result };
}

function bardicAbilityCheckOutcome(action, playerName, lastAttack, biDieRoll, bardicDieSize) {
    const { d20, bonus: checkBonus, checkName } = lastAttack;
    const originalTotal = d20 + checkBonus;
    const modifiedD20 = d20 + biDieRoll;
    const modifiedTotal = modifiedD20 + checkBonus;

    const logDescription = `${playerName} used ${action.name} on ${checkName || 'ability check'}: d20(${d20}) + ${checkBonus} = ${originalTotal}. Bonus: +${biDieRoll} → Modified: d20(${modifiedD20}) + ${checkBonus} = ${modifiedTotal}. Bardic Inspiration die: 1d${bardicDieSize} (${biDieRoll}).`;
    const result = handleAbilityCheck(action, biDieRoll, lastAttack);
    return { logDescription, result };
}

async function handleBardicInspiration({ action, auto, playerName, playerStats, lastAttack, campaignName, bardicDieSize }) {
    const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
        ?? (playerStats.proficiency || 0);

    let currentUses = usesMax;
    if (usesMax > 0) {
        currentUses = Number(getRuntimeValue(playerName, 'bardicInspirationUses') ?? usesMax);
        if (currentUses <= 0) {
            return infoPopup(action.name, `${action.name} has no uses remaining. Recharges on a Long Rest.`, auto);
        }
    }

    const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

    const { attackFresh, abilityFresh } = isFreshPlayerRoll(lastAttack, playerName);

    if (!attackFresh && !abilityFresh) {
        return infoPopup(action.name, `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`, auto);
    }

    const { logDescription, result } = attackFresh
        ? await bardicAttackOutcome({ action, playerName, playerStats, lastAttack, campaignName, biDieRoll, bardicDieSize })
        : bardicAbilityCheckOutcome(action, playerName, lastAttack, biDieRoll, bardicDieSize);

    if (usesMax > 0) {
        await setRuntimeValue(playerName, 'bardicInspirationUses', currentUses - 1, campaignName);
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDescription,
        biDieRoll,
        biDieSize: bardicDieSize,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[autoReroll] Error:", e); });

    return result;
}

function homingStrikeRefusal(action, auto, lastAttack, playerName) {
    const attackFresh = lastAttack?.rollType === 'attack' && lastAttack.hit === false && lastAttack.attackerName === playerName;
    if (!attackFresh) {
        return infoPopup(action.name, `${action.name}: No recent missed attack found — Homing Strikes can only be used when one of your own attack rolls misses.`, auto);
    }
    if (lastAttack.isPsychicBlade !== true) {
        return infoPopup(action.name, `${action.name}: your last miss was with ${lastAttack.attackName || 'a normal attack'} — Homing Strikes only works with Psychic Blade attacks.`, auto);
    }
    if (lastAttack.d20 === 1) {
        return infoPopup(action.name, `${action.name}: you rolled a natural 1 — an attack roll of 1 always misses, and Homing Strikes cannot be used.`, auto);
    }
    if (lastAttack.homingStrikesAttempted || lastAttack.homingStrikesUsed) {
        return infoPopup(action.name, `${action.name}: Homing Strikes has already resolved this attack roll. Manifest a new Psychic Blade and attack again.`, auto);
    }
    return null;
}

async function handleHomingStrikes({ action, auto, playerName, playerStats, lastAttack, campaignName, usesKey, currentUses, defaultMax }) {
    const refusal = homingStrikeRefusal(action, auto, lastAttack, playerName);
    if (refusal) return refusal;

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = Math.floor(Math.random() * psionicDieSize) + 1;
    const { d20, bonus: atkBonus, targetAc } = lastAttack;
    const ac = lastAttack.effectiveAc ?? targetAc;
    const modifiedD20 = d20 + dieRoll;
    const modifiedTotal = modifiedD20 + atkBonus;
    const modifiedHit = ac != null ? (modifiedTotal >= ac) : null;
    const originalTotal = d20 + atkBonus;
    const acText = ac != null ? ac : '—';
    const modifiedHitText = modifiedHit == null ? 'N/A' : modifiedHit ? 'HIT' : 'MISS';
    const struck = modifiedHit === true;

    let logDescription = `${playerName} used ${action.name} (Homing Strikes) on Psychic Blade attack: d20(${d20}) + ${atkBonus} = ${originalTotal} vs AC ${acText} → MISS. Psionic die: 1d${psionicDieSize} (${dieRoll}) → Modified: d20(${modifiedD20}) + ${atkBonus} = ${modifiedTotal} vs AC ${acText} → ${modifiedHitText}.`;
    let result;
    if (struck) {
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
        logDescription += ` Miss turned into a hit — 1 Psionic Energy expended. Psionic Energy: ${currentUses - 1}/${defaultMax}.`;
        result = await handleAttackRoll(action, dieRoll, lastAttack, playerStats, campaignName);
    } else {
        logDescription += ` Still a miss — Psionic Energy die NOT expended. Psionic Energy: ${currentUses}/${defaultMax}.`;
        result = handleAttackRoll(action, dieRoll, lastAttack, playerStats, campaignName);
    }

    await setRuntimeValue('campaign', 'lastAttack', {
        ...lastAttack,
        hit: struck,
        homingStrikesAttempted: true,
        homingStrikesUsed: struck,
        homingStrikesBonus: struck ? dieRoll : null,
    }, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDescription,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[autoReroll] Error:", e); });

    return result;
}

function buildPsionicAttackRerollText({ playerName, actionName, lastAttack, dieRoll, psionicDieSize, currentUses, defaultMax }) {
    const { d20, bonus: atkBonus, targetAc, hit } = lastAttack;
    const ac = targetAc;
    const modifiedD20 = d20 + dieRoll;
    const modifiedTotal = modifiedD20 + atkBonus;
    const modifiedHit = ac != null ? (modifiedTotal >= ac) : null;
    const originalTotal = d20 + atkBonus;
    const acText = ac != null ? ac : '—';
    const modifiedHitText = modifiedHit == null ? 'N/A' : modifiedHit ? 'HIT' : 'MISS';
    return `${playerName} used ${actionName} on attack: d20(${d20}) + ${atkBonus} = ${originalTotal} vs AC ${acText} → ${hit ? 'HIT' : 'MISS'}. Bonus: +${dieRoll} → Modified: d20(${modifiedD20}) + ${atkBonus} = ${modifiedTotal} vs AC ${acText} → ${modifiedHitText}. Psionic Energy Die: 1d${psionicDieSize} (${dieRoll}). Psionic Energy: ${currentUses - 1}/${defaultMax}.`;
}

async function handlePsionicEnergyDie(action, auto, playerName, playerStats, lastAttack, campaignName) {
    const usesKey = 'psionicEnergy';
    const defaultMax = playerStats._trackedResources?.[usesKey]?.max || 6;
    const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? defaultMax);

    if (currentUses <= 0) {
        return infoPopup(action.name, `${action.name}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`, auto);
    }

    // CLA-320: Homing Strikes (Soulknife Soul Blades) is the only
    // psionic_energy_die auto_reroll in the 2024 data. RAW gates: the
    // trigger is a missed Psychic Blade attack roll (not a natural 1,
    // not a check, not an already-resolved miss), and the Psionic Energy
    // die is expended ONLY if the boosted total turns the miss into a hit.
    const isHomingStrikes = auto.trigger === 'psychic_blade_miss' || auto.condition === 'psychic_blade_miss';
    if (isHomingStrikes) {
        return handleHomingStrikes({ action, auto, playerName, playerStats, lastAttack, campaignName, usesKey, currentUses, defaultMax });
    }

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = Math.floor(Math.random() * psionicDieSize) + 1;

    const { attackFresh, abilityFresh } = isFreshPlayerRoll(lastAttack, playerName);

    if (!attackFresh && !abilityFresh) {
        return infoPopup(action.name, `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`, auto);
    }

    let logDescription;
    let result;
    if (attackFresh) {
        logDescription = buildPsionicAttackRerollText({ playerName, actionName: action.name, lastAttack, dieRoll, psionicDieSize, currentUses, defaultMax });
        result = await handleAttackRoll(action, dieRoll, lastAttack, playerStats, campaignName);
    } else {
        const { d20, bonus: checkBonus, checkName } = lastAttack;
        const originalTotal = d20 + checkBonus;
        const modifiedD20 = d20 + dieRoll;
        const modifiedTotal = modifiedD20 + checkBonus;

        logDescription = `${playerName} used ${action.name} on ${checkName || 'ability check'}: d20(${d20}) + ${checkBonus} = ${originalTotal}. Bonus: +${dieRoll} → Modified: d20(${modifiedD20}) + ${checkBonus} = ${modifiedTotal}. Psionic Energy Die: 1d${psionicDieSize} (${dieRoll}). Psionic Energy: ${currentUses - 1}/${defaultMax}.`;
        result = handleAbilityCheck(action, dieRoll, lastAttack);
    }

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDescription,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[autoReroll] Error:", e); });

    return result;
}

async function handleBonusReroll({ action, auto, playerName, playerStats, lastAttack, campaignName, _mapName }) {
    const bonus = Number(auto.bonus);

    const costError = await consumeResourceCost(auto, playerStats, campaignName);
    if (costError) return costError;

    const { attackFresh, abilityFresh } = isFreshPlayerRoll(lastAttack, playerName);

    if (attackFresh) {
        const ac = lastAttack.effectiveAc ?? lastAttack.targetAc;
        const modifiedD20 = lastAttack.d20 + bonus;
        const modifiedTotal = modifiedD20 + lastAttack.bonus;
        const modifiedHit = ac != null ? (modifiedTotal >= ac) : lastAttack.hit;

        if (lastAttack.hit === false && modifiedHit === true) {
            await applyMissTurnedHitDamage({ campaignName, attackEvent: lastAttack, playerStats, characterName: playerName, logName: action.name });
        }

        const result = handleAttackRoll(action, bonus, lastAttack, playerStats, campaignName, true);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name}: +${bonus} to own failed attack roll.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[autoReroll] Error:", e); });
        return result;
    }
    if (abilityFresh) {
        const result = handleAbilityCheck(action, bonus, lastAttack);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name}: +${bonus} to own failed ability check.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[autoReroll] Error:", e); });
        return result;
    }

    if (auto.range) {
        const rangeFt = rangeToFeet(auto.range);
        const ally = await findAllyMissedAttack(playerStats, campaignName, _mapName, rangeFt);
        if (ally) {
            const attackEvent = ally.attackEvent;
            const ac = attackEvent.effectiveAc ?? attackEvent.targetAc;
            const modifiedD20 = attackEvent.d20 + bonus;
            const modifiedTotal = modifiedD20 + attackEvent.bonus;
            const modifiedHit = ac != null ? (modifiedTotal >= ac) : attackEvent.hit;

            if (attackEvent.hit === false && modifiedHit === true) {
                await applyMissTurnedHitDamage({ campaignName, attackEvent, playerStats, characterName: ally.name, logName: attackEvent.attackName || attackEvent.name || 'Attack' });
            }

            const result = handleAttackRoll(action, bonus, attackEvent, playerStats, campaignName, true);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} used ${action.name}: +${bonus} to ${ally.name}'s failed attack roll.`,
                targetName: ally.name,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[autoReroll] Error:", e); });
            return result;
        }
    }

    return infoPopup(action.name, 'No recent failed attack roll or ability check found for you or any ally within range.', auto);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName) || null;

    if (auto.target === 'saving_throw') {
        if (auto.effect === 'override_fail_to_success' && auto.oncePer) {
            return handleGuardedMind(action, auto, playerName, lastAttack, campaignName);
        }
        return handleSavingThrowReroll(action, auto, playerName, playerStats, lastAttack, campaignName);
    }

    const bardicDieSize = getBardicDieSize(playerStats);

    if (bardicDieSize > 0 && auto.bonusExpression === 'bardic_inspiration_die') {
        return handleBardicInspiration({ action, auto, playerName, playerStats, lastAttack, campaignName, bardicDieSize });
    }

    if (auto.bonusExpression === 'psionic_energy_die') {
        return handlePsionicEnergyDie(action, auto, playerName, playerStats, lastAttack, campaignName);
    }

    if (auto.bonus != null) {
        return handleBonusReroll({ action, auto, playerName, playerStats, lastAttack, campaignName, _mapName });
    }

    return automationInfoPopup(action);
}
