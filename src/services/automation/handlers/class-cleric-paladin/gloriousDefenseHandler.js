import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';
import { findLastAttack, rollbackDamage } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';

const USES_KEY = 'gloriousDefenseUses';

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
    const lastAttack = await findLastAttack(campaignName);
    const attackEvent = lastAttack?.attackEvent;

    if (!attackEvent) {
        return infoPopup(featureName, `${featureName}: No recent attack roll found. This reaction must be used in response to an attack.`, auto);
    }

    if (lastAttack.totalDamage <= 0) {
        return infoPopup(featureName, `${featureName}: The last attack dealt no damage.`, auto);
    }

    const targetName = lastAttack.targetName;
    const { d20, bonus, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const attackerName = lastAttack.attackerName || 'Unknown creature';
    const chaMod = Math.max(1, chaBonus);
    const newAc = targetAc != null ? targetAc + chaMod : null;

    // Calculate if the attack would still hit with the CHA bonus applied
    const originalHit = hit === true;
    const wouldHit = newAc != null ? (d20 + bonus >= newAc) : null;

    let description = `<b>${featureName}</b><br/>`;
    description += `Target: ${targetName}<br/>`;
    description += `Attacker: ${attackerName}<br/>`;
    description += `Original roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `With CHA modifier (${chaMod}): d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${newAc != null ? newAc : '—'} → <b>${wouldHit == null ? 'N/A' : wouldHit ? 'HIT' : 'MISS'}</b><br/>`;

    let damageRolledBack = 0;

    if (originalHit && wouldHit === false) {
        description += `<br/><i>The attack now misses due to your Glorious Defense!</i>`;
        damageRolledBack = await rollbackDamage(attackerName, targetName, campaignName, featureName);
        if (damageRolledBack > 0) {
            description += `<br/>Damage negated: ${damageRolledBack} HP restored to ${targetName}.`;
        }

        // Decrement uses
        await setRuntimeValue(playerName, USES_KEY, currentUses - 1, campaignName);

        // Find the Paladin's main melee weapon for the counterattack
        const meleeAttacks = (playerStats.attacks || []).filter(a => {
            if (a.weaponType === 'melee' || a.attackType === 'melee') return true;
            if (a.range === MELEE_REACH_FEET || a.range === '5' || a.range === '5 ft' || a.range === '5_ft')
                return a.type === 'Action' || a.actionType === 'Action';
            if (a.isRanged === false) return true;
            if (Array.isArray(a.properties) && a.properties.some(p => String(p).toLowerCase() === 'melee'))
                return true;
            return false;
        });
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
    } else if (originalHit && wouldHit === true) {
        description += `<br/><i>The attack still hits despite your Glorious Defense.</i>`;
        return infoPopup(featureName, description, auto);
    } else if (!originalHit) {
        description += `<br/><i>The attack already missed — Glorious Defense has no additional effect.</i>`;
        return infoPopup(featureName, description, auto);
    }

    // Fallback
    return infoPopup(featureName, description, auto);
}

export function hasGloriousDefenseActive(playerStats) {
    const isPaladin = playerStats?.class?.name === 'Paladin';
    if (!isPaladin) return false;
    const subclassName = playerStats.class?.major?.name || playerStats.class?.subclass?.name;
    return subclassName === 'Oath of Glory';
}
