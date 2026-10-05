import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';

const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];
const STRIDE_SPEED_BONUS = 20;
const STRIDE_RANGE_FT = 5;
const USED_KEY = '_Destructive_Stride_usedRound';

export async function handle(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const epitomeActive = getRuntimeValue(playerName, 'elementalEpitomeActive', campaignName);

    if (!epitomeActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: action.automation?.type,
                description: 'Elemental Epitome must be active to use Destructive Stride.',
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'destructiveStride',
        payload: { action, playerStats, campaignName },
    };
}

// CLA-113: numeric Speed +20 until end of turn — the verified CLA-067 Dash /
// CLA-100 Dread Ambush lane: activeBuffs entry {effect:'speed_boost', speedBonus}
// consumed by charSummaryCalc (buffSpeedBonus → numeric sheet Speed), removed via
// name-scoped remove_active_buff clock anchored to the monk's next turn
// (same-round expiry never fires, playbook §38). Dedupe by name+effect so a
// re-Stride within the window refreshes instead of stacking.
async function grantStrideSpeedBuff(playerStats, campaignName) {
    const buffs = Array.isArray(getRuntimeValue(playerStats.name, 'activeBuffs', campaignName))
        ? getRuntimeValue(playerStats.name, 'activeBuffs', campaignName)
        : [];
    const cleaned = buffs.filter(b => !(b.name === 'Destructive Stride' && b.effect === 'speed_boost'));
    await setRuntimeValue(playerStats.name, 'activeBuffs', [
        ...cleaned,
        { name: 'Destructive Stride', effect: 'speed_boost', speedBonus: STRIDE_SPEED_BONUS, duration: 'until_end_of_turn' },
    ], campaignName);
    addExpiration({ attackerName: playerStats.name, targetName: playerStats.name, effects: [
        { type: 'remove_active_buff', buffName: 'Destructive Stride' },
    ], campaignName, rounds: undefined, expireOnCreatureName: playerStats.name });
}

async function refuseStride({ campaignName, playerName, action, targetName, reason, message }) {
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'destructive_stride_refused',
        automationDetail: reason,
        abilityName: action?.name || 'Destructive Stride',
        targetName,
        description: message,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] refusal log failed:', e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action?.name || 'Destructive Stride',
            automationType: action?.automation?.type,
            description: message,
            automation: action?.automation,
        },
    };
}

export async function applyDamageTypeChoice(action, playerStats, campaignName, chosenType) {
    const chosen = DAMAGE_TYPES.find(t => t === chosenType);
    if (!chosen) return null;

    await setRuntimeValue(playerStats.name, 'destructiveStrideDamageType', chosen, campaignName);
    await setRuntimeValue(playerStats.name, 'destructiveStrideActive', true, campaignName);
    await grantStrideSpeedBuff(playerStats, campaignName);

    const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
    const martialArtsDie = classLevel?.martial_arts_die || 4;

    const combatSummary = getCombatSummary(campaignName);
    const targets = combatSummary
        ? combatSummary.creatures
            .filter(c => c.name !== playerStats.name)
            .map(c => ({
                name: c.name,
                type: c.type,
                currentHp: c.currentHp,
                maxHp: c.maxHp,
                size: c.size,
            }))
        : [];

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Destructive Stride activated — Speed +${STRIDE_SPEED_BONUS} ft (speed_boost) until end of turn, damage type set to ${chosen} (d${martialArtsDie}).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] Error logging:', e); });

    return {
        type: 'modal',
        modalName: 'destructiveStrideTarget',
        payload: { action, playerStats, campaignName, chosenType: chosen, martialArtsDie, targets },
    };
}

