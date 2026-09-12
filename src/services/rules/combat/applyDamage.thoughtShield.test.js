// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// CLA-361: Thought Shield handler tests. The old version of this file locked in the
// fake-write defect (mutating the fetched combatSummary copy with no persistence).
// These tests now require the reflect to flow through applyDamageToTarget (the
// verified consumer that writes cs.currentHp + hp_change) and a once-per-round latch.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from '../../automation/handlers/reactions/reactionDamageHandler.js';

// ── Mocks (hoisted by Vitest) ──────────────────────────────────

vi.mock('../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(() => 15),
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt' })),
}));

vi.mock('../../automation/common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../automation/common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../automation/common/polearmUtils.js', () => ({
  isPolearmWeapon: vi.fn(async () => true),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('./applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(async (cs, targetName, rawDamage) => {
    const creature = cs?.creatures?.find(c => c.name === targetName) || null;
    if (!creature) return null;
    const oldHp = creature.currentHp;
    const newHp = Math.max(0, oldHp - rawDamage);
    creature.currentHp = newHp;
    return { finalDamage: rawDamage, oldHp, newHp };
  }),
  computeDamageAfterSave: vi.fn((raw, saveSuccess) => (saveSuccess ? 0 : raw)),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 1),
}));

vi.mock('../../combat/baseCombatActions.js', () => ({
  MELEE_REACH_FEET: 5,
}));

vi.mock('./rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));

// ── Globals ─────────────────────────────────────────────────────

const { getCombatContext } = await import('./damageUtils.js');
const { applyDamageToTarget } = await import('./applyDamage.js');
const { addEntry } = await import('../../ui/logService.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

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

function tsAction() {
  return {
    name: 'Thought Shield',
    automation: {
      type: 'reaction_damage',
      trigger: 'psychic_damage_received',
      damageExpression: 'RAW damage',
      damageType: 'Psychic',
      range: '5_ft',
    },
  };
}

function expectRefused(result, fragment) {
  expect(result.type).toBe('popup');
  expect(result.payload.description).toContain(fragment);
  expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
    automationType: 'thought_shield_refused',
    characterName: 'Warlock',
  }));
}

// ── Tests ───────────────────────────────────────────────────────

