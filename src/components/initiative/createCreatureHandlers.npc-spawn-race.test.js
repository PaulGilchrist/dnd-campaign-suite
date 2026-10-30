// @maintained-by-ai
// Regression: bug-initiative-concurrent-npc-spawn-lost-update — two localhost GM
// tabs clicking +NPC at (near-)the-same-time read-modify-wrote the FULL
// combatSummary board with no stamp, so the last write silently won: one accepted
// spawn vanished with zero toast, zero console output, zero log row, and BOTH
// tabs naming their spawn "NPC 1" from the local creature count made the loss
// invisible. The fix mirrors the EB-join post-ack doctrine (26ffb4aa5) + the
// .ct-* jsonEntityCrud 409 guard: strict fresh read, numbering from the FRESH
// board, mutation on a clone, guarded write carrying the baseVersion it was
// built from, ONE re-apply on a 409 conflict, honest toast otherwise.
//
// Deterministic simulation: loadCombatSummary/storage.set mock a fake server
// with jsonEntityCrud-semantics (stale baseVersion ⇒ 409, match ⇒ store). Both
// tabs run concurrently via Promise.all; mocked promises are microtask-resolved,
// so the interleave is fixed: both reads see v0, A's POST commits (v1), B's POST
// 409s, B re-reads the FRESH board, names its NPC "NPC 2", and lands (v2).
import { cloneDeep } from 'lodash';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import storage from '../../services/ui/storage.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { addNpc } from '../../services/encounters/initiativeService.js';

vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
    sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
// REAL addNpc numbering + mergeCombatSummaryWithCharacters semantics (the
// naming-from-fresh-board hardening is exactly what this lane locks).
vi.mock('../../services/encounters/initiativeService.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        addNpc: vi.fn(actual.addNpc), // real numbering semantics, spy-observable
        renameNpc: vi.fn(async () => {}),
    };
});
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    vanishSummonAtZeroHp: vi.fn(),
}));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({
    breakHypnoticPatternOnDamage: vi.fn(() => false),
}));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({
    sweepNewCombatClocks: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';

const alice = () => ({ name: 'Alice', type: 'player', initiative: '', targetName: null, concentration: null });

/** One GM tab: stale local mirror + own setCombatSummary/showToast spies. */
function makeTab(staleMirror) {
    const setCombatSummary = vi.fn();
    const showToast = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary: staleMirror,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary,
        setActiveCreatureName: vi.fn(),
        characters: [{ name: 'Alice' }],
        numOfNpc: 0,
        isLocalhost: true,
        showToast,
    });
    return { handlers, setCombatSummary, showToast };
}

let server; // fake store: { board } — boardVersion rides inside the value

function serverBoard(creatures, boardVersion) {
    return { round: 1, creatures, boardVersion };
}

beforeEach(() => {
    vi.clearAllMocks();
    server = { board: serverBoard([alice()], 0) };
    window.confirm = vi.fn(() => true);
    loadCombatSummary.mockImplementation(async () => cloneDeep(server.board));
    // Fake guarded server: matching baseVersion commits, a stale base 409s
    // (campaigns-changedata.js semantics), a missing opts lane stays unguarded.
    storage.set.mockImplementation(async (key, value, _campaign, opts) => {
        if (key !== 'combatSummary') return true;
        const current = Number(server.board?.boardVersion) || 0;
        if (opts && typeof opts.baseVersion === 'number' && opts.baseVersion !== current) {
            return { ok: false, status: 409 };
        }
        server.board = cloneDeep(value);
        return { ok: true, status: 200 };
    });
});

const boardNames = () => server.board.creatures.map(c => c.name);

