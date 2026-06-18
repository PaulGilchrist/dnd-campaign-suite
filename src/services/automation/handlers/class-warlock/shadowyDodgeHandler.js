import { addEntry } from '../../../ui/logService.js';
import { getLastAttackRoll } from '../../../../hooks/combat/useMetamagic.js';
import { infoPopup } from '../../common/infoPopup.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Shadowy Dodge';

    // Get the last attack roll against the player
    const attackEvent = getLastAttackRoll(playerName);
    if (!attackEvent || isStale(attackEvent)) {
        return infoPopup(featureName, `No recent attack roll against you found. ${featureName} can only be used shortly after an attack roll.`, auto);
    }

    const { d20, bonus, targetName, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const attackerName = targetName || 'Unknown creature';

    // Simulate disadvantage: roll second d20, take lower
    const secondD20 = Math.floor(Math.random() * 20) + 1;
    const finalD20 = Math.min(d20, secondD20);
    const finalHit = ac != null ? (finalD20 + bonus >= ac) : null;

    let description = `<b>${featureName}</b><br/>`;
    description += `Attacker: ${attackerName}<br/>`;
    description += `Original roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Disadvantage (second d20: ${secondD20}): d20(${finalD20}) + ${bonus} = ${finalD20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${finalHit == null ? 'N/A' : finalHit ? 'HIT' : 'MISS'}</b><br/>`;

    if (hit === true && finalHit === true) {
        description += `<br/><i>The attack still hits despite Disadvantage.</i>`;
    } else if (hit === true && finalHit === false) {
        description += `<br/><i>The attack now misses due to Disadvantage!</i>`;
    } else if (hit === false) {
        description += `<br/><i>The attack already missed — Disadvantage has no additional effect.</i>`;
    }

    description += `<br/>Teleported 30 feet to an unoccupied space you can see.`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${attackerName}, imposing Disadvantage and teleporting 30 feet.`,
        targetName: attackerName,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return infoPopup(featureName, description, auto);
}
