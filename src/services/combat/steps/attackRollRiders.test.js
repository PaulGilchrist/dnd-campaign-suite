// @improved-by-ai
// Regression tests for CLA-188: Cunning Strike rider pause + once-per-turn tracking.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, creatures: [] })),
  getTargetFromAttacker: vi.fn(() => ({ name: 'Animated Rug of Smothering 1' })),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
  executeAttackRiderManeuver: vi.fn(),
}));

vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({
  sendBardicInspirationOffensePrompt: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));

vi.mock('../../automation/common/resourceCheck.js', () => ({
  spendResource: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

import { buildCunningStrikeStep, buildChargerStep } from './attackRollRiders.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

const csPassive = { name: 'Devious Strikes', type: 'attack_rider' };

const chargerPassive = {
  name: 'Charge Attack',
  type: 'attack_rider',
  trigger: 'melee_hit_after_10ft_charge',
  chooseOne: true,
  oncePerTurn: true,
  options: [
    { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
    { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
  ],
};

function makeCtx(overrides = {}) {
  return {
    hit: true,
    attack: { name: 'Shortsword', damage: '1d6+2', damageType: 'Piercing' },
    playerStats: {
      name: 'AasimarTest',
      level: 14,
      automation: { actions: [], passives: [csPassive] },
    },
    campaignName: 'test-campaign',
    mapName: null,
    buildCtxSync: vi.fn(() => Promise.resolve({ sneakAttackDice: 7 })),
    setAttackRiderModal: vi.fn(),
    ...overrides,
  };
}

function runtimeValues(values = {}) {
  getRuntimeValue.mockImplementation((key, prop) => values[prop] ?? null);
}

describe('buildCunningStrikeStep (CLA-188)', () => {
  let step;

  beforeEach(() => {
    vi.clearAllMocks();
    step = buildCunningStrikeStep();
    getCurrentCombatRound.mockReturnValue(1);
    runtimeValues({ lastAttack: { hit: true } });
  });

  it('does not run when the attack missed', async () => {
    const ctx = makeCtx({ hit: false });
    expect(step.condition(ctx)).toBe(false);
  });

  it('pauses with a cunningStrike modal on a hit with sneak dice available', async () => {
    const ctx = makeCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeDefined();
    expect(result.modal.type).toBe('cunningStrike');
    expect(result.modal.props.targetName).toBe('Animated Rug of Smothering 1');
    expect(result.data).toEqual({ _cunningStrike: true, sneakDice: 7 });
    expect(ctx.setAttackRiderModal).toHaveBeenCalled();
    expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
  });

  it('suppresses the modal when _CunningStrike_usedRound is object-form for the same round', async () => {
    runtimeValues({
      lastAttack: { hit: true },
      _CunningStrike_usedRound: { round: 1, activeCreature: 'AasimarTest' },
    });
    const ctx = makeCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
    expect(result.data).toEqual({ sneakDice: 7 });
  });

  it('suppresses the modal when _CunningStrike_usedRound is legacy number-form for the same round', async () => {
    runtimeValues({ lastAttack: { hit: true }, _CunningStrike_usedRound: 1 });
    const ctx = makeCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('suppresses the modal when skipped for the current round (object-form)', async () => {
    runtimeValues({
      lastAttack: { hit: true },
      _cunningStrikeSkippedRound: { round: 1, activeCreature: 'AasimarTest' },
    });
    const ctx = makeCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('re-offers the modal when the feature was used in an earlier round', async () => {
    runtimeValues({
      lastAttack: { hit: true },
      _CunningStrike_usedRound: { round: 1, activeCreature: 'AasimarTest' },
    });
    getCurrentCombatRound.mockReturnValue(2);
    const ctx = makeCtx();
    const result = await step.handler(ctx);
    expect(result.modal?.type).toBe('cunningStrike');
  });

  it('does not prompt without a cunning strike passive', async () => {
    const ctx = makeCtx({
      playerStats: { name: 'AasimarTest', level: 14, automation: { actions: [], passives: [] } },
    });
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('does not prompt when sneak dice are unavailable', async () => {
    const ctx = makeCtx({ buildCtxSync: vi.fn(() => Promise.resolve({ sneakAttackDice: 0 })) });
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });
});

describe('buildChargerStep (FT-022/023)', () => {
  let step;

  function chargerCtx(overrides = {}) {
    return makeCtx({
      attack: { name: 'Glaive', damage: '1d10+4', damageType: 'Slashing', weaponType: 'melee' },
      playerStats: {
        name: 'AasimarTest',
        level: 8,
        automation: { actions: [], passives: [chargerPassive] },
      },
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    step = buildChargerStep();
    getCurrentCombatRound.mockReturnValue(1);
    runtimeValues({ lastAttack: { hit: true, attackerName: 'AasimarTest' } });
  });

  it('does not run when the attack missed', () => {
    expect(step.condition(chargerCtx({ hit: false }))).toBe(false);
  });

  it('does not run for ranged attacks', () => {
    expect(step.condition(chargerCtx({ attack: { weaponType: 'ranged' } }))).toBe(false);
  });

  it('pauses with a charger modal on a melee hit', async () => {
    const ctx = chargerCtx();
    const result = await step.handler(ctx);
    expect(result.modal?.type).toBe('charger');
    expect(result.modal?.props.action).toBe(chargerPassive);
    expect(result.modal?.props.targetName).toBe('Animated Rug of Smothering 1');
    expect(result.data).toEqual({ _charger: true });
    expect(ctx.setAttackRiderModal).toHaveBeenCalled();
  });

  it('does not prompt without a charger passive', async () => {
    const ctx = chargerCtx({
      playerStats: { name: 'AasimarTest', level: 8, automation: { actions: [], passives: [] } },
    });
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
    expect(result.data).toEqual({});
  });

  it('does not prompt when lastAttack is from another attacker', async () => {
    runtimeValues({ lastAttack: { hit: true, attackerName: 'Goblin' } });
    const ctx = chargerCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('does not prompt when lastAttack missed', async () => {
    runtimeValues({ lastAttack: { hit: false, attackerName: 'AasimarTest' } });
    const ctx = chargerCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('suppresses the modal when already used this round', async () => {
    runtimeValues({
      lastAttack: { hit: true, attackerName: 'AasimarTest' },
      _Charge_Attack_usedRound: { round: 1, activeCreature: 'AasimarTest' },
    });
    const ctx = chargerCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('suppresses the modal when skipped this round', async () => {
    runtimeValues({
      lastAttack: { hit: true, attackerName: 'AasimarTest' },
      _Charge_Attack_skippedRound: { round: 1, activeCreature: 'AasimarTest' },
    });
    const ctx = chargerCtx();
    const result = await step.handler(ctx);
    expect(result.modal).toBeUndefined();
  });

  it('re-offers the modal in a later round', async () => {
    runtimeValues({
      lastAttack: { hit: true, attackerName: 'AasimarTest' },
      _Charge_Attack_usedRound: { round: 1, activeCreature: 'AasimarTest' },
    });
    getCombatContext.mockResolvedValue({ round: 2, creatures: [] });
    const ctx = chargerCtx();
    const result = await step.handler(ctx);
    expect(result.modal?.type).toBe('charger');
  });
});
