// @maintained-by-ai
// giantAncestry.test.setup — shared FIXTURE sidecar (not a suite): intentionally
// excluded from vitest collection via vitest.config.js exclude '**/*.test.setup.js'.
// Consumed by 8 sibling giantAncestry suites; exports ONLY the two fixture
// factories they import.
//
// Why there are no vi.mock blocks here (they used to be): every consumer
// file declares its own hoisted vi.mock block and imports the handler chain
// BEFORE importing this sidecar, so each suite's own factories resolve and
// cache the mocked modules first — the removed copies were inert duplicates.
// Keeping mocks in one place never worked (consumers diverged anyway:
// cloudsJaunt pins findLastAttack → null, others → a hit event); fixtures
// only is the honest boundary. Each consumer OWNS its mock defaults and
// runs its own beforeEach(() => vi.resetAllMocks()).
//
// Mock ownership map (lane → owner file, do not re-pin here):
// - selection routing / confirm / getters .... giantAncestry-selection.test.js
// - Cloud's Jaunt both lanes ................. giantAncestry-cloudsJaunt.test.js (no sidecar import)
// - Fire's Burn lane pins .................... giantAncestry-firesBurn.test.js
// - Fire's Burn regression ........  giantAncestry-firesBurn.regression.test.js
// - Frost's Chill lane pins ................ giantAncestry-frostsChill.test.js
// - Hill's Tumble lane pins ................ giantAncestry-hillsTumble.test.js
// - Hill's Tumble regression ....... giantAncestry-hillsTumble.regression.test.js
// - Stone's Endurance lane pins ............ giantAncestry-stonesEndurance.test.js
// - Stone's Endurance refire .... giantAncestry-stonesEndurance.refire.test.js
// - Storm's Thunder pins / range refusal ... giantAncestry-stormsThunder{.range,}.test.js
//
// Old → new:
// - 8 vi.mock factories + beforeEach(clearAllMocks) → removed (inert; each
//   consumer owns identical-or-stricter self-mocks + resetAllMocks).
// - makeAction / makePlayerStats → unchanged shape; consumers spread overrides.

// Resource-pool action mirroring the authored "Giant Ancestry" entry used by
// the dispatch lane (handle(action, playerStats, campaign, option)).
export function makeAction(overrides = {}) {
    return {
        name: 'Giant Ancestry',
        description: 'Choose a giant ancestry benefit.',
        automation: {
            type: 'resource_pool',
            options: [],
            recharge: 'short_rest',
            casting_time: '1 action',
        },
        ...overrides,
    };
}

// Minimal PlayerStats shape the ancestry handlers read (name, proficiency for
// uses-max defaults, abilities for CON-based checks).
export function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [{ name: 'Constitution', bonus: 2 }],
        ...overrides,
    };
}
