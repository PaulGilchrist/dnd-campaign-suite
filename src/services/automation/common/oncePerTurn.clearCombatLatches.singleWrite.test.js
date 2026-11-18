// @maintained-by-ai
// Regression (bug-clear-latch-eviction-resurrects-stamps): clearCombatLatches
// used to null each latch key with its OWN setRuntimeValue call — one
// whole-bucket snapshot POST per key, dispatched back-to-back. HTTP/1.1
// socket fan-out gives same-origin POSTs no arrival-order guarantee, so an
// earlier body still carrying the freshest `{round:N}` stamp could land LAST
// and RESURRECT it while the `new_combat_latch_reset` row counted intent —
// the new combat's round-1 rider then silently dropped again (live
// fingerprint: audit row "3 evicted", store kept
// `_Shield_Bash_usedRound={round:1}`). These pins run the REAL
// useRuntimeState module against a fetch spy and lock the fix: the eviction
// of ONE creature's latches is exactly ONE POST whose single body nulls
// EVERY matched key — no intermediate body exists that could interleave.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({ round: 1 })),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => ({})),
}));

// The real runtime-store module — this test pins the WIRE shape, so no fake.
import { setRuntimeValue, getRuntimeValue, clearRuntimeState } from '../../../hooks/runtime/useRuntimeState.js';
import { clearCombatLatches } from './oncePerTurn.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
let fetchCalls;

function postsTo(creatureName) {
    return fetchCalls.filter((c) => c.url === `/api/campaigns/${CAMPAIGN}/${creatureName}` && c.method === 'POST');
}

beforeEach(() => {
    vi.clearAllMocks();
    fetchCalls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
        fetchCalls.push({ url, method: opts?.method, body: opts?.body });
        return { ok: true, json: async () => ({}) };
    }));
    clearRuntimeState('EvasiveFighter');
    clearRuntimeState('Goblin');
});

describe('clearCombatLatches — one write per creature (no latch resurrection)', () => {
    it('evicts the live repro bucket (attack-action + Charge skip + Shield Bash stamps) in ONE POST whose body nulls all three', () => {
        // Replay the combat traffic that stamps the three latches (each write
        // legitimately rides its own POST).
        setRuntimeValue('EvasiveFighter', '_attackActionTakenRound', 1, CAMPAIGN);
        setRuntimeValue('EvasiveFighter', '_Charge_Attack_skippedRound', { round: 1, activeCreature: 'EvasiveFighter' }, CAMPAIGN);
        setRuntimeValue('EvasiveFighter', '_Shield_Bash_usedRound', { round: 1, activeCreature: 'EvasiveFighter' }, CAMPAIGN);
        fetchCalls = [];

        expect(clearCombatLatches(CAMPAIGN, ['EvasiveFighter'])).toBe(3);

        const evictionPosts = postsTo('EvasiveFighter');
        // THE pin: one body ⇒ nothing to interleave. The pre-fix lane shipped
        // THREE whole-bucket snapshots (nulling keys one at a time) whose
        // arrival order could leave body-2 ({round:1} Shield Bash stamp
        // intact) as the final server state.
        expect(evictionPosts.length).toBe(1);
        const value = JSON.parse(evictionPosts[0].body).value;
        expect(value._attackActionTakenRound).toBeNull();
        expect(value._Charge_Attack_skippedRound).toBeNull();
        expect(value._Shield_Bash_usedRound).toBeNull();
    });

    it('mirrors the eviction locally (synchronous) so the writing tab never re-POSTs a resurrected stamp from its own snapshot', () => {
        setRuntimeValue('EvasiveFighter', '_Shield_Bash_usedRound', { round: 1, activeCreature: 'EvasiveFighter' }, CAMPAIGN);
        fetchCalls = [];

        clearCombatLatches(CAMPAIGN, ['EvasiveFighter']);

        expect(getRuntimeValue('EvasiveFighter', '_Shield_Bash_usedRound')).toBeNull();
        // Any LATER write from this tab's whole-bucket snapshot therefore
        // already carries the null — resurrection becomes impossible.
        setRuntimeValue('EvasiveFighter', 'lastAttack', { name: 'Glaive' }, CAMPAIGN);
        const later = JSON.parse(postsTo('EvasiveFighter').at(-1).body).value;
        expect(later._Shield_Bash_usedRound).toBeNull();
    });

    it('ships one batched POST per creature (players AND monsters), never one per key', () => {
        setRuntimeValue('EvasiveFighter', '_Shield_Bash_usedRound', { round: 2, activeCreature: 'EvasiveFighter' }, CAMPAIGN);
        setRuntimeValue('EvasiveFighter', '_Charge_Attack_skippedRound', { round: 2, activeCreature: 'EvasiveFighter' }, CAMPAIGN);
        setRuntimeValue('Goblin', '_Shield_Bash_usedRound', { round: 2, activeCreature: 'Goblin' }, CAMPAIGN);
        fetchCalls = [];

        expect(clearCombatLatches(CAMPAIGN, ['EvasiveFighter', 'Goblin'])).toBe(3);

        expect(postsTo('EvasiveFighter').length).toBe(1);
        expect(postsTo('Goblin').length).toBe(1);
        const ef = JSON.parse(postsTo('EvasiveFighter')[0].body).value;
        expect(ef).toMatchObject({ _Shield_Bash_usedRound: null, _Charge_Attack_skippedRound: null });
        const goblin = JSON.parse(postsTo('Goblin')[0].body).value;
        expect(goblin._Shield_Bash_usedRound).toBeNull();
        // The audit row now counts what LANDED: the single body per creature
        // carries every counted null.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0][1].description).toBe(
            'Combat board cleared: 3 once-per-turn latches from the previous combat evicted.'
        );
    });

    it('leaves clean buckets at zero writes (byte-identical Clear, no cosmetic {} POST)', () => {
        setRuntimeValue('EvasiveFighter', 'lastAttack', { name: 'Glaive' }, CAMPAIGN);
        fetchCalls = [];

        expect(clearCombatLatches(CAMPAIGN, ['EvasiveFighter', 'Goblin'])).toBe(0);
        expect(postsTo('EvasiveFighter').length).toBe(0);
        expect(postsTo('Goblin').length).toBe(0);
        expect(addEntry).not.toHaveBeenCalled();
    });
});
