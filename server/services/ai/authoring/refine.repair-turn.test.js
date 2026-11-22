// @maintained-by-ai
// Regression pin for bug-ai-refine-repair-turn-sends-object-object: the repair
// retry's assistant turn must carry the model's ACTUAL rejected output as TEXT
// (the designer.js `lastContent` pattern) — the parsed object used to ride in
// raw, so String(object) put the literal '[object Object]' on the wire and the
// repair round was blind.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../providers/localProvider.js', () => ({ chat: vi.fn(), isLocalEndpoint: () => true }));
vi.mock('../index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));
vi.mock('./storyBible.js', () => ({ buildStoryBible: vi.fn(() => ({ party: [], partyLevels: { min: 1, max: 1, size: 0 }, quests: { active: [], completed: [], failed: [] }, factions: [], npcs: [], settlements: [], sessions: [], encounters: [], maps: [], recentLog: [] })) }));
const ctx = {
    quests: new Set(['the lost artifact']), npcs: new Set(['marta copperkettle']), factions: new Set(),
    settlements: new Set(), sessions: new Set(), notes: new Set(), encounters: new Set(), maps: new Set(),
    monsters: new Map([['goblin', 'Goblin']]), monsterNames: new Set(['goblin']),
};
vi.mock('./referential.js', async () => {
    const actual = await vi.importActual('./referential.js');
    return { ...actual, buildCampaignContext: vi.fn(() => ctx) };
});

import { refineEntity } from './refine.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const npc = { name: 'Oldhem', personality: 'Gruff', attitude: 'neutral', draft: true, updatedAt: 7 };

const assistantTurn = (chatFn) =>
    chatFn.mock.calls[1][0].messages.find((m) => m.role === 'assistant');

describe('refineEntity — repair-retry assistant turn echoes the real output', () => {
    it('a schema-rejected replacement rides back as parseable JSON, never "[object Object]"', async () => {
        const rejected = { name: 'Oldhem', personality: 'Gruff', attitude: 'wary', bogusField: 1 }; // bad enum + unknown field
        const chatFn = vi.fn(async () => JSON.stringify(rejected));
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'x', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(chatFn).toHaveBeenCalledTimes(2);
        const turn = assistantTurn(chatFn);
        expect(turn.content).not.toBe('[object Object]');
        expect(JSON.parse(turn.content)).toEqual(rejected); // byte-faithful round trip
    });

    it('a reference-collision rejection also seeds the repair turn with the rejected JSON', async () => {
        const chatFn = vi.fn(async () => JSON.stringify({ name: 'Marta Copperkettle', personality: 'ok', attitude: 'neutral' }));
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'rename her', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false); // collides with a different live NPC
        const turn = assistantTurn(chatFn);
        expect(turn.content).not.toBe('[object Object]');
        expect(JSON.parse(turn.content).name).toBe('Marta Copperkettle');
    });

    it('a non-JSON model answer still echoes its raw text to the repair retry', async () => {
        const raw = 'I cannot produce JSON, sorry! <<<';
        const chatFn = vi.fn()
            .mockResolvedValueOnce(raw)
            .mockResolvedValueOnce(JSON.stringify({ name: 'Oldhem', personality: 'Gruff but grieving', attitude: 'neutral' }));
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'polish', aiConfig: AI, chatFn });
        expect(res.ok).toBe(true); // attempt 2 recovers
        expect(assistantTurn(chatFn).content).toBe(raw);
    });

    it('a transport-failed first attempt has no output to echo: the designer.js twin null placeholder rides, never "[object Object]"', async () => {
        const err = Object.assign(new Error('endpoint down'), { code: 'AI_UNAVAILABLE' });
        const chatFn = vi.fn()
            .mockRejectedValueOnce(err)
            .mockResolvedValueOnce(JSON.stringify({ name: 'Oldhem', personality: 'Gruff but grieving', attitude: 'neutral' }));
        const res = await refineEntity({ campaign: 'c', kind: 'npc', entity: npc, instruction: 'polish', aiConfig: AI, chatFn });
        expect(res.ok).toBe(true);
        expect(assistantTurn(chatFn).content).toBe('null'); // matches designer.js/dressMap.js
    });
});
