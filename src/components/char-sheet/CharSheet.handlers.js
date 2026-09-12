import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { executeEmpoweredReroll } from '../../services/rules/spells/empoweredSpellService.js'
import { getManeuversForRules, getSuperiorityDice } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js'
import { loadCombatSummary } from '../../services/encounters/combatData.js'
import * as storageService from '../../services/ui/storage.js'
import { addEntry } from '../../services/ui/logService.js'
import { evaluateAutoExpression } from '../../services/combat/automation/automationExpressions.js'
import { isProficientSkillOrToolCheck } from '../../services/rules/psiBolsteredKnack.js'

export function handleReroll(playerStats, campaignName, conditionEffects, rerollInfo) {
    if (!playerStats) return;
    const rerollBonus = conditionEffects.autoRerollBonus || 0;
    const rollDetail = rerollInfo ? ` New d20 ${rerollInfo.roll}, total ${rerollInfo.total}.` : ''
    if (conditionEffects.autoRerollCondition === 'raging') {
        setRuntimeValue(playerStats.name, 'fanaticalFocusUsed', true, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Fanatical Focus',
            description: `${playerStats.name} used Fanatical Focus to reroll a failed saving throw.${rollDetail}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[CharSheet] Error logging Fanatical Focus reroll:', e); });
    } else if (conditionEffects.autoRerollCondition === 'disciplined_survivor') {
        const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? playerStats.focusPoints);
        if (currentFocus <= 0) {
            return;
        }
        setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Disciplined Survivor',
            description: `${playerStats.name} used Disciplined Survivor (1 Focus Point) to reroll a failed saving throw.${rollDetail}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[CharSheet] Error logging Disciplined Survivor reroll:', e); });
    } else {
        const current = Number(getRuntimeValue(playerStats.name, 'indomitableUses', campaignName) ?? 0);
        const max = (playerStats.level || 0) >= 17 ? 3 : (playerStats.level || 0) >= 13 ? 2 : 1;
        if (current >= max) {
            return;
        }
        setRuntimeValue(playerStats.name, 'indomitableUses', current + 1, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Indomitable',
            description: `${playerStats.name} used Indomitable to reroll a failed saving throw${rerollBonus ? ` (+${rerollBonus})` : ''}. Uses used: ${current + 1}/${max}.${rollDetail}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[CharSheet] Error logging Indomitable reroll:', e); });
    }
}

export function handleStrokeOfLuck(playerStats, campaignName, popupHtml, featureKey) {
    if (!playerStats) return;
    if (featureKey === 'boonOfCombatProwess') {
        setRuntimeValue(playerStats.name, 'boonOfCombatProwessUsed', Date.now(), campaignName);
        return;
    }
    setRuntimeValue(playerStats.name, 'strokeOfLuckUsed', true, campaignName);
    const d20 = Number(popupHtml?.rolls?.[0]) || 0;
    const bonus = Number(popupHtml?.bonus) || 0;
    const modifier = Number(popupHtml?.modifier) || 0;
    const originalTotal = d20 + bonus + modifier;
    const newTotal = 20 + bonus + modifier;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Stroke of Luck',
        description: `${playerStats.name} used Stroke of Luck on ${popupHtml?.name || 'a D20 Test'}: d20 ${d20} → 20 (total ${originalTotal} → ${newTotal}).${popupHtml?.hit === false ? ' Miss converted to a hit.' : ''}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[CharSheet] Error logging Stroke of Luck:', e); });
}

export async function handleBardicInspiration(playerStats, campaignName, popupHtml) {
    if (!playerStats) return;
    const playerName = playerStats.name;
    const biDie = getRuntimeValue(playerName, 'bardicInspirationDie', campaignName);
    if (!biDie) return;
    const grantedBy = getRuntimeValue(playerName, 'bardicInspirationGrantedBy', campaignName) || 'unknown';
    const checkName = popupHtml?.name || 'Ability Check';
    const d20 = popupHtml?.rolls?.[0] || 0;
    const bonus = popupHtml?.bonus || 0;
    const modifier = popupHtml?.modifier || 0;
    const originalTotal = d20 + bonus + modifier;
    const modifiedTotal = originalTotal + biDie;
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Bardic Inspiration',
        description: `${playerName} used Bardic Inspiration (1d${popupHtml?.dieSize || 'd6'}): +${biDie} to ${checkName} (d20 ${d20} + ${bonus + modifier} = ${originalTotal} → ${modifiedTotal}). Inspiration granted by ${grantedBy}.`,
        dieValue: biDie,
        dieSize: popupHtml?.dieSize || 'd6',
        timestamp: Date.now(),
    });
    setRuntimeValue(playerName, 'bardicInspirationDie', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationGrantedBy', null, campaignName);
}

export async function handleBiDefenseCombatSummary(playerStats, campaignName, { dieValue, newAc, willMiss }) {
    if (!playerStats) return;
    const cs = await loadCombatSummary(campaignName);
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const la = lastAttack;
    if (la) {
        la.effectiveAc = newAc;
        la.bardicInspirationDefense = { used: true, biRoll: dieValue, newEffectiveAc: newAc };
        if (willMiss) {
            la.hit = false;
            la.isAutoMiss = true;
        }
        storageService.default.set('combatSummary', cs, campaignName);
    }
}

export async function handleBardicInspirationOffense(playerStats, campaignName, characters, dieValue, dieSize) {
    if (!playerStats) return;
    const playerName = playerStats.name;
    const biUsesRaw = getRuntimeValue(playerName, 'bardicInspirationUses', campaignName);
    const biUsesNum = (typeof biUsesRaw === 'object' && biUsesRaw !== null) ? biUsesRaw.current : (biUsesRaw != null ? Number(biUsesRaw) : (playerStats?._trackedResources?.bardicInspirationUses?.current ?? 0));
    if (biUsesNum > 0) {
        await setRuntimeValue(playerName, 'bardicInspirationUses', biUsesNum - 1, campaignName);
    }
    const cs = await loadCombatSummary(campaignName);
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const la = lastAttack;
    const targetName = la?.targetName;
    const damageType = la?.damageType || 'Bludgeoning';
    const damageTypes = Array.isArray(damageType) ? damageType : [damageType];
    if (targetName) {
        const applyResult = applyDamageToTarget(cs, targetName, dieValue, damageTypes, campaignName, characters, { ignoreResistance: false, attackerName: playerName });
        if (applyResult) {
            storageService.default.set('combatSummary', cs, campaignName);
        }
    }
    setRuntimeValue(playerName, 'bardicInspirationDie', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationCombatOptions', null, campaignName);
    setRuntimeValue(playerName, 'bardicInspirationGrantedBy', null, campaignName);
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Combat Inspiration - Offense',
        description: `${playerName} used Combat Inspiration - Offense, rolling ${dieValue} (d${dieSize}) bonus damage${targetName ? ` on ${targetName}` : ''}.`,
        biDieRoll: dieValue,
        timestamp: Date.now(),
    });
}

export async function handleEmpoweredSpell(playerStats, campaignName, characters, popupHtml, lastEventData) {
    if (!playerStats || !campaignName) return null;
    const result = await executeEmpoweredReroll({
        campaignName,
        playerStats,
        lastEvent: lastEventData,
        chaMod: popupHtml?.empoweredSpellChaMod || 0,
        characters,
    });
    if (result?.popupState?.result) {
        return result.popupState.result;
    }
    return null;
}

export async function handlePuncture(playerStats, campaignName, characters, popupHtml, setPopupHtml, punctureData) {
    if (!playerStats || !campaignName || !punctureData) return null;
    
    const playerName = playerStats.name;
    const usedKey = 'piercerPunctureUsedThisTurn';
    const used = getRuntimeValue(playerName, usedKey, campaignName);
    if (used) return null;
    
    const { rawDamage, targetName, damageTypes, originalRolls, newRolls, rerolledIndex, originalValue, newValue } = punctureData;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary || !targetName) return null;

    const damageDifference = newRolls.reduce((sum, r) => sum + r, 0) + (popupHtml?.modifier || 0) - rawDamage;
    
    if (damageDifference !== 0) {
        applyDamageToTarget(combatSummary, targetName, damageDifference, damageTypes || [popupHtml?.damageType || 'Piercing'], campaignName, characters, { ignoreResistance: false, attackerName: playerName });
    }
    
    await setRuntimeValue(playerName, usedKey, true, campaignName);
    
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Piercer - Puncture',
        description: `${playerName} used Piercer - Puncture: rerolled die ${rerolledIndex + 1} from ${originalValue} → ${newValue} (${originalRolls.join(', ')} → ${newRolls.join(', ')}).`,
        timestamp: Date.now(),
    });
    
    const newTotal = newRolls.reduce((sum, r) => sum + r, 0) + (popupHtml?.modifier || 0);
    const newFinalDamage = Math.max(0, newTotal);
    
    setPopupHtml({
        ...popupHtml,
        total: newTotal,
        adjustedTotal: newTotal,
        rolls: newRolls,
        finalDamage: newFinalDamage,
    });
    
    return {
        originalDice: originalRolls,
        newDice: newRolls,
        rerolledIndex,
        originalValue,
        newValue,
    };
}

