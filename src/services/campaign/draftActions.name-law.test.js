// @maintained-by-ai
// Regression (bug-designer-draft-accepts-kind-word-entity-name): Approve is the
// last gate before an AI draft becomes LIVE campaign data — the bug's live face
// was Approve persisting an NPC row literally named "npc" with zero warning.
// validateEntity now blocks such rows before they draft, and approveDraft keeps
// the belt-and-braces refusal for legacy drafts already on disk. Same service-
// mock convention as draftActions.test.js.
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

import { loadQuests, saveQuests } from './questsService.js';
import { saveNPC } from '../npcs/npcsService.js';
import { loadEncounter, updateEncounter } from '../encounters/encountersService.js';
import { loadMapData, saveMapData } from '../maps/mapsService.js';
import { approveDraft } from './draftActions.js';

beforeEach(() => vi.clearAllMocks());

describe('approveDraft — the name law is enforced at the live gate', () => {
    it('refuses a legacy kind-word draft and touches NO save lane', async () => {
        await expect(approveDraft('C', 'npcs', { name: 'npc', draft: true, personality: 'Suspicious' }))
            .rejects.toThrow(/name "npc" is a kind word.*Reject this draft/s);
        expect(saveNPC).not.toHaveBeenCalled();
    });

    it('refuses placeholders on every kind, quoting the offending name', async () => {
        loadQuests.mockResolvedValue([{ id: 'q1', name: 'TBD', draft: true }]);
        await expect(approveDraft('C', 'quests', { id: 'q1', name: 'TBD', draft: true }))
            .rejects.toThrow(/"TBD" is a placeholder/);
        expect(saveQuests).not.toHaveBeenCalled();

        loadEncounter.mockResolvedValue({ name: 'Untitled' });
        await expect(approveDraft('C', 'encounters', { name: 'Untitled', draft: true }))
            .rejects.toThrow(/"Untitled" is a placeholder/);
        expect(updateEncounter).not.toHaveBeenCalled();

        loadMapData.mockResolvedValue({ name: 'map_plan', displayName: 'Map Plan' });
        await expect(approveDraft('C', 'maps', { slug: 'map_plan', name: 'map_plan', draft: true }))
            .rejects.toThrow(/kind word/);
        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('properly-named drafts approve exactly as before (adjacent behavior intact)', async () => {
        await approveDraft('C', 'npcs', { name: 'Maren Tidal-Voss', draft: true, personality: 'Gruff' });
        expect(saveNPC).toHaveBeenCalledWith('C', { name: 'Maren Tidal-Voss', personality: 'Gruff' }, 'Maren Tidal-Voss');
    });
});
