// @maintained-by-ai
// Backlog 2026-11-13: approving/rejecting a draft used to ride the plain CRUD
// save/delete lane with NO campaign-log trace — another GM tab could not see
// that a live entity came from an approval. approveDraft/rejectDraft now each
// write exactly ONE thin audit row (type + description only, via the shared
// POST /log lane like the adventure_regenerated / ai_director_applied
// siblings) AFTER the normal lane succeeds. Same service-mock convention as
// draftActions.test.js.
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
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(), getLog: vi.fn(),
}));

import { deleteQuest } from './questsService.js';
import { saveNPC, deleteNPC } from '../npcs/npcsService.js';
import { deleteMap } from '../maps/mapsService.js';
import { addEntry } from '../ui/logService.js';
import { approveDraft, rejectDraft } from './draftActions.js';

beforeEach(() => vi.clearAllMocks());

describe('draft approve/reject audit rows — thin, action-specific, one per decision', () => {
    it('approve writes exactly one ai_draft_approved row naming kind + entity', async () => {
        await approveDraft('C', 'npcs', { name: 'Seren Vael', draft: true });
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('C', {
            type: 'ai_draft_approved',
            name: 'AI draft review',
            description: 'Approved AI draft: npc "Seren Vael"',
        });
    });

    it('reject writes the matching ai_draft_rejected row (symmetric, same lane)', async () => {
        await rejectDraft('C', 'npcs', { name: 'Seren Vael', draft: true });
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('C', {
            type: 'ai_draft_rejected',
            name: 'AI draft review',
            description: 'Rejected AI draft: npc "Seren Vael"',
        });
    });

    it('every kind names a human-facing singular (maps → "map", ids label uuid kinds)', async () => {
        deleteQuest.mockResolvedValue(undefined);
        deleteMap.mockResolvedValue(undefined);
        await rejectDraft('C', 'quests', { id: 'q-1', name: 'Tide-Born Whisper' });
        await rejectDraft('C', 'maps', { slug: 'dungeon-x', draft: true });
        expect(addEntry.mock.calls.map(([, e]) => e.description)).toEqual([
            'Rejected AI draft: quest "Tide-Born Whisper"',
            'Rejected AI draft: map "dungeon-x"',
        ]);
    });

    it('the audit rides the log lane only — the save/delete lane is not otherwise altered', async () => {
        await approveDraft('C', 'npcs', { name: 'Seren Vael', draft: true });
        expect(saveNPC).toHaveBeenCalledTimes(1); // one normal-lane write, audit is not a second entity write
        await rejectDraft('C', 'npcs', { name: 'Seren Vael', draft: true });
        expect(deleteNPC).toHaveBeenCalledTimes(1);
    });

    it('a failed lane writes NO audit row (nothing was approved/rejected)', async () => {
        saveNPC.mockRejectedValue(new Error('conflict'));
        await expect(approveDraft('C', 'npcs', { name: 'Seren Vael', draft: true })).rejects.toThrow('conflict');
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('a name-law refusal throws before any lane or audit write', async () => {
        await expect(approveDraft('C', 'npcs', { name: 'npc', draft: true })).rejects.toThrow(/Not approved/);
        expect(addEntry).not.toHaveBeenCalled();
        expect(saveNPC).not.toHaveBeenCalled();
    });

    it('a log-write failure never masks the decision (lane already succeeded)', async () => {
        saveNPC.mockResolvedValue(undefined); // undo the previous test's rejection (clearAllMocks keeps implementations)
        addEntry.mockRejectedValueOnce(new Error('log lane down'));
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(approveDraft('C', 'npcs', { name: 'Seren Vael', draft: true })).resolves.toBeUndefined();
        expect(saveNPC).toHaveBeenCalledTimes(1);
        expect(err).toHaveBeenCalled();
        err.mockRestore();
    });
});
