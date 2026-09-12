import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { filterMeleeAttacks } from '../../../combat/filterMeleeAttacks.js';
import { findLastAttack, rollbackDamage } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';

const USES_KEY = 'gloriousDefenseUses';

function buildOutcomeDescription({ featureName, targetName, attackerName, d20, bonus, ac, chaMod, newAc, hit, wouldHit }) {
    let description = `<b>${featureName}</b><br/>`;
    description += `Target: ${targetName}<br/>`;
    description += `Attacker: ${attackerName}<br/>`;
    description += `Original roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `With CHA modifier (${chaMod}): d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${newAc != null ? newAc : '—'} → <b>${wouldHit == null ? 'N/A' : wouldHit ? 'HIT' : 'MISS'}</b><br/>`;
    return description;
}

function computeChaAdjustedOutcome(attackEvent, chaMod) {
    const { d20, bonus, targetAc } = attackEvent;
    const newAc = targetAc != null ? targetAc + chaMod : null;
    const wouldHit = newAc != null ? (d20 + bonus >= newAc) : null;
    return { newAc, wouldHit };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Glorious Defense';

    // Check uses remaining
    const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const usesMax = Math.max(1, chaBonus);
    const currentUses = Number(getRuntimeValue(playerName, USES_KEY, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return infoPopup(featureName, `${featureName} has no uses remaining. Recharges on a Long Rest.`, auto);
    }

    // Read the last attack to determine if it targeted this Paladin
    const lastAttack = await findLastAttack(campaignName) || {};
    const attackEvent = lastAttack.attackEvent;

    if (!attackEvent) {
        return infoPopup(featureName, `${featureName}: No recent attack roll found. This reaction must be used in response to an attack.`, auto);
    }

    if (lastAttack.totalDamage <= 0) {
        return infoPopup(featureName, `${featureName}: The last attack dealt no damage.`, auto);
    }

    const targetName = lastAttack.targetName;
    const ac = attackEvent.effectiveAc ?? attackEvent.targetAc;
    const attackerName = lastAttack.attackerName || 'Unknown creature';
    const chaMod = Math.max(1, chaBonus);
    const { newAc, wouldHit } = computeChaAdjustedOutcome(attackEvent, chaMod);

    // Calculate if the attack would still hit with the CHA bonus applied
    const originalHit = attackEvent.hit === true;

    let description = buildOutcomeDescription({ featureName, targetName, attackerName, d20: attackEvent.d20, bonus: attackEvent.bonus, ac, chaMod, newAc, hit: attackEvent.hit, wouldHit });

    if (originalHit && wouldHit === false) {
        return await blockAndCounterattack({ auto, playerStats, playerName, campaignName, featureName, targetName, attackerName, chaMod, currentUses, description });
    }

    return infoPopup(featureName, appendOutcomeNote(description, originalHit, wouldHit), auto);
}

function appendOutcomeNote(description, originalHit, wouldHit) {
    if (originalHit && wouldHit === true) {
        return `${description}<br/><i>The attack still hits despite your Glorious Defense.</i>`;
    }
    if (!originalHit) {
        return `${description}<br/><i>The attack already missed — Glorious Defense has no additional effect.</i>`;
    }
    return description;
}

async function blockAndCounterattack({ auto, playerStats, playerName, campaignName, featureName, targetName, attackerName, chaMod, currentUses, description }) {
    description += `<br/><i>The attack now misses due to your Glorious Defense!</i>`;
    const damageRolledBack = await rollbackDamage(attackerName, targetName, campaignName, featureName);
    if (damageRolledBack > 0) {
        description += `<br/>Damage negated: ${damageRolledBack} HP restored to ${targetName}.`;
    }

    // Decrement uses
    await setRuntimeValue(playerName, USES_KEY, currentUses - 1, campaignName);

    // Find the Paladin's main melee weapon for the counterattack
    const meleeAttacks = filterMeleeAttacks(playerStats.attacks);
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return infoPopup(featureName, `${description}<br/><br/>No melee attack available for the counterattack.`, auto);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to protect ${targetName} from ${attackerName} — the attack misses due to the CHA modifier (${chaMod}) and ${playerName} makes a melee counterattack. ${damageRolledBack > 0 ? `${damageRolledBack} damage was negated.` : ''}`,
        targetName: attackerName,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[${featureName}] Error:`, e); });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName: attackerName,
            sourceName: featureName,
        },
    };
}

export function hasGloriousDefenseActive(playerStats) {
    const isPaladin = playerStats?.class?.name === 'Paladin';
    if (!isPaladin) return false;
    const subclassName = playerStats.class?.major?.name || playerStats.class?.subclass?.name;
    return subclassName === 'Oath of Glory';
}
