// #1370 dead-export delete: triggerGreaterRestoration removed — ZERO importers
// repo-wide (src/server/config/public census). The spell bar's direct cast
// dispatches automation type 'greater_restoration' straight to the handler
// (automation/index.js:560 → greaterRestorationHandler.handle; envelope built
// caller-side at useSimpleSpellHandlers.js:311). confirmGreaterRestoration
// below is the LIVE export (useSimpleSpellHandlers.js:26).
import { applyGreaterRestorationEffect } from '../../automation/index.js';

export async function confirmGreaterRestoration(action, playerStats, campaignName, mapName, result) {
    try {
        const appliedResult = await applyGreaterRestorationEffect(action, playerStats, campaignName, mapName, result);
        return appliedResult;
    } catch (e) {
        console.error('[greaterRestoration] Failed to apply Greater Restoration effect:', e);
        return null;
    }
}
