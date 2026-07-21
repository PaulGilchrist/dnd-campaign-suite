// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from '../../automation/handlers/reactions/reactionDamageHandler.js';

// ── Mocks (hoisted by Vitest) ──────────────────────────────────

vi.mock('../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(() => 15),
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt' })),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// The handler imports damageUtils from its own directory perspective.
// We need to also mock the path as resolved from the handler's location.
vi.mock('../../automation/handlers/../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Globals ─────────────────────────────────────────────────────

const { getCombatContext } = await import('./damageUtils.js');
const { addEntry } = await import('../../ui/logService.js');
const { buildSaveDc } = await import('../../automation/common/savePrompt.js');

// ── Helpers ─────────────────────────────────────────────────────

function makeWarlock(name = 'Warlock') {
  return {
    name,
    level: 10,
    characterAdvancement: [{ name: 'Thought Shield' }],
    attacks: [{
      name: 'Quarterstaff',
      type: 'Action',
      range: '5_ft',
      hitBonus: 7,
      damage: '1d6+1',
      damageType: 'Bludgeoning',
    }],
    inventory: { equipped: [] },
    equipment: [],
  };
}

function makeCombatSummary(creatures, lastAttack = null) {
  return { round: 1, creatures, lastAttack };
}

// ── Tests ───────────────────────────────────────────────────────

describe('Thought Shield — manual reaction handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(15);
  });

  describe('no Thought Shield feature', () => {
    it('returns popup saying feature is not available', async () => {
      const warlock = { name: 'Fighter', level: 10, characterAdvancement: [] };
      getCombatContext.mockResolvedValue(null);
      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('does not have Thought Shield');
    });
  });

  describe('no combat context', () => {
    it('returns popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat context available.');
    });
  });

  describe('no recent attack', () => {
    it('returns popup when lastAttack is missing', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([]));
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent attack found');
    });
  });

  describe('warlock was not the target', () => {
    it('returns popup when another creature was targeted', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10 };
      const cs = makeCombatSummary([goblin], { targetName: 'Goblin', damageTypes: ['Psychic'] });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('You were not the target');
    });
  });

  describe('damage was not psychic', () => {
    it('returns popup when damage type is not psychic', async () => {
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Fire'],
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not psychic damage');
    });
  });

  describe('no damage dealt (immune/resistant)', () => {
    it('returns popup when actualDamage is 0', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([goblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 0,
        rawDamage: 10,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('reflects 10 psychic damage');
    });
  });

  describe('no attacker found', () => {
    it('returns popup when attackerName is missing', async () => {
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: null,
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No attacker found to reflect damage to.');
    });
  });

  describe('attacker not in combat', () => {
    it('returns popup when attacker is not in creatures list', async () => {
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'MissingCreature',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not found in combat');
    });
  });

  describe('attacker already defeated', () => {
    it('returns popup when attacker has 0 HP', async () => {
      const deadGoblin = { name: 'Goblin', type: 'monster', currentHp: 0 };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([deadGoblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already defeated');
    });
  });

  describe('successful reflection', () => {
    it('reflects damage back to attacker and logs it', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10, concentration: null };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([goblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(goblin.currentHp).toBe(5);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('reflects 5 psychic damage back to Goblin');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'hp_change',
        targetName: 'Goblin',
        delta: -5,
        abilityName: 'Thought Shield',
      }));
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'Warlock',
        abilityName: 'Thought Shield',
      }));
    });

    it('uses rawDamage as fallback when actualDamage is missing', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10, concentration: null };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([goblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        rawDamage: 8,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(goblin.currentHp).toBe(2);
      expect(result.payload.description).toContain('reflects 8 psychic damage back to Goblin');
    });

    it('updates attacker concentration DC when reflected', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10, concentration: { spell: 'Burning Hands', dc: 5 } };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([goblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 10,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(goblin.concentration.dc).toBe(10);
    });

    it('does not update concentration when attacker has none', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10, concentration: null };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([goblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(goblin.concentration).toBeNull();
    });

    it('clamps reflected damage to 0 minimum HP', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 3, maxHp: 10, concentration: null };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const cs = makeCombatSummary([goblin, warlockCreature], {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 10,
        attackerName: 'Goblin',
      });
      getCombatContext.mockResolvedValue(cs);
      const warlock = makeWarlock();

      const result = await handle({ name: 'Thought Shield', automation: { trigger: 'psychic_damage_received' } }, warlock, 'TestCampaign');

      expect(goblin.currentHp).toBe(0);
      expect(result.payload.description).toContain('reflects 10 psychic damage back to Goblin');
    });
  });
});
