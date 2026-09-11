import { addEntry } from '../../../ui/logService.js';
import { findLastAttack, rollbackDamage } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

// CLA-310: Shadowy Dodge ("when a creature makes an attack roll against you")
// reaction consumption gates. Attack-instance latch (_ShadowyDodge_appliedAttack_ts)
// closes "same lastAttack reusable forever"; round latch (_ShadowyDodge_usedRound)
// mirrors the CLA-297 Retaliation precedent (re-arms when the combat round advances;
// also cleared at round wrap in initiative.jsx / navigationHandlers.js).
const APPLIED_ATTACK_KEY = '_ShadowyDodge_appliedAttack';
const USED_ROUND_KEY = '_ShadowyDodge_usedRound';

// Identity of the triggering attack instance: the campaign lastAttack is the
// single source of truth; damage application stamps timestamp on it, misses may
// lack one, so fall back to roll signature + attacker.
async function appendDodgeOutcome(hit, finalHit, attackerName, playerName, campaignName, featureName) {
    if (hit === true && finalHit === false) {
        let text = `<br/><i>The attack now misses due to Disadvantage!</i>`;
        const damageRolledBack = await rollbackDamage(attackerName, playerName, campaignName, featureName);
        if (damageRolledBack > 0) {
            text += `<br/>Damage negated: ${damageRolledBack} HP restored.`;
        }
        return { text, damageRolledBack };
    }
    if (hit === true && finalHit === true) {
        return { text: `<br/><i>The attack still hits despite Disadvantage.</i>`, damageRolledBack: 0 };
    }
    if (hit === false) {
        return { text: `<br/><i>The attack already missed — Disadvantage has no additional effect.</i>`, damageRolledBack: 0 };
    }
    return { text: '', damageRolledBack: 0 };
}

function attackIdentity(attackEvent, attackerName) {
    if (attackEvent?.timestamp != null) return String(attackEvent.timestamp);
    return `d20:${attackEvent?.d20 ?? '?'}+${attackEvent?.bonus ?? 0}:${attackerName ?? ''}`;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Shadowy Dodge';

    // Get the last attack roll against the player
    const lastAttack = await findLastAttack(campaignName);
    const attackEvent = lastAttack?.attackEvent;
    if (!attackEvent || lastAttack?.targetName !== playerName) {
        return infoPopup(featureName, `No recent attack roll against you found. ${featureName} can only be used shortly after an attack roll.`, auto);
    }

    const { d20, bonus, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const attackerName = lastAttack.attackerName || 'Unknown creature';

    if (attackerName === playerName) {
        return infoPopup(featureName, `${featureName}: you cannot attack yourself — the triggering attack must come from another creature.`, auto);
    }

    const rangeFt = rangeToFeet(auto?.range) ?? 30;
    const withinRange = await isWithinRange(playerName, attackerName, rangeFt);
    if (!withinRange) {
        return infoPopup(featureName, `${attackerName} is not within ${rangeFt} feet of you. ${featureName} requires the attacker to be in range.`, auto);
    }

    const identity = attackIdentity(attackEvent, attackerName);
    const appliedIdentity = getRuntimeValue(playerName, APPLIED_ATTACK_KEY, campaignName);
    if (appliedIdentity === identity) {
        return infoPopup(featureName, `Reaction already used — you have already dodged this attack roll with ${featureName}. Your Reaction is spent until your next turn.`, auto);
    }

    const combatContext = await getCombatContext(campaignName);
    const currentRound = combatContext?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return infoPopup(featureName, `You have already used ${featureName} this round — your Reaction is spent until your next turn.`, auto);
    }

    // Consume the reaction: stamp the dodged attack instance + round (sequential
    // awaits — pitfall 21: concurrent full-store POSTs race).
    await setRuntimeValue(playerName, APPLIED_ATTACK_KEY, identity, campaignName);
    await setRuntimeValue(playerName, USED_ROUND_KEY, currentRound, campaignName);

    // Simulate disadvantage: roll second d20, take lower
    const secondD20 = Math.floor(Math.random() * 20) + 1;
    const finalD20 = Math.min(d20, secondD20);
    const finalHit = ac != null ? (finalD20 + bonus >= ac) : null;

    let description = `<b>${featureName}</b><br/>`;
    description += `Attacker: ${attackerName}<br/>`;
    description += `Original roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Disadvantage (second d20: ${secondD20}): d20(${finalD20}) + ${bonus} = ${finalD20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${finalHit == null ? 'N/A' : finalHit ? 'HIT' : 'MISS'}</b><br/>`;

    const outcome = await appendDodgeOutcome(hit, finalHit, attackerName, playerName, campaignName, featureName);
    description += outcome.text;
    const damageRolledBack = outcome.damageRolledBack;

    description += `<br/>Teleported 30 feet to an unoccupied space you can see.`;

    let logDesc = `${playerName} used ${featureName} (Reaction) on ${attackerName}, imposing Disadvantage and teleporting 30 feet.`;
    if (damageRolledBack > 0) {
        logDesc += ` ${damageRolledBack} damage was negated.`;
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: logDesc,
        targetName: attackerName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[shadowyDodge] Error:", e); });

    return infoPopup(featureName, description, auto);
}
