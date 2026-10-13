// §9.4 — world keeper: ledger allowlist, schema, funnel fail-closed.
import { loadWorldState } from './worldContext.js';
import { validateWorldProposal } from './schemas.js';
import { askWorldKeeper } from './index.js';

describe('loadWorldState', () => {
    it('reads the real test-campaign ledger and builds allowlists', () => {
        const { context, allow } = loadWorldState('test-campaign');
        expect(Array.isArray(context.quests)).toBe(true);
        expect(allow.npcNames.length).toBeGreaterThan(0);
        expect(allow.settlementNames.length).toBeGreaterThan(0);
    });

    it('traversal-ish campaign names ⇒ empty ledger, no throw', () => {
        const { context, allow } = loadWorldState('../../etc');
        expect(context.quests).toEqual([]);
        expect(allow.npcNames).toEqual([]);
    });
});

describe('validateWorldProposal — the ledger is the contract', () => {
    const ALLOW = { npcNames: ['Mira', 'Rakan'], settlementNames: ['Bravor'], factionNames: ['Cobalt'], questNames: ['Lost Blade'] };

    it('accepts clean payloads', () => {
        expect(validateWorldProposal({ kind: 'recap', text: 'The party delved…' }, ALLOW).ok).toBe(true);
        expect(validateWorldProposal({ kind: 'rumor', text: 'Coin glints…', settlement: 'bravor' }, ALLOW).ok).toBe(true);
        expect(validateWorldProposal({ kind: 'npc_dialogue', npcName: 'mira', text: 'Trouble follows you.' }, ALLOW).ok).toBe(true);
        expect(validateWorldProposal({ kind: 'quest_draft', name: 'The Sunken Vault', description: 'Recover the relic.' }, ALLOW).ok).toBe(true);
    });

    it('canonicalizes entity references to ledger spellings', () => {
        const p = { kind: 'npc_dialogue', npcName: '  MIRAK  ', text: 'x' };
        expect(validateWorldProposal(p, ALLOW).ok).toBe(false);
        const ok = { kind: 'npc_dialogue', npcName: ' mira ', text: 'x' };
        expect(validateWorldProposal(ok, ALLOW).ok).toBe(true);
        expect(ok.npcName).toBe('Mira');
    });

    it('fabricated NPCs/settlements REFUSED; unknown kind refused', () => {
        expect(validateWorldProposal({ kind: 'npc_dialogue', npcName: 'Dragon Emperor', text: 'x' }, ALLOW).ok).toBe(false);
        expect(validateWorldProposal({ kind: 'rumor', text: 'x', settlement: 'Waterdeep' }, ALLOW).ok).toBe(false);
        expect(validateWorldProposal({ kind: 'reality_edit', text: 'x' }, ALLOW).ok).toBe(false);
        expect(validateWorldProposal(null, ALLOW).ok).toBe(false);
    });

    it('quest_draft needs name + description', () => {
        expect(validateWorldProposal({ kind: 'quest_draft', text: 'nope' }, ALLOW).ok).toBe(false);
        expect(validateWorldProposal({ kind: 'quest_draft', name: 'X' }, ALLOW).ok).toBe(false);
    });
});

describe('askWorldKeeper funnel', () => {
    const CFG = { endpoint: 'http://localhost:11434', model: 'stub-llm', mode: 'suggest' };
    const ALLOW = { npcNames: ['Mira'], settlementNames: ['Bravor'], factionNames: [], questNames: [] };
    const log = vi.fn(async () => ({}));

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it('AI off ⇒ AI_OFF, no traffic', async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const r = await askWorldKeeper({ campaign: 'test-campaign', kind: 'recap', world: {}, allow: ALLOW, aiConfig: null, log });
        expect(r).toEqual({ ok: false, code: 'AI_OFF' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('valid recap returns the proposal + audits ai_world', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: '{"kind":"recap","text":"Ash and ember — the party survived the fall."}' } }) })));
        const r = await askWorldKeeper({ campaign: 'test-campaign', kind: 'recap', world: {}, allow: ALLOW, aiConfig: CFG, log });
        expect(r.ok).toBe(true);
        expect(r.proposal.kind).toBe('recap');
        expect(log).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ai_world' }));
    });

    it('fabricated NPC: retry once then needs_human (never guessed)', async () => {
        const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: { content: '{"kind":"npc_dialogue","npcName":"Fake Guy","text":"hi"}' } }) }));
        vi.stubGlobal('fetch', fetchFn);
        const r = await askWorldKeeper({ campaign: 'test-campaign', kind: 'npc_dialogue', world: {}, allow: ALLOW, aiConfig: CFG, log });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('AI_NEEDS_HUMAN');
        expect(r.proposal.kind).toBe('needs_human');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});
