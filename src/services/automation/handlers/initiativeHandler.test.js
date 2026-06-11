import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../rules/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => {
  const storage = {
    set: vi.fn().mockResolvedValue(undefined),
  };
  return { default: storage };
});

// ── Imports (Vite returns mocked versions) ─────────────────────

import { handle } from './initiativeHandler.js';

import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as diceRoller from '../../dice/diceRoller.js';
import * as healingRoll from '../common/healingRoll.js';
import * as damageUtils from '../../rules/damageUtils.js';
import storage from '../../ui/storage.js';

// ── Helpers ─────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    hitPoints: 40,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6, bardic_inspiration_uses: 2 },
        { level: 2, bardic_die: 6, bardic_inspiration_uses: 3 },
        { level: 3, bardic_die: 8, bardic_inspiration_uses: 4 },
      ],
    },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Tandem Footwork',
    description: 'You and allies gain bonus to initiative.',
    automation: {
      type: 'initiative',
      effect: '',
      ...automation,
    },
  };
}

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

// ── Tests ───────────────────────────────────────────────────────

describe('initiativeHandler.handle', () => {
  function resetMocks() {
    useRuntimeState.getRuntimeValue.mockClear().mockReset();
    useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
    diceRoller.rollExpression.mockClear().mockReset();
    healingRoll.logHealingToSSE.mockClear().mockReset();
    damageUtils.getCombatContext.mockClear().mockReset();
    storage.set.mockClear().mockResolvedValue(undefined);
  }

  beforeEach(() => {
    resetMocks();
  });

  // ── bonus_initiative_allies effect ───────────────────────────

  describe('effect: bonus_initiative_allies', () => {
    it('returns early when incapacitated', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue.mockReturnValue(['incapacitated']);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used while Incapacitated');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when no bardic inspiration uses remaining', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([]) // activeConditions — not incapacitated
        .mockReturnValueOnce(0); // bardicInspirationUses = 0 <= 0

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('returns early when bardicUsed equals bardicMax', async () => {
      const ps = makePlayerStats({ level: 1 }); // max = 2 (bardic_inspiration_uses)
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(0); // bardicUsed = 0 <= 0

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('no uses remaining');
    });

    it('consumes a bardic inspiration use on success', async () => {
      const ps = makePlayerStats({ level: 3 }); // bardic_die = 8, bardic_inspiration_uses = 4
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2); // bardicUsed = 2
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        1,
        campaignName
      );
    });

    it('uses proficiency as fallback when no class_levels bardic_inspiration_uses', async () => {
      const ps = makePlayerStats({
        level: 3,
        proficiency: 2,
        class: { name: 'Other', class_levels: [] }, // no bardic_inspiration_uses
      });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(0); // bardicUsed = 0, bardicMax = proficiency (2) — proceed
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).not.toBeNull();
    });

    it('returns null when rollExpression returns null', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('updates initiative for allies with existing initiative', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally1', type: 'player', initiative: '12' },
      ]));

      await handle(action, ps, campaignName, null);

      // Ally initiative should be updated directly in creature object
      const combatSummaryArg = storage.set.mock.calls[0]?.[0] === 'combatSummary'
        ? storage.set.mock.calls[0][1]
        : null;
      expect(combatSummaryArg.creatures[0].initiative).toBe('20');
    });

     it('sets tandemFootworkBonus for allies without initiative', async () => {
       const ps = makePlayerStats({ level: 3 });
       const action = makeAction({ effect: 'bonus_initiative_allies' });
       // First two calls: activeConditions ([]), bardicInspirationUses (2)
       // Third call: tandemFootworkBonus for ally (0)
       useRuntimeState.getRuntimeValue
          .mockReturnValueOnce([])
          .mockReturnValueOnce(2)
          .mockReturnValueOnce(0);
       diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally2', type: 'player', initiative: '' },
      ]));

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally2',
        'tandemFootworkBonus',
        8,
        campaignName
      );
    });

    it('skips non-player creatures in combat summary', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Goblin', type: 'npc', initiative: '15' },
      ]));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('initiative_buff');
    });

     it('sorts creatures by initiative after updating', async () => {
       const ps = makePlayerStats({ level: 3 });
       const action = makeAction({ effect: 'bonus_initiative_allies' });
        // First two: activeConditions ([]), bardicInspirationUses (2)
        // Next calls: tandemFootworkBonus for allies without initiative
       useRuntimeState.getRuntimeValue
           .mockReturnValueOnce([])
           .mockReturnValueOnce(2)
           .mockReturnValueOnce(0)
           .mockReturnValueOnce(0);
       diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally1', type: 'player', initiative: '12' }, // becomes 22
        { name: 'Ally2', type: 'player', initiative: '' }, // gets tandemFootworkBonus
        { name: 'Ally3', type: 'player', initiative: '25' }, // stays 25, should be first
      ]));

      await handle(action, ps, campaignName, null);

      const savedSummary = storage.set.mock.calls[0]?.[1];
      expect(savedSummary.creatures[0].name).toBe('Ally3'); // highest initiative first
    });

    it('saves combat summary via storage.set', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally1', type: 'player', initiative: '10' },
      ]));

      await handle(action, ps, campaignName, null);

      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('returns correct popup payload with initiative_buff type', async () => {
      const ps = makePlayerStats({ level: 3 }); // bardic_die = 8
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('initiative_buff');
      expect(result.payload.formula).toBe('1d8');
      expect(result.payload.description).toContain('+8 to Initiative');
    });

    it('does not update combat context when getCombatContext returns null', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName, null);

      expect(storage.set).not.toHaveBeenCalled();
    });

    it('defaults to level 1 when playerStats.level is undefined', async () => {
      const ps = makePlayerStats({ level: undefined });
      delete ps.level; // ensure no level
      ps.class.class_levels = [
        { level: 1, bardic_die: 6, bardic_inspiration_uses: 2 },
      ];
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toBe('1d6'); // level 1 bardic_die
    });
  });

  // ── wild_shape_regen_on_initiative effect ────────────────────

  describe('effect: wild_shape_regen_on_initiative', () => {
    it('returns null when no Wild Shape uses available (maxWS = 0)', async () => {
      const ps = makePlayerStats({ level: 1, class: { name: 'Druid', class_levels: [] } });
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });

      // No matching class level → maxWS = 0
      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('returns early when current Wild Shape uses > 0', async () => {
      const ps = makePlayerStats({
        level: 2,
        class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 3 }] },
      });
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });
      useRuntimeState.getRuntimeValue.mockReturnValue(2); // currentWS = 2 > 0

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No need to regain');
       });

    it('regains Wild Shape when current uses are 0', async () => {
      const ps = makePlayerStats({
        level: 2,
        class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 3 }] },
      });
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });
      useRuntimeState.getRuntimeValue.mockReturnValue(0); // currentWS = 0

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('regained 1 use of Wild Shape');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'wildShapeUses', 1, campaignName);
    });

    it('uses custom resourceKey when provided in automation', async () => {
      const ps = makePlayerStats({
        level: 2,
        class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 3 }] },
      });
      const action = makeAction({
        effect: 'wild_shape_regen_on_initiative',
        resourceKey: 'myCustomResource',
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'myCustomResource', 1, campaignName);
    });

    it('handles getRuntimeValue returning null for current Wild Shape uses', async () => {
      const ps = makePlayerStats({
        level: 2,
        class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 2 }] },
      });
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });
      useRuntimeState.getRuntimeValue.mockReturnValue(null); // null → Number(null ?? 0) = 0

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('regained 1 use of Wild Shape');
    });
  });

  // ── regain_focus_points_and_heal effect ──────────────────────

  describe('effect: regain_focus_points_and_heal', () => {
    function makeMonkStats(overrides = {}) {
      return makePlayerStats({
        level: 3,
        class: { name: 'Monk', class_levels: [
          { level: 1, martial_arts_die: 4 },
          { level: 2, martial_arts_die: 4 },
          { level: 3, martial_arts_die: 6 },
        ]},
        hitPoints: 30,
        ...overrides,
      });
    }

    it('returns early when uses exhausted', async () => {
      const ps = makeMonkStats({});
      const action = makeAction({
        effect: 'regain_focus_points_and_heal',
        usesMax: 1,
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(0); // used 0 <= 0

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
    });

    it('returns early when usesUsed >= auto.uses (uses field)', async () => {
      const ps = makeMonkStats({});
      const action = makeAction({
        effect: 'regain_focus_points_and_heal',
        uses: 1, // uses instead of usesMax
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('cannot be used again');
    });

    it('heals HP on success using martial arts die + monk level', async () => {
       const ps = makeMonkStats({}); // level 3, martial_arts_die = 6
       const action = makeAction({
         effect: 'regain_focus_points_and_heal',
         usesMax: 2,
        });
        // First call: usesUsed (2), second: currentHitPoints (15)
       useRuntimeState.getRuntimeValue
            .mockReturnValueOnce(2)
            .mockReturnValueOnce(15);
       diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('healing');
      expect(result.payload.formula).toBe('1d6 + 3');
      // healAmount = monkLevel(3) + roll(6) = 9; newHp = min(30, 15+9) = 24
      expect(result.payload.healAmount).toBe(9);
      expect(result.payload.targetCurrentHp).toBe(24);
    });

    it('caps healing at max HP', async () => {
       const ps = makeMonkStats({ hitPoints: 20 });
       const action = makeAction({
         effect: 'regain_focus_points_and_heal',
         usesMax: 2,
         });
           // First call: usesUsed (2), second: currentHitPoints (18)
       useRuntimeState.getRuntimeValue
             .mockReturnValueOnce(2)
             .mockReturnValueOnce(18);
       diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      // healAmount = 6 + 3 = 9, but newHp capped at 20 (from 18)
      expect(result.payload.targetCurrentHp).toBe(20);
    });

    it('increments uses count after healing', async () => {
       const ps = makeMonkStats({});
       const action = makeAction({
         effect: 'regain_focus_points_and_heal',
         usesMax: 2,
         resourceKey: 'focusUses',
           });
         // First call: usesUsed (2), second: currentHitPoints (15)
       useRuntimeState.getRuntimeValue
             .mockReturnValueOnce(2)
             .mockReturnValueOnce(15);
       diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'focusUses', 1, campaignName);
    });

    it('logs healing to SSE', async () => {
      const ps = makeMonkStats({});
      const action = makeAction({
        effect: 'regain_focus_points_and_heal',
        usesMax: 2,
      });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(15);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(healingRoll.logHealingToSSE).toHaveBeenCalled();
    });

    it('returns correct description with roll details', async () => {
      const ps = makeMonkStats({}); // level 3 (monkLevel), martial_arts_die = 6
      const action = makeAction({
        effect: 'regain_focus_points_and_heal',
        usesMax: 2,
      });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(15);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Rolled 6');
      expect(result.payload.description).toContain('+ 3');
    });

    it('returns null when rollExpression returns null during healing', async () => {
       const ps = makeMonkStats({});
       const action = makeAction({ effect: 'regain_focus_points_and_heal', usesMax: 2 });
         // Proceed past uses check — no need for second getRuntimeValue call
       useRuntimeState.getRuntimeValue.mockReturnValueOnce(2);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('defaults resourceKey from action.name when not provided', async () => {
      const ps = makeMonkStats({});
      const action = {
        name: 'Diamond Soul',
        automation: {
          type: 'initiative',
          effect: 'regain_focus_points_and_heal',
          usesMax: 2,
        },
      };
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(15);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      // resourceKey defaults to action.name.lowercased.spaces-removed + 'Uses' = 'diamondsoulUses'
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'diamondsoulUses', 1, campaignName);
    });

    it('handles currentHitPoints as null (uses default 0)', async () => {
       const ps = makeMonkStats({ hitPoints: 30 });
       const action = makeAction({ effect: 'regain_focus_points_and_heal', usesMax: 2 });
       // First call: usesUsed (2), second: currentHitPoints (null → 0)
       useRuntimeState.getRuntimeValue
              .mockReturnValueOnce(2)
              .mockReturnValueOnce(null);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe(7); // monkLevel(3) + roll(4) = 7
    });
  });

  // ── Unrecognised effect (default fallback) ──────────────────

  describe('unrecognised effect', () => {
    it('returns info popup with action description for unknown effects', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({
        effect: 'some_unknown_effect',
      });
      action.description = 'Some custom effect.';

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Some custom effect.');
      expect(result.payload.automationType).toBe(action.automation.type);
    });

    it('returns empty description when action has no description field', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ effect: 'totally_unknown' });
      action.description = undefined;

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('');
    });
  });
});
