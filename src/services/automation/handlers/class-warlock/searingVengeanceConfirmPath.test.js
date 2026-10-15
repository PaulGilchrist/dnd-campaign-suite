// @maintained-by-ai
// SEARING VENGEANCE CONFIRM LANE (quad file 2/4). Canonical home of:
// - confirm-path guards: selectedTargets guard table (null/undefined/empty array),
//   no-combat-at-confirm popup (Handler.test.js covers the handle() twin only),
//   both with no-side-effect pins (no combat read, no roll, no runtime write).
// - CHA modifier resolution table ('2d8+5' canonical / '2d8-2' sign formatting /
//   '2d8+0' missing-abilities fallback) — the quad's rollExpression pins point here.
// - blinded dedupe + storedConditions coercion table (skip-if-present incl.
//   case-insensitive, append-preserving, null/non-array → ['blinded']).
// - multi-target fanout: ONE shared roll, full-args applyDamageToTarget pins on each
//   creature (adopted from heal lane's borrowed copy — droppable there now), per-target
//   blinded writes + expirations, healed-target pending-condition clear (line 191 of
//   the handler, pinned nowhere else in the quad), full-string popup composition
//   including the '(r1, r2)' rollDisplay.
// - log-failure resilience: every addEntry call is .catch-guarded.
// applyHealingToTarget is MOCKED here ({actualHeal:25} stub) by design — the real
// heal path is heal-lane canonical (searingVengeance.heal.test.js), don't absorb it.
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
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

import { confirmSearingVengeance } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

const DEFAULT_PLAYER_STATS = {
  name: 'TestWarlock',
  level: 14,
  hitPoints: { max: 70 },
  currentHitPoints: 50,
};

const DEFAULT_AUTOMATION = {
  damageExpression: '2d8 + CHA modifier',
  damageType: 'Radiant',
  usesMax: 1,
};

const DEFAULT_PAYLOAD = {
  name: 'Searing Vengeance',
  targetName: 'Ally',
  healAmount: 25,
  selectedTargets: ['Goblin'],
};

const GOBLIN = { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 };

function mockRuntimeValues(values) {
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key, _campaign) => {
    if (key === 'searingvengeanceUses') return values.searingvengeanceUses;
    if (key === 'activeConditions') return values.activeConditions;
    return null;
  });
}

function mockCombatCreatures(creatures) {
  damageUtils.getCombatContext.mockResolvedValue({ creatures });
}

function runConfirm({ automation = DEFAULT_AUTOMATION, playerStats = DEFAULT_PLAYER_STATS, payload = {} } = {}) {
  return confirmSearingVengeance({
    automation,
    playerStats,
    campaignName,
    mapName: null,
    characters: [],
    payload: { ...DEFAULT_PAYLOAD, ...payload },
  });
}

function goblinConditionWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(
    (call) => call[0] === 'Goblin' && call[1] === 'activeConditions'
  );
}