// Token distance note for the damage log — isWithinRange gates, the note records
// the measurement honestly (gridless = advisory, playbook §42).
async function describeProximity(playerStats, targetName) {
    try {
        const campaignName = getRuntimeValue('__campaign__', 'campaignName');
        const activeMapName = getRuntimeValue('__map__', 'activeMapName');
        if (!activeMapName) return 'gridless — GM-enforced 5 ft proximity';
        const data = await loadMapData(campaignName, activeMapName);
        const tokens = [...(data?.players || []), ...(data?.placedItems || [])];
        const hasPosition = t => !!t && Number.isFinite(t.gridX) && Number.isFinite(t.gridY);
        const source = tokens.find(t => t.name === playerStats.name);
        const target = tokens.find(t => t.name === targetName);
        if (!hasPosition(source) || !hasPosition(target)) return 'no token positions — GM-enforced 5 ft proximity (advisory)';
        const dist = getDistanceFeet(source, target);
        return dist == null ? 'distance unmeasured (advisory)' : `token distance ${dist} ft`;
    } catch (e) {
        console.error('[DestructiveStride] proximity note failed:', e);
        return 'proximity unmeasurable (advisory)';
    }
}

function readStrideLatch(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, USED_KEY, campaignName);
    if (stored && typeof stored === 'object' && Array.isArray(stored.targets)) return stored;
    return { round: null, targets: [] };
}

export async function applyTargetChoice({ action, playerStats, campaignName, targetName, chosenType, martialArtsDie }) {
    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        console.error('[DestructiveStride] applyTargetChoice: no combat summary for', campaignName);
        return null;
    }

    const target = combatSummary.creatures.find(c => c.name === targetName);
    if (!target) {
        console.error('[DestructiveStride] applyTargetChoice: target not in combat:', targetName);
        return null;
    }

    const inRange = await isWithinRange(playerStats.name, targetName, STRIDE_RANGE_FT);
    if (!inRange) {
        return await refuseStride({
            campaignName,
            playerName: playerStats.name,
            action,
            targetName,
            reason: 'out_of_range_5ft',
            message: `${targetName} is beyond 5 feet — Destructive Stride refused (no damage).`,
        });
    }

    // CLA-113: once per turn PER CREATURE latch — {round, targets:[names]} on the
    // monk's store, cleared at round-wrap in Initiative.jsx + navigationHandlers
    // beside _Slow_Fall_usedRound (playbook §5).
    const round = combatSummary.round || 1;
    const storedLatch = readStrideLatch(playerStats, campaignName);
    const latch = storedLatch.round === round ? storedLatch : { round, targets: [] };
    if (storedLatch.round === round && storedLatch.targets.includes(targetName)) {
        return await refuseStride({
            campaignName,
            playerName: playerStats.name,
            action,
            targetName,
            reason: 'already_damaged_this_turn',
            message: `${targetName} has already taken Destructive Stride damage this turn — refused (once per turn per creature).`,
        });
    }

    const rollResult = rollExpression(`1d${martialArtsDie}`);
    const damage = rollResult?.total || martialArtsDie;

    const characters = combatSummary.creatures.filter(c => c.type === 'player') || [];
    await applyDamageToTarget(combatSummary, targetName, damage, [chosenType.toLowerCase()], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerStats.name, suppressHpLog: false });

    const proximityNote = await describeProximity(playerStats, targetName);

    // §39: latch stamp awaited BEFORE any later consumer reads (no same-tick drop).
    await setRuntimeValue(playerStats.name, USED_KEY, { round, targets: [...latch.targets, targetName] }, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Destructive Stride — ${targetName} takes ${damage} ${chosenType} damage (1d${martialArtsDie} roll: ${rollResult?.total ?? martialArtsDie}; ${proximityNote}).`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] Error logging target:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: `${targetName} takes ${damage} ${chosenType} damage.`,
            automation: action.automation,
        },
    };
}

export async function skipTargetChoice(action, playerStats, campaignName) {
    await setRuntimeValue(playerStats.name, 'destructiveStrideActive', true, campaignName);
    await grantStrideSpeedBuff(playerStats, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `Destructive Stride activated — Speed +${STRIDE_SPEED_BONUS} ft (speed_boost) until end of turn, no target chosen.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[DestructiveStride] Error logging skip:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description: 'Destructive Stride activated — Speed +20 ft, no damage dealt.',
            automation: action.automation,
        },
    };
}
