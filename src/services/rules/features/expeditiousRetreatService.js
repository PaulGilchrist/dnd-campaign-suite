import { addEntry } from '../../ui/logService.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import storage from '../../ui/storage.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// SP-128 grant-state keys: the persisted expeditiousRetreatActive flag is
// the single source of truth gating BOTH the sheet Bonus Actions row
// (CharBonusActions) and the dash handler; the turnStartEffects entry rides
// the verified turn-start lane (TURN_START_HANDLERS in turnStartEffects.js)
// so the Dash grant is re-offered at EVERY caster turn. Both are cleared on
// concentration break by the 'Expeditious Retreat' branch in
// concentrationService cleanupConcentrationEffects (verified consumer).
export const ER_ACTIVE_FLAG = 'expeditiousRetreatActive';
export const ER_DASH_USED_ROUND_KEY = '_Expeditious_Retreat_dash_usedRound';
export const ER_TURN_START_OFFER_TYPE = 'expeditious_retreat_dash_offer';

export async function triggerExpeditiousRetreat(spell, metaCtx, playerStats, campaignName, _mapName) {
    const isExpeditiousRetreat = (spell.name || '').toLowerCase() === 'expeditious retreat';
    if (!isExpeditiousRetreat) return null;

    const targetName = playerStats.name;

    // Add concentration on the caster so the badge shows in the initiative tracker
    const csForConc = getCombatSummary(campaignName);
    if (csForConc) {
        const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0);
        addConcentration(csForConc, playerStats.name, 'Expeditious Retreat', concentrationDc);
        storage.set('combatSummary', csForConc, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    // SP-128: grant stamp — persisted flag (row + handler gate) + turn-start
    // re-offer entry. No te marker: registerTargetEffect writes skipSync=true
    // (memory-only, never POSTs) so it would not survive reload/broadcast; the
    // persisted flag is the authoritative grant state.
    await setRuntimeValue(targetName, ER_ACTIVE_FLAG, true, campaignName);
    const storedOffer = getRuntimeValue(targetName, 'turnStartEffects', campaignName);
    const offers = Array.isArray(storedOffer) ? storedOffer : [];
    if (!offers.some(e => e && e.type === ER_TURN_START_OFFER_TYPE)) {
        await setRuntimeValue(targetName, 'turnStartEffects', [...offers, { type: ER_TURN_START_OFFER_TYPE }], campaignName);
    }

    // Log to campaign
    addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName,
        spellName: 'Expeditious Retreat',
        spellLevel: 1,
        description: `${playerStats.name} casts Expeditious Retreat on themself. They can take the Dash action as a bonus action on each of their turns until concentration breaks.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[expeditiousRetreat] Error logging:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Expeditious Retreat',
            automationType: 'expeditious_retreat',
            description: `<b>Expeditious Retreat</b><br/>${targetName} has <b>Concentration</b> — can take the Dash action as a bonus action on each of their turns. A <b>Dash (Expeditious Retreat)</b> row is now offered in your Bonus Actions on every turn until the spell ends.`,
        },
    };
}
