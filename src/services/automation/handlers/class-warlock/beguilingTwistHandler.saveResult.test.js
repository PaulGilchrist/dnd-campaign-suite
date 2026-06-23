import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn((r) => {
    if (typeof r === 'number') return r;
    const m = String(r).match(/(\d+)_?ft/);
    return m ? parseInt(m[1], 10) : null;
  }),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, ability) => {
    const ab = abilities?.find(a => a.name === ability);
    return ab?.bonus ?? 0;
  }),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle } from './beguilingTwistHandler.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Beguiling Twist',
    automation: { type: 'beguiling_twist', range: '120_ft', ...automation },
  };
}

function dispatchSaveResult(promptId, success) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success },
  }));
}

describe('beguilingTwistHandler.saveResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
  });

  describe('save result handling', () => {
    it('should add condition and expiration when save fails', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-fail-result' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-fail-result', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith(
        'TestWarlock',
        'TestWarlock',
        expect.arrayContaining([expect.objectContaining({ type: 'condition', condition: 'charmed' })]),
        campaignName,
        60,
      );
    });

    it('should add log entry for failed save', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-fail-log' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-fail-log', false);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'TestWarlock',
        saveDc: 15,
        saveType: 'WIS',
        success: false,
      }));
    });

    it('should add log entry for successful save', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-success-result' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-success-result', true);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'TestWarlock',
        saveDc: 15,
        saveType: 'WIS',
        success: true,
        description: expect.stringContaining('succeeded on WIS save'),
      }));
    });

    it('should not apply duplicate condition if already present', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-dup-cond' });
      getRuntimeValue.mockReturnValue(['charmed']);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-dup-cond', false);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });

    it('should use charmed condition for charmed_frightened type', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-cf-cond' });
      getRuntimeValue.mockReturnValue([]);

      await handle(
        makeAction({ target: 'self', condition: 'charmed_frightened' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      dispatchSaveResult('beguiling-cf-cond', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
    });

    it('should use charmed condition for charmed type', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-charmed-only' });
      getRuntimeValue.mockReturnValue([]);

      await handle(
        makeAction({ target: 'self', condition: 'charmed' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      dispatchSaveResult('beguiling-charmed-only', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
    });

    it('should use frightened condition for frightened type', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-frightened-only' });
      getRuntimeValue.mockReturnValue([]);

      await handle(
        makeAction({ target: 'self', condition: 'frightened' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      dispatchSaveResult('beguiling-frightened-only', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.arrayContaining(['frightened']),
        campaignName,
      );
    });

    it('should ignore events with wrong promptId', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-wrong-id' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('wrong-prompt-id', false);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('should remove event listener after handling save result', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-remove-listener' });
      getRuntimeValue.mockReturnValue([]);

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-remove-listener', false);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should not remove event listener on wrong promptId', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-keep-listener' });
      getRuntimeValue.mockReturnValue([]);

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('wrong-prompt-id', false);

      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      removeEventListenerSpy.mockRestore();
    });

    it('should not add condition or expiration on successful save', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-no-cond-success' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-no-cond-success', true);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('condition name in descriptions', () => {
    it('should show "Charmed or Frightened" for default condition type', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-desc-default' });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Charmed or Frightened');
    });

    it('should show "Charmed" for charmed condition type', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-desc-charmed' });

      const result = await handle(
        makeAction({ target: 'self', condition: 'charmed' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('or be Charmed');
      expect(result.payload.description).not.toContain('Frightened');
    });

    it('should show "Frightened" for frightened condition type', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-desc-frightened' });

      const result = await handle(
        makeAction({ target: 'self', condition: 'frightened' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('or be Frightened');
      expect(result.payload.description).not.toContain('Charmed');
    });
  });
});
