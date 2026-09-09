// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './initiativeHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

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

function setupRuntimeMocks(mocks) {
  useRuntimeState.getRuntimeValue.mockImplementation((player, prop, camp) => {
    const key = `${player}:${prop}:${camp}`;
    if (key in mocks) {
      return mocks[key];
    }
    return undefined;
  });
}

function getSavedCombatSummary() {
  const call = storage.set.mock.calls.find(
    (c) => c[0] === 'combatSummary'
  );
  return call ? call[1] : null;
}

// ── Tests ───────────────────────────────────────────────────────

describe('initiativeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRuntimeMocks({});
    diceRoller.rollExpression.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(null);
  });

  describe('effect: bonus_initiative_allies — guard clauses', () => {
    it('returns popup when player is incapacitated', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': ['incapacitated'],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('cannot be used while Incapacitated');
      expect(result.payload.name).toBe(action.name);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when no bardic inspiration uses remaining', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 0,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

  });

  describe('effect: bonus_initiative_allies — success path', () => {
    it('consumes a bardic inspiration use on success', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        1,
        campaignName,
      );
    });

    it('uses proficiency as fallback for bardicMax when class_levels has no bardic_inspiration_uses', async () => {
      const ps = makePlayerStats({
        level: 3,
        proficiency: 3,
        class: { name: 'Other', class_levels: [] },
      });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('initiative_buff');
    });

    it('defaults bardic_die to 6 when class_level entry is missing', async () => {
      const ps = makePlayerStats({ level: 99 });
      ps.class.class_levels = [];
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toBe('1d6');
    });

    it('returns null when rollExpression returns null', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('updates initiative for allies with existing initiative', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally1', type: 'player', initiative: '12' },
      ]));

      await handle(action, ps, campaignName, null);

      const savedSummary = getSavedCombatSummary();
      expect(savedSummary.creatures[0].initiative).toBe('20');
    });

    it('sets tandemFootworkBonus for allies without initiative', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
        'Ally2:tandemFootworkBonus:TestCampaign': 0,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally2', type: 'player', initiative: '' },
      ]));

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally2',
        'tandemFootworkBonus',
        8,
        campaignName,
      );
    });

    it('accumulates tandemFootworkBonus when ally already has one', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
        'Ally2:tandemFootworkBonus:TestCampaign': 3,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally2', type: 'player', initiative: '' },
      ]));

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally2',
        'tandemFootworkBonus',
        8,
        campaignName,
      );
    });

    it('skips non-player creatures in combat summary but still saves', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Goblin', type: 'npc', initiative: '15' },
      ]));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('initiative_buff');
      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        expect.objectContaining({ creatures: expect.any(Array) }),
        campaignName,
      );
    });

    it('sorts creatures by initiative descending after updating', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
        'Ally2:tandemFootworkBonus:TestCampaign': 0,
        'Ally3:tandemFootworkBonus:TestCampaign': 0,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
        { name: 'Ally1', type: 'player', initiative: '12' },
        { name: 'Ally2', type: 'player', initiative: '' },
        { name: 'Ally3', type: 'player', initiative: '25' },
      ]));

      await handle(action, ps, campaignName, null);

      const savedSummary = getSavedCombatSummary();
      expect(savedSummary.creatures[0].name).toBe('Ally3');
      expect(savedSummary.creatures[1].name).toBe('Ally1');
      expect(savedSummary.creatures[2].name).toBe('Ally2');
    });

    it('returns correct popup payload with initiative details', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('initiative_buff');
      expect(result.payload.formula).toBe('1d8');
      expect(result.payload.rolls).toEqual([8]);
      expect(result.payload.bonus).toBe(0);
      expect(result.payload.modifier).toBe(0);
      expect(result.payload.description).toContain('+8 to Initiative');
      expect(result.payload.automationType).toBe('initiative');
    });

    it('handles empty creatures array in combat summary', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('initiative_buff');
      expect(storage.set).toHaveBeenCalledWith(
        'combatSummary',
        expect.objectContaining({ creatures: [] }),
        campaignName,
      );
    });

    it('handles null combat summary gracefully', async () => {
      const ps = makePlayerStats({ level: 3 });
      const action = makeAction({ effect: 'bonus_initiative_allies' });
      setupRuntimeMocks({
        'Bard:activeConditions:TestCampaign': [],
        'Bard:bardicInspirationUses:TestCampaign': 2,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('initiative_buff');
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('effect: wild_shape_regen_on_initiative', () => {
    function makeDruidStats(overrides = {}) {
      return makePlayerStats({
        level: 2,
        class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 3 }] },
        ...overrides,
      });
    }

    it('returns null when no Wild Shape uses available (maxWS = 0)', async () => {
      const ps = makeDruidStats({
        class: { name: 'Druid', class_levels: [] },
      });
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup when current Wild Shape uses > 0', async () => {
      const ps = makeDruidStats();
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });
      setupRuntimeMocks({
        'Bard:wildShapeUses:TestCampaign': 3,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No need to regain');
      expect(result.payload.description).toContain('3 Wild Shape use');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('regains Wild Shape when current uses are 0', async () => {
      const ps = makeDruidStats();
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });
      setupRuntimeMocks({
        'Bard:wildShapeUses:TestCampaign': 0,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('regained 1 use of Wild Shape');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'wildShapeUses',
        1,
        campaignName,
      );
    });

    it('uses custom resourceKey when provided in automation', async () => {
      const ps = makeDruidStats();
      const action = makeAction({
        effect: 'wild_shape_regen_on_initiative',
        resourceKey: 'myCustomResource',
      });
      setupRuntimeMocks({
        'Bard:myCustomResource:TestCampaign': 0,
      });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'myCustomResource',
        1,
        campaignName,
      );
    });

    it('treats null/undefined runtime value as 0 current uses', async () => {
      const ps = makeDruidStats();
      const action = makeAction({ effect: 'wild_shape_regen_on_initiative' });
      setupRuntimeMocks({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('regained 1 use of Wild Shape');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'wildShapeUses',
        1,
        campaignName,
      );
    });
  });

  describe('effect: regain_bardic_inspiration_on_initiative', () => {
    function makeBardStats(overrides = {}) {
      return makePlayerStats({
        level: 3,
        class: {
          name: 'Bard',
          class_levels: [
            { level: 1, bardic_die: 6, bardic_inspiration_uses: 2 },
            { level: 2, bardic_die: 6, bardic_inspiration_uses: 3 },
            { level: 3, bardic_die: 8, bardic_inspiration_uses: 4 },
          ],
        },
        ...overrides,
      });
    }

    it('returns popup when current bardic uses already meet minTarget', async () => {
      const ps = makeBardStats();
      const action = makeAction({ effect: 'regain_bardic_inspiration_on_initiative' });
      setupRuntimeMocks({
        'Bard:bardicInspirationUses:TestCampaign': 4,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No need to regain');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('regains bardic inspiration when below minTarget', async () => {
      const ps = makeBardStats();
      const action = makeAction({ effect: 'regain_bardic_inspiration_on_initiative' });
      setupRuntimeMocks({
        'Bard:bardicInspirationUses:TestCampaign': 0,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Regained Bardic Inspiration uses');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });

    it('respects custom minTarget from automation', async () => {
      const ps = makeBardStats();
      const action = makeAction({
        effect: 'regain_bardic_inspiration_on_initiative',
        minTarget: 3,
      });
      setupRuntimeMocks({
        'Bard:bardicInspirationUses:TestCampaign': 0,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('3/4');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        3,
        campaignName,
      );
    });

    it('caps regained uses at maxBI from class_levels when minTarget exceeds max', async () => {
      const ps = makeBardStats();
      const action = makeAction({
        effect: 'regain_bardic_inspiration_on_initiative',
        minTarget: 10,
      });
      setupRuntimeMocks({
        'Bard:bardicInspirationUses:TestCampaign': 0,
      });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        4,
        campaignName,
      );
    });

    it('falls back to proficiency when class_levels has no bardic_inspiration_uses', async () => {
      const ps = makeBardStats({
        proficiency: 5,
        class: { name: 'Bard', class_levels: [] },
      });
      const action = makeAction({ effect: 'regain_bardic_inspiration_on_initiative' });
      setupRuntimeMocks({
        'Bard:bardicInspirationUses:TestCampaign': 0,
      });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationUses',
        2,
        campaignName,
      );
    });
  });

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

    it('returns popup when Uncanny Metabolism already used this combat', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('cannot be used again until a long rest');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    // CLA-372: refusal must reach the campaign log (family precedent
    // CLA-345/CLA-355/CLA-394), spending nothing.
    it('logs uncanny_metabolism_refused on refusal with zero HP/FP deltas', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': true,
        'Bard:currentHitPoints:TestCampaign': 50,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'Bard',
        automationType: 'uncanny_metabolism_refused',
        name: 'Tandem Footwork',
      }));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });

    it('heals HP using martial arts die + monk level', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('healing');
      expect(result.payload.formula).toBe('1d6 + 3');
      expect(result.payload.rolls).toEqual([6]);
      expect(result.payload.healAmount).toBe(9);
      expect(result.payload.targetCurrentHp).toBe(24);
      expect(result.payload.targetMaxHp).toBe(30);
      expect(result.payload.damageApplied).toBe(true);
    });

    it('caps healing at max HP', async () => {
      const ps = makeMonkStats({ hitPoints: 20 });
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 18,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetCurrentHp).toBe(20);
      expect(result.payload.healAmount).toBe(9);
    });

    it('logs healing to SSE', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Bard',
          sourceName: 'Tandem Footwork',
          actualHeal: expect.any(Number),
          newHp: expect.any(Number),
          maxHp: 30,
        }),
      );
    });

    it('sets currentHitPoints via setRuntimeValue', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'currentHitPoints',
        22,
        campaignName,
      );
    });

    it('sets uncannyMetabolismUsed to true after healing', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'uncannyMetabolismUsed',
        true,
        campaignName,
      );
    });

    it('restores focus points to max when focus_points is defined', async () => {
      const ps = makeMonkStats({
        class: { name: 'Monk', class_levels: [
          { level: 1, martial_arts_die: 4 },
          { level: 2, martial_arts_die: 4, focus_points: 2 },
          { level: 3, martial_arts_die: 6, focus_points: 2 },
        ]},
      });
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'focusPoints',
        2,
        campaignName,
      );
    });

    it('skips focus points restore when focus_points is 0', async () => {
      const ps = makeMonkStats({
        class: { name: 'Monk', class_levels: [
          { level: 1, martial_arts_die: 4 },
          { level: 2, martial_arts_die: 4, focus_points: 0 },
          { level: 3, martial_arts_die: 6, focus_points: 0 },
        ]},
      });
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      await handle(action, ps, campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Bard',
        'focusPoints',
        expect.any(Number),
        campaignName,
      );
    });

    it('logs ability_use to campaign log', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

      await handle(action, ps, campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Tandem Footwork',
        description: expect.stringContaining('Rolled 5'),
      });
    });

    it('returns correct description with roll details', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Rolled 6');
      expect(result.payload.description).toContain('+ 3');
      expect(result.payload.description).toContain('<strong>9</strong>');
      expect(result.payload.description).toContain('Regained all Focus Points');
    });

    it('returns null when rollExpression returns null', async () => {
      const ps = makeMonkStats();
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 15,
      });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('uses martial_arts_die fallback of 4 when class_level missing', async () => {
      const ps = makeMonkStats({ level: 99 });
      ps.class.class_levels = [];
      const action = makeAction({ effect: 'regain_focus_points_and_heal' });
      setupRuntimeMocks({
        'Bard:uncannyMetabolismUsed:TestCampaign': false,
        'Bard:currentHitPoints:TestCampaign': 10,
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toBe('1d4 + 99');
    });
  });

  describe('unrecognised effect', () => {
    it('returns info popup with action description for unknown effects', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'some_unknown_effect' });
      action.description = 'Some custom effect.';

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Some custom effect.');
      expect(result.payload.automationType).toBe('initiative');
    });

    it('returns empty description when action has no description property', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Unknown Action',
        automation: { type: 'initiative', effect: 'unknown_xyz' },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe('');
    });
  });
});
