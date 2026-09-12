import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { infoPopup } from '../../common/infoPopup.js';
import { getActiveCreatureName, getCombatSummary, loadCombatSummary } from '../../../encounters/combatData.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

// Reverse the original damage when an attack that hit is turned into a miss.
function reverseHitDamage(combatSummary, attackResult, defenderName, nowMisses) {
    let defenderHp = null;
    let healedAmount = 0;
    if (nowMisses && defenderName) {
        const healAmount = attackResult.totalDamage || attackResult.primaryDamage || 0;
        if (healAmount > 0) {
            const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount);
            defenderHp = healResult?.newHp ?? null;
            healedAmount = healResult?.actualHeal ?? 0;
        }
    }
    return { defenderHp, healedAmount };
}

function hitOutcomeLabel(hit) {
    return hit == null ? 'N/A' : hit ? 'HIT' : 'MISS';
}

function attackRollHtml(label, d20, bonus, ac, outcome) {
    return `${label} d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${outcome}</b><br/>`;
}

function appendAttackOutcomeLines(description, hit, finalHit, defenderName, healedAmount) {
    if (hit === true && finalHit === true) {
        description += `<br/><i>Attack still hits.</i>`;
    } else if (hit === true && finalHit === false) {
        description += `<br/><i>The attack now misses!</i>`;
        if (healedAmount > 0) {
            description += `<br/>${defenderName} healed for ${healedAmount} HP.`;
        } else if (defenderName) {
            description += `<br/><i>No damage event found to reverse for ${defenderName}.</i>`;
        }
    } else if (hit === false) {
        description += `<br/><i>The attack already missed — no effect.</i>`;
    }
    return description;
}

async function handleAttackRollDebuff(action, _playerStats, campaignName, _mapName, attackerName, bardicDieSize, biDieRoll, combatSummary) {
    const auto = action.automation;

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent || attackResult.attackerName !== attackerName) {
        return infoPopup(action.name, `No recent attack roll found for ${attackerName}. ${action.name} can only be used shortly after an attack roll.`, auto);
    }

    const { d20, bonus, targetName, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const reducedD20 = Math.max(1, d20 - biDieRoll);
    const reducedHit = ac != null ? (reducedD20 + bonus >= ac) : null;
    const defenderName = targetName;

    const { defenderHp, healedAmount } = reverseHitDamage(combatSummary, attackResult, defenderName, hit === true && reducedHit === false);

    let description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>`;
    description += attackRollHtml('Attack roll:', d20, bonus, ac, hit ? 'HIT' : 'MISS');
    description += attackRollHtml('Reduced:', reducedD20, bonus, ac, hitOutcomeLabel(reducedHit));
    description = appendAttackOutcomeLines(description, hit, reducedHit, defenderName, healedAmount);

    return infoPopup(action.name, description, auto, { defenderHp });
}

async function handleDamageDebuff(action, _playerStats, campaignName, _mapName, attackerName, bardicDieSize, biDieRoll, combatSummary) {
    const auto = action.automation;

    const attackResult = await findLastAttack(campaignName);
    const lastEvent = attackResult.attackEvent;
    if (!lastEvent || !attackResult.totalDamage || attackResult.attackerName !== attackerName) {
        return infoPopup(action.name, `No recent damage event found for ${attackerName}. ${action.name} can only be used shortly after a damage roll.`, auto);
    }

    const defenderName = lastEvent.targetName;
    if (!defenderName) {
        return infoPopup(action.name, `Could not determine who ${attackerName} damaged. Cannot apply ${action.name}.`, auto);
    }

    const originalDamage = attackResult.totalDamage;
    const reducedDamage = Math.max(0, originalDamage - biDieRoll);
    const healAmount = originalDamage - reducedDamage;

    let defenderHp = null;
    if (healAmount > 0) {
        const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount);
        defenderHp = healResult?.newHp ?? null;
    }

    const description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Defender: ${defenderName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>Original damage: ${originalDamage}<br/>Reduced damage: <b>${reducedDamage}</b><br/>${healAmount > 0 ? `Healed ${defenderName} for ${healAmount} HP.` : ''}${defenderHp != null ? `<br/>${defenderName} HP: ${defenderHp}` : ''}`;

    return infoPopup(action.name, description, auto, { defenderHp });
}