export async function handleSavageAttacker(playerStats, campaignName, characters, popupHtml, setPopupHtml, savageData) {
    if (!playerStats || !campaignName || !savageData) return null;

    const playerName = playerStats.name;
    const usedKey = '_Savage_Attacker_usedRound';
    const stored = getRuntimeValue(playerName, usedKey, campaignName);
    if (stored) return null;

    const { targetName, originalRolls, newRolls } = savageData;
    if (!targetName) return null;

    const originalTotal = originalRolls.reduce((s, r) => s + r, 0);
    const newTotal = newRolls.reduce((s, r) => s + r, 0);
    const better = newTotal > originalTotal;

    await setRuntimeValue(playerName, usedKey, true, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Savage Attacker',
        description: better
            ? `${playerName} used Savage Attacker against ${targetName}: rolled ${originalRolls.join(', ')} (${originalTotal}) then rerolled ${newRolls.join(', ')} (${newTotal}). Awaiting choice of which total to keep.`
            : `${playerName} used Savage Attacker against ${targetName}: rolled ${originalRolls.join(', ')} (${originalTotal}) then rerolled ${newRolls.join(', ')} (${newTotal}) — kept original total ${originalTotal}.`,
        timestamp: Date.now(),
    });

    return {
        original: originalRolls.join(', '),
        rerolled: newRolls.join(', '),
        originalTotal,
        newTotal,
        better,
        awaitingChoice: better,
    };
}

