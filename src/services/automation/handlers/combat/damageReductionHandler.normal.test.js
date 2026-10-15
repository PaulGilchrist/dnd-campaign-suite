// @maintained-by-ai
// damageReductionHandler — NORMAL (flat/typed) reduction lane of the damageReduction quint.
// Lane map (handle() flow in damageReductionHandler.js):
//   - equipment gates (requiresShield / requiresShieldOrWeapon) -> damageReductionHandler.test.js
//   - zero_on_success effect (Intervene Shield)                 -> damageReductionHandler.zero-on-success.test.js
//   - 'falling' trigger gate + reaction round latch (Slow Fall) -> damageReductionHandler.slow-fall.test.js
//   - damage-reduced-to-0 redirect modal (redirect / executeRedirect / getMonkLevel) -> damageReductionHandler.redirect.test.js
//   - THIS FILE: attackTriggerRefusal, matchesTrigger (non-falling — canonical home),
//     rollReductionExpression, applyDeflectHeal + logDeflectHeal, ability_use logging, popup composition.
// Turn-based only; no game timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
  resolveDiceExpression: vi.fn((expr) => expr),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './damageReductionHandler.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Defensive Reaction',
    automation: {
      type: 'damage_reduction',
      ...automation,
    },
  };
}

function setupMocks() {
  automationService.evaluateAutoExpression.mockReturnValue(5);
  diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
  logService.addEntry.mockResolvedValue({});
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: { targetName: 'TestHero' },
    targetName: 'TestHero',
    totalDamage: 10,
    damageTypes: ['Slashing'],
  });
  damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
  applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 5 });
}

// ── Tests ──────────────────────────────────────────────────────

