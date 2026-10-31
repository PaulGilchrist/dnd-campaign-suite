// @maintained-by-ai
// Campaign-authoring plan Phase 3 — approve/reject must ride the EXISTING
// per-kind services (approve = same-lane save minus the draft field; reject =
// normal delete). These tests pin the service contract the Campaign Builder
// depends on without touching fetch.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./questsService.js', () => ({
    loadQuests: vi.fn(), saveQuests: vi.fn(), deleteQuest: vi.fn(),
}));
vi.mock('./factionsService.js', () => ({
    loadFactions: vi.fn(), saveFactions: vi.fn(), deleteFaction: vi.fn(),
}));
vi.mock('../npcs/npcsService.js', () => ({
    loadNPCs: vi.fn(), saveNPC: vi.fn(), deleteNPC: vi.fn(),
}));
vi.mock('./settlementsService.js', () => ({
    loadSettlements: vi.fn(), saveSettlement: vi.fn(), deleteSettlement: vi.fn(),
}));
vi.mock('./sessionsService.js', () => ({
    loadSessions: vi.fn(), saveSession: vi.fn(), deleteSession: vi.fn(),
}));
vi.mock('../encounters/encountersService.js', () => ({
    loadEncounters: vi.fn(), loadEncounter: vi.fn(), updateEncounter: vi.fn(), deleteEncounter: vi.fn(),
}));
vi.mock('../maps/mapsService.js', () => ({
    loadMaps: vi.fn(), loadMapData: vi.fn(), saveMapData: vi.fn(), deleteMap: vi.fn(),
}));

import { loadQuests, saveQuests, deleteQuest } from './questsService.js';
import { loadFactions, deleteFaction } from './factionsService.js';
import { loadNPCs, saveNPC, deleteNPC } from '../npcs/npcsService.js';
import { loadSettlements, saveSettlement } from './settlementsService.js';
import { loadSessions, saveSession } from './sessionsService.js';
import { loadEncounters, loadEncounter, updateEncounter, deleteEncounter } from '../encounters/encountersService.js';
import { loadMaps, loadMapData, saveMapData, deleteMap } from '../maps/mapsService.js';
import { loadDrafts, approveDraft, rejectDraft } from './draftActions.js';

beforeEach(() => vi.clearAllMocks());

describe('loadDrafts — groups only draft:true rows per kind', () => {
    it('filters every kind and tolerates envelope shapes', async () => {
        loadFactions.mockResolvedValue({ factions: [{ id: 'f1', name: 'Cult', draft: true }, { id: 'f2', name: 'Guild' }] });
        loadSettlements.mockResolvedValue({ settlements: [] });
        loadNPCs.mockResolvedValue({ npcs: [{ name: 'Oldhem', draft: true }] });
        loadQuests.mockResolvedValue([{ name: 'Q1', draft: true }, { name: 'Q2' }]); // unwrapped array
        loadEncounters.mockResolvedValue({ encounters: [{ name: 'E1', draft: true }] });
        loadSessions.mockResolvedValue({ sessions: [{ name: 'S4' }] });
        loadMaps.mockResolvedValue({ maps: [{ fileName: 'dungeon-x.json', slug: 'dungeon-x', draft: true }] });

        const drafts = await loadDrafts('C');
        expect(drafts.factions.map(f => f.name)).toEqual(['Cult']);
        expect(drafts.npcs).toHaveLength(1);
        expect(drafts.quests.map(q => q.name)).toEqual(['Q1']);
        expect(drafts.encounters).toHaveLength(1);
        expect(drafts.sessions).toEqual([]);
        expect(drafts.maps[0].slug).toBe('dungeon-x');
    });
});

describe('approveDraft — the draft field is gone, every other byte rides the normal lane', () => {
    it('uuid-array kind: re-reads the fresh list and clears the flag on the target only', async () => {
        loadQuests.mockResolvedValue([
            { id: 'q1', name: 'Draft Quest', draft: true, updatedAt: 5 },
            { id: 'q2', name: 'Other Draft', draft: true, updatedAt: 6 },
        ]);
        await approveDraft('C', 'quests', { id: 'q1' });
        const saved = saveQuests.mock.calls[0][1];
        expect(saved.find(q => q.id === 'q1')).toEqual({ id: 'q1', name: 'Draft Quest', updatedAt: 5 }); // no draft residue
        expect(saved.find(q => q.id === 'q2').draft).toBe(true); // untouched
    });

    it('name-keyed kinds: PUT-upsert by name with the flag stripped', async () => {
        await approveDraft('C', 'npcs', { name: 'Oldhem', draft: true, personality: 'Gruff' });
        expect(saveNPC).toHaveBeenCalledWith('C', { name: 'Oldhem', personality: 'Gruff' }, 'Oldhem');
    });

    it('encounters/maps: re-read the full document before clearing (list lanes are summaries)', async () => {
        loadEncounter.mockResolvedValue({ name: 'E1', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }], draft: true });
        await approveDraft('C', 'encounters', { name: 'E1' });
        expect(updateEncounter).toHaveBeenCalledWith('C', 'E1', {
            name: 'E1', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
        });

        loadMapData.mockResolvedValue({ name: 'dungeon-x', gridSize: 30, draft: true });
        await approveDraft('C', 'maps', { slug: 'dungeon-x' });
        expect(saveMapData).toHaveBeenCalledWith('C', 'dungeon-x', { name: 'dungeon-x', gridSize: 30 });
    });

    it('sessions/settlements use their upsert lanes with oldName = name', async () => {
        await approveDraft('C', 'sessions', { name: 'S4', draft: true });
        expect(saveSession).toHaveBeenCalledWith('C', { name: 'S4' }, 'S4');
        await approveDraft('C', 'settlements', { name: 'Mudport', draft: true });
        expect(saveSettlement).toHaveBeenCalledWith('C', { name: 'Mudport' }, 'Mudport');
    });

    it('unknown kind fails loudly (never a silent no-op)', async () => {
        await expect(approveDraft('C', 'dragons', {})).rejects.toThrow(/Unknown draft kind/);
    });
});

describe('rejectDraft — normal delete lanes', () => {
    it('routes per kind identity (id for uuid kinds, name/slug otherwise)', async () => {
        await rejectDraft('C', 'quests', { id: 'q1' });
        expect(deleteQuest).toHaveBeenCalledWith('C', 'q1');
        await rejectDraft('C', 'factions', { id: 'f1' });
        expect(deleteFaction).toHaveBeenCalledWith('C', 'f1');
        await rejectDraft('C', 'npcs', { name: 'Oldhem' });
        expect(deleteNPC).toHaveBeenCalledWith('C', 'Oldhem');
        await rejectDraft('C', 'encounters', { name: 'E1' });
        expect(deleteEncounter).toHaveBeenCalledWith('C', 'E1');
        await rejectDraft('C', 'maps', { fileName: 'dungeon-x.json', slug: 'dungeon-x' });
        expect(deleteMap).toHaveBeenCalledWith('C', 'dungeon-x');
    });
});
