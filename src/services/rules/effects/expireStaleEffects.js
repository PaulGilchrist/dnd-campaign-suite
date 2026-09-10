import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';
import { expireForCreature, expireForTarget } from './expirationQueue.js';
import { processSleetStormAreaSave } from '../../automation/handlers/spells/sleetStormHandler.js';
import { processStinkingCloudAreaSave } from '../../automation/handlers/spells/stinkingCloudHandler.js';
import { processWebAreaSave } from '../../automation/handlers/spells/webAreaSaveHandler.js';

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

            // Wild Magic Surge: expire effects with "end of your current turn" duration
            const surgeEffects = getRuntimeValue(attacker.name, 'wildMagicSurgeEffects', campaignName);
            if (Array.isArray(surgeEffects) && surgeEffects.length > 0) {
                const filtered = surgeEffects.filter(e => {
                    if (!e || !e.duration) return true;
                    return e.duration.trim().toLowerCase() !== 'end of your current turn';
                });
                if (filtered.length !== surgeEffects.length) {
                    setRuntimeValue(attacker.name, 'wildMagicSurgeEffects', filtered, campaignName, true);
                    console.error(`[expirations] Removed ${surgeEffects.length - filtered.length} "end of current turn" surge effects for ${attacker.name}`);
                }
            }
        }

        // Phase 2: Scan all stores for entries targeting the active creature
        // This handles self-targeted effects (e.g. Nature's Veil, Misty Escape)
        // stored on the character's own pendingExpirations — they fire whenever
        // the target becomes active, regardless of who owns the entry.
        expireForTarget(activeName, currentRound, campaignName);

        // Phase 3: Check for recurring Sleet Storm area saves
        // When a creature starts its turn in the sleet storm area, it must make a DEX save
        // Only run if the active creature is actually in the combat summary (i.e., is a caster)
        const activeCreature = creatures.find(c => utils.getName(c.name) === utils.getName(activeName));
        if (activeCreature) {
            const sleetStormTrackingKey = `_sleetStorm_${activeName.replace(/\s+/g, '_')}`;
            const sleetStormTracking = getRuntimeValue(activeName, sleetStormTrackingKey, campaignName);
            if (sleetStormTracking && sleetStormTracking.saveDc) {
                // The active creature is the caster — check all other creatures for sleet storm effects
                const allTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
                const sleetEffects = Array.isArray(allTargetEffects)
                    ? allTargetEffects.filter(te => te.effect === 'sleet_storm' && te.source === activeName)
                    : [];
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

            // Phase 4: SP-111 Stinking Cloud recurring turn-start CON saves.
            // Each creature that starts its turn with a live stinking_cloud te
            // (written by the cast, swept by the concentration break) re-saves at
            // CON DC stored on the caster's `_stinkingCloud_<caster>` zone tracking
            // (SP-108 sleetStorm Phase 3 pattern). Poisoned on a failed save; the
            // action/bonus-action block and Poisoned are shed at that creature's
            // turn end by applyStinkingCloudTurnEnd.
            const allCloudEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
            const cloudEffects = Array.isArray(allCloudEffects)
                ? allCloudEffects.filter(te => te && te.effect === 'stinking_cloud' && te.target === activeName)
                : [];
            for (const te of cloudEffects) {
                const casterTrackingKey = `_stinkingCloud_${String(te.source || '').replace(/\s+/g, '_')}`;
                const cloudTracking = getRuntimeValue(te.source, casterTrackingKey, campaignName);
                if (!cloudTracking || !cloudTracking.saveDc) continue;
                try {
                    await processStinkingCloudAreaSave(te.source, activeName, campaignName, cloudTracking.mapName);
                } catch (_e) { console.error(`[expireStaleEffects] Stinking Cloud turn-start save failed for ${activeName}:`, _e); }
            }

            // Phase 5: SP-126 Web recurring turn-start STR saves. Each creature
            // carrying a live `web` zone te (written at cast by webAreaSaveHandler,
            // swept by the concentration break) re-saves at the caster's DC when
            // its own turn starts (SP-111 stinking_cloud Phase 4 pattern).
            // Restrained on a failed save; already-Restrained creatures skip —
            // breaking free via a STR (Athletics) action is a GM-adjudicated
            // residual with no modal consumer in this engine.
            const allWebEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
            const webEffects = Array.isArray(allWebEffects)
                ? allWebEffects.filter(te => te && te.effect === 'web' && te.target === activeName)
                : [];
            for (const te of webEffects) {
                const casterTrackingKey = `_web_${String(te.source || '').replace(/\s+/g, '_')}`;
                const webTracking = getRuntimeValue(te.source, casterTrackingKey, campaignName);
                if (!webTracking || !webTracking.saveDc) continue;
                try {
                    await processWebAreaSave(te.source, activeName, campaignName, webTracking.mapName);
                } catch (_e) { console.error(`[expireStaleEffects] Web turn-start save failed for ${activeName}:`, _e); }
            }
        }
    } catch (_e) { console.error('[expireStaleEffects] Zone save expiration processing failed:', _e); }
}
