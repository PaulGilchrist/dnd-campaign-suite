// Shared AC computation for attack rolls (hit resolution and roll logging).

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { readCoverShot } from '../../services/combat/coverService.js';

// SP-013: Barkskin floor: AC can't be less than 17 (2024; display consumers
// displayCreatureUtils.js / CharSummary.jsx stamp 17). FLOOR semantics, NOT an
// additive buff — shield/staff/warding bonuses still fold on top in
// computeEffectiveAc (hitResolution.js), mirroring how getShieldAcBonus /
// getParryAcBonus ride the defender's activeBuffs channel.
export function isBarkskinAcFloorActive(targetName, campaignName) {
    if (!targetName || !campaignName) return false;
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return Array.isArray(activeBuffs) && activeBuffs.some(b => b && b.effect === 'barkskin');
}

export function computeTargetAc(context, target, characters, campaignName) {
    if (context?.rollType !== 'attack' || !target) {
        return undefined;
    }
    let targetAc;
    if (target.type === 'player') {
        const playerChar = (characters || []).find(c => c.name === target.name);
        const playerComputed = playerChar?.computedStats || playerChar;
        targetAc = playerComputed?.armorClass ?? playerChar?.armorClass;
    } else {
        targetAc = target.ac;
    }
    if (typeof targetAc !== 'number') {
        throw new Error(`[AC] Target "${target.name}" has no AC defined.`);
    }
    if (isBarkskinAcFloorActive(target.name, campaignName)) {
        targetAc = Math.max(targetAc, 17);
    }
    // L5-003 §8.3 cover: half-cover stamp armed by the LoS/cover gate at
    // this shot's click (sync cached read). Covers stack ON TOP of the
    // Barkskin floor (floor is a base-AC rule; −2 is a circumstance
    // penalty). Matched by attacker + target + round; clear shots write
    // null so a clean line is never taxed. Zones off ⇒ stamp never
    // written ⇒ byte-parity.
    const cover = readCoverShot(context, target.name, campaignName, getCurrentCombatRound(campaignName));
    if (cover) {
        targetAc += cover.ac;
    }
    return targetAc;
}
