// @maintained-by-ai
// CLA-361: Thought Shield ("Whenever a creature deals Psychic damage to you, that
// creature takes the same amount of damage that you take") — handler-seam tests.
// The old version of this file locked in the fake-write defect (mutating the fetched
// combatSummary copy with no persistence); these tests require the reflect to route
// through applyDamageToTarget (the verified consumer that writes hp + hp_change) and
// enforce the once-per-round round latch. Guard-falsifier discipline: every refusal
// proves the shield stays silent AND spends nothing (no apply, no latch stamp);
// success + stale-latch prove it fires with exact persisted bytes.
// Generic damage arithmetic and HP bookkeeping are owned by applyDamage.helpers.test.js
// and applyDamage.test.js — applyDamageToTarget is fully mocked here, so only the
// handler's own gate/reflect/latch/log lane is exercised.
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
    return { finalDamage: rawDamage, oldHp: creature.currentHp, newHp: Math.max(0, creature.currentHp - rawDamage) };
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
const { isWithinRange } = await import('./rangeCheck.js');

// ── Helpers ─────────────────────────────────────────────────────

// Runtime-store stub keyed `${name}.${key}` (deterministic per test, no stale
// implementations leaking between cases).
function stubRuntime(map) {
  getRuntimeValue.mockImplementation((name, key) => map[`${name}.${key}`]);
}

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

// Canonical passing trigger: Goblin hits Warlock for 5 psychic.
const VALID_LAST_ATTACK = {
  targetName: 'Warlock',
  damageTypes: ['Psychic'],
  actualDamage: 5,
  attackerName: 'Goblin',
};

// Fresh combat context: live goblin (10 HP), Warlock player row, range open.
function makeCs({ round = 1, lastAttack = VALID_LAST_ATTACK, goblinHp = 10, withinRange = true } = {}) {
  const cs = {
    round,
    creatures: [
      { name: 'Goblin', type: 'monster', currentHp: goblinHp, maxHp: 10, concentration: null },
      { name: 'Warlock', type: 'player', currentHp: 20 },
    ],
    lastAttack,
  };
  getCombatContext.mockResolvedValue(cs);
  isWithinRange.mockResolvedValue(withinRange);
  stubRuntime({ 'campaign.lastAttack': lastAttack });
  return cs;
}

// ── Tests ───────────────────────────────────────────────────────