describe('confirmSearingVengeance - confirm path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
    mockCombatCreatures([GOBLIN]);
    // this lane's MOCKED heal contract — real path is heal-lane canonical
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 25, oldHp: 0, newHp: 25, maxHp: 50 });
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });
  });

  describe('early returns for invalid targets', () => {
    it.each([
      { label: 'null', selectedTargets: null },
      { label: 'undefined', selectedTargets: undefined },
      { label: 'an empty array', selectedTargets: [] },
    ])('returns popup when selectedTargets is $label', async ({ selectedTargets }) => {
      const result = await runConfirm({ payload: { selectedTargets } });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Searing Vengeance used — no creatures selected for damage.');
      // guard short-circuits before any side effects
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('combat context failures', () => {
    it('returns popup when no combat is active during confirm', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await runConfirm();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat active.');
      // nothing consumed, nothing touched
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    });
  });

  describe('blinded condition dedupe and stored-conditions coercion', () => {
    it.each([
      { label: 'already-present blinded', stored: ['blinded'], expectedWrite: null },
      { label: 'case-insensitive Blinded match', stored: ['Blinded'], expectedWrite: null },
      { label: 'other stored conditions preserved on append', stored: ['restrained'], expectedWrite: ['restrained', 'blinded'] },
      { label: 'null stored conditions treated as empty array', stored: null, expectedWrite: ['blinded'] },
      { label: 'non-array stored conditions treated as empty array', stored: 'blinded', expectedWrite: ['blinded'] },
    ])('writes blinded exactly once for $label', async ({ stored, expectedWrite }) => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: stored });

      await runConfirm();

      if (expectedWrite === null) {
        // should NOT write Goblin's conditions since blinded already exists
        expect(goblinConditionWrites()).toHaveLength(0);
      } else {
        expect(goblinConditionWrites()).toEqual([
          ['Goblin', 'activeConditions', expectedWrite, campaignName],
        ]);
      }
      // the until_end_of_current_turn expiration is registered unconditionally
      expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
    });
  });

  it('handles creature not found in combat context for hp_change log', async () => {
    mockCombatCreatures([]);

    await runConfirm();

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'hp_change',
        targetName: 'Goblin',
        currentHp: 0,
        maxHp: 0,
      })
    );
  });

  describe('damage roll composition', () => {
    it('handles rollExpression returning zero damage', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [] });

      const result = await runConfirm();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 radiant damage');
    });

    it('uses default damageType when automation.damageType is not set', async () => {
      await runConfirm({ automation: { damageExpression: '2d8 + CHA modifier', usesMax: 1 } });

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'roll',
          damageType: 'Radiant',
        })
      );
    });

    it.each([
      { label: 'resolves CHA modifier from abilities bonus (canonical PlayerStats shape)', abilities: [{ name: 'Charisma', bonus: 5 }], expectedExpression: '2d8+5' },
      { label: 'formats negative CHA modifier without a double sign', abilities: [{ name: 'Charisma', bonus: -2 }], expectedExpression: '2d8-2' },
      { label: 'resolves zero CHA modifier when abilities are missing', abilities: undefined, expectedExpression: '2d8+0' },
    ])('$label', async ({ abilities, expectedExpression }) => {
      await runConfirm({
        playerStats: abilities
          ? { ...DEFAULT_PLAYER_STATS, abilities }
          : DEFAULT_PLAYER_STATS,
      });

      expect(diceRoller.rollExpression).toHaveBeenCalledWith(expectedExpression);
    });
  });

  it('handles multiple targets by applying damage to each', async () => {
    const orc = { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 30 };
    const cs = { creatures: [GOBLIN, orc] };
    damageUtils.getCombatContext.mockResolvedValue(cs);

    const result = await runConfirm({ payload: { selectedTargets: ['Goblin', 'Orc'] } });

    // damage rolled ONCE and shared across the burst
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);

    // full-args damage pin on each target (quad-canonical, adopted from heal lane)
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(2);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      cs, 'Goblin', 10, ['Radiant'], { campaignName, characters: [], ignoreResistance: false, attackerName: 'TestWarlock' }
    );
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      cs, 'Orc', 10, ['Radiant'], { campaignName, characters: [], ignoreResistance: false, attackerName: 'TestWarlock' }
    );

    // blinded condition + expiration fan out to every selected creature
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['blinded'], campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc', 'activeConditions', ['blinded'], campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledTimes(2);

    // healed ally's pending conditions are cleared (ends the Pending condition)
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally', 'activeConditions', [], campaignName
    );

    // per-creature damage roll logs
    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ type: 'roll', targetName: 'Goblin' })
    );
    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({ type: 'roll', targetName: 'Orc' })
    );

    // full-string popup composition incl. count + rollDisplay
    expect(result.payload.description).toBe(
      'TestWarlock unleashes Searing Vengeance! Ally regains 25 HP. 2 creatures take 10 radiant damage (5, 5) and are Blinded until end of the current turn.'
    );
  });

  describe('error handling', () => {
    it('continues processing and returns result when addEntry rejects', async () => {
      addEntry.mockRejectedValue(new Error('log fails'));

      const result = await runConfirm();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Searing Vengeance');
      // game-state side effects still land despite every log call rejecting
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['blinded'], campaignName
      );
    });
  });
});
