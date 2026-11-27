// @maintained-by-ai 2026-11-26
// §9.4 — confirmed world proposals: narrative → log, quest_draft → CRUD lane.
// Pure dispatcher over a stable KIND_APPLY table with service boundaries mocked;
// deterministic contract, no churn expected when the app changes.
// Failure COPY law is owned by applyFailureCopy.test.js — only the routed raw
// tail and the audit row's shaped copy are pinned here, never the sentences.
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
        // Owner ruling 2026-11-21: the AI narrates AS the GM — the server
        // manual-author gate requires a real author, so characterName must
        // ride the narrative row (name alone is the speaker, not the author).
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', characterName: 'GM', name: 'World keeper', description: expect.stringContaining('Ash and ember…') }));
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_world_applied', characterName: 'AI world keeper', description: expect.stringContaining('applied: recap') }));
        // Canonical author field only (backlog 2026-11-21 LLL): the audit row
        // carries no dead `name`; the narrative row's `name` stays (speaker).
        const auditRow = addEntry.mock.calls.find(([ , e]) => e.type === 'ai_world_applied')[1];
        expect(auditRow).not.toHaveProperty('name');
    });

    it('npc_dialogue logs with the speaker; rumor and event as world keeper', async () => {
        await applyWorldProposal({ campaignName: CN, proposal: { kind: 'npc_dialogue', npcName: 'Mira', text: 'Trouble follows you.' } });
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'Mira', description: expect.stringContaining('Trouble follows you.') }));

        await applyWorldProposal({ campaignName: CN, proposal: { kind: 'rumor', text: 'The vault is guarded.' } });
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'World keeper', description: expect.stringContaining('The vault is guarded.') }));

        await applyWorldProposal({ campaignName: CN, proposal: { kind: 'event', text: 'A comet splits the sky.' } });
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'narrative', name: 'World keeper', description: expect.stringContaining('A comet splits the sky.') }));
    });

    // Regression (bug-ai-world-quest-draft-missing-id): drafts saved without
    // an id were undeletable (DELETE /quests/undefined → 404), tripped the
    // React key warning, and collided on edit with every other id-less row.
    // Pin a usable id, NOT the generator mechanism (utils.safeUuid has a
    // guid() fallback — spying on crypto.randomUUID would pin the wrong impl).
    it('quest_draft rides the normal quests CRUD lane, id + provenance stamped', async () => {
        loadQuests.mockResolvedValue([{ id: 'q1', name: 'Existing' }]);
        const r = await applyWorldProposal({
            campaignName: CN,
            proposal: { kind: 'quest_draft', name: 'The Sunken Vault', description: 'Recover the relic.', rewards: '200gp' },
        });
        expect(r.applied).toBe(true);
        const [campaign, list] = saveQuests.mock.calls[0];
        expect(campaign).toBe(CN);
        expect(list.find(q => q.id === 'q1')).toBeTruthy(); // existing rows preserved
        const draft = list.find(q => q.name === 'The Sunken Vault');
        expect(draft).toMatchObject({ status: 'active', description: 'Recover the relic.', rewards: '200gp', notes: 'AI-drafted — confirmed by the referee' });
        expect(typeof draft.id).toBe('string');
        expect(draft.id.length).toBeGreaterThan(0);
    });

    // Receipt copy (backlog YB 2026-11-13): the quest lands LIVE (status
    // active, no draft flag) directly in the ledger, so the detail that feeds
    // the Applied notice and the audit row must state that plainly — never
    // "(AI-drafted)" wording that implies a draft pending approval.
    it('quest_draft receipt says added directly to the ledger, never "draft"', async () => {
        const r = await applyWorldProposal({
            campaignName: CN,
            proposal: { kind: 'quest_draft', name: 'Tide-Born Whisper', description: 'Follow the humming tide.' },
        });
        expect(r.applied).toBe(true);
        expect(r.detail).toBe("quest 'Tide-Born Whisper' added directly to the ledger");
        expect(r.detail).not.toMatch(/draft/i);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
            type: 'ai_world_applied',
            characterName: 'AI world keeper',
            description: expect.stringContaining('added directly to the ledger'),
        }));
    });

    // Backlog 2026-11-22 (UI) — the refusal never throws at the console; the
    // detail is the bounded shaped copy (sentence law owned by
    // applyFailureCopy.test.js — only the routed raw tail is pinned here), and
    // the refused audit row carries that same shaped copy, not the raw page.
    it('quest CRUD failure is caught, shaped, and refused in the audit', async () => {
        const html = `<h1>502 Bad Gateway</h1>${'<p>proxy upstream returned an invalid response</p>'.repeat(12)}`;
        loadQuests.mockRejectedValueOnce(new Error(html));
        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'quest_draft', name: 'X', description: 'y' } });
        expect(r.applied).toBe(false);
        expect(r.detail).not.toContain(html); // raw page not echoed whole
        const auditRow = addEntry.mock.calls.find(([ , e]) => e.type === 'ai_world_applied')[1];
        expect(auditRow.description).toContain('refused: quest_draft');
        expect(auditRow.description).not.toContain(html);

        // Save-side catch too: a short raw error stays verbatim in the tail.
        saveQuests.mockRejectedValueOnce(new Error('ledger locked'));
        const r2 = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'quest_draft', name: 'X', description: 'y' } });
        expect(r2.applied).toBe(false);
        expect(r2.detail).toContain('ledger locked');
    });

    // Source quirk pinned honestly: the docstring promises every-outcome-
    // logged, but needs_human/null short-circuit BEFORE audit() — silently
    // refused, nothing written to any lane. Unknown kinds do audit-refuse.
    it('needs_human / garbage never write; unknown kinds refuse with an audit trail', async () => {
        const nh = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'needs_human', text: 'GM decides' } });
        expect(nh.applied).toBe(false);
        expect(nh.detail).toBe('GM decides'); // the proposal's own text passes through to the console
        expect((await applyWorldProposal({ campaignName: CN, proposal: null })).applied).toBe(false);
        // Silent short-circuit: nothing written to any lane, not even the audit row.
        expect(addEntry).not.toHaveBeenCalled();

        const r = await applyWorldProposal({ campaignName: CN, proposal: { kind: 'rewrite_history' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/unknown kind .* refused/);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
            type: 'ai_world_applied',
            characterName: 'AI world keeper',
            description: expect.stringContaining('refused: rewrite_history'),
        }));
        expect(saveQuests).not.toHaveBeenCalled();
    });
});
