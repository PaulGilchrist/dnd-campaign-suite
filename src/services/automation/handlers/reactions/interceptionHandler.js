import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const USED_ROUND_KEY = 'interceptionUsedRound';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Feature';

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    const defenderName = attackEvent?.targetName || null;
    const attackerName = attackResult.attackerName;

    if (!attackerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No recent attack found. Can only be used after an attack roll.`,
                automation: auto,
            },
        };
    }

    const shieldOrWeaponResult = checkShieldOrWeapon(playerStats, auto, featureName);
    if (shieldOrWeaponResult) return shieldOrWeaponResult;

    const rangePopup = await checkInterceptionRange(auto, playerName, attackerName, featureName, _mapName, campaignName);
    if (rangePopup) return rangePopup;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return makePopup(action, auto, baseDescription(action, attackerName, defenderName));
    }

    // Reaction consumption: one Reaction per round (spent until your next turn).
    const currentRound = combatSummary.round || 1;
    const usedMark = getRuntimeValue(playerName, USED_ROUND_KEY);
    if (isReactionSpent(usedMark, attackEvent, currentRound)) {
        return makePopup(action, auto, `${featureName} has already been used this round — your Reaction is spent until your next turn.`);
    }

    // Campaign-scoped targetEffects: consumers (MonsterCardModal → conditionEffects
    // targetDisadvantageCount) only read campaign-level targetEffects.
    await upsertProtectionEffect(defenderName, playerName, campaignName);

    if (defenderName) {
        addExpiration(playerName, defenderName, [
            { type: 'remove_target_effect', effectKey: 'protection', source: playerName, target: defenderName }
        ], campaignName, 1);
    }

    const originalDamage = attackResult.totalDamage || 0;

    const damageRoll = rollExpression(auto.damageExpression || '1d10');
    const damageBonus = resolveInterceptionDamageBonus(auto, playerStats);
    const reductionAmount = (damageRoll?.total || 0) + damageBonus;
    const reducedDamage = Math.max(0, originalDamage - reductionAmount);
    const actualHeal = Math.min(reductionAmount, originalDamage);

    if (actualHeal > 0 && defenderName) {
        applyHealingToTarget(combatSummary, defenderName, actualHeal, campaignName);
    }

    await setRuntimeValue(playerName, USED_ROUND_KEY, {
        round: currentRound,
        activeCreature: combatSummary.activeCreatureName || attackerName,
        lastAttackTimestamp: attackEvent?.timestamp || Date.now(),
    }, campaignName);

    const description = baseDescription(action, attackerName, defenderName) + attackDetails(attackEvent, originalDamage, damageRoll, damageBonus, reductionAmount, reducedDamage, actualHeal);

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
        description: `${playerName} used ${featureName} (Reaction) to impose Disadvantage and reduce damage by ${reductionAmount} on ${attackerName}'s attack against ${defenderName}. ${defenderName} healed ${actualHeal} HP.`,
        targetName: defenderName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[interception] Error:", e); });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: Disadvantage imposed on attack rolls against ${defenderName} until the start of ${playerName}'s next turn.`,
        targetName: defenderName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[interception] Error:", e); });

    return result;
}

async function checkInterceptionRange(auto, playerName, attackerName, featureName, _mapName, campaignName) {
    const rangeFt = auto.range ? parseInt(auto.range.replace(/[^0-9]/g, '')) || 5 : 5;
    if (rangeFt == null) return null;
    const positions = _mapName ? await resolveMapPositions(campaignName, playerName) : null;
    if (!(positions?.attackerPos && positions?.targetPos)) return null;
    const inRange = await isWithinRange(playerName, attackerName, rangeFt);
    if (inRange) return null;
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${attackerName} is out of range.`,
            automation: auto,
        },
    };
}

async function upsertProtectionEffect(defenderName, playerName, campaignName) {
    const storedEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const protectionEffect = {
        effect: 'protection',
        target: defenderName,
        source: playerName,
        duration: 'until_start_of_next_turn',
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
}

function isReactionSpent(usedMark, attackEvent, currentRound) {
    const sameTrigger = usedMark && usedMark.lastAttackTimestamp && attackEvent?.timestamp
        && usedMark.lastAttackTimestamp === attackEvent.timestamp;
    return sameTrigger || (usedMark && usedMark.round === currentRound);
}

function resolveInterceptionDamageBonus(auto, playerStats) {
    let damageBonus = auto.damageBonus || 0;
    if (damageBonus || !auto.damageBonusExpression) return damageBonus;
    if (auto.damageBonusExpression === 'proficiency_bonus') {
        return playerStats.proficiency || 0;
    }
    try {
        const num = Number(auto.damageBonusExpression);
        if (!isNaN(num)) {
            return num;
        }
    } catch (_e) {
        // Keep default 0
        console.warn('[interceptionHandler] Damage bonus expression invalid, keeping default 0:', _e);
    }
    return damageBonus;
}

function checkShieldOrWeapon(playerStats, auto, featureName) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const baseName = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item && item.armor_category === 'Shield') return null;
        if (item && item.equipment_category === 'Weapon') return null;
    }
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: You must be holding a Shield or a Simple or Martial weapon to use this Reaction.`,
            automation: auto,
        },
    };
}

function parseMagicItemName(itemName) {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
        return itemName.substring(3);
    }
    return itemName;
}

function makePopup(action, automation, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation,
        },
    };
}

function baseDescription(action, attackerName, defenderName) {
    return `<b>${action.name}</b><br/>You interpose yourself between ${attackerName} and ${defenderName}. ${attackerName} and all other creatures have Disadvantage on attack rolls against ${defenderName} until the start of your next turn.`;
}

function attackDetails(attackEvent, originalDamage, damageRoll, damageBonus, reductionAmount, reducedDamage, actualHeal) {
    if (!attackEvent || originalDamage == null) return '';

    let description = `<br/><br/>Attack roll: d20(${attackEvent.d20}) + ${attackEvent.bonus || 0} = ${attackEvent.d20 + (attackEvent.bonus || 0)} vs AC ${attackEvent.targetAc != null ? attackEvent.targetAc : '—'} → <b>${attackEvent.hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Original damage: ${originalDamage}<br/>`;
    description += `Interception damage reduction: 1d10(${damageRoll?.total || 0}) + ${damageBonus || 0} = <b>${reductionAmount || 0}</b><br/>`;
    description += `Reduced damage: <b>${reducedDamage || 0}</b><br/>`;
    if (actualHeal > 0) {
        description += `The target healed for ${actualHeal} HP.`;
    }
    return description;
}
