import { rollExpression } from '../dice/diceRoller.js';
import { applyDamageToTarget } from '../rules/combat/applyDamage.js';
import { addEntry } from '../ui/logService.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// CLA-315: first in-app producer of trigger:'falling' events app-wide.
// The GM 'Falling' te chip (targetEffectDefinitions.js) delegates here:
// roll 2d10 bludgeoning per 10 feet fallen (max 20d10), apply via
// applyDamageToTarget with trigger:'falling' stamped onto the campaign
// lastAttack, and log fall_damage. Reaction consumers (Slow Fall
// damageReductionHandler.js, Feather Fall featherFallHandler.js) press
// against the stamped lastAttack afterwards.
const DICE_PER_10FT = 2;
const DICE_CAP = 20;

export function fallDamageDice(feet) {
    const increments = Math.max(1, Math.floor(Math.max(Number(feet) || 0, 10) / 10));
    return Math.min(DICE_CAP, increments * DICE_PER_10FT);
}

export async function produceFallDamage({ combatSummary, targetName, feet, campaignName, characters }) {
    const formula = `${fallDamageDice(feet)}d10`;
    const roll = rollExpression(formula);
    if (!roll || roll.total == null) {
        console.error(`[fallDamage] Failed to roll ${formula} for ${targetName}`);
        return null;
    }

    // Fresh event chain: a GM fall stamp has no attack-roll leg to reset the
    // lastAttack primary/secondary chain, so stamp a chain header first —
    // otherwise the fall merges as secondaryDamage onto the PREVIOUS event
    // (a stale lastAttack) and reaction consumers read the wrong totals.
    await setRuntimeValue('campaign', 'lastAttack', {
        attackerName: 'Falling',
        targetName,
        rollType: 'fall',
        trigger: 'falling',
        rawDamage: 0,
        damageApplied: false,
        timestamp: Date.now(),
    }, campaignName);

    const result = await applyDamageToTarget(combatSummary, targetName, roll.total, ['bludgeoning'], {
        campaignName,
        characters,
        attackerName: 'Falling',
        trigger: 'falling',
    });
    if (!result) {
        console.error(`[fallDamage] ${targetName} not in combatSummary — fall not applied`);
        return null;
    }

    await addEntry(campaignName, {
        type: 'automation',
        characterName: targetName,
        automationType: 'fall_damage',
        name: 'Falling',
        description: `${targetName} falls ${Math.max(Number(feet) || 0, 10)} feet — ${formula} [${(roll.rolls || []).join(', ')}] = ${roll.total} bludgeoning (${result.oldHp} → ${result.newHp} HP). Slow Fall and Feather Fall Reactions can be pressed against this fall.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[fallDamage] Error logging fall damage:', e); });

    return { formula, roll, ...result };
}