export async function handleSavageAttackerChoice(playerStats, campaignName, characters, popupHtml, setPopupHtml, choiceData) {
    if (!playerStats || !campaignName || !choiceData) return null;

    const playerName = playerStats.name;
    const { keep, originalRolls, newRolls, rawDamage, modifier, targetName, damageTypes } = choiceData;

    const originalTotal = originalRolls.reduce((s, r) => s + r, 0);
    const newTotal = newRolls.reduce((s, r) => s + r, 0);

    if (keep === 'reroll' && newTotal > originalTotal) {
        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary || !targetName) return null;

        const damageDifference = (newTotal + (modifier || 0)) - rawDamage;
        if (damageDifference > 0) {
            applyDamageToTarget(combatSummary, targetName, damageDifference, damageTypes || [popupHtml?.damageType || 'Slashing'], campaignName, characters, { ignoreResistance: false, attackerName: playerName });
        }

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Savage Attacker',
            description: `${playerName} kept Savage Attacker reroll total ${newTotal} over original ${originalTotal} (+${Math.max(0, damageDifference)} damage to ${targetName}).`,
            timestamp: Date.now(),
        });

        const newPopupTotal = rawDamage + Math.max(0, damageDifference);
        const updatedPopup = {
            ...popupHtml,
            total: newPopupTotal,
            adjustedTotal: newPopupTotal,
            rolls: newRolls,
        };
        if (popupHtml?.finalDamage !== undefined) updatedPopup.finalDamage = popupHtml.finalDamage + Math.max(0, damageDifference);
        if (popupHtml?.targetCurrentHp !== undefined) updatedPopup.targetCurrentHp = popupHtml.targetCurrentHp - Math.max(0, damageDifference);
        setPopupHtml(updatedPopup);

        return { kept: 'reroll', damageDifference };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Savage Attacker',
        description: `${playerName} kept original Savage Attacker total ${originalTotal} (reroll was ${newTotal}). No damage change.`,
        timestamp: Date.now(),
    });

    return { kept: 'original', damageDifference: 0 };
}

