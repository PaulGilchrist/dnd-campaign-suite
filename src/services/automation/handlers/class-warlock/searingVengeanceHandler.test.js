// @maintained-by-ai 2026-11-26
// SEARING VENGEANCE HANDLE/SKIP LANE (quad file 3/4). Canonical home of:
// - handle() routing truth tables, each full-shape pinned: exhausted-uses popup,
//   no-combat popup (the handle() twin — ConfirmPath owns the at-confirm one),
//   0-HP gate table (alive / dead-flagged / out-of-range → popup, no use consumed),
//   and the scan gate's caster-sourced range calls (strict (source,target) pairs).
// - modal-open payload: full-shape toEqual of the whole result (NPC heal target,
//   warlock + healed-target burst exclusion, out-of-range burst creature dropped).
// - RAW self-inclusion: the warlock at 0 HP is a valid heal target and is excluded
//   from its own burst (the max-HP placeholder math is heal-lane canonical).
// - addExpiration full-args pin at confirm (ConfirmPath pins counts only) and the
//   ability_use summary-log composition (handler :215-220) — pinned nowhere else.
// - skip/refusal flow: declined reaction — full-shape popup + log, zero side effects.
// NOT here (sibling-owned): confirm guards, uses/blinded ordered census, CHA
// resolution table, popup full-string composition (ConfirmPath); getRealMaxHp
// runtime-truth, source-keyed burst-center gate, real-applyHealingToTarget leg
// (searingVengeance.heal.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollExpression: vi.fn() }
});

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => ({ actualHeal: 25, oldHp: 0, newHp: 25, maxHp: 50 })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

import { handle, confirmSearingVengeance, skipSearingVengeance } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 14,
    hitPoints: { max: 70 },
    currentHitPoints: 50,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Searing Vengeance',
    automation: {
      healExpression: 'floor(target_max_hp / 2)',
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      range: '30_ft',
      condition: 'blinded',
      conditionDuration: 'until_end_of_current_turn',
      uses: 1,
      usesMax: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction',
      trigger: 'death_save_by_ally_or_self',
      allyRange: '60_ft',
      ...automation,
    },
  };
}

function mockRuntimeValues(values) {
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key) => {
    if (key === 'searingVengeanceUses') return values.searingVengeanceUses;
    return null;
  });
}