async function handleDisadvantageDebuff(action, _playerStats, campaignName, _mapName, attackerName, combatSummary) {
    const auto = action.automation;

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent || attackResult.attackerName !== attackerName) {
        return infoPopup(action.name, `No recent attack roll found for ${attackerName}. ${action.name} can only be used shortly after an attack roll.`, auto);
    }

    const { d20, bonus, targetName, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const defenderName = targetName;

    const secondD20 = Math.floor(Math.random() * 20) + 1;
    const finalD20 = Math.min(d20, secondD20);
    const finalHit = ac != null ? (finalD20 + bonus >= ac) : null;

    const { defenderHp, healedAmount } = reverseHitDamage(combatSummary, attackResult, defenderName, hit === true && finalHit === false);

    let description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>`;
    description += attackRollHtml('Attack roll:', d20, bonus, ac, hit ? 'HIT' : 'MISS');
    description += attackRollHtml(`Disadvantage (second d20: ${secondD20}):`, finalD20, bonus, ac, hitOutcomeLabel(finalHit));
    description = appendAttackOutcomeLines(description, hit, finalHit, defenderName, healedAmount);

    return infoPopup(action.name, description, auto, { defenderHp, defenderName, healedAmount });
}

async function handleTeleportAndSlow(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const featureName = action.name || 'Branches of the Tree';
    const playerName = playerStats.name;

    await loadCombatSummary(campaignName);
    const activeCreatureName = getActiveCreatureName(campaignName);
    if (!activeCreatureName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No active creature found. ${featureName} triggers when a creature starts its turn within 30 feet.`,
                automation: auto,
            },
        };
    }

    const rangeFt = rangeToFeet(auto.range || '30_ft');
    const activeMapName = getRuntimeValue('__map__', 'activeMapName');

    if (activeMapName && _mapName) {
        const combatSummary = getCombatSummary(campaignName);
        if (combatSummary) {
            const playerCreature = combatSummary.players?.find(p => p.name === playerName);
            const targetCreature = combatSummary.creatures?.find(c => c.name === activeCreatureName);

            if (playerCreature?.gridX != null && playerCreature?.gridY != null &&
                targetCreature?.gridX != null && targetCreature?.gridY != null) {
                const inRange = await isWithinRange(playerName, activeCreatureName, rangeFt);
                if (!inRange) {
                    return {
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: featureName,
                            description: `${activeCreatureName} is out of range.`,
                            automation: auto,
                        },
                    };
                }
            }
        }
    }

    const strMod = getAbilityModifier(playerStats.abilities, 'STR');
    const prof = playerStats.proficiency || 0;
    const saveDc = 8 + strMod + prof;

    const { promptId } = createSaveListener(campaignName, {
        targetName: activeCreatureName,
        saveType: 'STR',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — ${activeCreatureName} must make STR save (DC ${saveDc}) or be teleported and have speed reduced to 0.`,
        promptId,
    }).catch((e) => { console.error("[branchesOfTheTree] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const isSuccessful = event.detail.success;

        if (!isSuccessful) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const effects = Array.isArray(storedEffects) ? [...storedEffects] : [];
            effects.push({
                effect: 'speed_reduction',
                target: activeCreatureName,
                source: featureName,
                value: 1000,
            });
            await setRuntimeValue('campaign', 'targetEffects', effects, campaignName);

            addExpiration(playerName, activeCreatureName, [
                { type: 'remove_target_effect', effectKey: 'speed_reduction', source: featureName, target: activeCreatureName }
            ], campaignName, 1);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName: activeCreatureName,
                saveDc,
                saveType: 'STR',
                success: false,
                description: `${activeCreatureName} failed STR save. ${activeCreatureName} is teleported and speed reduced to 0 until end of current turn.`,
            }).catch((e) => { console.error("[branchesOfTheTree] Error:", e); });
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerName,
                targetName: activeCreatureName,
                saveDc,
                saveType: 'STR',
                success: true,
                description: `${activeCreatureName} succeeded on STR save. ${featureName} has no effect.`,
            }).catch((e) => { console.error("[branchesOfTheTree] Error:", e); });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName: activeCreatureName,
            description: `${activeCreatureName} must make a STR saving throw (DC ${saveDc}) or be teleported and have speed reduced to 0.`,
        },
    };
}

async function applyImprovedWardingFlare(playerStats, campaignName, defenderName) {
    const allFeatures = [
        ...(playerStats.characterAdvancement || []),
        ...(playerStats.specialActions || []),
    ];
    const improvedWf = allFeatures.find(
        f => f.name === 'Improved Warding Flare' && f.automation?.tempHpExpression
    );
    if (!improvedWf) return null;

    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const wisMod = wis?.bonus ?? 0;

    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const amount = roll1 + roll2 + wisMod;
    if (amount <= 0) return null;

    setRuntimeValue(defenderName, 'tempHp', amount, campaignName);
    return amount;
}

function hasShield(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.armor_category === 'Shield') return true;
        }
    }
    return false;
}

function parseMagicItemName(itemName) {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
        const magicBonus = Number(itemName.charAt(1));
        return {
            baseName: itemName.substring(3),
            magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
        };
    }
    return { baseName: itemName, magicBonus: 0 };
}

function resolveUsesBudget(auto, playerStats, featureName) {
    const usesKey = getRuntimeUsesKey(featureName);
    const usesMax = auto.uses_expression
        ? (typeof auto.uses_expression === 'number'
            ? auto.uses_expression
            : evaluateAutoExpression(auto.uses_expression, playerStats))
        : 0;

    const bardicUsesMax = !auto.uses_expression
        ? (playerStats?._trackedResources?.bardicInspirationUses?.max
            ?? 0)
        : 0;

    const effectiveUsesMax = usesMax || bardicUsesMax;
    const effectiveUsesKey = bardicUsesMax > 0 ? 'bardicInspirationUses' : usesKey;

    return { effectiveUsesMax, effectiveUsesKey };
}

function currentUsesFor(playerName, budget) {
    return Number(getRuntimeValue(playerName, budget.effectiveUsesKey) ?? budget.effectiveUsesMax);
}

async function spendUse(playerName, budget, campaignName) {
    const currentUses = currentUsesFor(playerName, budget);
    await setRuntimeValue(playerName, budget.effectiveUsesKey, currentUses - 1, campaignName);
}

const refused = (response) => ({ refused: true, response });
const applied = (response, attackerName = null) => ({ refused: false, response, attackerName });

async function handleAttacksVsAlly(action, auto, playerStats, playerName, campaignName, _mapName, combatSummary) {
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent) {
        return refused(infoPopup(action.name, `No recent attack found. ${action.name} can only be used after an attack roll.`, auto));
    }

    const lastAttackerName = attackResult.attackerName;
    const defenderName = attackEvent.targetName;
    if (!defenderName) {
        return refused(infoPopup(action.name, `Could not determine who was attacked. Cannot apply ${action.name}.`, auto));
    }

    const rangeFt = auto.range ? parseInt(auto.range.replace(/[^0-9]/g, '')) || 5 : 5;
    if (_mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const inRange = await isWithinRange(playerName, lastAttackerName, rangeFt);
            if (!inRange) {
                return refused(infoPopup(action.name, `${lastAttackerName} is out of range.`, auto));
            }
        }
    }

    const duration = auto.duration || 'until_start_of_next_turn';

    const storedEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const protectionEffect = {
        effect: 'protection',
        target: defenderName,
        source: playerName,
        duration: duration,
        timestamp: Date.now(),
    };
    const existingIndex = storedEffects.findIndex(
        te => te.effect === 'protection' && te.target === defenderName
    );
    if (existingIndex === -1) {
        storedEffects.push(protectionEffect);
    } else {
        storedEffects[existingIndex] = protectionEffect;
    }
    await setRuntimeValue('campaign', 'targetEffects', storedEffects, campaignName);

    const result = await handleDisadvantageDebuff(action, playerStats, campaignName, _mapName, lastAttackerName, combatSummary);
    return applied(result);
}

// CLA-383: attacks resolve atomically (no pre-roll reaction seam), so a
// post-roll second-d20 simulation never touches the real attack roll and
// re-fired unlimited times on one resolved attack. Adjudicate instead like
// the verified pre-hit te producers (CLA-377 Vicious Mockery, Sap, Tumble):
// gate the trigger, spend one use, and write te disadvantage_next_attack so
// the attacker's next attack roll resolves with forcedMode:'disadvantage'.
async function handleWardingFlare(action, auto, playerName, featureName, campaignName, _mapName, combatSummary) {
    const refusalTag = featureName.toLowerCase().replace(/\s+/g, '_') + '_refused';
    const refuse = (description) => {
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: refusalTag,
            name: featureName,
            description,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[reactionDebuff] Error:", e); });
        return refused(infoPopup(action.name, description, auto));
    };

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent) {
        return refuse(`No recent attack roll found. ${featureName} can only be used in reaction to an attack roll.`);
    }

    const attackAttackerName = attackResult.attackerName;
    if (!attackAttackerName || attackAttackerName === playerName) {
        return refuse(`${featureName} cannot be used against your own attack rolls.`);
    }

    const flareDefenderName = attackEvent.targetName;
    const currentRound = combatSummary.round || 1;

    const rangeFt = rangeToFeet(auto.range || '30_ft');
    if (_mapName) {
        const positions = await resolveMapPositions(campaignName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const inRange = await isWithinRange(playerName, attackAttackerName, rangeFt);
            if (!inRange) {
                return refuse(`${attackAttackerName} is out of range of ${playerName} — ${featureName} requires the attacker to be within ${rangeFt} feet.`);
            }
        }
    }

    const latchKey = '_' + featureName.replace(/\s+/g, '_') + '_usedRound';
    if (getRuntimeValue(playerName, latchKey) === currentRound) {
        return refuse(`${featureName} has already been used this round — a Reaction can only be taken once per round. It re-arms when the next round begins.`);
    }

    const flareEffects = [...(getRuntimeValue('campaign', 'targetEffects') || [])];
    const flareEffect = {
        effect: 'disadvantage_next_attack',
        target: attackAttackerName,
        source: playerName,
        duration: 'until_used',
        appliedRound: currentRound,
        timestamp: Date.now(),
    };
    const flareIndex = flareEffects.findIndex(
        te => te.effect === 'disadvantage_next_attack' && te.target === attackAttackerName && te.source === playerName
    );
    if (flareIndex === -1) {
        flareEffects.push(flareEffect);
    } else {
        flareEffects[flareIndex] = flareEffect;
    }
    await setRuntimeValue('campaign', 'targetEffects', flareEffects, campaignName);

    await setRuntimeValue(playerName, latchKey, currentRound, campaignName);

    addExpiration(playerName, attackAttackerName, [
        { type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: playerName },
    ], campaignName, undefined, playerName);

    let flareDescription = `<b>${action.name}</b><br/>Light flares between ${flareDefenderName || 'the target'} and ${attackAttackerName}.<br/>`;
    flareDescription += `${attackAttackerName} has Disadvantage on its next attack roll (until used, or until the start of ${playerName}'s next turn).`;

    return applied(infoPopup(action.name, flareDescription, auto, { defenderName: flareDefenderName, attackerName: attackAttackerName }), attackAttackerName);
}

async function handleBardicRoll(action, auto, playerStats, playerName, featureName, campaignName, _mapName, combatSummary) {
    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return refused(infoPopup(featureName, `${featureName} requires a target. Select a creature in combat and try again.`, auto));
    }

    const attackerName = targetInfo.target.name;
    const rangeFt = auto.range ? parseInt(auto.range.replace(/[^0-9]/g, '')) || 60 : 60;

    if (_mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const inRange = await isWithinRange(playerName, attackerName, rangeFt);
            if (!inRange) {
                return refused(infoPopup(featureName, `${attackerName} is out of range.`, auto));
            }
        }
    }

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const bardicDieSize = classLevel?.bardic_die || 6;
    const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    const hasAttack = attackEvent && attackResult.attackerName === attackerName;

    if (!hasAttack) {
        return refused(infoPopup(featureName, `No recent roll found for ${attackerName} (attack, damage, or ability check). ${featureName} must be used shortly after the roll.`, auto));
    }

    if (attackEvent?.damageTypes?.length || attackResult.totalDamage > 0) {
        const result = await handleDamageDebuff(action, playerStats, campaignName, _mapName, attackerName, bardicDieSize, biDieRoll, combatSummary);
        return applied(result, attackerName);
    }

    const result = await handleAttackRollDebuff(action, playerStats, campaignName, _mapName, attackerName, bardicDieSize, biDieRoll, combatSummary);
    return applied(result, attackerName);
}

