import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
  rollbackSpellEffects: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './counterSpellHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

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
    name: 'Counterspell',
    automation: {
      type: 'counterspell',
      saveType: 'CON',
      ...automation,
    },
  };
}

function makeCombatContext(overrides = {}) {
  return {
    creatures: [
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    placedItems: [],
    ...overrides,
  };
}

function makeLastAttack(overrides = {}) {
  return {
    attackEvent: {
      attackerName: 'Goblin',
      targetName: 'TestCaster',
      damageFormula: '3d6',
      damageName: 'Fire Bolt',
      attackName: 'Fire Bolt',
      saveType: null,
      ...overrides.attackEvent,
    },
    attackerName: 'Goblin',
    targetName: 'TestCaster',
    primaryDamage: 9,
    secondaryDamage: 0,
    totalDamage: 9,
    damageTypes: ['Fire'],
    statusEffects: null,
    affectedTargets: ['TestCaster'],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('counterSpellHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('should return popup when no combat context exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('requires an active combat');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should return popup when no lastAttack exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('No recent attack to counter');
    });

    it('should return popup when no spell detected in lastAttack', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          hit: true,
          // No spell indicators
        },
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('No spell detected');
    });

    it('should return popup when no attacker in lastAttack', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fire Bolt',
        },
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('Could not identify the spellcaster');
    });

    it('should return popup when attacker not in combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          attackerName: 'Wizard',
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fire Bolt',
        },
      }));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Counterspell');
      expect(result.payload.description).toContain('Wizard is not in combat');
    });
  });

  describe('spell detection', () => {
    it('should detect spell by damageFormula', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fire Bolt',
        },
      }));
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-1' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Goblin');
      expect(result.payload.description).toContain("is being countered");
      expect(result.payload.description).toContain('CON saving throw');
      expect(result.payload.description).toContain('DC 15');
    });

    it('should detect spell by attackName', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          attackName: 'Eldritch Blast',
          hit: true,
        },
      }));
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-2' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('should detect spell by spellName', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          attackName: 'Ray of Frost',
        },
      }));
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-3' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('should detect spell by saveType', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          saveType: 'CON',
          saveDc: 13,
        },
      }));
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Goblin');
    });
  });

  describe('save prompt', () => {
    it('should create CON save prompt on attacker', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-5' });

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        disadvantage: false,
      });
    });

    it('should support metamagicHeighten disadvantage', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), metaCtx: { metamagicHeighten: true } };

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-6' });

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        disadvantage: true,
      });
    });

    it('should log ability_use entry with spell name', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'test-prompt-7' });

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: expect.stringContaining("Countering Goblin's 'Fire Bolt'"),
        promptId: 'test-prompt-7',
      });
    });
  });

  describe('feature name', () => {
    it('should use action.name when provided', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), name: 'Heightened Counterspell' };

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'custom-name-prompt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Heightened Counterspell');
      expect(result.payload.description).toContain("is being countered");
    });

    it('should use default name when action.name is falsy', async () => {
      const ps = makePlayerStats();
      const action = { ...makeAction(), name: null };

      getCombatContext.mockResolvedValue(makeCombatContext());
      findLastAttack.mockResolvedValue(makeLastAttack());
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({ promptId: 'default-name-prompt' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Counterspell');
    });
  });
});