function extractTacticalMindRoll(popupHtml) {
    return {
        checkName: popupHtml?.name || 'Ability Check',
        d20: popupHtml?.rolls?.[0] || 0,
        bonus: popupHtml?.bonus || 0,
        dieValue: popupHtml?.tacticalMindDie || 0,
    };
}

export async function handleTacticalMind(playerStats, campaignName, popupHtml, setPopupHtml) {
    if (!playerStats) return;
    const playerName = playerStats.name;
    const { checkName, d20, bonus, dieValue } = extractTacticalMindRoll(popupHtml);
    const originalTotal = d20 + bonus;
    const modifiedTotal = originalTotal + dieValue;

    const refuse = (reason) => {
        if (setPopupHtml) {
            setPopupHtml({
                type: 'automation_info',
                name: 'Tactical Mind',
                description: `<b>Tactical Mind</b><br/>${reason}`,
            });
        }
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Tactical Mind',
            description: `${playerName} attempted Tactical Mind on ${checkName} — refused: ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[CharSheet] Error logging Tactical Mind refusal:', e); });
    };

    if (popupHtml?.success === true || d20 === 20) {
        refuse('Tactical Mind can only be used when the ability check fails.');
        return;
    }
    const currentUses = Number(getRuntimeValue(playerName, 'secondWindUses', campaignName) ?? 0);
    if (!(currentUses > 0)) {
        refuse('No Second Wind uses remaining.');
        return;
    }

    // CLA-352: expend only if the boosted total succeeds (GM adjudication,
    // mirrors the verified Psi-Bolstered Knack flow — sheet checks carry no DC).
    const succeeded = popupHtml?.tacticalSuccess === true;
    if (succeeded) {
        await setRuntimeValue(playerName, 'secondWindUses', currentUses - 1, campaignName);
    }
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Tactical Mind',
        description: `${playerName} used Tactical Mind: +${dieValue} to ${checkName} (d20 ${d20} + ${bonus} = ${originalTotal} → ${modifiedTotal}). ${succeeded ? 'Check succeeded — Second Wind use expended.' : 'Check still failed — Second Wind use not expended.'}`,
        d10Roll: dieValue,
        timestamp: Date.now(),
    });
}

export async function handleDarkOnesLuck(playerStats, campaignName, popupHtml) {
    if (!playerStats) return;
    const playerName = playerStats.name;
    const usesKey = 'darkOnesLuckUses';
    const chaMod = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const maxUses = Math.max(1, chaMod);
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? maxUses);
    if (currentUses <= 0) return;
    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    const rollName = popupHtml?.name || 'Ability Check';
    const d20 = popupHtml?.rolls?.[0] || 0;
    const bonus = popupHtml?.bonus || 0;
    const originalTotal = d20 + bonus;
    const luckValue = popupHtml?.darkOnesLuckValue || 0;
    const modifiedTotal = originalTotal + luckValue;
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: "Dark One's Own Luck",
        description: `${playerName} used Dark One's Own Luck: +1d10(${luckValue}) to ${rollName} (d20 ${d20} + ${bonus} = ${originalTotal} → ${modifiedTotal}). Uses remaining: ${currentUses - 1}/${maxUses}.`,
        timestamp: Date.now(),
    });
}

async function adjustInitiativeTrackerForManeuver(campaignName, playerName, newTotal) {
    const cs = await loadCombatSummary(campaignName);
    if (!cs) return;
    const creature = cs.creatures.find(
        c => c.type === 'player' && c.name === playerName
    );
    if (!creature) return;
    creature.initiative = String(newTotal);
    cs.creatures.sort((a, b) => b.initiative - a.initiative);
    console.error('[CharSheet initiative adjust] set activeCreatureName:', cs.creatures[0]?.name);
    storageService.default.set('combatSummary', cs, campaignName);
}