describe('Thought Shield — manual reaction handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  describe('no Thought Shield feature', () => {
    it('returns popup saying feature is not available', async () => {
      const warlock = { name: 'Fighter', level: 10, characterAdvancement: [] };
      getCombatContext.mockResolvedValue(null);
      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('does not have Thought Shield');
    });
  });

  describe('no combat context', () => {
    it('returns popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat context available.');
    });
  });

  describe('no recent attack', () => {
    it('refuses with logged refusal when lastAttack is missing', async () => {
      getCombatContext.mockResolvedValue(makeCombatSummary([]));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'No recent attack found');
      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
  });

  describe('warlock was not the target', () => {
    it('refuses with logged refusal when another creature was targeted', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10 };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = { targetName: 'Goblin', damageTypes: ['Psychic'], actualDamage: 5, attackerName: 'Goblin' };
      getCombatContext.mockResolvedValue(makeCombatSummary([goblin, warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'You were not the target');
      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
  });

  describe('damage was not psychic', () => {
    it('refuses AND logs thought_shield_refused when damage type is not psychic', async () => {
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = { targetName: 'Warlock', damageTypes: ['Bludgeoning'], actualDamage: 5, attackerName: 'Thug 1' };
      getCombatContext.mockResolvedValue(makeCombatSummary([warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'not psychic damage');
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Warlock', '_Thought_Shield_usedRound', expect.anything(), 'TestCampaign');
    });
  });

  describe('no damage dealt (immune)', () => {
    it('refuses with logged refusal when both actualDamage and rawDamage are 0', async () => {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 0,
        rawDamage: 0,
        attackerName: 'Goblin',
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([goblin, warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'dealt no damage');
      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
  });

  describe('no attacker found', () => {
    it('refuses with logged refusal when attackerName is missing', async () => {
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: null,
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'No attacker found');
    });
  });

  describe('attacker not in combat', () => {
    it('refuses with logged refusal when attacker is not in creatures list', async () => {
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'MissingCreature',
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'not found in combat');
    });
  });

  describe('attacker already defeated', () => {
    it('refuses with logged refusal when attacker has 0 HP', async () => {
      const deadGoblin = { name: 'Goblin', type: 'monster', currentHp: 0 };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'Goblin',
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([deadGoblin, warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'already defeated');
      expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
  });

  describe('successful reflection — persisted via applyDamageToTarget', () => {
    function makeSuccessRig() {
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10, concentration: null };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'Goblin',
      };
      const cs = makeCombatSummary([goblin, warlockCreature], lastAttackData);
      getCombatContext.mockResolvedValue(cs);
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      return { cs, goblin, warlock: makeWarlock() };
    }

    it('routes the reflect through applyDamageToTarget with ignoreResistance and logs ability_use', async () => {
      const { goblin, warlock } = makeSuccessRig();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ round: 1 }), 'Goblin', 5, ['Psychic'], 'TestCampaign', expect.any(Array), { ignoreResistance: true, attackerName: 'Warlock' });
      expect(goblin.currentHp).toBe(5);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('reflects 5 psychic damage back to Goblin');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'Warlock',
        abilityName: 'Thought Shield',
      }));
    });

    it('stamps the once-per-round latch on the holder playerStats.name', async () => {
      const { warlock } = makeSuccessRig();

      await handle(tsAction(), warlock, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Warlock', '_Thought_Shield_usedRound', 1, 'TestCampaign');
    });

    it('refuses a refire on the same round with thought_shield_refused and applies nothing', async () => {
      const { goblin, warlock } = makeSuccessRig();
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'lastAttack') return {
          targetName: 'Goblin', damageTypes: ['Psychic'], actualDamage: 5, attackerName: 'Warlock',
        };
        if (key === 'Warlock' && prop === '_Thought_Shield_usedRound') return 1;
        return undefined;
      });

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'already used Thought Shield this round');
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(goblin.currentHp).toBe(10);
    });

    it('re-fires in a new round when the latch round is older', async () => {
      const { goblin, warlock } = makeSuccessRig();
      getCombatContext.mockResolvedValue({ ...makeCombatSummary([{ ...goblin }], {
        targetName: 'Warlock', damageTypes: ['Psychic'], actualDamage: 5, attackerName: 'Goblin',
      }), round: 2 });
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'lastAttack') return {
          targetName: 'Warlock', damageTypes: ['Psychic'], actualDamage: 5, attackerName: 'Goblin',
        };
        if (key === 'Warlock' && prop === '_Thought_Shield_usedRound') return 1;
        return undefined;
      });

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('reflects 5 psychic damage back to Goblin');
    });

    it('uses rawDamage as fallback when actualDamage is missing', async () => {
      const { warlock } = makeSuccessRig();
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack'
        ? { targetName: 'Warlock', damageTypes: ['Psychic'], rawDamage: 8, attackerName: 'Goblin' }
        : undefined));

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', 8, ['Psychic'], 'TestCampaign', expect.any(Array), { ignoreResistance: true, attackerName: 'Warlock' });
      expect(result.payload.description).toContain('reflects 8 psychic damage back to Goblin');
    });

    it('does not hand-roll the hp_change log or concentration mutation — owned by applyDamageToTarget', async () => {
      const { warlock } = makeSuccessRig();

      await handle(tsAction(), warlock, 'TestCampaign');

      const hpChangeCalls = addEntry.mock.calls.filter(([, entry]) => entry.type === 'hp_change');
      expect(hpChangeCalls).toHaveLength(0);
    });
  });

  describe('range gate', () => {
    it('refuses with logged refusal when attacker is out of the 5 ft range', async () => {
      const { isWithinRange } = await import('./rangeCheck.js');
      const goblin = { name: 'Goblin', type: 'monster', currentHp: 10, maxHp: 10 };
      const warlockCreature = { name: 'Warlock', type: 'player', currentHp: 20 };
      const lastAttackData = {
        targetName: 'Warlock',
        damageTypes: ['Psychic'],
        actualDamage: 5,
        attackerName: 'Goblin',
      };
      getCombatContext.mockResolvedValue(makeCombatSummary([goblin, warlockCreature], lastAttackData));
      getRuntimeValue.mockImplementation((key, prop) => (key === 'campaign' && prop === 'lastAttack' ? lastAttackData : undefined));
      isWithinRange.mockResolvedValue(false);
      const warlock = makeWarlock();

      const result = await handle(tsAction(), warlock, 'TestCampaign');

      expectRefused(result, 'not within 5 feet');
      expect(isWithinRange).toHaveBeenCalledWith('Goblin', 'Warlock', 5);
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      isWithinRange.mockResolvedValue(true);
    });
  });
});
