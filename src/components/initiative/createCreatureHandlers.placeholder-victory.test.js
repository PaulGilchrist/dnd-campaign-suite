// @maintained-by-ai
// Lane: bare "+NPC" placeholders vs the victory bank + the Clear seam
// (backlog 2026-11-18). Law: a bookkeeping placeholder must NEVER pollute the
// shared `lastCombatResult` stamp — a real 6-kill win went banner-less because
// trackerHasFoes outranked celebrated:true, and the later banner claimed
// "6 foes defeated · 1 drove off" where the "1" was the never-attacked slot.
// This file runs confirmClear through the REAL initiativeService.clearCombat
// (only its rng/bestiary seams mocked) plus the REAL npcPlaceholder predicate,
// so both the bank math and the players-only rebuild are pinned end-to-end.
// Banner gating itself is the useTvPresentation.victory-gate.test.js lane;
// classification lives in npcPlaceholder.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { buildVictoryLines } from './victoryLines.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { autoAwardCombatRewards } from '../../services/items/autoRewardService.js';
import storage from '../../services/ui/storage.js';

const campaignName = 'test-campaign';

vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (name) => name, guid: () => 'test-guid' } }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getRuntimeKeysByPrefix: vi.fn(() => []),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), patch: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(), sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    maybeGrantThiefsReflexesSecondTurn: vi.fn(), isSecondTurnEntry: vi.fn(() => false),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ vanishSummonAtZeroHp: vi.fn() }));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn(() => false) }));
vi.mock('../../services/encounters/creatureControl.js', () => ({ getCreatureController: vi.fn(() => null) }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({ clearCombatLatches: vi.fn(() => 0) }));
vi.mock('../../services/combat/pendingOpportunityAttacks.js', () => ({ clearAllPendingOas: vi.fn(), prunePendingOas: vi.fn() }));
vi.mock('../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => []) }));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
    getCombatSummary: vi.fn(() => null),
    getActiveCreatureName: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
// Real initiativeService stays REAL (clearCombat/setupCreatures are this lane's
// subject); only its rng + bestiary seams are mocked to keep the load offline.
vi.mock('../../services/dice/diceRoller.js', () => ({ rollD20: vi.fn(() => 12) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadMonsters: vi.fn(() => Promise.resolve([])) }));

const characters = [
    { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20, armorClass: 15 } },
    { name: 'Bob', computedStats: { hitPoints: 15, currentHitPoints: 15, armorClass: 14 } },
];

const player = (name) => ({ name, type: 'player', initiative: '10', targetName: null, concentration: null, currentHp: 10, maxHp: 10 });
const placeholder = (n = 1, extra = {}) => ({ name: `NPC ${n}`, type: 'npc', initiative: '', targetName: null, concentration: null, ac: 10, maxHp: 10, currentHp: 10, saveBonuses: {}, ...extra });
const ebFoe = (name, extra) => ({ name, type: 'npc', monsterIndex: name.toLowerCase(), initiative: '12', targetName: null, concentration: null, ac: 15, maxHp: 7, currentHp: 7, saveBonuses: {}, ...extra });

function makeHandlers(creatures, round = 4) {
    const combatSummary = { round, creatures };
    const setCombatSummary = vi.fn();
    const setActiveCreatureName = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary,
        setActiveCreatureName,
        characters,
        isLocalhost: true,
    });
    return { handlers, combatSummary, setCombatSummary, setActiveCreatureName };
}

const bankedStamp = () => {
    const call = setRuntimeValue.mock.calls.find(([key, prop]) => key === 'campaign' && prop === 'lastCombatResult');
    if (!call) throw new Error('lastCombatResult was never stamped');
    return call[2];
};

