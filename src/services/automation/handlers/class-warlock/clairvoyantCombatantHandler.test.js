import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

import { handle } from './clairvoyantCombatantHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

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
    name: 'Clairvoyant Combatant',
    automation: { type: 'clairvoyant_combatant', saveType: 'WIS', saveDc: 15, uses: 1, ...automation },
  };
}

describe('clairvoyantCombatantHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('active target check', () => {
    it('should return popup when already active against a target', async () => {
      getRuntimeValue.mockReturnValue('ExistingTarget');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already active');
      expect(result.payload.description).toContain('ExistingTarget');
    });
  });

  describe('uses check', () => {
    it('should return popup when no uses remaining', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        return 0;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No uses remaining');
    });

    it('should spend a pact magic slot to restore a use when available', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'warlockPactMagic') return 2;
        return 0;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-pact' });

      const result = await handle(makeAction({ pactMagicRecharge: true }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'warlockPactMagic', 1, campaignName);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'clairvoyantCombatantUses', 0, campaignName);
    });

    it('should return no pact magic available when pact slots are zero', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        if (key === 'warlockPactMagic') return 0;
        return 0;
      });

      const result = await handle(makeAction({ pactMagicRecharge: true }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No Pact Magic slots available');
    });

    it('should return no uses remaining when no pact magic recharge configured', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 1;
        return 0;
      });

      const result = await handle(makeAction({ pactMagicRecharge: false }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No uses remaining');
      expect(result.payload.description).toContain('Short or Long Rest');
    });
  });

  describe('target resolution', () => {
    it('should return popup when no target selected', async () => {
      getRuntimeValue.mockReturnValue(null);
      getTargetFromAttacker.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should increment use counter', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'clairvoyantCombatantTarget') return null;
        if (key === 'clairvoyantCombatantUses') return 0;
        return 0;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-incr' });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'clairvoyantCombatantUses', 1, campaignName);
    });
  });

  describe('target effects', () => {
    function setupFull() {
      getRuntimeValue.mockImplementation((a, b, _) => {
        if (b === 'clairvoyantCombatantTarget') return null;
        if (b === 'clairvoyantCombatantUses') return 0;
        if (a === campaignName && b === 'targetEffects') return [];
        if (b === 'activeBuffs') return [];
        return 0;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-full' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });
    }

    it('should add target effect for combat advantage/disadvantage', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'EnemyTarget',
            effect: 'clairvoyant_combatant',
            attackerAdvantage: true,
            defenderDisadvantage: true,
          }),
        ]),
        campaignName,
      );
    });

    it('should store active target', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'clairvoyantCombatantTarget',
        'EnemyTarget',
        campaignName,
      );
    });

    it('should add to activeBuffs', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            effect: 'clairvoyant_combatant',
            target: 'EnemyTarget',
          }),
        ]),
        campaignName,
      );
    });
  });

  describe('save listener', () => {
    function setupFull() {
      getRuntimeValue.mockImplementation((a, b, _) => {
        if (b === 'clairvoyantCombatantTarget') return null;
        if (b === 'clairvoyantCombatantUses') return 0;
        if (a === campaignName && b === 'targetEffects') return [];
        if (b === 'activeBuffs') return [];
        return 0;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-full' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });
    }

    it('should create save listener with correct parameters', async () => {
      setupFull();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyTarget',
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('should add event listener for save-result', async () => {
      setupFull();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });
  });

  describe('popup response', () => {
    function setupFull() {
      getRuntimeValue.mockImplementation((a, b, _) => {
        if (b === 'clairvoyantCombatantTarget') return null;
        if (b === 'clairvoyantCombatantUses') return 0;
        if (a === campaignName && b === 'targetEffects') return [];
        if (b === 'activeBuffs') return [];
        return 0;
      });
      getTargetFromAttacker.mockReturnValue({ name: 'EnemyTarget' });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'clairvoyant-full' });
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'EnemyTarget' }] });
    }

    it('should return popup with description', async () => {
      setupFull();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Clairvoyant Combatant');
      expect(result.payload.targetName).toBe('EnemyTarget');
      expect(result.payload.description).toContain('EnemyTarget');
      expect(result.payload.description).toContain('Disadvantage');
    });
  });
});
