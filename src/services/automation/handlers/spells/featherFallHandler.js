import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { infoPopup } from '../../common/infoPopup.js';

// CLA-315 lane companion: Feather Fall cast reactively AFTER a fall lands —
// retroactively negates the falling damage (heals the fallen creature by the
// damage actually taken from the stamped trigger:'falling' lastAttack, capped
// at missing HP). Same undo shape as Shield's rollbackNegatedAttack /
// rollbackDamage family. Same-fall re-cast refused via a timestamp stamp on
// the caster (§ reaction-economy one-shot lineage).
const FALL_STAMP_KEY = '_Feather_Fall_negatedStamp';

function refusal(featureName, playerName, campaignName, auto, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'feather_fall_refused',
        name: featureName,
        description: `${featureName}: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[featherFall] Error logging refusal:', e); });
    return infoPopup(featureName, `${featureName}: ${reason}`, auto);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const featureName = action.name || 'Feather Fall';
    const playerName = playerStats.name;

    const lastAttack = await findLastAttack(campaignName);
    if (!lastAttack.attackEvent || lastAttack.trigger !== 'falling') {
        return refusal(featureName, playerName, campaignName, auto, 'Nothing is falling — this Reaction can only be used when a creature takes falling damage.');
    }
    if (lastAttack.targetName !== playerName) {
        return refusal(featureName, playerName, campaignName, auto, `${lastAttack.targetName} is the falling creature — you are not the one who took the falling damage.`);
    }

    // findLastAttack carries the stamp only on attackEvent (not top-level) —
    // reading lastAttack.timestamp yields 0 and self-refuses every cast
    // (live-caught 2026-10-10).
    const fallStamp = lastAttack.attackEvent?.timestamp || 0;
    const negated = Number(getRuntimeValue(playerName, FALL_STAMP_KEY, campaignName) ?? 0);
    if (negated === fallStamp) {
        return refusal(featureName, playerName, campaignName, auto, 'You have already negated this fall.');
    }
    await setRuntimeValue(playerName, FALL_STAMP_KEY, fallStamp, campaignName);

    const fallDamage = lastAttack.totalDamage || 0;
    const cs = await getCombatContext(campaignName);
    let healedAmount = 0;
    if (cs && fallDamage > 0) {
        const healResult = await applyHealingToTarget(cs, playerName, fallDamage, campaignName);
        healedAmount = healResult?.actualHeal ?? 0;
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} casts ${featureName} — falling damage retroactively negated: healed ${healedAmount} HP (fall damage ${fallDamage}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[featherFall] Error logging cast:', e); });

    return infoPopup(featureName, `${featureName}: falling damage negated — healed ${healedAmount} HP of the ${fallDamage} falling damage taken.`, auto);
}
