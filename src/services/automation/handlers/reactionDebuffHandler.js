import { resolveTarget, resolveMapPositions } from '../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../rules/combat/applyHealing.js';
import { getLastDamageEvent, getLastAttackRoll, getLastAbilityCheck } from '../../../hooks/useMetamagic.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

async function handleAttackRollDebuff(action, _playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary) {
    const auto = action.automation;

    const attackEvent = getLastAttackRoll(attackerName);
    if (!attackEvent || isStale(attackEvent)) {
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
        const damageEvent = getLastDamageEvent(attackerName);
        if (damageEvent && damageEvent.targetName === defenderName && !isStale(damageEvent) && damageEvent.rawDamage > 0) {
            const healResult = applyHealingToTarget(combatSummary, defenderName, damageEvent.rawDamage, campaignName);
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

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
        defenderHp,
    };
}

async function handleAbilityCheckDebuff(action, _playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, _combatSummary) {
    const auto = action.automation;

    const checkEvent = getLastAbilityCheck(attackerName);
    if (!checkEvent || isStale(checkEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent ability check found for ${attackerName}. ${action.name} can only be used shortly after an ability check.`,
                automation: auto,
            },
        };
    }

    const { d20, bonus, checkName } = checkEvent;
    const originalTotal = d20 + bonus;
    const reducedD20 = Math.max(1, d20 - biDieRoll);
    const reducedTotal = reducedD20 + bonus;

    const description = `<b>${action.name}</b><br/>Creature: ${attackerName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>${checkName}: d20(${d20}) + ${bonus} = ${originalTotal} → <b>${reducedTotal}</b>`;

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}

async function handleDamageDebuff(action, _playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary) {
    const auto = action.automation;

    const lastEvent = getLastDamageEvent(attackerName);
    if (!lastEvent || !lastEvent.rawDamage || isStale(lastEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent damage event found for ${attackerName}. ${action.name} can only be used shortly after a damage roll.`,
                automation: auto,
            },
        };
    }

    const defenderName = lastEvent.targetName;
    if (!defenderName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Could not determine who ${attackerName} damaged. Cannot apply ${action.name}.`,
                automation: auto,
            },
        };
    }

    const originalDamage = lastEvent.rawDamage;
    const reducedDamage = Math.max(0, originalDamage - biDieRoll);
    const healAmount = originalDamage - reducedDamage;

    let defenderHp = null;
    if (healAmount > 0) {
        const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount, campaignName);
        defenderHp = healResult?.newHp ?? null;
    }

    const description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Defender: ${defenderName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>Original damage: ${originalDamage}<br/>Reduced damage: <b>${reducedDamage}</b><br/>${healAmount > 0 ? `Healed ${defenderName} for ${healAmount} HP.` : ''}${defenderHp != null ? `<br/>${defenderName} HP: ${defenderHp}` : ''}`;

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
        defenderHp,
    };
}

async function handleDisadvantageDebuff(action, _playerStats, campaignName, attackerName, combatSummary) {
    const auto = action.automation;

    const attackEvent = getLastAttackRoll(attackerName);
    if (!attackEvent || isStale(attackEvent)) {
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
    const defenderName = targetName;

    const secondD20 = Math.floor(Math.random() * 20) + 1;
    const finalD20 = Math.min(d20, secondD20);
    const finalHit = ac != null ? (finalD20 + bonus >= ac) : null;

    let defenderHp = null;

    if (hit === true && finalHit === false && defenderName) {
        const damageEvent = getLastDamageEvent(attackerName);
        if (damageEvent && damageEvent.targetName === defenderName && !isStale(damageEvent) && damageEvent.rawDamage > 0) {
            const healResult = applyHealingToTarget(combatSummary, defenderName, damageEvent.rawDamage, campaignName);
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

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
        defenderHp,
        defenderName,
    };
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

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Feature';

    const usesKey = getRuntimeUsesKey(featureName);
    const usesMax = auto.uses_expression
        ? (typeof auto.uses_expression === 'number'
            ? auto.uses_expression
            : evaluateAutoExpression(auto.uses_expression, playerStats))
        : 0;

    const bardicUsesMax = !auto.uses_expression
        ? (playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
            ?? (playerStats.proficiency || 0))
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

    if (effect === 'disadvantage_on_attack_roll') {
        const attackEvent = getLastAttackRoll(attackerName);
        if (!attackEvent || isStale(attackEvent)) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `No recent attack roll found for ${attackerName}. ${featureName} can only be used shortly after an attack roll.`,
                    automation: auto,
                },
            };
        }
        result = await handleDisadvantageDebuff(action, playerStats, campaignName, attackerName, combatSummary);
    } else {
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const bardicDieSize = classLevel?.bardic_die || 6;
        const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

        const attackEvent = getLastAttackRoll(attackerName);
        const damageEvent = getLastDamageEvent(attackerName);
        const abilityEvent = getLastAbilityCheck(attackerName);

        const attackFresh = attackEvent && !isStale(attackEvent);
        const damageFresh = damageEvent && !isStale(damageEvent) && damageEvent.rawDamage;
        const abilityFresh = abilityEvent && !isStale(abilityEvent);

        if (!attackFresh && !damageFresh && !abilityFresh) {
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

        if (attackFresh) {
            result = await handleAttackRollDebuff(action, playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary);
        } else if (damageFresh) {
            result = await handleDamageDebuff(action, playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary);
        } else {
            result = await handleAbilityCheckDebuff(action, playerStats, campaignName, attackerName, bardicDieSize, biDieRoll, combatSummary);
        }
    }

    if (effectiveUsesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? effectiveUsesMax);
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
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
    }).catch(() => {});

    return result;
}
