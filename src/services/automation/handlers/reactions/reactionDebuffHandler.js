import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { infoPopup } from '../../common/infoPopup.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

async function handleAttackRollDebuff(action, _playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary) {
    const auto = action.automation;

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent || attackResult.attackerName !== attackerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent attack roll found for ${attackerName}. ${action.name} can only be used shortly after an attack roll.`,
                automation: auto,
            },
        };
    }

    const { d20, bonus, targetName, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const reducedD20 = Math.max(1, d20 - biDieRoll);
    const reducedHit = ac != null ? (reducedD20 + bonus >= ac) : null;
    const defenderName = targetName;

    let defenderHp = null;

    if (hit === true && reducedHit === false && defenderName) {
        const healAmount = attackResult.primaryDamage || attackResult.totalDamage || 0;
        if (healAmount > 0) {
            const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount, campaignName);
            defenderHp = healResult?.newHp ?? null;
        }
    }

    let description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>`;
    description += `Attack roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Reduced: d20(${reducedD20}) + ${bonus} = ${reducedD20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${reducedHit == null ? 'N/A' : reducedHit ? 'HIT' : 'MISS'}</b><br/>`;

    if (hit === true && reducedHit === true) {
        description += `<br/><i>Attack still hits.</i>`;
    } else if (hit === true && reducedHit === false) {
        description += `<br/><i>The attack now misses!</i>`;
        if (defenderHp != null) {
            description += `<br/>${defenderName} healed to ${defenderHp} HP.`;
        } else if (defenderName) {
            description += `<br/><i>No damage event found to reverse for ${defenderName}.</i>`;
        }
    } else if (hit === false) {
        description += `<br/><i>The attack already missed — no effect.</i>`;
    }

    return infoPopup(action.name, description, auto, { defenderHp });
}

async function handleDamageDebuff(action, _playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary) {
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
        const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount, campaignName);
        defenderHp = healResult?.newHp ?? null;
    }

    const description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Defender: ${defenderName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>Original damage: ${originalDamage}<br/>Reduced damage: <b>${reducedDamage}</b><br/>${healAmount > 0 ? `Healed ${defenderName} for ${healAmount} HP.` : ''}${defenderHp != null ? `<br/>${defenderName} HP: ${defenderHp}` : ''}`;

    return infoPopup(action.name, description, auto, { defenderHp });
}

async function handleDisadvantageDebuff(action, _playerStats, campaignName, attackerName, combatSummary) {
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

    let defenderHp = null;

    if (hit === true && finalHit === false && defenderName) {
        const healAmount = attackResult.primaryDamage || attackResult.totalDamage || 0;
        if (healAmount > 0) {
            const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount, campaignName);
            defenderHp = healResult?.newHp ?? null;
        }
    }

    let description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>`;
    description += `Attack roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Disadvantage (second d20: ${secondD20}): d20(${finalD20}) + ${bonus} = ${finalD20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${finalHit == null ? 'N/A' : finalHit ? 'HIT' : 'MISS'}</b><br/>`;

    if (hit === true && finalHit === true) {
        description += `<br/><i>Attack still hits.</i>`;
    } else if (hit === true && finalHit === false) {
        description += `<br/><i>The attack now misses!</i>`;
        if (defenderHp != null) {
            description += `<br/>${defenderName} healed to ${defenderHp} HP.`;
        } else if (defenderName) {
            description += `<br/><i>No damage event found to reverse for ${defenderName}.</i>`;
        }
    } else if (hit === false) {
        description += `<br/><i>The attack already missed — no effect.</i>`;
    }

    return infoPopup(action.name, description, auto, { defenderHp, defenderName });
}

