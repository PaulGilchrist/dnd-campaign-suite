import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => fullName || 'Unknown' },
}));

import { handle, resolvePolymorphMaxCR } from './polymorphHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(metaCtx = {}) {
  return {
    name: 'Polymorph',
    automation: { type: 'polymorph', saveType: 'WIS', saveDc: 15 },
    spell: { name: 'Polymorph', level: 4 },
    spellSlotLevel: 4,
    metaCtx,
  };
}

const baseCombatContext = {
  creatures: [
    { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [] },
    { name: casterName, type: 'player' },
  ],
};

function setupBaseMocks({ allies = [casterName], saveResult = { success: false }, existingEffects = [] } = {}) {
  getCombatContext.mockResolvedValue(baseCombatContext);
  getAllyList.mockReturnValue(allies);
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return existingEffects;
    return undefined;
  });
  createSaveListener.mockReturnValue({
    promptId: 'poly-prompt',
    promise: Promise.resolve(saveResult),
  });
}

describe('polymorphHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('uses default DC 15 when automation is absent', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getAllyList.mockReturnValue([]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'poly-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 6 }),
      });

      const actionWithoutAutomation = {
        name: 'Polymorph',
        spell: { name: 'Polymorph', level: 4 },
        spellSlotLevel: 4,
        metaCtx: { polymorphTarget: targetName },
      };

      const result = await handle(actionWithoutAutomation, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('polymorph_select');
    });
  });

  describe('target validation', () => {
    it('returns popup when no polymorphTarget provided', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when target not found in combat', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);

      const result = await handle(makeAction({ polymorphTarget: 'NonExistent' }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('not found');
    });

    it('returns popup when target is already polymorphed', async () => {
      setupBaseMocks({ existingEffects: [{ target: targetName, effect: 'polymorph', source: casterName }] });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('already polymorphed');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('handles addEntry rejection when target is already polymorphed', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [{ target: targetName, effect: 'polymorph', source: casterName }];
        return undefined;
      });
      addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('already polymorphed');
    });

    it('detects already polymorphed when target is an array', async () => {
      setupBaseMocks({ existingEffects: [{ target: [targetName, 'alt'], effect: 'polymorph', source: casterName }] });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('already polymorphed');
    });

    it('returns popup when target has 0 hit points', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 0, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('reads player HP from runtime store via getTargetCurrentHp', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'player', currentHp: 5, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === targetName && subKey === 'currentHitPoints') return 0;
        return undefined;
      });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
      expect(getRuntimeValue).toHaveBeenCalledWith(targetName, 'currentHitPoints', campaignName);
    });

    it('handles addEntry rejection when target has 0 hit points', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 0, maxHp: 7, traits: [] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);
      addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('0 hit points');
    });

    it('returns popup when target is a shapechanger', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [{ name: 'Shapechanger' }] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('shapechanger');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('detects shapechanger via type string', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'npc', monsterType: 'Shapechanger', currentHp: 5, maxHp: 7 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('shapechanger');
    });

    it('detects shapechanger via type string containing "shapechanger"', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'npc', monsterType: 'greater shapechanger', currentHp: 5, maxHp: 7 },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('shapechanger');
    });

    it('detects shapechanger via type_tags array', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, type_tags: ['shapechanger'] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('shapechanger');
    });

    it('handles addEntry rejection in shapechanger path', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, traits: [{ name: 'Shapechanger' }] },
          { name: casterName, type: 'player' },
        ],
      });
      getAllyList.mockReturnValue([casterName]);
      getRuntimeValue.mockImplementation(() => undefined);
      addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('shapechanger');
    });
  });

  describe('non-ally target save flow', () => {
    it('returns polymorph_select popup when target fails save', async () => {
      setupBaseMocks({ saveResult: { success: false, roll: 5, total: 6 } });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('polymorph_select');
      expect(result.payload.targetName).toBe(targetName);
      expect(result.payload.casterName).toBe(casterName);
      expect(result.payload.maxCR).toBeGreaterThan(0);
      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName, saveType: 'WIS', saveDc: 15 }),
      );
    });

    it('returns automation_info when target succeeds save', async () => {
      setupBaseMocks({ saveResult: { success: true, roll: 15, total: 20 } });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('resisted');
      expect(addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName, saveResult: 'success' }),
      );
    });

    it('handles null roll/total in save success with fallback defaults', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getAllyList.mockReturnValue([]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'poly-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName, saveResult: 'success', roll: 0, total: 0 }),
      );
    });

    it('passes metamagicHeighten as disadvantage', async () => {
      setupBaseMocks();

      await handle(makeAction({ polymorphTarget: targetName, metamagicHeighten: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ disadvantage: true }),
      );
    });

    it('logs save-polymorph result entries', async () => {
      setupBaseMocks({ saveResult: { success: false, roll: 5, total: 6 } });

      await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      const saveResultCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.rollType === 'save-polymorph');
      expect(saveResultCalls.length).toBeGreaterThan(0);
      expect(saveResultCalls.some(call => call[1].success === false)).toBe(true);
    });

    it('handles addEntry rejection in non-ally save prompt path', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getAllyList.mockReturnValue([]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'poly-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 6 }),
      });
      addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('polymorph_select');
    });

    it('handles addEntry rejection in save success path', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getAllyList.mockReturnValue([]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'poly-prompt',
        promise: Promise.resolve({ success: true, roll: 15, total: 20 }),
      });
      addEntry.mockRejectedValue(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('resisted');
    });

    it('handles addEntry rejection in save failure path', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      getAllyList.mockReturnValue([]);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'poly-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 6 }),
      });
      addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('log write failed'));

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('polymorph_select');
    });
  });

  describe('ally target', () => {
    it('skips the save and returns polymorph_select popup for allies', async () => {
      setupBaseMocks({ allies: [casterName, targetName] });

      const result = await handle(makeAction({ polymorphTarget: targetName }), makePlayerStats(), campaignName, null);

      expect(result.payload.type).toBe('polymorph_select');
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });
});

describe('polymorphHandler.resolvePolymorphMaxCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns player level for a matching PC', async () => {
    const characters = [{ name: targetName, computedStats: { level: 7 } }];

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(7);
  });

  it('falls back to creature level field for a PC', async () => {
    const characters = [{ name: targetName, level: 5 }];

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(5);
  });

  it('returns monster challenge rating for NPCs', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 3 });

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(3);
  });

  it('parses fractional challenge ratings', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: '1/2' });

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(0.5);
  });

  it('defaults to CR 1 for custom NPCs without a challenge rating', async () => {
    getMonsterData.mockResolvedValue(null);

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, []);

    expect(maxCR).toBe(1);
  });

  it('matches a PC by exact name', async () => {
    const characters = [{ name: 'Goblin the Brave', computedStats: { level: 9 } }];

    const maxCR = await resolvePolymorphMaxCR('Goblin the Brave', campaignName, characters);

    expect(maxCR).toBe(9);
  });

  it('skips PC with non-number level and falls through to monster lookup', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 2 });
    const characters = [{ name: targetName, computedStats: { level: 'invalid' } }];

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(2);
  });

  it('returns default CR 1 when PC has level 0 and monster has no CR', async () => {
    getMonsterData.mockResolvedValue(null);
    const characters = [{ name: targetName, computedStats: { level: 0 } }];

    const maxCR = await resolvePolymorphMaxCR(targetName, campaignName, characters);

    expect(maxCR).toBe(1);
  });
});
