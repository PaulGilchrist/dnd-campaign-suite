// blessHandler lane contract — Bless popup-builder (automation registry 'bless:' @ index.js:607).
// Live dispatch: spellCastService/execution/index.js:291 → triggerSpells.handleBless →
// blessService.triggerBlessSpell → executeHandler → handle(). Live side effects: one
// resolveMapPositions + one getCombatContext read; ZERO state writes here. The apply lane
// is blessService.applyBlessEffect — called DIRECTLY by useSimpleSpellHandlers.js:288,
// never through this handler (delegation pinned here; apply behaviour lives in
// blessService.test.js which mocks executeHandler, i.e. mocks this lane's entry point).
// VESTIGIAL OUTPUT FLAG (bane/beacon/enhanceAbility SP-039 precedent, tally x4:
// bane, beacon, multiTarget, bless): 'bless_target_selection' has ZERO renderer consumers
// (repo-wide grep: this handler + this test only), and triggerSpells.handleBless discards
// triggerBlessSpell's return value (triggerSpells.js:155-156) — the live picker is
// spellGates.gateBless (own lane, spellGates.js:273, registered :805). These exact-key
// pins preserve the dispatch contract should the popup lane be rewired; keep them
// full-payload toEqual, not toHaveProperty walks.
// bless/bane mirror seam (#1877): blessHandler.js is byte-identical to baneHandler.js
// except the popup string (no shared infra to merge) — SOURCE-DUP flag stands; any fix
// here must land on the bane side too.
// maxTargets ladder honesty: max(3, 3 + (slotLevel - 1)) matches the RAW Bless text but
// the LIVE lane caps at a hardcoded 3 (gateBless.js:276; manifest SP-017: "upcast ladder
// structurally dead ... SP-011 fix wired gateBane only, spellGates.js:267 uses
// extractMaxTargets"). The ladder below pins THIS module's dispatch contract only —
// if gateBless ever adopts extractMaxTargets, reconcile both lanes together.

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

import { handle } from './blessHandler.js';
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
  // Merge-not-replace: automation overrides land INSIDE the { type: 'bless' } base
  // (the old helper's trailing ...overrides silently replaced the merged automation
  // with the raw partial). No test needs a replace-wholesale automation here.
  return {
    name: 'Bless',
    spell: {},
    ...overrides,
    automation: { type: 'bless', ...overrides.automation },
  };
}

function makeCombatContext(creatures) {
  return { creatures };
}

describe('blessHandler', () => {
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
          name: 'Bless',
          description: 'No combat context found. Cannot apply Bless.',
        },
      });
    },
  );

  // ── target selection popup ─────────────────────────────────

  it('returns the bless_target_selection popup with the exact full payload', async () => {
    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(getCombatContext).toHaveBeenCalledWith(campaignName);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'bless_target_selection',
        name: 'Bless',
        creatureTargets: ['Goblin', 'Orc'],
        range: '30 feet',
        rangeFt: 30,
        maxTargets: 3,
        slotLevel: 1,
        attackerPos: null,
        automation: { type: 'bless' },
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
    'computes maxTargets as max(3, 3 + (slotLevel - 1)) — lv%i caps %i (dispatch contract; live gateBless lane stays capped at 3 per SP-017)',
    async (lv, cap) => {
      const result = await handle(makeAction({ spellSlotLevel: lv }), makePlayerStats(), campaignName, mapName);

      expect(result.payload.maxTargets).toBe(cap);
    },
  );

  it('passes the automation object through unchanged', async () => {
    const auto = { type: 'bless', saveType: 'CHA', saveDc: 15 };

    const result = await handle(makeAction({ automation: auto }), makePlayerStats(), campaignName, mapName);

    expect(result.payload.automation).toEqual(auto);
  });

  it('returns an empty creatureTargets when no creatures are in combat', async () => {
    getCombatContext.mockResolvedValue(makeCombatContext([]));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('bless_target_selection');
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
    const result = await handle({ name: 'Bless' }, makePlayerStats(), campaignName, mapName);

    expect(result.payload).toEqual({
      type: 'bless_target_selection',
      name: 'Bless',
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

    // Ordering proof: the throw lands at the resolveMapPositions seam, before getCombatContext is read.
    expect(getCombatContext).not.toHaveBeenCalled();
  });
});
