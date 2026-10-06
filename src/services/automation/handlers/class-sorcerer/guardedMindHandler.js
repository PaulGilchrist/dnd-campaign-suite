import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { logConditionEvent } from '../../../encounters/combatLoggingService.js';
import { infoPopup } from '../../common/infoPopup.js';

// CLA-155: Guarded Mind (Fighter Psi Warrior lv10) — expend one Psionic
// Energy Die to end the Charmed or Frightened condition on yourself.
const MIND_CONDITIONS = ['charmed', 'frightened'];
const CONDITION_LABELS = { charmed: 'Charmed', frightened: 'Frightened' };

// Canonical activeConditions entries are strings (conditionDef.key, e.g.
// 'charmed'); tolerate object entries ({condition|key}) defensively so a
// spend never silently misses an eligible condition (CLA-155 fingerprint).
function entryKey(entry) {
    const raw = entry && typeof entry === 'object'
        ? (entry.condition ?? entry.key ?? entry.name)
        : entry;
    return String(raw ?? '').toLowerCase();
}

function isEligible(entry) {
    return MIND_CONDITIONS.includes(entryKey(entry));
}

// CLA-027 pool contract: stored null/absent = re-armed (fall back to max,
// same convention as the sheet's useTrackedResource null fallback renders
// 12/12). Explicit numeric — including a genuine 0 — is honored.
function resolveUses(stored, maxUses) {
    if (stored == null) return maxUses;
    const numeric = Number(stored);
    return Number.isFinite(numeric) ? numeric : maxUses;
}

function energyMaxFromClassLevels(playerStats) {
    const cls = playerStats?.class || {};
    const row = (cls.class_levels || []).find(cl => cl.level === playerStats?.level);
    const majorName = cls.major?.name || cls.subclass?.name;
    if (!row?.energy || row.energy.required_major !== majorName) return 0;
    return Number(row.energy.energy_die_num) || 0;
}

function resolveMaxUses(playerStats, usesKey) {
    const tracked = Number(playerStats?._trackedResources?.[usesKey]?.max);
    if (Number.isFinite(tracked) && tracked > 0) return tracked;
    return energyMaxFromClassLevels(playerStats);
}

async function refuseGuardedMind({ campaignName, playerName, featureName, auto, reason, message }) {
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'guarded_mind_refused',
        automationDetail: reason,
        abilityName: featureName,
        description: `${featureName} refused (${reason}): ${message}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[guardedMindHandler:refusal-log-error]', e); });
    return infoPopup(featureName, message, auto);
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Guarded Mind';
    const usesKey = auto.resource || 'psionicEnergy';
    const maxUses = resolveMaxUses(playerStats, usesKey);
    const currentUses = resolveUses(getRuntimeValue(playerName, usesKey, campaignName), maxUses);

    if (maxUses <= 0) {
        console.error(`[guardedMindHandler] could not resolve ${usesKey} max for ${playerName}`);
    }

    const storedConditions = getRuntimeValue(playerName, 'activeConditions', campaignName);
    const currentConditions = Array.isArray(storedConditions) ? storedConditions : [];
    const eligible = currentConditions.filter(isEligible);

    if (currentUses <= 0) {
        return refuseGuardedMind({
            campaignName, playerName, featureName, auto, reason: 'no_psionic_energy',
            message: `${featureName}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`,
        });
    }

    if (eligible.length === 0) {
        return refuseGuardedMind({
            campaignName, playerName, featureName, auto, reason: 'not_charmed_or_frightened',
            message: `${featureName}: you are not Charmed or Frightened — no condition to end and no Psionic Energy spent.`,
        });
    }

    const remaining = [...currentConditions.filter(c => !isEligible(c))];
    const removedKeys = [...new Set(eligible.map(entryKey))];
    const endedLabels = removedKeys.map(k => CONDITION_LABELS[k] || k);
    const usesAfter = currentUses - 1;

    // One merged write for die decrement + condition removal (§5) plus the
    // canonical activeConditionMeta purge (mirrors removeCondition).
    await setRuntimeBatch(playerName, { [usesKey]: usesAfter, activeConditions: remaining }, campaignName);

    const existingMeta = getRuntimeValue(playerName, 'activeConditionMeta', campaignName) || {};
    if (removedKeys.some(k => existingMeta[k])) {
        const cleanedMeta = { ...existingMeta };
        removedKeys.forEach(k => delete cleanedMeta[k]);
        await setRuntimeValue(playerName, 'activeConditionMeta', cleanedMeta, campaignName);
    }

    for (const key of removedKeys) {
        await logConditionEvent({ campaignName, action: 'removed', creatureName: playerName, conditionLabel: CONDITION_LABELS[key] || key });
    }

    const endedList = endedLabels.join(' and ');
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} and ended ${endedList}. Psionic Energy: ${usesAfter}/${maxUses}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[guardedMindHandler:log-error]', e); });

    return infoPopup(featureName, `${featureName}: Ended ${endedList}. Psionic Energy: ${usesAfter}/${maxUses}.`, auto);
}