async function logAttacksVsAllyTail(playerName, featureName, campaignName, result) {
    const defenderName = result?.defenderName || 'the target';
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: result.payload.description,
        targetName: defenderName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionDebuff] Error:", e); });
    return result;
}

async function logWardingFlareTail(action, playerStats, playerName, featureName, campaignName, attackerName, result) {
    const defenderName = result?.defenderName;
    if (defenderName) {
        const tempHpAmount = await applyImprovedWardingFlare(playerStats, campaignName, defenderName);
        if (tempHpAmount) {
            result.payload.description += `<br/><br/>${defenderName} gains ${tempHpAmount} Temporary Hit Points from Improved Warding Flare.`;
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to give ${attackerName} Disadvantage on their next attack roll.`,
        targetName: attackerName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionDebuff] Error:", e); });

    addEntry(campaignName, {
        type: 'condition',
        characterName: playerName,
        targetName: attackerName,
        condition: 'Disadvantage on next attack',
        source: featureName,
        description: `${attackerName} has Disadvantage on its next attack roll (from ${playerName}'s ${featureName}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionDebuff] Error:", e); });

    return result;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Feature';

    if (auto.requiresShield && !hasShield(playerStats)) {
        return infoPopup(featureName, `${featureName}: You must be holding a Shield to use this Reaction.`, auto);
    }

    const budget = resolveUsesBudget(auto, playerStats, featureName);

    if (budget.effectiveUsesMax > 0 && currentUsesFor(playerName, budget) <= 0) {
        return infoPopup(featureName, `${featureName} has no uses remaining. Recharges on a ${auto.recharge === 'short_rest' ? 'Short or Long Rest' : 'Long Rest'}.`, auto);
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return infoPopup(featureName, `No combat context found. Cannot apply ${featureName}.`, auto);
    }

    const effect = auto.effect || '';
    let outcome;

    if (effect === 'disadvantage_on_attacks_vs_ally') {
        outcome = await handleAttacksVsAlly(action, auto, playerStats, playerName, campaignName, _mapName, combatSummary);
    } else if (effect === 'disadvantage_on_attack_roll') {
        outcome = await handleWardingFlare(action, auto, playerName, featureName, campaignName, _mapName, combatSummary);
    } else if (effect === 'teleport_and_slow') {
        outcome = applied(await handleTeleportAndSlow(action, playerStats, campaignName, _mapName));
    } else {
        outcome = await handleBardicRoll(action, auto, playerStats, playerName, featureName, campaignName, _mapName, combatSummary);
    }

    if (outcome.refused) return outcome.response;

    if (budget.effectiveUsesMax > 0) {
        await spendUse(playerName, budget, campaignName);
    }

    if (effect === 'disadvantage_on_attacks_vs_ally') {
        return logAttacksVsAllyTail(playerName, featureName, campaignName, outcome.response);
    }

    if (effect === 'disadvantage_on_attack_roll') {
        return logWardingFlareTail(action, playerStats, playerName, featureName, campaignName, outcome.attackerName, outcome.response);
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: outcome.response.payload.description,
        targetName: outcome.attackerName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionDebuff] Error:", e); });

    return outcome.response;
}
