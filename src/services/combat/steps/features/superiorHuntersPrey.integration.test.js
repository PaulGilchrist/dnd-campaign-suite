// @maintained-by-ai
/**
 * Integration lane — superiorHuntersPrey.js spread-damage wiring with REAL collaborators.
 *
 * Real (no mocks): superiorHuntersPrey.js, useRuntimeState.js (real in-memory
 * stores, character-keyed), combatData.js (real round cache + loadCombatSummary),
 * damageUtils.getCombatContext + mapsService.loadMapData over the network seam,
 * rangeCheck.js + rangeValidation.js (real grid math). Only true external seams
 * are mocked: diceRoller (dice), applyDamage (owned by its own applyDamage.*
 * lane — 27 sibling suites), logService (own lane; log asserted exact here per
 * app mandate), and fetch (network). Mirrors the darkOnesLuck integration-store
 * precedent (getStore seeds, inert-fetch override).
 *
 * Family map (hunter-prey domain, #1050): hunterPreyHandler.test.js owns the
 * "_Hunter's_Prey_choice" prompt; superiorHuntersPrey.test.js (unit) owns the
 * condition bytes, early-return gates, die selection 1d6 vs 1d10 Foe-Slayer
 * (the upgrade bytes colossusSlayer.test.js:21 cites here — they stay in the
 * unit lane, untouched), once-per-turn with mocked collaborators, and skip/null
 * guards. rules-hunterPrey.test.js owns the Horde Breaker marker. THIS lane
 * owns what mocked units cannot prove: real store/round/range round-trips.
 *
 * Pins: latch key '_Superior_Hunters_Prey_UsedRound' (no apostrophe) verbatim;
 * spread radiates from the MARKED target, not the attacker; campaign-scoped
 * round flows through real combatData (source passes campaignName at :43 —
 * unlike colossusSlayer's no-arg defect; other-campaign cache decoy proves
 * non-leak, #1050); server-first POST persistence of the latch. Turn-based —
 * no wall-clock timers anywhere; deterministic dice from the mock table.
 *
 * Old→new: map-filter ×3 (some/all/none in range, all hand-mocked) → 1 map
 * test with REAL grid math, two legs (exactly-30ft near-miss + beyond/unplaced
 * excluded; nobody-in-range → prevData no modal); resolveHp ×3 → 1 exact HP
 * ladder through the REAL store; NEW: full selection chain (roll→applyDamage
 * with store characters→exact log→popup→real latch stamp + POST) and real
 * once-per-turn denial/re-fire. 6 mocked tests → 4 real-wiring tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (dice + own-lane modules only) ─────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) =>
    formula === '1d6' ? { total: 4, rolls: [4], modifier: 0, formula: '1d6' }
      : formula === '1d10' ? { total: 9, rolls: [9], modifier: 0, formula: '1d10' }
        : null
  ),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 4, newHp: 1 })),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports (everything below runs REAL except the three seams above) ───

import { superiorHuntersPrey } from './superiorHuntersPrey.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';
import { getStore, getRuntimeValue, clearRuntimeState } from '../../../../hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from '../../../encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const LATCH = '_Superior_Hunters_Prey_UsedRound'; // no apostrophe — verbatim
const PREV = { formula: '1d8+3', total: 11, rolls: [8, 3] };

// Recording network router: change-data serves network.cs, maps serve network.map.
const network = { cs: null, map: null };
const fetchRouter = vi.fn(async (url) => {
  let body = {};
  if (url.includes('/change-data')) body = network.cs ? { combatSummary: JSON.parse(JSON.stringify(network.cs)) } : {};
  else if (url.includes('/maps/')) body = JSON.parse(JSON.stringify(network.map ?? {}));
  return { ok: true, status: 200, statusText: 'OK', json: async () => body, text: async () => JSON.stringify(body) };
});
const posts = () => fetchRouter.mock.calls.filter(([, o]) => o?.method === 'POST');

const ranger = (extra = {}) => ({
  name: 'Ranger1', level: 1, class: { name: 'Ranger' },
  concentration: { spell: "Hunter's Mark", target: 'Orc1' },
  ...extra,
});

async function open(overrides = {}) {
  const setSecondaryTargetModal = vi.fn();
  const ctx = {
    campaignName: CAMPAIGN,
    playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' } },
    targetName: 'Orc1',
    setSecondaryTargetModal,
    ...overrides,
  };
  const result = await superiorHuntersPrey.handler(ctx, PREV);
  return { ctx, setSecondaryTargetModal, result };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('superiorHuntersPrey — integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchRouter);
    network.cs = null;
    network.map = null;
    for (const k of ['Ranger1', 'Ally1', 'Ally2', 'Ally3', 'characters', '__map__', '__campaign__']) clearRuntimeState(k);
    setCombatSummaryCache(null, CAMPAIGN);
    setCombatSummaryCache(null, 'other-campaign');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inactive map fallback: all candidates offered with the full real-store HP ladder (exact modal, zero writes)', async () => {
    // playerStats.mapName opens the range branch, but the runtime store tracks no
    // active map — real isWithinRange short-circuits to in-range (two map sources
    // differ; pinned as current behavior) and no map is ever fetched.
    network.cs = {
      round: 1,
      creatures: [
        ranger(),
        { name: 'Orc1' },
        { name: 'Goblin1', currentHp: 5, maxHp: 10 },        // straight passthrough
        { name: 'Ogre1', maxHp: 12 },                        // creature fallback: current = max
        { name: 'Ally1', type: 'player' },                   // player: currentHitPoints ?? hitPoints
        { name: 'Ally2', type: 'player' },                   // player: hitPoints-only rung
        { name: 'Ally3', type: 'player' },                  // player: nothing → 0/0
      ],
    };
    const ally1 = getStore('Ally1');
    ally1.set('hitPoints', 25); ally1.set('currentHitPoints', 18);
    getStore('Ally2').set('hitPoints', 30);

    const { setSecondaryTargetModal, result } = await open({
      playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' }, mapName: 'Dungeon1' },
    });

    expect(result).toEqual({ data: PREV });
    expect(setSecondaryTargetModal).toHaveBeenCalledTimes(1);
    const modal = setSecondaryTargetModal.mock.calls[0][0];
    expect(modal.title).toBe("Superior Hunter's Prey — Choose Second Target");
    expect(modal.confirmLabel).toBe('Deal Damage');
    expect(modal.featureDescription).toBe("Deal 1d6 Force damage to a creature within 30 feet of the Hunter's Mark target. Once per turn.");
    expect(modal.targets).toEqual([
      { name: 'Goblin1', currentHp: 5, maxHp: 10 },
      { name: 'Ogre1', maxHp: 12, currentHp: 12 },
      { name: 'Ally1', type: 'player', currentHp: 18, maxHp: 25 },
      { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
      { name: 'Ally3', type: 'player', currentHp: 0, maxHp: 0 },
    ]);
    expect(fetchRouter.mock.calls.some(([u]) => u.includes('/maps/'))).toBe(false);
    expect(posts()).toHaveLength(0); // an offer burns nothing
  });

  it('active map: REAL grid math spreads from the MARKED target — exactly 30ft stays, beyond-30 and unplaced fall, nobody in range returns prevData with no modal', async () => {
    // Hand-derived once (FEET_PER_CELL=5, Euclidean): Orc1(0,0)→Goblin1(6,0)
    // = 30ft ≤ 30 IN; Skeleton1(7,0) = 35ft OUT — yet it is only 15ft from
    // Ranger1(10,0), so its exclusion proves the center is the MARKED target,
    // not the attacker; Troll1 unplaced cannot satisfy a positioned-map check.
    network.cs = {
      round: 1,
      creatures: [
        ranger(),
        { name: 'Orc1' },
        { name: 'Goblin1', currentHp: 7, maxHp: 20 },
        { name: 'Skeleton1' },
        { name: 'Troll1' },
      ],
    };
    network.map = {
      players: [
        { name: 'Orc1', gridX: 0, gridY: 0 },
        { name: 'Goblin1', gridX: 6, gridY: 0 },
        { name: 'Skeleton1', gridX: 7, gridY: 0 },
        { name: 'Ranger1', gridX: 10, gridY: 0 },
      ],
      placedItems: [{ name: 'Troll1' }],
    };
    getStore('__campaign__').set('campaignName', CAMPAIGN);
    getStore('__map__').set('activeMapName', 'Dungeon1');
    const mapCtx = { playerStats: { name: 'Ranger1', level: 1, class: { name: 'Ranger' }, mapName: 'Dungeon1' } };

    const { setSecondaryTargetModal } = await open(mapCtx);
    expect(fetchRouter).toHaveBeenCalledWith('/api/campaigns/test-campaign/maps/dungeon1', expect.objectContaining({ method: 'GET' }));
    expect(setSecondaryTargetModal.mock.calls[0][0].targets).toEqual([{ name: 'Goblin1', currentHp: 7, maxHp: 20 }]);

    // Leg 2: push Goblin past the threshold — nothing remains in range.
    network.map.players[1].gridX = 7; // 35ft
    const off = await open(mapCtx);
    expect(off.result).toEqual({ data: PREV });
    expect(off.setSecondaryTargetModal).not.toHaveBeenCalled();
  });

  it('selection chain at round 4: rolls 1d6, damages with store-sourced characters, logs exactly, updates popup, stamps the REAL latch and persists it via campaign POST', async () => {
    network.cs = { round: 4, creatures: [ranger(), { name: 'Orc1' }, { name: 'Goblin1', currentHp: 5, maxHp: 10 }] };
    setCombatSummaryCache({ round: 4, creatures: network.cs.creatures }, CAMPAIGN);
    setCombatSummaryCache({ round: 9, creatures: [] }, 'other-campaign'); // planted decoy — must not leak (#1050)
    getStore('characters').set('characters', [{ name: 'Ranger1' }]);
    const setPopupHtml = vi.fn();

    const { setSecondaryTargetModal } = await open({ setPopupHtml });
    await setSecondaryTargetModal.mock.calls[0][0].onTargetSelected('Goblin1');

    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('1d6');

    const [csArg, nameArg, amountArg, typesArg, optsArg] = applyDamageToTarget.mock.calls[0];
    // loadCombatSummary refetched via the real getCombatContext; resolveActiveCreatureName
    // stamps activeCreatureName from creatures[0] — folded in as current behavior.
    expect(csArg).toEqual({ round: 4, creatures: network.cs.creatures, activeCreatureName: 'Ranger1' });
    expect([nameArg, amountArg, typesArg]).toEqual(['Goblin1', 4, ['Force']]);
    expect(optsArg).toEqual({ campaignName: CAMPAIGN, characters: [{ name: 'Ranger1' }], ignoreResistance: false, attackerName: 'Ranger1' });

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'roll', characterName: 'Ranger1', rollType: 'damage', name: "Superior Hunter's Prey",
      formula: '1d6 [Superior Hunters Prey]', rolls: [4], total: 4, modifier: 0, damageType: 'Force', targetName: 'Goblin1', finalDamage: 4,
    });

    expect(setPopupHtml.mock.calls[0][0]({ keep: 1 })).toEqual({
      keep: 1, spreadTargetName: 'Goblin1', spreadFinalDamage: 4, spreadTargetCurrentHp: 1, spreadTargetMaxHp: 10,
    });
    expect(setSecondaryTargetModal.mock.calls.at(-1)[0]).toBeNull();

    // Round 4 came through REAL combatData (not pinned to 1, not the decoy's 9).
    expect(getRuntimeValue('Ranger1', LATCH)).toBe(4);
    expect(posts()).toHaveLength(1);
    const [postUrl, postOpts] = posts()[0];
    expect(postUrl).toBe(`/api/campaigns/${CAMPAIGN}/Ranger1`);
    expect(JSON.parse(postOpts.body)).toEqual({ value: { [LATCH]: 4 } });
  });

  it('once-per-turn lives in the REAL store: same-round demand refuses with zero dice and zero writes, next initiative round re-offers without burning the latch', async () => {
    network.cs = { round: 4, creatures: [ranger(), { name: 'Orc1' }, { name: 'Goblin1', currentHp: 5, maxHp: 10 }] };
    setCombatSummaryCache({ round: 4, creatures: network.cs.creatures }, CAMPAIGN);
    getStore('Ranger1').set(LATCH, 4); // stamp written by a prior chain, read by REAL getCurrentCombatRound + store

    const denied = await open();
    expect(denied.result).toEqual({ data: PREV });
    expect(denied.setSecondaryTargetModal).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(0);
    expect(getRuntimeValue('Ranger1', LATCH)).toBe(4);

    // Initiative advances via the real cache seam (as Initiative.jsx does).
    setCombatSummaryCache({ round: 5, creatures: network.cs.creatures }, CAMPAIGN);
    const refired = await open();
    expect(refired.setSecondaryTargetModal).toHaveBeenCalledTimes(1);
    expect(getRuntimeValue('Ranger1', LATCH)).toBe(4); // offering burns nothing
  });
});