beforeEach(() => {
    vi.clearAllMocks();
    // Warm-store defaults + FRESH attack evidence this board-generation
    // (IMP-1 celebrated gate satisfied — the placeholders are the only suspect
    // rows, so anything the bank counts is honest real-foe math).
    getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'currentHitPoints') return 10;
        if (key === 'campaign' && prop === 'lastAttack') {
            return { attackerName: 'Alice', targetName: 'Goblin', hit: true, total: 17, timestamp: 1234 };
        }
        return null;
    });
});

describe('victory bank — bare +NPC placeholders never count as foes (backlog 2026-11-18)', () => {
    it('kills/fled count ONLY real rows: goblin fell, orc drove off, placeholder contributes nothing', () => {
        const { handlers } = makeHandlers([
            player('Alice'),
            player('Bob'),
            ebFoe('Goblin', { currentHp: 0 }),   // real kill
            ebFoe('Orc', { currentHp: 6, maxHp: 15 }), // real row alive at the seam → fled
            placeholder(1),                       // untouchable bookkeeping slot (never attacked)
        ]);

        handlers.confirmClear();

        const stamp = bankedStamp();
        expect(stamp).toMatchObject({ foes: 2, defeated: 1, survivors: 2, partySize: 2, wipe: false, celebrated: true });
        // Banner copy off the banked stamp: pre-fix the placeholder inflated
        // this to "1 foe defeated · 2 drove off".
        expect(buildVictoryLines(stamp)).toEqual([
            'The party survived 4 rounds!',
            '1 foe defeated · 1 drove off',
            '2 of 2 heroes standing',
        ]);
    });

    it('a board whose only NPC rows are bare placeholders banks foes:0 — the real-win banner is never gated or fed by them', () => {
        const { handlers } = makeHandlers([
            player('Alice'),
            player('Bob'),
            placeholder(1),
            placeholder(2),
        ]);

        handlers.confirmClear();

        const stamp = bankedStamp();
        expect(stamp).toMatchObject({ foes: 0, defeated: 0, celebrated: true });
        // foes:0 ⇒ no foes line at all (no "0 defeated"/"N drove off" face).
        expect(buildVictoryLines(stamp)).toEqual([
            'The party survived 4 rounds!',
            '2 of 2 heroes standing',
        ]);
    });

    it('real never-attacked foes still count honestly as fled (only the bare-placeholder class is excluded)', () => {
        const { handlers } = makeHandlers([
            player('Alice'),
            // Renamed/custom NPC (no monsterIndex, species-shaped name) is a REAL foe.
            { name: 'Steve', type: 'npc', initiative: '9', targetName: null, concentration: null, ac: 12, maxHp: 9, currentHp: 9 },
            placeholder(1),
        ]);

        handlers.confirmClear();

        expect(bankedStamp()).toMatchObject({ foes: 1, defeated: 0 });
    });
});

describe('Clear rebuild — bare placeholders are evicted, never re-baked', () => {
    it('the post-Clear board (REAL clearCombat) is players-only even though the closing board held a bare placeholder + EB monster', () => {
        const { handlers, setCombatSummary } = makeHandlers([
            player('Alice'),
            player('Bob'),
            ebFoe('Goblin', { currentHp: 0 }),
            placeholder(1, { initiative: '5' }), // added for bookkeeping
        ]);

        handlers.confirmClear();

        const written = storage.set.mock.calls.find(([key]) => key === 'combatSummary')[1];
        expect(written.round).toBe(1);
        expect(written.creatures.map(c => c.name)).toEqual(['Alice', 'Bob']);
        expect(written.creatures.some(c => c.type === 'npc')).toBe(false);
        expect(setCombatSummary).toHaveBeenCalledWith(written);
        // The rewards service still sees the CLOSING roster (placeholder included
        // in the clone — loot math is not this fix; the bank is).
        expect(autoAwardCombatRewards).toHaveBeenCalledWith(expect.objectContaining({
            combatSummary: expect.objectContaining({
                creatures: expect.arrayContaining([
                    expect.objectContaining({ name: 'NPC 1' }),
                ]),
            }),
        }));
    });
});