describe('+NPC concurrent two-tab spawn (bug-initiative-concurrent-npc-spawn-lost-update)', () => {
    it('two simultaneous accepted spawns converge on TWO creatures — the 409 loser re-applies onto the fresh board', async () => {
        const A = makeTab({ round: 1, creatures: [alice()] });
        const B = makeTab({ round: 1, creatures: [alice()] });

        await Promise.all([A.handlers.handleAddNpc(), B.handlers.handleAddNpc()]);

        // Pre-fix this ended at ONE "NPC 1" (last write won, zero feedback).
        expect(boardNames()).toEqual(['Alice', 'NPC 1', 'NPC 2']);
        expect(server.board.boardVersion).toBe(2);
        // Each tab confirmed exactly once — the 409 re-apply never re-prompts.
        expect(window.confirm).toHaveBeenCalledTimes(2);
        // No conflict toast: the retry landed honestly.
        expect(A.showToast).not.toHaveBeenCalled();
        expect(B.showToast).not.toHaveBeenCalled();
        // Each tab publishes its own acknowledged board: the winner its 2-creature
        // v1, the replayer the merged 3-creature v2 (SSE converges both after);
        // the shared mirror prop was never mutated in place (no phantom pre-ack).
        expect(A.setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([expect.objectContaining({ name: 'NPC 1' })]),
        }));
        expect(B.setCombatSummary).toHaveBeenCalledTimes(1); // the 409 attempt published nothing
        expect(B.setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([
                expect.objectContaining({ name: 'NPC 1' }),
                expect.objectContaining({ name: 'NPC 2' }),
            ]),
        }));
    });

    it('names the new NPC from the FRESH server board, not the stale local count', async () => {
        server.board = serverBoard([alice(), { name: 'NPC 1', type: 'npc' }, { name: 'NPC 2', type: 'npc' }], 1);
        const tab = makeTab({ round: 1, creatures: [alice(), { name: 'NPC 1', type: 'npc' }] });

        await tab.handlers.handleAddNpc();

        expect(boardNames()).toEqual(['Alice', 'NPC 1', 'NPC 2', 'NPC 3']);
        expect(addNpc).toHaveBeenCalledTimes(1);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ boardVersion: 2 }), campaignName, { baseVersion: 1 });
    });

    it('keeps roster PCs merged into the written board (client-side players are canonical)', async () => {
        server.board = { round: 1, creatures: [{ name: 'Goblin', type: 'npc', initiative: '15' }], boardVersion: 0 };
        const tab = makeTab({ round: 1, creatures: [alice()] });

        await tab.handlers.handleAddNpc();

        expect(boardNames()).toEqual(['Goblin', 'Alice', 'NPC 1']);
    });

    it('a board that keeps changing 409s twice, re-applies ONCE, then toasts honestly — never silently', async () => {
        const tab = makeTab({ round: 1, creatures: [alice()] });
        storage.set.mockImplementation(async () => ({ ok: false, status: 409 }));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await tab.handlers.handleAddNpc();

        expect(storage.set).toHaveBeenCalledTimes(2); // initial + single retry — bounded
        expect(window.confirm).toHaveBeenCalledTimes(1); // retry does not re-prompt
        expect(tab.showToast).toHaveBeenCalledWith(
            'Another tab kept changing the initiative board — your NPC was not added, try again',
            true,
        );
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('kept changing in another tab (409)'));
        // Nothing was published locally — the tab never claims an unacknowledged spawn.
        expect(tab.setCombatSummary).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('a transport/HTTP failure (non-409) fails honestly with zero retry', async () => {
        const tab = makeTab({ round: 1, creatures: [alice()] });
        storage.set.mockImplementation(async () => ({ ok: false, status: 0 }));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await tab.handlers.handleAddNpc();

        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(tab.showToast).toHaveBeenCalledWith('Failed to add NPC 1', true);
        expect(tab.setCombatSummary).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('a failed strict fresh read aborts honestly — zero writes (EB-join read-blip doctrine)', async () => {
        const tab = makeTab({ round: 1, creatures: [alice()] });
        loadCombatSummary.mockRejectedValue(new Error('change-data fetch failed (500)'));

        await tab.handlers.handleAddNpc();

        expect(tab.showToast).toHaveBeenCalledWith('Failed to add NPC — could not read the initiative board', true);
        expect(storage.set).not.toHaveBeenCalled();
        expect(addNpc).not.toHaveBeenCalled();
    });

    it('legacy mocks resolving undefined keep the historical success semantics', async () => {
        const tab = makeTab({ round: 1, creatures: [alice()] });
        storage.set.mockImplementation(async () => undefined);

        await tab.handlers.handleAddNpc();

        expect(tab.showToast).not.toHaveBeenCalled();
        expect(tab.setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({
            creatures: expect.arrayContaining([expect.objectContaining({ name: 'NPC 1' })]),
        }));
    });
});
