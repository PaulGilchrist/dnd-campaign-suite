// @maintained-by-ai
/**
 * calmEmotions TRIO lane #1880 — eligibility (trio seam map lives in the header of
 * calmEmotionsHandler-effects.test.js). Owns resolveCalmEmotionsEligibility L70-111 and
 * its module-private helpers checkCalmEmotionsHumanoid L31-46 / readSphereTokens L48-68,
 * reached ONLY through the exported resolver, plus the CALM_EMOTIONS_DURATION_ROUNDS
 * constant pin (the #1881 handle lane owns the expiration CLOCK that consumes it —
 * the constant is pinned here; the clock is not duplicated).
 *
 * Purity contract (this lane must be a pure gate): eligibility reads exactly ONE runtime
 * key — ('__map__', 'activeMapName'), arity 2 — and writes NOTHING. Zero setRuntimeValue
 * calls also rules out any registerTargetEffect delegation (the 'indifferent' te applier
 * and the 'immunity' latch are effects-lane owned; they never appear here) and this gate
 * never reads charmed/frightened — condition presence/absence is not an eligibility
 * concept. Proved per-test by expectZeroWrites().
 *
 * Sphere math is REAL — rangeValidation.js / rangeCheck.js are deliberately NOT mocked so
 * the Euclidean 5-ft-grid computation (getDistanceFeet → isDistanceInRange(dist, 20))
 * actually runs; only mapsService/monsterUtils are stubbed. Radius edges: 4 cells
 * orthogonal = exactly 20ft INSIDE (<=); (3,3) diagonal ≈ 21.21ft OUTSIDE recorded as
 * out_of_sphere_21ft; (4,3) = 3-4-5 triangle = exactly 25ft OUT.
 *
 * Advisory split (playbook §42 — lenient geometry is advisory, never silent):
 *  - no_map_lenient            — no active-map pointer
 *  - map_unavailable_lenient   — loadMapData threw; the advisory.length guard at L64
 *                                 deliberately suppresses caster_unplaced_lenient in the same
 *                                 pass (pinned: sole advisory)
 *  - caster_unplaced_lenient   — map loaded but no positioned caster token (L63-67);
 *                                 sphere unmeasurable, so placed-but-distant humanoids pass
 *  - <name>:unplaced_lenient   — per-target missing token, or token failing the
 *                                 Number.isFinite(gridX/gridY) filter at L58
 *  - no_statblock_lenient      — bestiary miss / missing type / empty type / lookup throw
 *                                 (L40-44, friendsService convention; Set-deduped at L110)
 *
 * Caller liveness (verified at source 2026-10-16): handle() L305 — dispatched via
 * automation/index.js L244/L578 `calm_emotions: handleCalmEmotions` — and
 * CalmEmotionsModal.jsx L126 (interactive cast route). No other production callers.
 *
 * Turn-based: durations are round counters resolved at initiative seams; zero timers and
 * zero waitFor in this file — the resolver awaits its own Promises and resolves directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: { set: vi.fn() },
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

// Registry stays real (importOriginal) with a spy layered on: proves this lane never
// delegates to registerTargetEffect — the te write sinks of the effects lane.
vi.mock('../../../combat/conditions/targetEffectDefinitions.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, registerTargetEffect: vi.fn(actual.registerTargetEffect) };
});

import {
    resolveCalmEmotionsEligibility,
    CALM_EMOTIONS_DURATION_ROUNDS,
} from './calmEmotionsHandler.js';
import {
    getRuntimeValue,
    setRuntimeValue,
    setRuntimeObject,
} from '../../../../hooks/runtime/useRuntimeState.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';
const CASTER = 'Divine_Cleric';

const creatures = [
    { name: CASTER, type: 'player' },
    { name: 'Bandit 1', type: 'npc' },
    { name: 'Ogre 1', type: 'npc' },
    { name: 'Pseudodragon 1', type: 'npc' },
];

const NOT_HUMANOID_PAIR = [
    { name: 'Ogre 1', reason: 'not_humanoid' },
    { name: 'Pseudodragon 1', reason: 'not_humanoid' },
];

// Default bestiary router; 'Mystery'/'Ghost' deliberately absent (statblock-lenient).
function monsterRouter(name) {
    const n = String(name).toLowerCase();
    if (n.startsWith('pseudodragon')) return { name: 'Pseudodragon', type: 'Dragon' };
    if (n.startsWith('ogre')) return { name: 'Ogre', type: 'Giant' };
    if (n.startsWith('bandit')) return { name: 'Bandit', type: 'Humanoid' };
    if (n.startsWith('cultist')) return { name: 'Cultist', type: 'Humanoid' };
    return null;
}

function setActiveMap(mapName = 'map1') {
    getRuntimeValue.mockImplementation((entity, key) => {
        if (entity === '__map__' && key === 'activeMapName') return mapName;
        return undefined;
    });
}

function placeMap({ players, placedItems }, mapName = 'map1') {
    setActiveMap(mapName);
    loadMapData.mockResolvedValue({ players, placedItems });
}

function casterAt(gridX, gridY) {
    return { name: CASTER, gridX, gridY };
}

// Every write/log/clock sink the handler family owns — eligibility must touch none.
function expectZeroWrites() {
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeObject).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(storeSpellLastAttack).not.toHaveBeenCalled();
    expect(addTargetResult).not.toHaveBeenCalled();
    expect(registerTargetEffect).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
}

beforeEach(() => {
    vi.clearAllMocks(); // keeps implementations; only call books are wiped
    getRuntimeValue.mockReturnValue(undefined); // no active map unless a test opts in
    getMonsterData.mockImplementation(async (name) => monsterRouter(name));
});

describe('resolveCalmEmotionsEligibility — purity contract (eligibility is a read-only gate)', () => {
    it('never writes stores, logs, clocks, appliers, or storage on a fully gated cast', async () => {
        placeMap({
            players: [casterAt(0, 0)],
            placedItems: [
                { name: 'Bandit 1', gridX: 4, gridY: 0 },
                { name: 'Ogre 1', gridX: 5, gridY: 0 },
            ],
        });

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: [],
        });
        expectZeroWrites();
    });

    it('reads the runtime store only via the 2-arg __map__ activeMapName pointer — once per call', async () => {
        placeMap({
            players: [casterAt(0, 0)],
            placedItems: [{ name: 'Bandit 1', gridX: 1, gridY: 0 }],
        });

        await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        // No per-entity reads: conditions/targetEffects/buffs are never consulted here —
        // charmed/frightened presence is not an eligibility input (effects lane owns them).
        expect(getRuntimeValue).toHaveBeenCalledTimes(1);
        expect(getRuntimeValue).toHaveBeenCalledWith('__map__', 'activeMapName');
    });

    it('short-circuits the caster by name and players by type — no bestiary lookup', async () => {
        const party = [...creatures, { name: 'Ranger 2', type: 'player' }];

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures: party });

        expect(getMonsterData.mock.calls.map(c => c[0]))
            .toEqual(['Bandit 1', 'Ogre 1', 'Pseudodragon 1']);
        // exact call signature: name + null (no monster object passed down)
        expect(getMonsterData).toHaveBeenCalledWith('Bandit 1', null);
        expect(res.eligible).toEqual([CASTER, 'Bandit 1', 'Ranger 2']);
    });
});

describe('resolveCalmEmotionsEligibility — humanoid gate (SP-020 B2)', () => {
    it.each([
        { type: 'Humanoid', passes: true },
        { type: 'humanoid', passes: true },
        { type: 'Giant', passes: false },
        { type: 'Dragon', passes: false },
        { type: 'Beast', passes: false },
        { type: 'Fey', passes: false },
        { type: 'Undead', passes: false },
        { type: 'Construct', passes: false },
    ])('statblock type "$type" → humanoid gate passes=$passes', async ({ type, passes }) => {
        placeMap({
            players: [casterAt(0, 0)],
            // target parked AT the caster: rejection below is humanoid-only, never geometry
            placedItems: [{ name: 'Bandit 1', gridX: 0, gridY: 0 }],
        });
        getMonsterData.mockImplementation(async (name) =>
            (name === 'Bandit 1' ? { name: 'Bandit', type } : null));

        const res = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [{ name: CASTER, type: 'player' }, { name: 'Bandit 1', type: 'npc' }],
        });

        expect(res).toEqual(passes
            ? { eligible: [CASTER, 'Bandit 1'], ineligible: [], advisory: [] }
            : { eligible: [CASTER], ineligible: [{ name: 'Bandit 1', reason: 'not_humanoid' }], advisory: [] });
        expectZeroWrites();
    });

    it.each([
        { label: 'null stat block', impl: async () => null },
        { label: 'stat block without type', impl: async () => ({ name: 'Mystery' }) },
        { label: 'empty-string type', impl: async () => ({ name: 'Mystery', type: '' }) },
        { label: 'bestiary lookup throws', impl: async () => { throw new Error('bestiary down'); } },
    ])('unmeasurable statblock ($label) is lenient with no_statblock_lenient', async ({ label, impl }) => {
        placeMap({ players: [casterAt(0, 0)], placedItems: [] });
        getMonsterData.mockImplementation(impl);
        // the console.error is production's own error logging (L37) — silenced, then pinned
        const spy = label.includes('throws') ? vi.spyOn(console, 'error').mockImplementation(() => {}) : null;

        const res = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [{ name: 'Mystery 1', type: 'npc' }],
        });

        expect(res).toEqual({
            eligible: ['Mystery 1'],
            ineligible: [],
            // humanoid leniency does NOT bypass the sphere gate — an unplaced lenient target
            // earns both advisories, in per-loop push order (statblock check runs first)
            advisory: ['no_statblock_lenient', 'Mystery 1:unplaced_lenient'],
        });
        if (spy) {
            expect(spy).toHaveBeenCalledWith('[calmEmotions] Error loading monster data:', expect.any(Error));
            spy.mockRestore();
        }
    });
});

describe('resolveCalmEmotionsEligibility — 20-ft sphere edges (SP-020 B4, real Euclidean math)', () => {
    it.each([
        { gridX: 4, gridY: 0, inside: true, reason: null },                 // exactly 20ft — inclusive
        { gridX: 0, gridY: 4, inside: true, reason: null },                 // same, other axis
        { gridX: -4, gridY: 0, inside: true, reason: null },                // negative coords measured normally
        { gridX: 2, gridY: 3, inside: true, reason: null },                 // ≈18.03ft (Manhattan 25 — pins the metric)
        { gridX: 3, gridY: 3, inside: false, reason: 'out_of_sphere_21ft' }, // diagonal ≈21.21ft
        { gridX: 5, gridY: 0, inside: false, reason: 'out_of_sphere_25ft' },
        { gridX: 0, gridY: -5, inside: false, reason: 'out_of_sphere_25ft' },
        { gridX: 4, gridY: 3, inside: false, reason: 'out_of_sphere_25ft' }, // 3-4-5 triangle = exactly 25ft
    ])('target at ($gridX,$gridY) inside=$inside', async ({ gridX, gridY, inside, reason }) => {
        placeMap({
            players: [casterAt(0, 0)],
            placedItems: [{ name: 'Bandit 1', gridX, gridY }],
        });
        getMonsterData.mockImplementation(async () => ({ type: 'Humanoid' }));

        const res = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [{ name: CASTER, type: 'player' }, { name: 'Bandit 1', type: 'npc' }],
        });

        expect(res).toEqual(inside
            ? { eligible: [CASTER, 'Bandit 1'], ineligible: [], advisory: [] }
            : { eligible: [CASTER], ineligible: [{ name: 'Bandit 1', reason }], advisory: [] });
    });

    it('mixes both ineligible reasons in loop order via loadMapData(campaign, activeMap)', async () => {
        placeMap({
            players: [casterAt(0, 0)],
            placedItems: [
                { name: 'Bandit 1', gridX: 4, gridY: 0 },
                { name: 'Bandit 2', gridX: 5, gridY: 0 },
                { name: 'Ogre 1', gridX: 1, gridY: 0 },
            ],
        });

        const res = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [
                { name: CASTER, type: 'player' },
                { name: 'Bandit 1', type: 'npc' },
                { name: 'Bandit 2', type: 'npc' },
                { name: 'Ogre 1', type: 'npc' },
            ],
        });

        expect(loadMapData).toHaveBeenCalledWith(campaignName, 'map1');
        // humanoid gate runs BEFORE the sphere: the adjacent Ogre never reaches distance math
        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1'],
            ineligible: [
                { name: 'Bandit 2', reason: 'out_of_sphere_25ft' },
                { name: 'Ogre 1', reason: 'not_humanoid' },
            ],
            advisory: [],
        });
        expectZeroWrites();
    });
});

describe('resolveCalmEmotionsEligibility — lenient-geometry advisory split (playbook §42)', () => {
    it('no active map: no_map_lenient is the SOLE advisory, map data never fetched', async () => {
        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(loadMapData).not.toHaveBeenCalled();
        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: ['no_map_lenient'],
        });
        expectZeroWrites();
    });

    it('map load rejects: map_unavailable_lenient alone — advisory guard suppresses caster_unplaced_lenient', async () => {
        setActiveMap();
        loadMapData.mockRejectedValue(new Error('map io'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: ['map_unavailable_lenient'],
        });
        expect(spy).toHaveBeenCalledWith('[calmEmotions] Error loading map data:', expect.any(Error));
        spy.mockRestore();
    });

    it('caster has no positioned token: caster_unplaced_lenient and even placed-but-distant humanoids pass', async () => {
        placeMap({
            players: [],
            placedItems: [{ name: 'Bandit 1', gridX: 9, gridY: 9 }],
        });

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: ['caster_unplaced_lenient'],
        });
    });

    it('caster token present but unpositioned counts as unplaced too (Number.isFinite filter)', async () => {
        placeMap({
            players: [{ name: CASTER }],
            placedItems: [{ name: 'Bandit 1', gridX: 20, gridY: 0 }],
        });

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures });

        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: ['caster_unplaced_lenient'],
        });
    });

    it('target without a token: <name>:unplaced_lenient while placed companions are still measured', async () => {
        placeMap({
            players: [casterAt(0, 0)],
            placedItems: [{ name: 'Bandit 1', gridX: 2, gridY: 0 }],
        });

        const res = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [...creatures, { name: 'Cultist 1', type: 'npc' }],
        });

        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1', 'Cultist 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: ['Cultist 1:unplaced_lenient'],
        });
    });

    it('target token with non-finite coords counts as unplaced', async () => {
        placeMap({
            players: [casterAt(0, 0)],
            placedItems: [
                { name: 'Bandit 1', gridX: 2, gridY: 0 },
                { name: 'Cultist 1', gridX: NaN, gridY: 1 },
            ],
        });

        const res = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [...creatures, { name: 'Cultist 1', type: 'npc' }],
        });

        expect(res).toEqual({
            eligible: [CASTER, 'Bandit 1', 'Cultist 1'],
            ineligible: NOT_HUMANOID_PAIR,
            advisory: ['Cultist 1:unplaced_lenient'],
        });
    });

    it('advisories are deduped (Set) and per-name, in loop order', async () => {
        placeMap({ players: [casterAt(0, 0)], placedItems: [] });

        const ghosts = [
            { name: CASTER, type: 'player' },
            { name: 'Ghost 1', type: 'npc' }, // statblock-lenient AND unplaced
            { name: 'Ghost 2', type: 'npc' },
        ];

        const res = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER, creatures: ghosts });

        // no_statblock_lenient collapses to one; unplaced advisories stay per-name
        expect(res).toEqual({
            eligible: [CASTER, 'Ghost 1', 'Ghost 2'],
            ineligible: [],
            advisory: [
                'no_statblock_lenient',
                'Ghost 1:unplaced_lenient',
                'Ghost 2:unplaced_lenient',
            ],
        });
    });
});

describe('resolveCalmEmotionsEligibility — input hygiene', () => {
    it('missing creatures list and blank-name entries yield empty buckets, zero lookups', async () => {
        const missing = await resolveCalmEmotionsEligibility({ campaignName, casterName: CASTER });
        expect(missing).toEqual({ eligible: [], ineligible: [], advisory: ['no_map_lenient'] });

        // blank-name guard runs BEFORE the caster-name short-circuit — even a blank-named
        // caster entry is skipped, never silently eligible
        const blank = await resolveCalmEmotionsEligibility({
            campaignName,
            casterName: CASTER,
            creatures: [{ type: 'npc' }, { name: '' }],
        });
        expect(blank.eligible).toEqual([]);
        expect(blank.ineligible).toEqual([]);
        expect(getMonsterData).not.toHaveBeenCalled();
        expectZeroWrites();
    });
});

describe('CALM_EMOTIONS_DURATION_ROUNDS constant', () => {
    it('is 10 rounds (1 minute, combat-scoped) for the #1881 expiration clock to consume', () => {
        // CLA-033 clock convention: authored ≥1-minute durations are combat-scoped round
        // counters cleared at initiative/concentration/rest seams — never wall-clock.
        expect(CALM_EMOTIONS_DURATION_ROUNDS).toBe(10);
    });
});