describe('searingVengeanceHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations set via mockImplementation — re-install
    // the default range truth so tests stay order-independent.
    rangeCheck.isWithinRange.mockImplementation(async () => true);
    addEntry.mockResolvedValue(undefined);
  });

  it('returns a popup when uses have been exhausted (short-circuits before any combat read)', async () => {
    mockRuntimeValues({ searingVengeanceUses: 0 });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Searing Vengeance',
        description: 'Searing Vengeance has no uses remaining. Must finish a Long Rest to regain.',
        automation: makeAction().automation,
      },
    });
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('returns a popup when no combat is active', async () => {
    mockRuntimeValues({ searingVengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Searing Vengeance',
        description: 'No combat active.',
        automation: makeAction().automation,
      },
    });
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  describe('creature at 0 HP gate table', () => {
    it.each([
      {
        label: 'no creatures are at 0 HP',
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 10, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
        deadName: null,
        runtimeHp: null,
        inRange: true,
      },
      {
        label: 'the only creature at 0 HP is dead',
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
        ],
        deadName: 'Ally',
        runtimeHp: null,
        inRange: true,
      },
      {
        label: 'all 0 HP creatures are out of range',
        creatures: [
          { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
        ],
        deadName: null,
        runtimeHp: 0,
        inRange: false,
      },
    ])('returns a popup when $label and consumes no use', async ({ creatures, deadName, runtimeHp, inRange }) => {
      useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
        if (key === 'searingVengeanceUses') return 1;
        if (key === 'isDead') return subject === deadName ? 1 : null;
        if (key === 'currentHitPoints') return runtimeHp;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({ creatures });
      rangeCheck.isWithinRange.mockResolvedValue(inRange);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Searing Vengeance',
          description: 'No creatures within 60 feet are at 0 HP.',
          automation: makeAction().automation,
        },
      });
      // routing popup must not consume the use, touch the board, or log
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  it('opens the modal with a full payload: NPC heal target picked, warlock/healed/burst-out-of-range excluded from creatureTargets', async () => {
    mockRuntimeValues({ searingVengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally', type: 'npc', currentHp: 0, maxHp: 50 },
        { name: 'TestWarlock', type: 'player', currentHp: 50, maxHp: 70 },
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        { name: 'Far Goblin', type: 'npc', currentHp: 8, maxHp: 30 },
      ],
    });
    // strict (source, target) pairs: the 0-HP scan must be caster-sourced and the
    // burst gate healed-target-sourced; any other centre fails the pairs → popup.
    rangeCheck.isWithinRange.mockImplementation(async (source, target) => {
      if (source === 'TestWarlock') return true;
      if (source === 'Ally') return target === 'Goblin';
      return false;
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result).toEqual({
      type: 'modal',
      modalName: 'searingVengeance',
      payload: {
        name: 'Searing Vengeance',
        creatureTargets: [{ name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 }],
        targetName: 'Ally',
        targetMaxHp: 50,
        healAmount: 25,
        automation: makeAction().automation,
      },
    });
  });

  it('includes the warlock themselves as a 0 HP heal target (RAW: you or ally) and excludes self from the burst', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
      if (key === 'searingVengeanceUses') return 1;
      if (subject === 'TestWarlock' && key === 'currentHitPoints') return 0;
      if (subject === 'TestWarlock' && key === 'hitPoints') return 70;
      return null;
    });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestWarlock', type: 'player', currentHp: 1, maxHp: 1 },
        { name: 'Ally', type: 'player', currentHp: 30, maxHp: 50 },
      ],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('searingVengeance');
    expect(result.payload.targetName).toBe('TestWarlock');
    // healed target (self) excluded from burst; healthy ally remains a valid burst target
    expect(result.payload.creatureTargets).toEqual([
      { name: 'Ally', type: 'player', currentHp: 30, maxHp: 50 },
    ]);
  });
});

describe('confirmSearingVengeance/skip quad pins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // re-install: mockRejectedValue setImplementations survive clearAllMocks
    // (run2#1755 prophylaxis) — keeps tests order-independent.
    addEntry.mockResolvedValue(undefined);
  });

  it('registers the blinded expiration with full args and logs the ability_use summary with heal + burst amounts', async () => {
    mockRuntimeValues({ searingVengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 }],
    });
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [6, 6] });
    applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 12 });

    const automation = {
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      usesMax: 1,
    };

    await confirmSearingVengeance({
      automation,
      playerStats: makePlayerStats(),
      campaignName,
      mapName: null,
      characters: [],
      payload: {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      },
    });

    // quad-canonical full-args expiration pin (ConfirmPath pins counts only)
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'TestWarlock',
      targetName: 'Goblin',
      effects: [{ type: 'condition', condition: 'blinded' }],
      campaignName,
      rounds: 1,
    });
    // ability_use summary log composition (handler :215-220) — full-shape
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestWarlock',
      abilityName: 'Searing Vengeance',
      description: 'Searing Vengeance used on Ally — healed for 25 HP. 1 creatures take 12 radiant damage and are Blinded until end of the current turn.',
    });
    // per-target condition log (sibling censuses pin writes and roll logs, not this)
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'condition',
      characterName: 'Goblin',
      condition: 'blinded',
      source: 'Searing Vengeance',
      description: 'Goblin is Blinded until end of the current turn.',
    });
  });

  it('declining (skip) returns the full-shape popup, logs the refusal, and touches nothing', async () => {
    const automation = {
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      usesMax: 1,
    };

    const result = await skipSearingVengeance(
      automation,
      makePlayerStats(),
      campaignName,
      { name: 'Searing Vengeance', targetName: 'Ally', healAmount: 25 }
    );

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Searing Vengeance',
        description: 'TestWarlock declined Searing Vengeance — no use expended.',
        automation,
      },
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestWarlock',
      abilityName: 'Searing Vengeance',
      description: 'TestWarlock declined Searing Vengeance — reaction not taken, no use expended.',
    });
    // declined reaction: no combat read, no roll, no heal, no damage, no use, no expiration
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });
});
