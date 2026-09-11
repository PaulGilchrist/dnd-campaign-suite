import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';
import { expireForCreature, expireForTarget } from './expirationQueue.js';
import { processSleetStormAreaSave } from '../../automation/handlers/spells/sleetStormHandler.js';
import { processStinkingCloudAreaSave } from '../../automation/handlers/spells/stinkingCloudHandler.js';
import { processWebAreaSave } from '../../automation/handlers/spells/webAreaSaveHandler.js';

// Wild Magic Surge: expire effects with "end of your current turn" duration
function expireTurnEndSurgeEffects(attackerName, campaignName) {
    const surgeEffects = getRuntimeValue(attackerName, 'wildMagicSurgeEffects', campaignName);
    if (!Array.isArray(surgeEffects) || surgeEffects.length === 0) return;
    const filtered = surgeEffects.filter(e => {
        if (!e || !e.duration) return true;
        return e.duration.trim().toLowerCase() !== 'end of your current turn';
    });
    if (filtered.length === surgeEffects.length) return;
    setRuntimeValue(attackerName, 'wildMagicSurgeEffects', filtered, campaignName, true);
    console.error(`[expirations] Removed ${surgeEffects.length - filtered.length} "end of current turn" surge effects for ${attackerName}`);
}

function getCampaignTargetEffects(campaignName) {
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    return Array.isArray(allTargetEffects) ? allTargetEffects : [];
}

// Phase 3: Check for recurring Sleet Storm area saves
// When a creature starts its turn in the sleet storm area, it must make a DEX save
async function processSleetStormSaves(activeName, campaignName) {
    const sleetStormTrackingKey = `_sleetStorm_${activeName.replace(/\s+/g, '_')}`;
    const sleetStormTracking = getRuntimeValue(activeName, sleetStormTrackingKey, campaignName);
    if (!sleetStormTracking || !sleetStormTracking.saveDc) return;
    // The active creature is the caster — check all other creatures for sleet storm effects
    const sleetEffects = getCampaignTargetEffects(campaignName)
        .filter(te => te.effect === 'sleet_storm' && te.source === activeName);
    for (const te of sleetEffects) {
        const teTargetName = te.target;
        if (teTargetName === activeName) continue;
        // Skip if already Prone (no need to re-save)
        const targetConditions = getRuntimeValue(teTargetName, 'activeConditions', campaignName) || [];
        const isAlreadyProne = Array.isArray(targetConditions) && targetConditions.some(c => String(c).toLowerCase() === 'prone');
        if (isAlreadyProne) continue;
        // Trigger recurring save
        try {
            await processSleetStormAreaSave(activeName, teTargetName, campaignName, sleetStormTracking.mapName);
        } catch (_e) { console.error(`[expireStaleEffects] Sleet Storm area save failed for ${teTargetName}:`, _e); }
    }
}

// Recurring turn-start zone saves on the active creature (SP-111 Stinking Cloud CON /
// SP-126 Web STR pattern): each creature carrying a live zone te written at cast
// (swept by the concentration break) re-saves at the DC stored on the caster's
// `_<prefix>_<caster>` zone tracking. The zone's turn-end block/condition is shed
// by the handler at that creature's turn end.
async function processZoneTurnStartSaves(activeName, campaignName, effectKey, trackingPrefix, processSave, logLabel) {
    const zoneEffects = getCampaignTargetEffects(campaignName)
        .filter(te => te && te.effect === effectKey && te.target === activeName);
    for (const te of zoneEffects) {
        const casterTrackingKey = `_${trackingPrefix}_${String(te.source || '').replace(/\s+/g, '_')}`;
        const zoneTracking = getRuntimeValue(te.source, casterTrackingKey, campaignName);
        if (!zoneTracking || !zoneTracking.saveDc) continue;
        try {
            await processSave(te.source, activeName, campaignName, zoneTracking.mapName);
        } catch (_e) { console.error(`[expireStaleEffects] ${logLabel} failed for ${activeName}:`, _e); }
    }
}

/**
 * Expire stale pendingExpirations at the start of each creature's turn.
 */
export async function expireStaleEffects(campaignName, overrideActiveName) {
    const currentRound = getCurrentCombatRound(campaignName);
    const activeName = overrideActiveName || getActiveCreatureName(campaignName);
    if (!activeName) return;

    try {
        const combatData = getCombatSummary(campaignName);
        if (!combatData || typeof combatData !== 'object') return;
        const creatures = combatData.creatures;
        if (!Array.isArray(creatures)) return;

        // Phase 1: Process entries owned by the active creature
        for (const attacker of creatures) {
            if (utils.getName(attacker.name) !== utils.getName(activeName)) continue;
            expireForCreature(attacker.name, currentRound, campaignName);
            expireTurnEndSurgeEffects(attacker.name, campaignName);
        }

        // Phase 2: Scan all stores for entries targeting the active creature
        // This handles self-targeted effects (e.g. Nature's Veil, Misty Escape)
        // stored on the character's own pendingExpirations — they fire whenever
        // the target becomes active, regardless of who owns the entry.
        expireForTarget(activeName, currentRound, campaignName);

        // Only run recurring zone saves if the active creature is actually in the
        // combat summary (i.e., is a caster).
        const activeCreature = creatures.find(c => utils.getName(c.name) === utils.getName(activeName));
        if (!activeCreature) return;

        // Phase 3: Sleet Storm recurring DEX saves (caster-side tracking).
        await processSleetStormSaves(activeName, campaignName);

        // Phase 4: SP-111 Stinking Cloud recurring turn-start CON saves.
        // Poisoned on a failed save; the action/bonus-action block and Poisoned
        // are shed at that creature's turn end by applyStinkingCloudTurnEnd.
        await processZoneTurnStartSaves(activeName, campaignName, 'stinking_cloud', 'stinkingCloud', processStinkingCloudAreaSave, 'Stinking Cloud turn-start save');

        // Phase 5: SP-126 Web recurring turn-start STR saves. Restrained on a
        // failed save; already-Restrained creatures skip — breaking free via a
        // STR (Athletics) action is a GM-adjudicated residual with no modal
        // consumer in this engine.
        await processZoneTurnStartSaves(activeName, campaignName, 'web', 'web', processWebAreaSave, 'Web turn-start save');
    } catch (_e) { console.error('[expireStaleEffects] Zone save expiration processing failed:', _e); }
}
