import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './banishmentHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { campaignName, makePlayerStats } from './banishmentHandler.test-utils.js';

describe('banishmentHandler.handle edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses provided targetName from automation instead of resolveTarget', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) banished');
    expect(getTargetFromAttacker).not.toHaveBeenCalled();
  });

  it('handles player target (not NPC) - no auto-roll', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'WizardGirl') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'WizardGirl', type: 'player', saveBonuses: { CHA: 5 }, currentHp: 20, maxHp: 40 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 8, total: 13, bonus: 5 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
      targetName: 'WizardGirl',
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) banished');
    expect(rollSaveForCreature).not.toHaveBeenCalled();
  });

  it('handles when combatSummary is falsy (no concentration added)', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValueOnce({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    }).mockResolvedValueOnce(null);

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('handles when storedConditions is falsy', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return null;
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['incapacitated'], campaignName,
    );
  });

  it('handles when activeConditionMeta is falsy', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return null;
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditionMeta', expect.objectContaining({ incapacitated: expect.any(Object) }), campaignName,
    );
  });

  it('handles when targetCreature is null (creature not in combat)', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestCaster', type: 'player' },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) banished');
  });

  it('handles permanent banishment for fey type', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'FeyCreature') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'FeyCreature', type: 'npc', monsterType: 'fey', saveBonuses: { CHA: 1 }, currentHp: 10, maxHp: 20 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 2, total: 3, bonus: 1, rawRolls: [2] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 2, total: 3, bonus: 1 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'FeyCreature' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    const targetEffectsCall = vi.mocked(setRuntimeValue).mock.calls.find(
      call => call[1] === 'targetEffects',
    );
    expect(targetEffectsCall).toBeDefined();
    const effects = targetEffectsCall[2];
    const banishmentEffect = effects.find(e => e.effect === 'banishment');
    expect(banishmentEffect.permanent).toBe(true);
  });

  it('handles permanent banishment for aberration type', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Aberration') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Aberration', type: 'npc', monsterType: 'aberration', saveBonuses: { CHA: 3 }, currentHp: 25, maxHp: 50 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 1, total: 4, bonus: 3, rawRolls: [1] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 1, total: 4, bonus: 3 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Aberration' },
    };

    await handle(action, makePlayerStats(), campaignName, null);

    const targetEffectsCall = vi.mocked(setRuntimeValue).mock.calls.find(
      call => call[1] === 'targetEffects',
    );
    const banishmentEffect = targetEffectsCall[2].find(e => e.effect === 'banishment');
    expect(banishmentEffect.permanent).toBe(true);
  });

  it('handles when targetEffects is falsy', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return null;
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    const targetEffectsCall = vi.mocked(setRuntimeValue).mock.calls.find(
      call => call[1] === 'targetEffects',
    );
    expect(targetEffectsCall[2]).toHaveLength(1);
  });

  it('handles when saveResult has null roll/total', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: null, total: null, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) banished');
    const addTargetResultCalls = vi.mocked(addTargetResult).mock.calls;
    expect(addTargetResultCalls.length).toBeGreaterThan(0);
  });

  it('returns popup with no banished when all targets save', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: true, roll: 18, total: 20, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No creatures banished');
    expect(result.payload.description).toContain('1 creature(s) saved');
  });

  it('uses targetName from action (not automation) when automation.targetName is missing', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
      targetName: 'Goblin',
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('1 creature(s) banished');
  });

  it('uses resolveTarget when no targetName is provided in action or automation', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

    resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.payload.description).toContain('1 creature(s) banished');
    expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
  });

  it('handles NPC with null targetCreature using d20 fallback', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'Goblin') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestCaster', type: 'player' },
      ],
    });

    buildSaveDc.mockReturnValue(15);

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 10, total: 10, bonus: 0 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) banished');
    expect(rollSaveForCreature).not.toHaveBeenCalled();
  });

  it('handles creature type with spaces (e.g. "Fey Creature" -> feycreature)', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === 'FeyCreature') {
        if (subKey === 'activeConditions') return [];
        if (subKey === 'activeConditionMeta') return {};
      }
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'FeyCreature', type: 'Fey Creature', saveBonuses: { CHA: 1 }, currentHp: 10, maxHp: 20 },
      ],
    });

    buildSaveDc.mockReturnValue(15);
    rollSaveForCreature.mockReturnValue({ success: false, roll: 2, total: 3, bonus: 1, rawRolls: [2] });

    createSaveListener.mockReturnValue({
      promptId: 'prompt-1',
      promise: Promise.resolve({ success: false, roll: 2, total: 3, bonus: 1 }),
    });

    const action = {
      name: 'Banishment',
      automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'FeyCreature' },
    };

    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('1 creature(s) banished');
    const targetEffectsCall = vi.mocked(setRuntimeValue).mock.calls.find(
      call => call[1] === 'targetEffects',
    );
    const banishmentEffect = targetEffectsCall[2].find(e => e.effect === 'banishment');
    expect(banishmentEffect.permanent).toBe(false);
  });
});
