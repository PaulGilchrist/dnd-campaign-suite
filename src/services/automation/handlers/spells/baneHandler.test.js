// @maintained-by-ai
// baneHandler lane contract — Bane popup-builder (automation registry 'bane:' @ index.js:606).
// Live dispatch: spellCastService/execution/index.js:290 → triggerSpells.handleBane →
// baneService.triggerBaneSpell → executeHandler → handle(). Live side effects: one
// resolveMapPositions + one getCombatContext read; ZERO state writes here — the
// concentration 'bane_penalty' targetEffect (-1d4 attacks/saves) is applied in the
// baneService/save lanes (duration is a concentration latch, never a clock).
// VESTIGIAL OUTPUT FLAG (enhanceAbility SP-039 precedent): 'bane_target_selection'
// currently has ZERO renderer consumers, and triggerSpells.handleBane discards
// triggerBaneSpell's return value — the live picker is spellGates.gateBane (own lane,
// spellGates.bane.test.js). These exact-key pins preserve the dispatch contract should
// the popup lane be rewired; keep them full-payload toEqual, not toHaveProperty walks.
// bless/bane mirror seam (#1877): blessHandler.js is a near-clone of this module at
// source (no shared save-issuer/aura infra to merge) — the bless lane should mirror
// this trim and the merge-not-replace makeAction shape.
// maxTargets ladder max(3, 3 + (slotLevel - 1)) agrees with the gateBane lane caps
// (lv2→4, lv3→5, lv9→11) pinned in spellGates.bane.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn((r) => {
    if (typeof r === 'number') return r;
    if (!r || typeof r !== 'string') return null;
    const m = String(r).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle } from './baneHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  // handle() consumes only playerStats.name (map-position seam).
  return { name: 'TestCaster', ...overrides };
}

function makeAction(overrides = {}) {
  // Merge-not-replace: automation overrides land INSIDE the { type: 'bane' } base
  // (the old helper's trailing ...overrides silently replaced the merged automation
  // with the raw partial). No test needs a replace-wholesale automation here.
  return {
    name: 'Bane',
    spell: {},
    ...overrides,
    automation: { type: 'bane', ...overrides.automation },
  };
}

function makeCombatContext(creatures) {
  return { creatures };
}

describe('baneHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeCombatContext([{ name: 'Goblin' }, { name: 'Orc' }]));
    resolveMapPositions.mockResolvedValue({});
  });

  // ── no combat context ──────────────────────────────────────

  it.each([{ ctx: null }, { ctx: undefined }])(
    'returns the automation_info popup when combat context is $ctx',
    async ({ ctx }) => {
      getCombatContext.mockResolvedValue(ctx);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Bane',
          description: 'No combat context found. Cannot apply Bane.',
        },
      });
    },
  );

  // ── target selection popup ─────────────────────────────────

  it('returns the bane_target_selection popup with the exact full payload', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(getCombatContext).toHaveBeenCalledWith(campaignName);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'bane_target_selection',
        name: 'Bane',
        creatureTargets: ['Goblin', 'Orc'],
        range: '30 feet',
        rangeFt: 30,
        maxTargets: 3,
        slotLevel: 1,
        attackerPos: null,
        automation: { type: 'bane' },
      },
    });
  });

  it('pins the range fallback chain automation > spell > "30 feet" default', async () => {
    const automationResult = await handle(
      makeAction({ automation: { range: '60 feet' } }),
      makePlayerStats(),
      campaignName,
      mapName,
    );
    expect(automationResult.payload.range).toBe('60 feet');
    expect(automationResult.payload.rangeFt).toBe(60);

    const spellResult = await handle(
      makeAction({ spell: { range: '45 feet' } }),
      makePlayerStats(),
      campaignName,
      mapName,
    );
    expect(spellResult.payload.range).toBe('45 feet');
    expect(spellResult.payload.rangeFt).toBe(45);

    const defaultResult = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
    expect(defaultResult.payload.range).toBe('30 feet');
    expect(defaultResult.payload.rangeFt).toBe(30);

    // rangeToFeet seam is fed the resolved string, in order.
    expect(rangeToFeet.mock.calls.map((c) => c[0])).toEqual(['60 feet', '45 feet', '30 feet']);
  });

  it('pins the slot-level chain spellSlotLevel > spell.level > 1', async () => {
    let result = await handle(makeAction({ spellSlotLevel: 3 }), makePlayerStats(), campaignName, mapName);
    expect(result.payload.slotLevel).toBe(3);
    expect(result.payload.maxTargets).toBe(5);

    result = await handle(makeAction({ spell: { level: 4 } }), makePlayerStats(), campaignName, mapName);
    expect(result.payload.slotLevel).toBe(4);
    expect(result.payload.maxTargets).toBe(6);

    result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
    expect(result.payload.slotLevel).toBe(1);
    expect(result.payload.maxTargets).toBe(3);
  });

  it.each([[2, 4], [5, 7], [9, 11]])(
    'computes maxTargets as max(3, 3 + (slotLevel - 1)) — lv%i caps %i',
    async (lv, cap) => {
      const result = await handle(makeAction({ spellSlotLevel: lv }), makePlayerStats(), campaignName, mapName);

      expect(result.payload.maxTargets).toBe(cap);
    },
  );

  it('passes the automation object through unchanged', async () => {
    const auto = { type: 'bane', saveType: 'CHA', saveDc: 15 };

    const result = await handle(makeAction({ automation: auto }), makePlayerStats(), campaignName, mapName);

    expect(result.payload.automation).toEqual(auto);
  });

  it('returns an empty creatureTargets when no creatures are in combat', async () => {
    getCombatContext.mockResolvedValue(makeCombatContext([]));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('bane_target_selection');
    expect(result.payload.creatureTargets).toEqual([]);
  });

  // ── map position seam ──────────────────────────────────────

  it('resolves attackerPos via resolveMapPositions(campaignName, mapName, casterName)', async () => {
    resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 5, gridY: 10 } });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestCaster');
    expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
  });

  it('reports null attackerPos and skips the resolver without a mapName', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(resolveMapPositions).not.toHaveBeenCalled();
    expect(result.payload.attackerPos).toBeNull();
  });

  it('reports null attackerPos when the resolver returns no position', async () => {
    resolveMapPositions.mockResolvedValue({});

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.payload.attackerPos).toBeNull();
  });

  // ── edge cases ─────────────────────────────────────────────

  it('defaults missing automation and spell objects on a minimal action', async () => {
    const result = await handle({ name: 'Bane' }, makePlayerStats(), campaignName, mapName);

    expect(result.payload).toEqual({
      type: 'bane_target_selection',
      name: 'Bane',
      creatureTargets: ['Goblin', 'Orc'],
      range: '30 feet',
      rangeFt: 30,
      maxTargets: 3,
      slotLevel: 1,
      attackerPos: null,
      automation: {},
    });
  });

  it('rejects when playerStats is undefined — the map seam reads playerStats.name before the combat-context guard', async () => {
    await expect(
      handle(makeAction(), undefined, campaignName, mapName),
    ).rejects.toThrow(TypeError);
  });
});
