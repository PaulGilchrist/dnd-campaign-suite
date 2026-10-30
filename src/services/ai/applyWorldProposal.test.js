// @maintained-by-ai
// §9.4 — confirmed world proposals: narrative → log, quest_draft → CRUD lane.
// Pure dispatcher over a stable KIND_APPLY table with service boundaries mocked;
// deterministic contract, no churn expected when the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('applyWorldProposal', () => {
    it('recap confirms as a narrative log entry + audit', async () => {
        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'recap', text: 'Ash and ember…' } });
        expect(r.applied).toBe(true);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'World keeper', description: expect.stringContaining('Ash and ember…') }));
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_world_applied', description: expect.stringContaining('applied: recap') }));
    });

    it('npc_dialogue logs with the speaker; rumors too', async () => {
        await applyWorldProposal({ campaignName: CN, proposal: { kind: 'npc_dialogue', npcName: 'Mira', text: 'Trouble follows you.' } });
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'Mira', description: expect.stringContaining('Trouble follows you.') }));

        await applyWorldProposal({ campaignName: CN, proposal: { kind: 'rumor', text: 'The vault is guarded.' } });
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'World keeper', description: expect.stringContaining('The vault is guarded.') }));
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

    // Regression (bug-ai-world-quest-draft-missing-id): drafts saved without
    // an id were undeletable (DELETE /quests/undefined → 404), tripped the
    // React key warning, and collided on edit with every other id-less row.
    // The manual create lane (Quests.jsx) stamps crypto.randomUUID() — so must this one.
    it('quest_draft stamps a stable id like the manual create lane', async () => {
        loadQuests.mockResolvedValue([{ id: 'q1', name: 'Existing' }]);
        const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('draft-uuid-1');
        try {
            const r = await applyWorldProposal({
                campaignName: CN,
                proposal: { kind: 'quest_draft', name: 'Silence on the North Road', description: 'Caravans missing.' },
            });
            expect(r.applied).toBe(true);
            const [campaign, list] = saveQuests.mock.calls[0];
            expect(campaign).toBe(CN);
            const draft = list.find(q => q.name === 'Silence on the North Road');
            expect(draft.id).toBe('draft-uuid-1');
            expect(list.find(q => q.id === 'q1')).toBeTruthy(); // existing rows preserved
        } finally {
            uuidSpy.mockRestore();
        }
    });

    it('quest CRUD failure is caught + refused, never thrown at the console', async () => {
        saveQuests.mockRejectedValueOnce(new Error('ledger locked'));
        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'quest_draft', name: 'X', description: 'y' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/apply failed/);
    });

    it('needs_human / garbage never write', async () => {
        expect((await applyWorldProposal({ campaignName: CN, proposal: { kind: 'needs_human', text: 'GM decides' } })).applied).toBe(false);
        expect((await applyWorldProposal({ campaignName: CN, proposal: null })).applied).toBe(false);
        // Silent short-circuit: nothing written to any lane, not even the audit row.
        expect(addEntry).not.toHaveBeenCalled();

        // Unknown kinds are refused AND leave a refused audit trail.
        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'rewrite_history' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/unknown kind .* refused/);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
            type: 'ai_world_applied',
            description: expect.stringContaining('refused: rewrite_history'),
        }));
        expect(saveQuests).not.toHaveBeenCalled();
    });
});
