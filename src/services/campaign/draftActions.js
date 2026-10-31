/**
 * Campaign-authoring plan Phase 3 — draft approve/reject for the Campaign
 * Builder panel (and any editor badge). Deliberately built ONLY from the
 * existing per-kind services: approving is a save that drops the `draft`
 * field through the NORMAL lane (so stamps, dedupe, broadcasts all apply),
 * rejecting is the normal delete. No new server endpoints, no new write
 * semantics — the server remains the single source of truth.
 *
 * uuid-array kinds (quests/factions) only have whole-array saves, so approve
 * re-reads the fresh list (minimizing the concurrent-edit window; a 409 still
 * surfaces via the services' err.conflict flag) and overwrites with just the
 * draft flag removed on the target row.
 */
import { loadQuests, saveQuests, deleteQuest } from './questsService.js';
import { loadFactions, saveFactions, deleteFaction } from './factionsService.js';
import { loadNPCs, saveNPC, deleteNPC } from '../npcs/npcsService.js';
import { loadSettlements, saveSettlement, deleteSettlement } from './settlementsService.js';
import { loadSessions, saveSession, deleteSession } from './sessionsService.js';
import { loadEncounters, loadEncounter, updateEncounter, deleteEncounter } from '../encounters/encountersService.js';
import { loadMaps, loadMapData, saveMapData, deleteMap } from '../maps/mapsService.js';

/** Drop the draft flag without leaving an explicit `draft: false` residue. */
const approved = (row) => Object.fromEntries(
  Object.entries(row).filter(([key]) => key !== 'draft')
);

const unwrap = (body, key) => (Array.isArray(body) ? body : body?.[key] || []);

export const DRAFT_KINDS = [
  { kind: 'factions', label: 'Factions', icon: 'fa-handshake' },
  { kind: 'settlements', label: 'Settlements', icon: 'fa-city' },
  { kind: 'npcs', label: 'NPCs', icon: 'fa-users' },
  { kind: 'quests', label: 'Quests', icon: 'fa-scroll' },
  { kind: 'encounters', label: 'Encounters', icon: 'fa-skull-crossbones' },
  { kind: 'sessions', label: 'Sessions', icon: 'fa-calendar-check' },
  { kind: 'maps', label: 'Maps', icon: 'fa-map' },
];

async function draftRows(loader, key) {
  const body = await loader();
  return unwrap(body, key).filter(row => row?.draft === true);
}

/** Every AI draft across all kinds, grouped for the review panel. */
export async function loadDrafts(campaignName) {
  const c = campaignName;
  const [factions, settlements, npcs, quests, encounters, sessions, maps] = await Promise.all([
    draftRows(() => loadFactions(c), 'factions'),
    draftRows(() => loadSettlements(c), 'settlements'),
    draftRows(() => loadNPCs(c), 'npcs'),
    draftRows(() => loadQuests(c), 'quests'),
    draftRows(() => loadEncounters(c), 'encounters'),
    draftRows(() => loadSessions(c), 'sessions'),
    draftRows(async () => (await loadMaps(c)).maps, 'maps'),
  ]);
  return { factions, settlements, npcs, quests, encounters, sessions, maps };
}

const identity = row => row.id ?? row.name ?? row.slug ?? row.fileName;

/** Approve one draft row through its kind's normal save lane. */
export async function approveDraft(campaignName, kind, row) {
  const c = campaignName;
  switch (kind) {
    case 'quests': {
      const all = await loadQuests(c);
      await saveQuests(c, all.map(q => (q.id === row.id ? approved(q) : q)));
      return;
    }
    case 'factions': {
      const all = unwrap(await loadFactions(c), 'factions');
      await saveFactions(c, all.map(f => (f.id === row.id ? approved(f) : f)));
      return;
    }
    case 'npcs':
      await saveNPC(c, approved(row), row.name);
      return;
    case 'settlements':
      await saveSettlement(c, approved(row), row.name);
      return;
    case 'sessions':
      await saveSession(c, approved(row), row.name);
      return;
    case 'encounters': {
      // Re-read the full document (the list lane only carries a summary).
      const fresh = await loadEncounter(c, row.name);
      await updateEncounter(c, row.name, approved(fresh));
      return;
    }
    case 'maps': {
      const slug = row.slug || row.fileName?.replace(/\.json$/, '') || row.name;
      const fresh = await loadMapData(c, slug);
      await saveMapData(c, slug, approved(fresh));
      return;
    }
    default:
      throw new Error(`Unknown draft kind: ${kind}`);
  }
}

/** Reject (delete) one draft row through its kind's normal delete lane. */
export async function rejectDraft(campaignName, kind, row) {
  const c = campaignName;
  switch (kind) {
    case 'quests': return deleteQuest(c, row.id);
    case 'factions': return deleteFaction(c, row.id);
    case 'npcs': return deleteNPC(c, row.name);
    case 'settlements': return deleteSettlement(c, row.name);
    case 'sessions': return deleteSession(c, row.name);
    case 'encounters': return deleteEncounter(c, row.name);
    case 'maps': return deleteMap(c, row.slug || row.fileName?.replace(/\.json$/, '') || row.name);
    default: throw new Error(`Unknown draft kind: ${kind}`);
  }
}

export { identity as draftRowIdentity };
