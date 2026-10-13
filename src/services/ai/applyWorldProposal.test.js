// §9.4 — confirmed world proposals: narrative → log, quest_draft → CRUD lane.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../campaign/questsService.js', () => ({
    loadQuests: vi.fn(async () => [{ id: 'q1', name: 'Existing Quest', status: 'active', description: 'x', rewards: '', notes: '' }]),
    saveQuests: vi.fn(async () => {}),
}));

import { addEntry } from '../ui/logService.js';
import { loadQuests, saveQuests } from '../campaign/questsService.js';
import { applyWorldProposal } from './applyWorldProposal.js';

const CN = 'test-campaign';

beforeEach(() => { vi.clearAllMocks(); loadQuests.mockResolvedValue([]); });
afterEach(() => vi.unstubAllGlobals());

describe('applyWorldProposal', () => {
    it('recap confirms as a narrative log entry + audit', async () => {
        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'recap', text: 'Ash and ember…' } });
        expect(r.applied).toBe(true);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative' }));
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_world_applied', description: expect.stringContaining('applied: recap') }));
    });

    it('npc_dialogue logs with the speaker; rumors too', async () => {
        await applyWorldProposal({ campaignName: CN, proposal: { kind: 'npc_dialogue', npcName: 'Mira', text: 'Trouble follows you.' } });
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'Mira', description: expect.stringContaining('Trouble follows you.') }));
    });

    it('quest_draft rides the normal quests CRUD lane, provenance stamped', async () => {
        loadQuests.mockResolvedValue([{ id: 'q1', name: 'Existing' }]);
        const r = await applyWorldProposal({
            campaignName: CN,
            proposal: { kind: 'quest_draft', name: 'The Sunken Vault', description: 'Recover the relic.', rewards: '200gp' },
        });
        expect(r.applied).toBe(true);
        expect(saveQuests).toHaveBeenCalledWith(CN, expect.arrayContaining([
            expect.objectContaining({ name: 'The Sunken Vault', status: 'active', rewards: '200gp', notes: 'AI-drafted — confirmed by the referee' }),
            expect.objectContaining({ id: 'q1' }),
        ]));
    });

    it('quest CRUD failure is caught + refused, never thrown at the console', async () => {
        saveQuests.mockRejectedValueOnce(new Error('ledger locked'));
        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'quest_draft', name: 'X', description: 'y' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/apply failed/);
    });

    it('needs_human / garbage never write', async () => {
        expect((await applyWorldProposal({ campaignName: CN, proposal: { kind: 'needs_human', text: 'GM decides' } })).applied).toBe(false);
        expect((await applyWorldProposal({ campaignName: CN, proposal: { kind: 'rewrite_history' } })).applied).toBe(false);
        expect((await applyWorldProposal({ campaignName: CN, proposal: null })).applied).toBe(false);
        expect(saveQuests).not.toHaveBeenCalled();
    });
});
