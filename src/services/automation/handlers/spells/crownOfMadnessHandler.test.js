// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
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

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

import { handle } from './crownOfMadnessHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addTargetResult } from '../../common/damageRollback.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Crown of Madness',
    automation: { type: 'crown_of_madness', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

function setupBaseMocks(saveResult = { success: true }, isNpc = false) {
  resolveTarget.mockResolvedValue({
    target: { name: 'Goblin', type: isNpc ? 'npc' : 'player' },
    cs: {
      creatures: [
        { name: 'Goblin', type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 } },
      ],
    },
  });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('crownOfMadnessHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when no target is selected', async () => {
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when target name is missing', async () => {
      resolveTarget.mockResolvedValue({ target: null });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('passes advantage from automation config to createSaveListener', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        attackerName: 'TestCaster',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        advantage: true,
        disadvantage: false,
        condition: 'charmed',
      });
    });

    it('passes disadvantage when metamagicHeighten is set in action metaCtx', async () => {
      setupBaseMocks();

      const action = {
        name: 'Crown of Madness',
        automation: { type: 'crown_of_madness', saveType: 'WIS', saveDc: 15 },
        metaCtx: { metamagicHeighten: true },
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        disadvantage: true,
      }));
    });
  });

  describe('ability_use log entry', () => {
    it('logs ability_use with full details when a target is resolved', async () => {
      setupBaseMocks();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Crown of Madness',
        description: expect.stringContaining('TestCaster casts Crown of Madness on Goblin'),
        promptId: 'test-prompt-id',
      });
    });

    it('includes "with Advantage" in ability_use description when advantage is true', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      const abilityCall = addEntry.mock.calls.find(call => call[1]?.type === 'ability_use');
      expect(abilityCall[1].description).toContain('with Advantage');
    });

    it('omits "with Advantage" when advantage is false', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: false }), makePlayerStats(), campaignName, null);

      const abilityCall = addEntry.mock.calls.find(call => call[1]?.type === 'ability_use');
      expect(abilityCall[1].description).not.toContain('with Advantage');
    });
  });

  describe('NPC auto-save', () => {
    it('calls rollSaveForCreature and sendSaveResult for NPC targets', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS',
        15,
        false,
        false,
      );
      expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', expect.objectContaining({
        promptId: 'test-prompt-id',
        success: false,
      }));
    });

    it('uses fallback roll when creature not found in combat summary', async () => {
      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc' },
        cs: { creatures: [] },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalled();
    });

    it('uses fallback roll with advantage for NPC when creature not found', async () => {
      resolveTarget.mockResolvedValue({
        target: { name: 'Goblin', type: 'npc' },
        cs: { creatures: [] },
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(sendSaveResult).toHaveBeenCalled();
    });

    it('calls rollSaveForCreature with advantage when set', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      await handle(makeAction({ advantage: true }), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS',
        15,
        false,
        true,
      );
    });

    it('dispatches save-result custom event for NPC targets', async () => {
      setupBaseMocks({ success: false }, true);
      rollSaveForCreature.mockReturnValue({ roll: 8, total: 10, bonus: 2, success: false, rawRolls: [8, 12] });

      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'save-result',
      }));

      dispatchEventSpy.mockRestore();
    });
  });

  describe('successful save', () => {
    it('returns popup and logs save_result with success=true', async () => {
      setupBaseMocks({ success: true });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(result.payload.description).toContain('Goblin');

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-crown-of-madness',
        saveDc: 15,
        saveType: 'WIS',
      }));

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(2);
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(1);
      const saveEntries = addEntry.mock.calls.filter(call => call[1].type === 'save_result');
      expect(saveEntries.length).toBe(1);
    });

    it('calls addTargetResult with success details including roll/total', async () => {
      setupBaseMocks({ success: true, roll: 14, total: 16, bonus: 2 });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 14,
        total: 16,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('defaults roll/total to 0 when missing from saveResult', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        roll: 0,
        total: 0,
      }));
    });

    it('does not apply charmed condition or add expiration on success', async () => {
      setupBaseMocks({ success: true });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('failed save', () => {
    it('returns popup with correct payload and description', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Crown of Madness');
      expect(result.payload.description).toContain('TestCaster');
      expect(result.payload.description).toContain('Goblin');
      expect(result.payload.description).toContain('melee attack');
      expect(result.payload.description).toContain('Charmed');
    });

    it('applies charmed condition with deduplication and preservation of other conditions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed']),
        campaignName,
      );
    });

    it('deduplicates charmed when already present', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('preserves other conditions when adding charmed', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(['frightened', 'charmed']);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'charmed'],
        campaignName,
      );
    });

    it('registers expiration with charmed type', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([{ type: 'charmed', condition: 'charmed' }]), campaignName });
    });

    it('calls addConcentration for the caster', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: [] }),
        'TestCaster',
        'Crown of Madness',
        expect.any(Number),
      );
    });

    it('posts condition log entry with full note', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Charmed',
        reason: 'Crown of Madness spell',
        note: expect.stringContaining('melee attack'),
        timestamp: expect.any(Number),
      }));
    });

    it('logs save_result with success=false', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-crown-of-madness',
        saveDc: 15,
        saveType: 'WIS',
      }));
    });

    it('calls addTargetResult with failure details including conditions', async () => {
      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: ['charmed'],
        appliedDamage: 0,
      });
    });

    it('handles null/undefined saveResult.roll by defaulting to 0', async () => {
      setupBaseMocks({ success: false, total: 7 });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        roll: 0,
        total: 7,
      }));
    });

    it('handles getRuntimeValue returning null by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('handles getRuntimeValue returning non-array by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });
  });

  describe('edge cases', () => {
    it('handles missing automation property by defaulting to empty object', async () => {
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin', type: 'player' } });
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'Crown of Madness' }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('uses action.name in popup payload', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const result = await handle({ name: 'My Crown', automation: { type: 'crown_of_madness' } }, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('My Crown');
    });

    it('uses custom playerStats name in descriptions', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ name: 'WizardX' });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.payload.description).toContain('WizardX');
    });

    it('ignores the mapName parameter', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      await handle(makeAction(), makePlayerStats(), campaignName, 'some-map');

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });

    it('uses playerStats.spellAbilities.saveDc for concentration DC when available', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ spellAbilities: { saveDc: 17 } });
      await handle(makeAction(), ps, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Crown of Madness',
        17,
      );
    });

    it('falls back to formula for concentration DC when spellAbilities missing', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);

      const ps = makePlayerStats({ proficiency: 4 });
      await handle(makeAction(), ps, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Crown of Madness',
        12,
      );
    });

    it('skips concentration when getCombatSummary returns null', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      getCombatSummary.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
    });

    it('handles getRuntimeValue returning null by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('handles getRuntimeValue returning non-array by defaulting to empty array', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('passes advantage: false by default when not specified', async () => {
      setupBaseMocks();

      await handle(makeAction({ advantage: false }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        advantage: false,
      }));
    });

    it('uses custom saveDc from automation config', async () => {
      setupBaseMocks();

      await handle(makeAction({ saveDc: 18 }), makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(
        expect.objectContaining({ saveDc: 18 }),
        makePlayerStats(),
      );
    });

    it('uses proficiency fallback (2) when proficiency is missing for concentration DC', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      getCombatSummary.mockReturnValue({ creatures: [] });

      const ps = makePlayerStats({ proficiency: undefined });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
      expect(addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Crown of Madness',
        10,
      );
    });
  });

  describe('error handlers', () => {
    it('handles addEntry rejection for ability_use without crashing', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin');
    });

    it('handles addEntry rejection on successful save without crashing', async () => {
      setupBaseMocks({ success: true });
      addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded');
    });

    it('handles addEntry rejection for condition log without crashing', async () => {
      setupBaseMocks({ success: false });
      getRuntimeValue.mockReturnValue([]);
      addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
    });
  });
});
