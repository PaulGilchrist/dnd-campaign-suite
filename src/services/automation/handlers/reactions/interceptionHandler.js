import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';
import { rollExpression } from '../../../dice/diceRoller.js';

function hasShield(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.equipment_category === 'Shield') return true;
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
    const rangeFt = rangeToFeet(auto.range || '5_ft');

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

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent || attackResult.attackerName !== attackerName) {
        return infoPopup(action.name, `No recent attack found for ${attackerName}. ${action.name} can only be used after an attack roll.`, auto);
    }

    const defenderName = attackEvent.targetName;
    if (!defenderName) {
        return infoPopup(action.name, `Could not determine who ${attackerName} attacked. Cannot apply ${action.name}.`, auto);
    }

    const originalDamage = attackResult.totalDamage;

    const damageRoll = rollExpression(auto.damageExpression || '1d10');
    let damageBonus = auto.damageBonus || 0;
    if (!damageBonus && auto.damageBonusExpression) {
        if (auto.damageBonusExpression === 'proficiency_bonus') {
            damageBonus = playerStats.proficiency || 0;
        } else {
            try {
                const expr = auto.damageBonusExpression;
                const num = Number(expr);
                if (!isNaN(num)) {
                    damageBonus = num;
                }
            } catch (_e) {
                // Keep default 0
            }
        }
    }
    const reductionAmount = (damageRoll?.total || 0) + damageBonus;

    const reducedDamage = Math.max(0, originalDamage - reductionAmount);
    const actualHeal = Math.min(reductionAmount, originalDamage);

    let defenderHp = null;
    if (actualHeal > 0) {
        const healResult = applyHealingToTarget(combatSummary, defenderName, actualHeal, campaignName);
        defenderHp = healResult?.newHp ?? null;
    }

    let description = `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Defender: ${defenderName}<br/>`;
    description += `Attack roll: d20(${attackEvent.d20}) + ${attackEvent.bonus || 0} = ${attackEvent.d20 + (attackEvent.bonus || 0)} vs AC ${attackEvent.targetAc != null ? attackEvent.targetAc : '—'} → <b>${attackEvent.hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Original damage: ${originalDamage}<br/>`;
    description += `Interception damage reduction: 1d10(${damageRoll?.total || 0}) + ${damageBonus} = <b>${reductionAmount}</b><br/>`;
    description += `Reduced damage: <b>${reducedDamage}</b><br/>`;
    if (actualHeal > 0) {
        description += `${defenderName} healed for ${actualHeal} HP.${defenderHp != null ? ` HP: ${defenderHp}` : ''}`;
    }

    await setRuntimeValue(defenderName, 'interceptionBuff', {
        source: playerName,
        duration: 'until_start_of_next_turn',
        timestamp: Date.now(),
        reduction: reductionAmount,
    }, campaignName);

    const result = {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to impose Disadvantage and reduce damage by ${reductionAmount} on ${attackerName}'s attack against ${defenderName}.`,
        targetName: defenderName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[interception] Error:", e); });

    return result;
}
