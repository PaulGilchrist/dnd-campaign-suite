// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fearHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Fear',
    automation: {
      type: 'fear',
      saveType: 'WIS',
      saveDc: 13,
      ...automation,
    },
  };
}

function makeCombatContext(creatures) {
  return {
    creatures,
    players: [{ name: casterName, gridX: 5, gridY: 10 }],
    placedItems: [],
  };
}

function failSaveListener() {
  return {
    promptId: 'fear-prompt',
    promise: Promise.resolve({ success: false }),
  };
}

function successSaveListener() {
  return {
    promptId: 'fear-prompt',
    promise: Promise.resolve({ success: true }),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('fearHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when no combat context exists', () => {
    it('returns a popup indicating no creatures in combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Fear has no effect');
    });
  });

  describe('when combat has no creatures', () => {
    it('returns a popup indicating no creatures in combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Fear has no effect');
    });
  });

  describe('target selection', () => {
    it('excludes the caster from targets', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'TestCaster', gridX: 5, gridY: 10 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Goblin',
      }));
    });

    it('targets all non-caster creatures in combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
        { name: 'TestCaster', gridX: 5, gridY: 10 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toContain('Goblin');
      expect(targetNames).toContain('Orc');
    });
  });

  describe('save prompt creation', () => {
    it('uses WIS save type and computed DC from buildSaveDc', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ saveDc: 15 });
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveType: 'WIS',
        saveDc: 15,
      }));
    });

    it('passes campaignName as the first argument to createSaveListener', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, 'MyCampaign', null);

      expect(createSaveListener).toHaveBeenCalledWith('MyCampaign', expect.any(Object));
    });
  });

  describe('log entries on cast', () => {
    it('posts an ability_use entry for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(2);
      const abilityEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'ability_use',
      );
      expect(abilityEntries.length).toBe(2);
    });

    it('includes the caster name, ability name, and target in the description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const abilityEntry = addEntry.mock.calls[0][1];
      expect(abilityEntry.type).toBe('ability_use');
      expect(abilityEntry.characterName).toBe(casterName);
      expect(abilityEntry.abilityName).toBe('Fear');
      expect(abilityEntry.description).toContain('Goblin');
      expect(abilityEntry.description).toContain('WIS save');
      expect(abilityEntry.description).toContain('DC 13');
    });
  });

  describe('on successful save', () => {
    it('posts a save_result entry', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      const saveResultEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'save_result',
      );
      expect(saveResultEntries.length).toBe(1);
      const entry = saveResultEntries[0][1];
      expect(entry.targetName).toBe('Goblin');
      expect(entry.success).toBe(true);
      expect(entry.saveType).toBe('WIS');
    });

    it('does not apply any conditions or log entries for the condition', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(postLogEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expect.any(Array), campaignName,
      );
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('on failed save', () => {
    it('applies the Frightened condition to the target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expect.arrayContaining(['frightened']), campaignName,
      );
    });

    it('deduplicates the Frightened condition if already present', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['frightened', 'Stunned']);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const conditionsArg = setRuntimeValue.mock.calls[0][2];
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'frightened').length).toBe(1);
    });

    it('posts a condition log entry with the correct details', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Frightened',
        reason: 'Fear spell',
      }));
    });

    it('registers an expiration for the condition', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        casterName, 'Goblin',
        expect.arrayContaining([expect.objectContaining({ condition: 'frightened' })]),
        campaignName,
        10,
      );
    });

    it('tracks a fear_end_on_los effect in targetEffects', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const effectCalls = setRuntimeValue.mock.calls.filter(
        call => call[1] === 'targetEffects',
      );
      expect(effectCalls.length).toBeGreaterThan(0);
      const effects = effectCalls[effectCalls.length - 1][2];
      const fearEffect = effects.find(e => e.effect === 'fear_end_on_los');
      expect(fearEffect).toBeDefined();
      expect(fearEffect.target).toBe('Goblin');
      expect(fearEffect.source).toBe(casterName);
      expect(fearEffect.duration).toBe('concentration');
    });
  });

  describe('summary popup', () => {
    it('reports affected creature count when some fail', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Fear affects 2 creature(s)');
    });

    it('reports saved creature count in the summary', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: 'fear-prompt',
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('reports no creatures affected when all save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('No creatures affected by Fear');
    });

    it('mentions repeat save on line of sight loss', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('repeat the save');
      expect(result.payload.description).toContain('line of sight');
    });

    it('uses the action name in the popup payload', async () => {
      const ps = makePlayerStats();
      const action = { name: 'Terror', automation: { type: 'fear', saveType: 'WIS', saveDc: 13 } };
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.name).toBe('Terror');
    });
  });

  describe('edge cases', () => {
    it('handles undefined campaignName in no-combat case', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, null, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('handles single non-caster target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
        { name: 'TestCaster', gridX: 5, gridY: 10 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Fear affects 1 creature(s)');
    });

    it('handles all creatures being the caster (no enemies)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'TestCaster', gridX: 5, gridY: 10 },
      ]);
      getCombatContext.mockResolvedValue(ctx);

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected by Fear');
    });

    it('handles zero proficiency on player stats', async () => {
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });
  });
});
