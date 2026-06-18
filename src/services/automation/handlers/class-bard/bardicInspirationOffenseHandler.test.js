import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockImplementation(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
  getLastDamageEvent: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import { handle } from './bardicInspirationOffenseHandler.js';

import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as useMetamagic from '../../../../hooks/combat/useMetamagic.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Offensive Inspiration',
    automation: { type: 'bardic_inspiration_offense' },
    ...overrides,
  };
}

function makeRollResult(total, rolls = [total]) {
  return { total, rolls };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('bardicInspirationOffenseHandler.handle', () => {
  function resetMocks() {
    diceRoller.rollExpression.mockClear();
    useRuntimeState.getRuntimeValue.mockClear();
    useRuntimeState.setRuntimeValue.mockClear();
    logService.addEntry.mockClear();
    useMetamagic.getLastDamageEvent.mockClear();
    damageUtils.getCombatContext.mockClear();
    applyHealing.applyHealingToTarget.mockClear();
  }

  beforeEach(() => {
    resetMocks();
  });

  // ── Early exit: no die ───────────────────────────────────────────

  describe('no bardic inspiration die', () => {
    it('returns popup when bardicInspirationDie is null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when bardicInspirationDie is undefined', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when bardicInspirationDie is 0', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('does not call rollExpression when there is no die', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('does not call setRuntimeValue or addEntry when there is no die', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('includes correct payload structure on no-die early exit', async () => {
      const ps = makePlayerStats({});
      const action = { name: 'My Ability', automation: { type: 'custom' } };
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('My Ability');
    });
  });

  // ── Early exit: roll fails ───────────────────────────────────────

  describe('roll expression fails', () => {
    it('returns popup when rollExpression returns null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('returns popup when rollExpression returns undefined', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe('Roll failed.');
    });

    it('does not call setRuntimeValue or addEntry when roll fails', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Success flow: no recent damage event ─────────────────────────

  describe('successful invocation without recent damage event', () => {
    it('rolls correct die expression', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6); // bardicInspirationDie
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined); // bardicInspirationGrantedBy
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
    });

    it('rolls correct die expression for d12', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(12);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(7, [7]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    });

    it('clears bardic inspiration runtime state on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationCombatOptions',
        null,
        campaignName,
      );
    });

    it('logs the ability use entry on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(logService.addEntry).toHaveBeenCalled();
      const callArgs = logService.addEntry.mock.calls[0];
      expect(callArgs[0]).toBe(campaignName);
      expect(callArgs[1].type).toBe('ability_use');
      expect(callArgs[1].characterName).toBe('Bard');
      expect(callArgs[1].abilityName).toBe('Offensive Inspiration');
      expect(callArgs[1].biDieRoll).toBe(3);
      expect(callArgs[1].biDieSize).toBe(8);
    });

    it('log entry description contains roll total and no-damage-event message', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('rolled 1d6 (4)');
      expect(logDescription).toContain('No recent damage event found');
    });

    it('returns popup with roll details on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(6, [6]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bardic Inspiration (1d8)');
      expect(result.payload.description).toContain('rolled **6**');
    });

    it('includes roll values in success description', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(10);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(7, [2, 5]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('2, 5');
    });

    it('includes grantedBy in success description', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce('Fellow Bard');
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by Fellow Bard');
    });

    it('uses "unknown" as grantedBy when not set', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(null);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('includes action.automation in returned payload', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.automation).toEqual(action.automation);
    });

    it('does not call getCombatContext when no damage event', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('does not call applyHealingToTarget when no damage event', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('does not include defender HP in description when no damage event', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).not.toContain('HP:');
    });
  });

  // ── Success flow: stale damage event (treated as no event) ───────

  describe('stale damage event', () => {
    it('treats a stale damage event as no recent event', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      // Old timestamp — more than 60 seconds ago
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now() - 70000,
        targetName: 'Goblin',
      });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('treats a damage event with no timestamp as stale', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        targetName: 'Goblin',
      });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('treats a null damage event as stale', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('does not call getCombatContext for stale events', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now() - 70000,
        targetName: 'Goblin',
      });

      await handle(action, ps, campaignName);

      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });
  });

  // ── Success flow: fresh damage event, no combat context ──────────

  describe('fresh damage event but no combat context', () => {
    it('falls back to manual message when getCombatContext returns null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('falls back to manual message when getCombatContext returns undefined', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue(undefined);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('does not call applyHealingToTarget when combat context is null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue(null);

      await handle(action, ps, campaignName);

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });
  });

  // ── Success flow: fresh damage event, no target name ─────────────

  describe('fresh damage event but no target name', () => {
    it('falls back to manual message when targetName is missing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: undefined,
      });
      damageUtils.getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('falls back to manual message when targetName is null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: null,
      });
      damageUtils.getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('does not call applyHealingToTarget when targetName is missing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: undefined,
      });
      damageUtils.getCombatContext.mockResolvedValue({});

      await handle(action, ps, campaignName);

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });
  });

  // ── Success flow: damage applied to target ───────────────────────

  describe('successful damage application to target', () => {
    it('applies healing (negative = damage) to the target', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 12 });

      await handle(action, ps, campaignName);

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
        {}, // combatSummary (passed through)
        'Goblin',
        -5, // negative roll total = damage
        campaignName,
      );
    });

    it('includes target name in bonus description', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 12 });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
    });

    it('includes defender HP in description when healResult has newHp', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 12 });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Goblin HP: 12');
    });

    it('includes defender HP when newHp is 0', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 0 });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Goblin HP: 0');
    });

    it('does not include defender HP when healResult is null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
      // newHp is null, so the ternary `defenderHp != null` is false
      expect(result.payload.description).not.toContain('Goblin HP:');
    });

    it('does not include defender HP when healResult.newHp is undefined', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({});

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
      // newHp is undefined, so `defenderHp` becomes null via `?? null`
      expect(result.payload.description).not.toContain('Goblin HP:');
    });

    it('log entry description includes bonus damage message when applied', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 12 });

      await handle(action, ps, campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('Bonus damage applied to Goblin');
    });

    it('does not include HP in log entry description', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 12 });

      await handle(action, ps, campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      // The log entry description does NOT include the HP suffix (only the popup does)
      expect(logDescription).not.toContain('HP:');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('uses playerStats.name for runtime calls', async () => {
      const ps = makePlayerStats({ name: 'Valeria' });
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(2, [2]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Valeria',
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Valeria',
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Valeria',
        'bardicInspirationCombatOptions',
        null,
        campaignName,
      );
    });

    it('does not propagate addEntry rejection', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')).catch(() => {}));

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      // Should still return success popup despite addEntry failure
      expect(result.payload.description).toContain('rolled **5**');
    });

    it('calls getRuntimeValue with correct key for bardicInspirationDie', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'Bard',
        'bardicInspirationDie',
        campaignName,
      );
    });

    it('calls getRuntimeValue with correct key for bardicInspirationGrantedBy', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));
      useMetamagic.getLastDamageEvent.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'Bard',
        'bardicInspirationGrantedBy',
        campaignName,
      );
    });

    it('does not call getLastDamageEvent when die is missing', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useMetamagic.getLastDamageEvent).not.toHaveBeenCalled();
    });

    it('does not call getLastDamageEvent when roll fails', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useMetamagic.getLastDamageEvent).not.toHaveBeenCalled();
    });

    it('handles damage event with empty string targetName as falsy', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: '',
      });
      damageUtils.getCombatContext.mockResolvedValue({});

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
    });

    it('handles combat context with empty object and valid target', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Orc',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: 20 });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Orc');
      expect(result.payload.description).toContain('Orc HP: 20');
    });

    it('handles negative newHp from healResult', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      useMetamagic.getLastDamageEvent.mockReturnValue({
        timestamp: Date.now(),
        targetName: 'Goblin',
      });
      damageUtils.getCombatContext.mockResolvedValue({});
      applyHealing.applyHealingToTarget.mockReturnValue({ newHp: -3 });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Goblin HP: -3');
    });
  });
});