async function applyImprovedWardingFlare(playerStats, defenderName, campaignName) {
    const improvedWf = (playerStats.characterAdvancement || []).find(
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

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Feature';

    if (auto.requiresShield && !hasShield(playerStats)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: You must be holding a Shield to use this Reaction.`,
                automation: auto,
            },
        };
    }

    const usesKey = getRuntimeUsesKey(featureName);
    const usesMax = auto.uses_expression
        ? (typeof auto.uses_expression === 'number'
            ? auto.uses_expression
            : evaluateAutoExpression(auto.uses_expression, playerStats))
        : 0;

    const bardicUsesMax = !auto.uses_expression
        ? (playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
            ?? 0)
        : 0;

    const effectiveUsesMax = usesMax || bardicUsesMax;

    if (effectiveUsesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? effectiveUsesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} has no uses remaining. Recharges on a ${auto.recharge === 'short_rest' ? 'Short or Long Rest' : 'Long Rest'}.`,
                    automation: auto,
                },
            };
        }
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires a target. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const attackerName = targetInfo.target.name;
    const rangeFt = rangeToFeet(auto.range || '60_ft');

    if (mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, mapName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist != null && dist > rangeFt) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${attackerName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                        automation: auto,
                    },
                };
            }
        }
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No combat context found. Cannot apply ${featureName}.`,
                automation: auto,
            },
        };
    }

    const effect = auto.effect || '';

    let result;

    if (effect === 'disadvantage_on_attacks_vs_ally') {
        const attackResult = await findLastAttack(campaignName);
        const attackEvent = attackResult.attackEvent;
        if (!attackEvent) {
            return infoPopup(action.name, `No recent attack found. ${action.name} can only be used after an attack roll.`, auto);
        }

        const lastAttackerName = attackResult.attackerName;
        const defenderName = attackEvent.targetName;
        if (!defenderName) {
            return infoPopup(action.name, `Could not determine who was attacked. Cannot apply ${action.name}.`, auto);
        }

        const rangeFt = rangeToFeet(auto.range || '5_ft');
        if (mapName && rangeFt != null) {
            const positions = await resolveMapPositions(campaignName, mapName, playerName);
            if (positions?.attackerPos && positions?.targetPos) {
                const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
                if (dist != null && dist > rangeFt) {
                    return infoPopup(action.name, `${lastAttackerName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`, auto);
                }
            }
        }

        const duration = auto.duration || 'until_start_of_next_turn';

        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
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
        await setRuntimeValue(campaignName, 'targetEffects', storedEffects, campaignName);

        await setRuntimeValue(defenderName, 'protectionBuff', {
            source: playerName,
            duration: duration,
            timestamp: Date.now(),
        }, campaignName);

        result = await handleDisadvantageDebuff(action, playerStats, campaignName, lastAttackerName, combatSummary);
    } else {
        const targetInfo = await resolveTarget(campaignName, playerName);
        if (!targetInfo?.target) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} requires a target. Select a creature in combat and try again.`,
                    automation: auto,
                },
            };
        }

        const attackerName = targetInfo.target.name;
        const rangeFt = rangeToFeet(auto.range || '60_ft');

        if (mapName && rangeFt != null) {
            const positions = await resolveMapPositions(campaignName, mapName, playerName);
            if (positions?.attackerPos && positions?.targetPos) {
                const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
                if (dist != null && dist > rangeFt) {
                    return {
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: featureName,
                            description: `${attackerName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                            automation: auto,
                        },
                    };
                }
            }
        }

        if (effect === 'disadvantage_on_attack_roll') {
            const attackResult = await findLastAttack(campaignName);
            const attackEvent = attackResult.attackEvent;
            if (!attackEvent || attackResult.attackerName !== attackerName) {
                return infoPopup(action.name, `No recent attack roll found for ${attackerName}. ${action.name} can only be used shortly after an attack roll.`, auto);
            }
            result = await handleDisadvantageDebuff(action, playerStats, campaignName, attackerName, combatSummary);
        } else {
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const bardicDieSize = classLevel?.bardic_die || 6;
            const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

            const attackResult = await findLastAttack(campaignName);
            const attackEvent = attackResult.attackEvent;
            const hasAttack = attackEvent && attackResult.attackerName === attackerName;

            if (!hasAttack) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `No recent roll found for ${attackerName} (attack, damage, or ability check). ${featureName} must be used shortly after the roll.`,
                        automation: auto,
                    },
                };
            }

            if (attackEvent?.damageTypes?.length || attackResult.totalDamage > 0) {
                result = await handleDamageDebuff(action, playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary);
            } else {
                result = await handleAttackRollDebuff(action, playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary);
            }
        }
    }

    if (effectiveUsesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? effectiveUsesMax);
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    if (effect === 'disadvantage_on_attacks_vs_ally') {
        const defenderName = result?.defenderName || 'the target';
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${playerName} used ${featureName} to impose Disadvantage on attacks against ${defenderName}.`,
            targetName: defenderName,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[reactionDebuff] Error:", e); });
        return result;
    }

    if (effect === 'disadvantage_on_attack_roll' && result?.defenderName) {
        const tempHpAmount = await applyImprovedWardingFlare(playerStats, result.defenderName, campaignName);
        if (tempHpAmount) {
            result.payload.description += `<br/><br/>${result.defenderName} gains ${tempHpAmount} Temporary Hit Points from Improved Warding Flare.`;
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${attackerName}.`,
        targetName: attackerName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionDebuff] Error:", e); });

    return result;
}
