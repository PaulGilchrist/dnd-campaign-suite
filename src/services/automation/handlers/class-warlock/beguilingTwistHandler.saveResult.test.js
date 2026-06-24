// @improved-by-ai
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

function makeHitAttack(targetName) {
  return {
    attackEvent: { hit: true, timestamp: Date.now(), targetName },
    attackerName: 'Goblin',
    targetName,
    primaryDamage: 5,
    secondaryDamage: 0,
    totalDamage: 5,
    damageTypes: ['Piercing'],
  };
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

  describe('save failure — condition application', () => {
    it('should add charmed condition and expiration when save fails (default type)', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-fail-cond' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-fail-cond', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['charmed'],
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

    it('should add charmed condition when condition type is charmed_frightened', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
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
        ['charmed'],
        campaignName,
      );
    });

    it('should add charmed condition when condition type is charmed', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-charmed-cond' });
      getRuntimeValue.mockReturnValue([]);

      await handle(
        makeAction({ target: 'self', condition: 'charmed' }),
        makePlayerStats(),
        campaignName,
        null,
      );
      dispatchSaveResult('beguiling-charmed-cond', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should add frightened condition when condition type is frightened', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-frightened-cond' });
      getRuntimeValue.mockReturnValue([]);

      await handle(
        makeAction({ target: 'self', condition: 'frightened' }),
        makePlayerStats(),
        campaignName,
        null,
      );
      dispatchSaveResult('beguiling-frightened-cond', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['frightened'],
        campaignName,
      );
    });

    it('should not add duplicate condition if already present', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
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

    it('should not add condition when getRuntimeValue returns null for activeConditions', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-null-conds' });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-null-conds', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should not add condition when getRuntimeValue returns non-array for activeConditions', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-nonarray-conds' });
      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-nonarray-conds', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should not modify conditions when target already has the condition', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-existing-cond' });
      getRuntimeValue.mockReturnValue(['charmed', 'poisoned']);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-existing-cond', false);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
    });
  });

  describe('save failure — log entries', () => {
    it('should add save_result log entry with correct fields on failed save', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-fail-log' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-fail-log', false);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        characterName: 'TestWarlock',
        rollType: 'save-beguiling_twist',
        targetName: 'TestWarlock',
        saveDc: 15,
        saveType: 'WIS',
        success: false,
        description: expect.stringContaining('failed WIS save'),
      }));
    });

    it('should include the target name in the failure description', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-fail-desc' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-fail-desc', false);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('TestWarlock is now'),
      }));
    });

    it('should use the correct condition name in the failure description', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-fail-cond-desc' });
      getRuntimeValue.mockReturnValue([]);

      await handle(
        makeAction({ target: 'self', condition: 'frightened' }),
        makePlayerStats(),
        campaignName,
        null,
      );
      dispatchSaveResult('beguiling-fail-cond-desc', false);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('Frightened'),
      }));
    });
  });

  describe('save success — log entries', () => {
    it('should add save_result log entry with success=true on successful save', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-success-log' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-success-log', true);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        characterName: 'TestWarlock',
        rollType: 'save-beguiling_twist',
        targetName: 'TestWarlock',
        saveDc: 15,
        saveType: 'WIS',
        success: true,
        description: expect.stringContaining('succeeded on WIS save'),
      }));
    });

    it('should mention the feature name in the success description', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-success-feature' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-success-feature', true);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('Beguiling Twist'),
      }));
    });

    it('should not apply condition or expiration on successful save', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
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

  describe('promptId filtering', () => {
    it('should ignore save result events with wrong promptId', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-wrong-id' });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('completely-different-prompt', false);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        expect.any(Array),
        campaignName,
      );
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('should not remove event listener when promptId does not match', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-keep-listener' });
      getRuntimeValue.mockReturnValue([]);

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('wrong-prompt-id', false);

      expect(removeEventListenerSpy).not.toHaveBeenCalled();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('event listener cleanup', () => {
    it('should remove the save-result event listener after handling a matching save result', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-remove-listener' });
      getRuntimeValue.mockReturnValue([]);

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);
      dispatchSaveResult('beguiling-remove-listener', false);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('description in initial popup', () => {
    it('should show "Charmed or Frightened" for default condition type', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-desc-default' });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Charmed or Frightened');
    });

    it('should show "Charmed" for charmed condition type', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
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
      findLastAttack.mockResolvedValue(makeHitAttack('TestWarlock'));
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