describe('Thought Shield — manual reaction handler (CLA-361)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRuntime({});
  });

  it('popup-only early gates: refuses non-holders even with live combat, then no-combat-context', async () => {
    makeCs(); // combat IS available — proves the feature gate fires independently of state
    const fighter = { name: 'Fighter', level: 10, characterAdvancement: [] };

    const noFeature = await handle(tsAction(), fighter, 'TestCampaign');
    expect(noFeature.type).toBe('popup');
    expect(noFeature.payload.description).toContain('does not have Thought Shield');

    getCombatContext.mockResolvedValue(null);
    const noContext = await handle(tsAction(), makeWarlock(), 'TestCampaign');
    expect(noContext.type).toBe('popup');
    expect(noContext.payload.description).toBe('No combat context available.');

    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // Every gate refusal: refusal popup with the gate's message fragment, a logged
  // thought_shield_refused row (CLA-337 shape), and ZERO spend — no reflect, no
  // latch stamp (the stamp only happens after all gates pass).
  describe('gate refusals — log thought_shield_refused, spend nothing', () => {
    const REFUSALS = [
      {
        title: 'no recent attack',
        lastAttack: null,
        fragment: 'No recent attack found',
      },
      {
        // Post-reflect the persisted lastAttack shows the holder as attacker
        // (CLA-337 caveat) — the round latch must beat the identity gates.
        title: 'reaction already spent this round',
        lastAttack: { targetName: 'Goblin', damageTypes: ['Psychic'], actualDamage: 5, attackerName: 'Warlock' },
        latchRound: 1,
        fragment: 'already used Thought Shield this round',
      },
      {
        title: 'holder was not the target',
        lastAttack: { ...VALID_LAST_ATTACK, targetName: 'Goblin' },
        fragment: 'You were not the target',
      },
      {
        title: 'damage was not psychic',
        lastAttack: { ...VALID_LAST_ATTACK, damageTypes: ['Bludgeoning'] },
        fragment: 'not psychic damage',
      },
      {
        title: 'attacker dealt zero damage (immune)',
        lastAttack: { ...VALID_LAST_ATTACK, actualDamage: 0, rawDamage: 0 },
        fragment: 'dealt no damage',
      },
      {
        title: 'no attacker identity on lastAttack',
        lastAttack: { ...VALID_LAST_ATTACK, attackerName: null },
        fragment: 'No attacker found',
      },
      {
        title: 'attacker not in combat',
        lastAttack: { ...VALID_LAST_ATTACK, attackerName: 'MissingCreature' },
        fragment: 'not found in combat',
      },
      {
        title: 'attacker already defeated',
        lastAttack: VALID_LAST_ATTACK,
        goblinHp: 0,
        fragment: 'already defeated',
      },
      {
        title: 'attacker outside the 5 ft range',
        lastAttack: VALID_LAST_ATTACK,
        withinRange: false,
        fragment: 'not within 5 feet',
      },
    ];

    it.each(REFUSALS)('refuses when $title', async ({ lastAttack, latchRound, goblinHp, withinRange, fragment }) => {
      makeCs({ lastAttack, goblinHp, withinRange });
      if (latchRound !== undefined) {
        stubRuntime({ 'campaign.lastAttack': lastAttack, 'Warlock._Thought_Shield_usedRound': latchRound });
      }

      const result = await handle(tsAction(), makeWarlock(), 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain(fragment);
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'automation',
        automationType: 'thought_shield_refused',
        characterName: 'Warlock',
      }));
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      if (withinRange === false) {
        // Range span must come from the feature's declared 5_ft, not a hardcoded guess.
        expect(isWithinRange).toHaveBeenCalledWith('Goblin', 'Warlock', 5);
      }
    });
  });

  describe('successful reflection — persisted via applyDamageToTarget', () => {
    it('routes the reflect with exact bytes: ignoreResistance, player-only characters, latch stamped, ability_use logged, no hand-rolled hp_change', async () => {
      const cs = makeCs();

      const result = await handle(tsAction(), makeWarlock(), 'TestCampaign');

      // "Same amount" RAW: post-resistance damage reflected unmodified (ignoreResistance).
      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Goblin', 5, ['Psychic'], {
        campaignName: 'TestCampaign',
        characters: cs.creatures.filter(c => c.type === 'player'),
        ignoreResistance: true,
        attackerName: 'Warlock',
      });
      // Once-per-round latch on the holder's playerStats.name, round from the fresh cs.
      expect(setRuntimeValue).toHaveBeenCalledWith('Warlock', '_Thought_Shield_usedRound', 1, 'TestCampaign');

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('reflects 5 psychic damage back to Goblin');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'Warlock',
        abilityName: 'Thought Shield',
        description: 'Warlock reflects 5 psychic damage back to Goblin using Thought Shield (Goblin at 5 HP).',
      }));
      // hp_change rows + concentration DC are applyDamageToTarget's job, never re-rolled here.
      expect(addEntry.mock.calls.filter(([, entry]) => entry.type === 'hp_change')).toHaveLength(0);
    });

    it('re-fires and re-stamps the latch when the stamped round is older than the current round', async () => {
      const cs = makeCs({ round: 2 });
      stubRuntime({ 'campaign.lastAttack': VALID_LAST_ATTACK, 'Warlock._Thought_Shield_usedRound': 1 });

      const result = await handle(tsAction(), makeWarlock(), 'TestCampaign');

      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Goblin', 5, ['Psychic'], expect.objectContaining({ ignoreResistance: true }));
      expect(setRuntimeValue).toHaveBeenCalledWith('Warlock', '_Thought_Shield_usedRound', 2, 'TestCampaign');
      expect(result.payload.description).toContain('reflects 5 psychic damage back to Goblin');
    });

    it('reflects rawDamage as fallback when actualDamage is missing', async () => {
      const cs = makeCs();
      stubRuntime({ 'campaign.lastAttack': { ...VALID_LAST_ATTACK, actualDamage: undefined, rawDamage: 8 } });

      const result = await handle(tsAction(), makeWarlock(), 'TestCampaign');

      expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Goblin', 8, ['Psychic'], expect.objectContaining({ ignoreResistance: true, attackerName: 'Warlock' }));
      expect(result.payload.description).toContain('reflects 8 psychic damage back to Goblin');
    });
  });
});