export async function handleSuperiorityManeuver(playerStats, campaignName, setPopupHtml, popupHtml, maneuverName, dieValue) {
    if (!playerStats) return;
    try {
        const allManeuvers = await getManeuversForRules(playerStats.rules || '2024');
        const maneuver = allManeuvers.find(m => m.name === maneuverName);
        if (!maneuver) return;

        const superiorityDice = getSuperiorityDice(playerStats, campaignName);
        if (superiorityDice <= 0) return;

        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);

        const skillName = popupHtml?.name || 'Ability Check';
        const oldTotal = popupHtml?.rolls?.[0] + (popupHtml?.bonus || 0);
        const newTotal = oldTotal + dieValue;

        // Update initiative tracker if this was an initiative roll
        if (skillName === 'Initiative' || popupHtml?.rollType === 'initiative') {
            await adjustInitiativeTrackerForManeuver(campaignName, playerStats.name, newTotal);
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: playerStats.name, roll: newTotal },
            }));
        }

        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuverName,
            description: `Used ${maneuverName} on ${skillName} check. Superiority die rolled ${dieValue}. Adjusted total: ${oldTotal} → ${newTotal}.`,
        };

        // Show result popup
        const dieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
        const desc = `<b>${maneuverName}</b><br/>Rolled d${dieSize} for ${dieValue}.<br/>${skillName}: ${oldTotal} → <b>${newTotal}</b> (+${dieValue})`;
        setPopupHtml({
            type: 'automation_info',
            name: maneuverName,
            description: desc,
        });

        try {
            await addEntry(campaignName, logEntry);
        } catch (e) {
            console.error('[CharSheet] Error logging superiority maneuver:', e);
        }
    } catch (e) {
        console.error('[CharSheet] Superiority maneuver execution failed:', e);
    }
}

function refusePsiBolsteredKnack(campaignName, name, popupName, popupHtml, setPopupHtml) {
    console.error('[CharSheet] Psi-Bolstered Knack refused in ineligible context:', { checkName: popupHtml?.name, rollType: popupHtml?.rollType, success: popupHtml?.success });
    if (setPopupHtml) {
        setPopupHtml({
            type: 'automation_info',
            name: 'Psi-Bolstered Knack',
            description: '<b>Psi-Bolstered Knack</b><br/>Psi-Bolstered Knack only applies when you fail a proficient skill or tool check.',
        });
    }
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: name,
        abilityName: 'Psi-Bolstered Knack',
        description: `${name} attempted Psi-Bolstered Knack on ${popupName} — refused: Psi-Bolstered Knack only applies when you fail a proficient skill or tool check.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[CharSheet] Error logging Psi-Bolstered Knack refusal:', e); });
}

async function expendPsiEnergyOnSuccess(campaignName, name, success) {
    if (!success) return;
    const currentEnergy = Number(getRuntimeValue(name, 'psionicEnergy', campaignName) ?? 0);
    if (currentEnergy > 0) {
        await setRuntimeValue(name, 'psionicEnergy', currentEnergy - 1, campaignName);
    }
}

export async function handlePsiBolsteredKnack(playerStats, campaignName, popupHtml, dieValue, dieSize, success, setPopupHtml) {
    if (!playerStats) return;
    const name = playerStats.name;
    const popupName = popupHtml?.name || 'Ability Check';

    const isIneligibleContext = popupHtml?.success === true
        || !isProficientSkillOrToolCheck(playerStats, popupHtml?.name);
    if (isIneligibleContext) {
        refusePsiBolsteredKnack(campaignName, name, popupName, popupHtml, setPopupHtml);
        return;
    }

    const oldRoll = popupHtml?.rolls?.[0] || 0;
    const bonus = popupHtml?.bonus || 0;
    const oldTotal = oldRoll + bonus;
    const newTotal = oldTotal + dieValue;

    await expendPsiEnergyOnSuccess(campaignName, name, success);

    const desc = `<b>Psi-Bolstered Knack</b><br/>Rolled d${dieSize} for ${dieValue}.<br/>${popupName}: ${oldTotal} → <b>${newTotal}</b> (+${dieValue})${success ? ' — Succeeded, energy expended' : ' — Still failed, energy not expended'}`;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: name,
        abilityName: 'Psi-Bolstered Knack',
        description: desc,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[CharSheet] Error logging Psi-Bolstered Knack:', e); });
}