describe('damageReductionHandler - normal damage reduction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  // ── Popup composition ───────────────────────────────────────

  it('evaluates reduction expression and returns popup with result', async () => {
    automationService.evaluateAutoExpression.mockReturnValue(7);
    applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 7 });
    const ps = makePlayerStats();
    const action = makeAction({ reductionExpression: '2d6+1' });

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('2d6+1 = 7');
    expect(result.payload.automation).toBe(action.automation);
    expect(result.payload.automationType).toBe('damage_reduction');
  });

  it('includes trigger text when auto.trigger is set', async () => {
    const action = makeAction({ reductionExpression: '1d4', trigger: 'When hit by an attack' });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('Trigger: When hit by an attack');
  });

  it('omits trigger text when auto.trigger is not set', async () => {
    const action = makeAction({ reductionExpression: '1d4' });

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).not.toContain('Trigger:');
  });

  // ── rollReductionExpression ─────────────────────────────────

  describe('rollReductionExpression', () => {
    it('returns zero when no reductionExpression is provided', async () => {
      const result = await handle(makeAction({}), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Deflect roll:</b> 0');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('uses dice expression path when evaluateAutoExpression returns non-number', async () => {
      automationService.evaluateAutoExpression.mockReturnValue('2d6');
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 4] });
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 7 });

      const result = await handle(makeAction({ reductionExpression: '2d6' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('2d6 = 7');
    });

    it('falls back to zero when evaluateAutoExpression returns non-number and rollExpression fails', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction({ reductionExpression: '2d6+1' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Deflect roll:</b> 0');
    });
  });

  // ── Healing seam (applyDeflectHeal / logDeflectHeal) ────────

  describe('deflect healing', () => {
    it('clamps heal to total damage and logs the hp_change entry', async () => {
      automationService.evaluateAutoExpression.mockReturnValue(15);
      applyHealing.applyHealingToTarget.mockResolvedValue({ actualHeal: 10 });
      const ps = makePlayerStats({ computedStats: { currentHp: 12, maxHp: 20 } });

      const result = await handle(makeAction({ reductionExpression: '2d6+1' }), ps, campaignName, null);

      // reduction 15 vs damage 10: heal clamped, damage floored at 0 (no redirect set → normal exit)
      const cs = await damageUtils.getCombatContext(campaignName);
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(cs, 'TestHero', 10, campaignName);
      expect(result.payload.description).toContain('Damage reduced to:</b> <strong>0');
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'TestHero',
        delta: 10,
        currentHp: 12,
        maxHp: 20,
        isHealing: true,
        sourceName: 'Defensive Reaction',
        note: '2d6+1 = 15 HP from 10 damage reduced by Defensive Reaction',
      });
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: expect.stringContaining('healed for 10 HP'),
      }));
    });

    it('reports no healing needed and skips applyHealingToTarget when combat context is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction({ reductionExpression: '1d4' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Reduce damage by');
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: expect.stringContaining('no healing needed'),
      }));
      const loggedTypes = logService.addEntry.mock.calls.map(c => c[1].type);
      expect(loggedTypes).not.toContain('hp_change');
    });
  });

  // ── Logging ─────────────────────────────────────────────────

  describe('logging', () => {
    it('adds log entry with ability_use type', async () => {
      const action = makeAction({ reductionExpression: '2d4' });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Defensive Reaction',
        description: 'TestHero used Defensive Reaction to reduce damage by 2d4 = 5 (healed for 5 HP).',
      });
    });

    it('does not throw when addEntry rejects (fire-and-forget logging)', async () => {
      logService.addEntry.mockRejectedValue(new Error('log save failed'));

      const result = await handle(makeAction({ reductionExpression: '2d6' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('logs damage_reduction_refused when the trigger does not match', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { targetName: 'TestHero' },
        targetName: 'TestHero',
        totalDamage: 10,
        damageTypes: ['Fire'],
      });

      await handle(makeAction({ reductionExpression: '1d4', trigger: 'bludgeoning_piercing_slashing_damage' }), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'automation',
        characterName: 'TestHero',
        automationType: 'damage_reduction_refused',
        name: 'Defensive Reaction',
        description: expect.stringContaining('does not match the trigger condition'),
      }));
    });
  });

  // ── Last-attack refusal gates ───────────────────────────────

  describe('attack trigger refusal', () => {
    it('returns popup when no attackEvent in lastAttack', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: null,
        targetName: 'TestHero',
        totalDamage: 10,
      });

      const result = await handle(makeAction({ reductionExpression: '2d6' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent attack found');
    });

    it('returns popup when lastAttack targetName does not match player', async () => {
      damageRollback.findLastAttack.mockResolvedValue({
        attackEvent: { targetName: 'OtherPlayer' },
        targetName: 'OtherPlayer',
        totalDamage: 10,
      });

      const result = await handle(makeAction({ reductionExpression: '2d6' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('The last attack did not target you');
    });
  });

  // ── matchesTrigger (canonical home for non-falling branches;
  //    'falling' branch owned by damageReductionHandler.slow-fall.test.js) ──

  describe('trigger matching', () => {
    const triggerTests = [
      { name: 'bludgeoning', damageTypes: ['Bludgeoning'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: true },
      { name: 'piercing', damageTypes: ['Piercing'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: true },
      { name: 'slashing', damageTypes: ['Slashing'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: true },
      { name: 'fire (no match)', damageTypes: ['Fire'], trigger: 'bludgeoning_piercing_slashing_damage', expectMatch: false },
      { name: 'any_damage via damageTypes', damageTypes: ['Fire'], totalDamage: 0, trigger: 'any_damage', expectMatch: true },
      { name: 'any_damage via totalDamage', damageTypes: [], totalDamage: 10, trigger: 'any_damage', expectMatch: true },
      { name: 'any_damage without damage', damageTypes: [], totalDamage: 0, trigger: 'any_damage', expectMatch: false },
      { name: 'ranged weapon', damageTypes: ['Piercing'], trigger: 'ranged_weapon_attack_hit', weaponType: 'ranged', expectMatch: true },
      { name: 'melee weapon (no match)', damageTypes: ['Slashing'], trigger: 'ranged_weapon_attack_hit', weaponType: 'melee', expectMatch: false },
    ];

    for (const tt of triggerTests) {
      it(`matches ${tt.name}`, async () => {
        damageRollback.findLastAttack.mockResolvedValue({
          attackEvent: { targetName: 'TestHero', ...(tt.weaponType ? { weaponType: tt.weaponType } : {}) },
          targetName: 'TestHero',
          totalDamage: tt.totalDamage ?? 10,
          damageTypes: tt.damageTypes,
        });

        const result = await handle(makeAction({ reductionExpression: '1d4', trigger: tt.trigger }), makePlayerStats(), campaignName, null);

        if (tt.expectMatch) {
          expect(result.payload.description).toContain('Reduce damage by');
        } else {
          expect(result.payload.description).toContain('does not match the trigger condition');
        }
      });
    }
  });

  // ── hasShield non-string guard (required-shield consumer probe) ──

  it('handles non-string items in equipped array gracefully', async () => {
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: { targetName: 'TestHero' },
      targetName: 'TestHero',
      totalDamage: 10,
      damageTypes: ['Slashing'],
    });
    const ps = makePlayerStats({
      inventory: { equipped: [null, 42, 'Shield'] },
      equipment: [{ name: 'Shield', armor_category: 'Shield' }],
    });

    const result = await handle(makeAction({ requiresShield: true, reductionExpression: '2d6' }), ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Reduce damage by');
  });
});
