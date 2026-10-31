// @maintained-by-ai
// Campaign-authoring Phase 6 — per-entity refine: whole-object proposal,
// fail-closed validation with a repair retry, self-name collision waiver,
// outward-ref enforcement, and the hard rule that refine NEVER writes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../providers/localProvider.js', () => ({ chat: vi.fn(), isLocalEndpoint: () => true }));
vi.mock('../index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));
vi.mock('./storyBible.js', () => ({ buildStoryBible: vi.fn(() => ({ party: [], partyLevels: { min: 1, max: 1, size: 0 }, quests: { active: [], completed: [], failed: [] }, factions: [], npcs: [], settlements: [], sessions: [], encounters: [], maps: [], recentLog: [] })) }));
const ctx = {
    quests: new Set(['the lost artifact']), npcs: new Set(['marta copperkettle']), factions: new Set(),
    settlements: new Set(), sessions: new Set(), notes: new Set(), encounters: new Set(), maps: new Set(),
    monsters: new Map([['goblin', 'Goblin']]), monsterNames: new Set(['goblin']),
};
const buildCampaignContext = vi.fn(() => ctx);
vi.mock('./referential.js', async () => {
    const actual = await vi.importActual('./referential.js');
    return { ...actual, buildCampaignContext: (...a) => buildCampaignContext(...a) };
});

import { refineEntity } from './refine.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const npc = { name: 'Oldhem', personality: 'Gruff', attitude: 'neutral', draft: true, updatedAt: 7 };
beforeEach(() => buildCampaignContext.mockClear());

describe('refineEntity — proposal only, validation-gated', () => {
    it('returns the complete replacement the model was asked for', async () => {
        const chatFn = vi.fn(async () => JSON.stringify({ name: 'Oldhem', personality: 'Gruff but secretly grieving', attitude: 'neutral' }));
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'give him a secret', aiConfig: AI, chatFn, log: vi.fn() });
        expect(res.ok).toBe(true);
        expect(res.replacement.personality).toContain('grieving');
        expect(res.replacement).not.toHaveProperty('draft'); // server-owned fields never ride back
        expect(res.replacement).not.toHaveProperty('updatedAt');
    });

    it('a model that smuggles server fields (updatedAt) is rejected with actionable errors', async () => {
        const chatFn = vi.fn(async () => JSON.stringify({ name: 'Oldhem', personality: 'Gruff', attitude: 'neutral', updatedAt: 999 }));
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'x', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(chatFn).toHaveBeenCalledTimes(2);
        expect(res.errors.join(' ')).toMatch(/unknown field 'updatedAt'/);
    });

    it('rejects an invalid replacement twice, then fails closed with model-actionable errors', async () => {
        const chatFn = vi.fn(async () => JSON.stringify({ name: 'Oldhem', attitude: 'wary' })); // bad enum
        const log = vi.fn();
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'x', aiConfig: AI, chatFn, log });
        expect(res.ok).toBe(false);
        expect(chatFn).toHaveBeenCalledTimes(2);
        // attempt 2's messages carry the enum error back to the model.
        const second = chatFn.mock.calls[1][0].messages;
        expect(second[second.length - 1].content).toMatch(/attitude must be one of/);
        expect(log).toHaveBeenCalledWith('c', expect.objectContaining({ type: 'ai_refine', attempts: 0 }));
    });

    it('waives the self-name collision but blocks collisions with OTHER live rows', async () => {
        const renameTo = (name) => vi.fn(async () => JSON.stringify({ name, personality: 'ok', attitude: 'neutral' }));
        const self = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'keep name', aiConfig: AI, chatFn: renameTo('Marta Copperkettle') });
        expect(self.ok).toBe(false); // collides with a DIFFERENT live NPC
        expect(self.errors.join(' ')).toMatch(/collides with an existing/);

        const same = await refineEntity({ campaign: 'c', kind: 'npc', entity: { name: 'Marta Copperkettle', draft: true }, instruction: 'polish', aiConfig: AI, chatFn: renameTo('Marta Copperkettle') });
        expect(same.ok).toBe(true); // refining the row that already owns the name is legal
    });

    it('encounters: replacement monster refs must be real bestiary pairs', async () => {
        const enc = { name: 'E', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 1 }] };
        const chatFn = vi.fn(async () => JSON.stringify({ name: 'E', selectedMonsters: [{ index: 'nope', name: 'Nope', qty: 2 }] }));
        const res = await refineEntity({ campaign: 'c', kind: 'encounter', entity: enc, instruction: 'more scary', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/not a bestiary monster index/);
    });

    it('refuses before any model call on off-config, bad kind, missing entity/instruction', async () => {
        const chatFn = vi.fn();
        expect((await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'x', aiConfig: { mode: 'off' }, chatFn })).code).toBe('AI_OFF');
        expect((await refineEntity({ campaign: 'c', kind: 'dragon', entity: npc, instruction: 'x', aiConfig: AI, chatFn })).code).toBe('BAD_KIND');
        expect((await refineEntity({ campaign: 'c', kind: 'npc', entity: null, instruction: 'x', aiConfig: AI, chatFn })).code).toBe('NO_ENTITY');
        expect((await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: '  ', aiConfig: AI, chatFn })).code).toBe('NO_INSTRUCTION');
        expect(chatFn).not.toHaveBeenCalled();
    });
});
