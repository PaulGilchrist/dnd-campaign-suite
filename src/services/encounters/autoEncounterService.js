/**
 * L5 Phase 4 (§10.2) — auto-encounter.
 *
 * The travel lane already rolls random combat events and enhances them
 * with a balanced encounter (useTravelManagement.enhanceCombatEvent →
 * generateEncounterSuggestions). The GM's Accept click in the event dialog
 * is the human consent (§9.5). This service closes the loop the manual UI
 * leaves open: it hydrates the accepted event's monster list into full
 * monsters, starts the initiative tracker through the existing
 * loadEncounterToInitiative lane (engine rolls NPC initiative, sets the
 * active creature, sweeps last combat's clocks), and moves the session phase
 * to `encounter` (§10.1).
 *
 * Gated on the `enforcement.autoEncounters` sub-flag (default OFF): off ⇒
 * zero writes, zero traffic — Accept keeps today's exact behavior (map
 * spawns, the GM starts initiative whenever they like). Engine dice only —
 * no AI in this lane (the AI-proposal encounter flavor is a §10.2
 * follow-up); no timers (§ No Game Timers).
 */
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { resolveEnforcement } from '../combat/canTakeAction.js';
import { setSessionPhase } from '../combat/sessionService.js';
import { loadEncounterToInitiative } from './encounterToInitiative.js';
import { loadMonsters } from '../ui/dataLoader.js';
import { addEntry } from '../ui/logService.js';

/**
 * Start combat from an accepted travel event. Idempotence: running it twice
 * for the same event would reset the tracker again — callers fire it once
 * per Accept click, the human gesture that arms it.
 * @returns {Promise<{started:boolean, reason?:string}>}
 */
export async function autoStartEncounterFromEvent({ campaignName, event, characters = [] }) {
    if (!campaignName || !event) return { started: false, reason: 'no campaign/event' };
    const flags = resolveEnforcement(getRuntimeValue('campaign', 'enforcement', campaignName));
    if (!flags.autoEncounters) return { started: false, reason: 'autoEncounters off' };
    const groups = event.encounter?.monsters;
    if (!Array.isArray(groups) || groups.length === 0) return { started: false, reason: 'event has no encounter roster' };

    // Hydrate index → full monster stat blocks (loadEncounterToInitiative
    // needs AC/HP/init/save bonuses). Unknown indexes are skipped loudly.
    const monsters = await loadMonsters();
    const selected = [];
    for (const g of groups) {
        const def = monsters.find((m) => m.index === g.index || m.name === g.name);
        if (!def) {
            console.error(`[autoEncounter] unknown monster index/name: ${g.index || g.name} — skipped`);
            continue;
        }
        selected.push({ ...def, qty: g.qty || 1 });
    }
    if (selected.length === 0) return { started: false, reason: 'no hydratable monsters' };

    const { combatSummary } = await loadEncounterToInitiative(selected, characters, campaignName);
    await setSessionPhase({
        campaignName,
        phase: 'encounter',
        changedBy: 'auto-encounter',
        reason: `travel event: ${event.title || 'combat'}`,
    });
    await addEntry(campaignName, {
        type: 'automation',
        automationType: 'auto_encounter_started',
        difficulty: event.encounter.difficultyLabel || null,
        totalXP: event.encounter.totalXP ?? null,
        description: `Auto-encounter started: ${selected.map((m) => `${m.qty}x ${m.name}`).join(', ')}`
            + ` (${combatSummary.creatures.length} on the tracker, initiative rolled by the engine).`,
    }).catch((e) => { console.error('[autoEncounter] log failed:', e); });
    return { started: true };
}
