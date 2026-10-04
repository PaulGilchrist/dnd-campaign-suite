// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { applyCalmEmotionsImmunity, applyCalmEmotionsIndifferent } from './calmEmotionsHandler.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

describe('calmEmotionsHandler - applyCalmEmotionsImmunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('should remove charmed and frightened from activeConditions (merged write)', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed', 'frightened', 'poisoned'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(setRuntimeObject).toHaveBeenCalledWith(
      'EnemyGoblin',
      expect.objectContaining({ activeConditions: ['poisoned'] }),
      campaignName,
    );
  });

  it('should handle case-insensitive condition removal', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['CHARMED', 'Frightened'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(setRuntimeObject).toHaveBeenCalledWith(
      'EnemyGoblin',
      expect.objectContaining({ activeConditions: [] }),
      campaignName,
    );
  });

  it('should not write activeConditions if charmed/frightened are absent', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['poisoned', 'blinded'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    // The merged patch must omit activeConditions when nothing changed
    const patch = setRuntimeObject.mock.calls.find(call => call[0] === 'EnemyGoblin')[1];
    expect(patch).not.toHaveProperty('activeConditions');
  });

  it('SP-020: conditions and buffs go out as ONE merged per-target write', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    const calls = setRuntimeObject.mock.calls.filter(call => call[0] === 'EnemyGoblin');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual(expect.objectContaining({
      activeConditions: [],
      activeBuffs: expect.any(Array),
    }));
    // No per-key activeBuffs/activeConditions setRuntimeValue writes remain
    const perKeyCalls = setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs' || call[1] === 'activeConditions',
    );
    expect(perKeyCalls).toHaveLength(0);
  });

  it('should add activeBuff with calm_emotions effect', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    const patch = setRuntimeObject.mock.calls.find(call => call[0] === 'EnemyGoblin')[1];
    expect(patch.activeBuffs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Calm Emotions',
        effect: 'calm_emotions',
        conditionImmunity: ['Charmed', 'Frightened'],
        sourceCharacter: 'TestWizard',
        duration: 'concentration',
      }),
    ]));
  });

  it('should preserve existing buffs when adding calm_emotions buff', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed'];
      if (key === 'activeBuffs') return [{ name: 'Blessing', effect: 'blessing' }];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    const patch = setRuntimeObject.mock.calls.find(call => call[0] === 'EnemyGoblin')[1];
    expect(patch.activeBuffs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Blessing' }),
      expect.objectContaining({ name: 'Calm Emotions' }),
    ]));
  });

  it('should track calm_emotions in targetEffects', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'EnemyGoblin',
          effect: 'calm_emotions',
          mode: 'immunity',
          source: 'TestWizard',
          suppressedConditions: ['charmed'],
          dc: 13,
          duration: 'concentration',
        }),
      ]),
      campaignName,
    );
  });

  it('should update existing calm_emotions targetEffect entry', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [
        {
          target: 'EnemyGoblin',
          effect: 'calm_emotions',
          mode: 'charmed',
          source: 'OldCaster',
        },
      ];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 15,
    });

    const targetEffectsCall = setRuntimeValue.mock.calls.find(
      call => call[1] === 'targetEffects',
    );
    const effects = targetEffectsCall[2];
    const calmEffect = effects.find(
      te => te.target === 'EnemyGoblin' && te.effect === 'calm_emotions',
    );
    expect(calmEffect.mode).toBe('immunity');
    expect(calmEffect.source).toBe('TestWizard');
    expect(calmEffect.dc).toBe(15);
  });

  it('should log with suppressed conditions when any are suppressed', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed', 'frightened'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'condition',
      action: 'applied',
      characterName: 'EnemyGoblin',
      condition: 'Calm Emotions (Suppressed: charmed, frightened)',
      reason: 'Calm Emotions spell',
      note: expect.stringContaining('suppressed'),
      timestamp: expect.any(Number),
    });
  });

  it('should log without suppressed conditions when none are suppressed', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['poisoned'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'condition',
      action: 'applied',
      characterName: 'EnemyGoblin',
      condition: 'Calm Emotions (Immune to Charmed/Frightened)',
      reason: 'Calm Emotions spell',
      note: expect.stringContaining('immune to Charmed and Frightened'),
      timestamp: expect.any(Number),
    });
  });

  it('should handle non-array activeConditions gracefully', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return 'charmed';
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    // Non-array activeConditions becomes [], filtered === conditions, so no
    // activeConditions key in the merged patch
    const patch = setRuntimeObject.mock.calls.find(call => call[0] === 'EnemyGoblin')[1];
    expect(patch).not.toHaveProperty('activeConditions');
  });

  it('should handle null targetEffects gracefully', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return ['charmed'];
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return null;
      return undefined;
    });

    await applyCalmEmotionsImmunity({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.any(Array),
      campaignName,
    );
  });
});

describe('calmEmotionsHandler - applyCalmEmotionsIndifferent (SP-020 B3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('registers the indifferent targetEffect with caster as source', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsIndifferent({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    const targetEffectsCall = setRuntimeValue.mock.calls.find(
      call => call[1] === 'targetEffects',
    );
    expect(targetEffectsCall).toBeDefined();
    const te = targetEffectsCall[2].find(
      e => e.target === 'EnemyGoblin' && e.effect === 'indifferent',
    );
    expect(te).toEqual(expect.objectContaining({
      target: 'EnemyGoblin',
      effect: 'indifferent',
      source: 'TestWizard',
      duration: 'concentration',
    }));
  });

  it('never writes the Charmed condition', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsIndifferent({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(setRuntimeObject).not.toHaveBeenCalled();
    const conditionWrites = setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeConditions',
    );
    expect(conditionWrites).toHaveLength(0);
  });

  it('logs the advisory with the ends-on-damage clause', async () => {
    getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'targetEffects') return [];
      return undefined;
    });

    await applyCalmEmotionsIndifferent({
      targetName: 'EnemyGoblin',
      casterName: 'TestWizard',
      campaignName,
      dc: 13,
    });

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'applied',
      characterName: 'EnemyGoblin',
      condition: 'Indifferent (Calm Emotions)',
      reason: 'Calm Emotions spell',
      note: expect.stringContaining('takes damage'),
      timestamp: expect.any(Number),
    }));
  });
});
