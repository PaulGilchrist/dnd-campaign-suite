/**
 * sleepShakeHandler.confirm.test.js — #1957 (family quad #1957–#1959, seam map in sleepHandler.test.js header)
 *
 * Own lane: sleepShakeHandler.js handleConfirm(action, playerStats, campaignName, _mapName, targetName)
 * — the shake-awake CONFIRM seam (5-param; every call below passes 5 args).
 * Siblings: #1958 sleepShakeHandler.target-selection.test.js owns handle() range/target selection,
 * #1959 sleepShakeHandler.test.js (main) owns handle() press/orchestration. Neither imports handleConfirm.
 *
 * MECHANISM pinned at source (verified 2026-10-16): AUTO-SUCCESS — no save, no dice, no RNG anywhere
 * in this module (it imports no save/dice code). Shaking is an action that unconditionally strips
 * Incapacitated + Unconscious from the target's runtime 'activeConditions'. This matches RAW
 * (manifest SP-107 expectedBehavior: "someone within 5 feet of it takes an action to shake it out
 * of the spell's effect" — no shake save exists in 5e or 2024).
 *
 * LANE LIVENESS (verified honestly): handleConfirm is UI-UNREACHABLE today —
 * - index.js imports sleepShakeHandler's handle ONLY (line 227; registered sleep_shake at :533);
 *   handleConfirm is not imported and no '<type>_confirm' dispatch key exists for it.
 * - handle()'s modalName 'sleepShake' is NOT in useCharActionsAutomation.js modalMap
 *   (only sibling hypnoticPatternShake is; grep 2026-10-16) → modal result silently dropped.
 * - Manifest SP-107 gap: "shake-awake UI-unreachable (sleep_shake zero producers §70)";
 *   SaveAttackAoeModal.jsx:740: "Shaking awake within 5 ft stays GM-enforced (§7 sleep_shake residual)."
 * Kept as the mechanical pin for the registered-half module so the lane is executable the moment a
 * producer/modal is wired. handle() itself is untouched here.
 *
 * SEAM NOTES (pinned where own):
 * - Both confirm branches read the TARGET's runtime 'activeConditions' of PLAIN STRINGS
 *   (server-first getRuntimeValue) — foreign from handle()'s monster branch, which reads
 *   combatSummary creatures[].conditions[].key objects (#1958's shape, not pinned here).
 * - Honest log asymmetry between the two private helpers: shakeOutCreature logs a condition-removed
 *   entry ONLY if it was actually present (hadIncapacitated/hadUnconscious gates), while
 *   shakeOutPlayer logs any of the two NOT in the filtered result — so it phantom-logs
 *   'Incapacitated' when only Unconscious was present. Pinned as-is; do not "fix" silently.
 * - handleConfirm ignores its action arg entirely: ability name and popup literals are hardcoded
 *   'Shake Asleep'; an overridden action.name must NOT leak into any output (pinned).
 * - No timers in this lane: addEntry calls are fire-and-forget with .catch; assertions use
 *   exact-key pins and call-shape guards only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handleConfirm } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}, name = 'Shake Asleep') {
  return {
    name,
    automation: {
      type: 'sleep_shake',
      range: '5 ft',
      ...automation,
    },
  };
}

function makeCtx(targetName, targetType) {
  return {
    creatures: [
      { name: targetName, type: targetType },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
    placedItems: [],
  };
}

const conditionLogs = (condition) =>
  addEntry.mock.calls.filter((call) => call[1]?.type === 'condition' && call[1]?.condition === condition);

describe('sleepShakeHandler - handleConfirm (auto-success shake-awake, no save)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player target (shakeOutPlayer)', () => {
    it('wakes player: exact activeConditions write, both removal logs, ability_use + popup full strings, single ctx fetch', async () => {
      getCombatContext.mockResolvedValue(makeCtx('AllyPlayer', 'player'));
      getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(getCombatContext).toHaveBeenCalledTimes(1);
      expect(getRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', ['poisoned'], campaignName);
      expect(conditionLogs('Incapacitated').length).toBe(1);
      expect(conditionLogs('Unconscious').length).toBe(1);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'AllyPlayer',
          reason: 'Shake Asleep (Sleep spell)',
        }),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Shake Asleep',
          targetName: 'AllyPlayer',
          description: 'TestCaster used an action to shake AllyPlayer out of its magical slumber.',
        }),
      );
      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Shake Asleep');
      expect(result.payload.description).toBe('AllyPlayer is no longer affected by Sleep.');
    });

    it('no sleep conditions present: zero write, zero condition logs, popup still returned', async () => {
      getCombatContext.mockResolvedValue(makeCtx('AllyPlayer', 'player'));
      getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(conditionLogs('Incapacitated').length).toBe(0);
      expect(conditionLogs('Unconscious').length).toBe(0);
      expect(result.type).toBe('popup');
    });

    it('matching is case-insensitive: uppercase "Unconscious" is stripped from the write', async () => {
      getCombatContext.mockResolvedValue(makeCtx('AllyPlayer', 'player'));
      getRuntimeValue.mockReturnValue(['Unconscious', 'Poisoned']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', ['Poisoned'], campaignName);
    });

    it('PLAYER-PATH LOG ASYMMETRY (pinned defect): logs Incapacitated removal even when only Unconscious was present', async () => {
      // shakeOutPlayer logs every one of the two NOT found in the filtered result — unlike
      // shakeOutCreature (monster path below) it never checks what was originally present.
      getCombatContext.mockResolvedValue(makeCtx('AllyPlayer', 'player'));
      getRuntimeValue.mockReturnValue(['unconscious', 'poisoned']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(setRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', ['poisoned'], campaignName);
      expect(conditionLogs('Incapacitated').length).toBe(1);
      expect(conditionLogs('Unconscious').length).toBe(1);
    });

    it('empty and null conditions: zero write, popup still returned', async () => {
      getCombatContext.mockResolvedValue(makeCtx('AllyPlayer', 'player'));

      for (const conditions of [[], null]) {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(conditions);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      }
    });

    it('action arg is ignored: overridden action.name never leaks into ability_use log or popup literals', async () => {
      getCombatContext.mockResolvedValue(makeCtx('AllyPlayer', 'player'));
      getRuntimeValue.mockReturnValue(['unconscious']);

      const result = await handleConfirm(makeAction({}, 'Custom Wake Name'), makePlayerStats(), campaignName, mapName, 'AllyPlayer');

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Shake Asleep',
          description: 'TestCaster used an action to shake AllyPlayer out of its magical slumber.',
        }),
      );
      expect(result.payload.name).toBe('Shake Asleep');
    });
  });

  describe('monster target (shakeOutCreature)', () => {
    it('wakes monster: exact runtime-key write and both condition-removed logs', async () => {
      getCombatContext.mockResolvedValue(makeCtx('Goblin', 'monster'));
      getRuntimeValue.mockReturnValue(['incapacitated', 'unconscious', 'poisoned']);

      const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], campaignName);
      expect(conditionLogs('Incapacitated').length).toBe(1);
      expect(conditionLogs('Unconscious').length).toBe(1);
      expect(conditionLogs('Incapacitated')[0][1]).toMatchObject({
        type: 'condition',
        action: 'removed',
        characterName: 'Goblin',
        reason: 'Shake Asleep (Sleep spell)',
      });
      expect(result.type).toBe('popup');
    });

    it('MONSTER-PATH LOG GATE (contrast to player asymmetry): logs only conditions actually present', async () => {
      getCombatContext.mockResolvedValue(makeCtx('Goblin', 'monster'));
      getRuntimeValue.mockReturnValue(['unconscious', 'poisoned']);

      await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], campaignName);
      expect(conditionLogs('Incapacitated').length).toBe(0);
      expect(conditionLogs('Unconscious').length).toBe(1);
    });

    it('no sleep conditions and empty conditions on monster: zero writes, popup still returned', async () => {
      getCombatContext.mockResolvedValue(makeCtx('Goblin', 'monster'));

      for (const conditions of [['frightened', 'poisoned'], []]) {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(conditions);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Goblin');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result.type).toBe('popup');
      }
    });
  });

  describe('edge cases', () => {
    it('null or empty targetName: returns null before any combat-context fetch', async () => {
      expect(await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, null)).toBeNull();
      expect(await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, '')).toBeNull();

      expect(getCombatContext).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('target not resolvable (absent creature / null ctx / ctx without creatures): no writes, success popup + ability_use still emitted', async () => {
      const contexts = [
        makeCtx('Goblin', 'monster'), // Goblin absent — lookup miss
        null,
        {},
      ];

      for (const ctx of contexts) {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue(ctx);

        const result = await handleConfirm(makeAction(), makePlayerStats(), campaignName, mapName, 'Ghost');

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(conditionLogs('Incapacitated').length).toBe(0);
        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Ghost is no longer affected by Sleep.');
        expect(addEntry).toHaveBeenCalledWith(
          campaignName,
          expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCaster',
            abilityName: 'Shake Asleep',
            targetName: 'Ghost',
          }),
        );
      }
    });
  });
});
