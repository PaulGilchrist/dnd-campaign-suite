import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── QUAD seam map — counterSpellHandler.js ─────────────────────────────
// Subject is LIVE: automation/index.js imports `handle` (l.201) and registers
// it as `reaction_counterspell` in the dispatch table (l.525). Reaction
// consumption precedent = handlers/reactions/ block — distinct modules, all
// maintained. CAST-1 reaction, CON save vs the attacker.
//
// THIS FILE (#1893) — SAVE-RESULT lane: handleSaveResult() only.
//   • failed-save rollback: rollbackSpellEffects args (incl. affectedTargets
//     passthrough), exact save_result shape, exact ability_use rollback log
//   • success counterspell negation log
//   • promptId guard (stale/foreign prompts ignored, listener stays armed)
//   • 'counterspell-save-result' broadcast payload
//   Canonical for 'should log save_result and rollback on failed save' —
//   strict superset of deleted counter_debug.test.js (exact save_result
//   shape + rollbackSpellEffects args + ability_use log). Do not weaken.
// #1894 counterSpellHandler.rejections.test.js — addEntry rejection paths
//   (mockRejectedValueOnce) + getRuntimeValue null/undefined/negative guards.
// #1895 counterSpellHandler.spellBreaker.test.js — Spell Breaker (War
//   Magic) slot refunds + CLA-322 reaction-spent round latch.
// #1896 counterSpellHandler.test.js — handle() validation, spell detection,
//   CON save prompt creation, popup returns.
//
// HANDOFF to #1895 (Spell Breaker content removed from this lane; its
// exact-named tests already supersede each one):
//   'should restore a spell slot on successful save when spell_breaker
//    passive includes Counterspell'
//     → 'refunds at the actual cast slot level and logs Spell Breaker when
//        the save succeeds'
//   'should not restore a spell slot when spell_breaker passive is missing'
//     → 'does not refund without the Spell Breaker passive (5e regression
//        gate)'
//   'should not restore a spell slot on failed save even with spell_breaker'
//     → 'does not refund when the attacker fails the save (counterspell
//        succeeded)'
// ─────────────────────────────────────────────────────────────────────────

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
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';

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
    round: 1,
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
  const { attackEvent: attackEventOverrides = {}, ...rest } = overrides;
  return {
    attackEvent: {
      attackerName: 'Goblin',
      targetName: 'TestCaster',
      damageFormula: '3d6',
      damageName: 'Fire Bolt',
      attackName: 'Fire Bolt',
      saveType: null,
      primaryDamage: 9,
      secondaryDamage: 0,
      affectedTargets: ['TestCaster'],
      statusEffects: null,
      // attackEvent overrides MERGE (caller keeps untouched identity fields)
      ...attackEventOverrides,
    },
    attackerName: 'Goblin',
    targetName: 'TestCaster',
    primaryDamage: 9,
    secondaryDamage: 0,
    totalDamage: 9,
    damageTypes: ['Fire'],
    ...rest,
  };
}

// Run handle() and return { savedCallback, addEventListenerSpy } wired to
// the handler's window 'save-result' listener. Awaiting savedCallback awaits
// handleSaveResult end-to-end (rollback + logs) — no timer races.
async function triggerAndCapture(action, playerStats) {
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  await handle(action, playerStats, campaignName, null);
  const savedCallback = addEventListenerSpy.mock.calls.find(
    call => call[0] === 'save-result'
  )[1];
  return { savedCallback, addEventListenerSpy };
}

// ── Tests ──────────────────────────────────────────────────────

describe('counterSpellHandler.handleSaveResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeCombatContext());
    findLastAttack.mockResolvedValue(makeLastAttack());
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({ promptId: 'save-test-prompt' });
    rollbackSpellEffects.mockResolvedValue({
      targetsHealed: 0,
      conditionsRemoved: [],
      effectsRemoved: 0,
      damageHealed: 0,
      logDescription: '',
    });
  });

  describe('save result handling', () => {
    it('should log save_result and rollback on failed save', async () => {
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 1,
        conditionsRemoved: [{ targetName: 'TestCaster', condition: 'burning' }],
        effectsRemoved: 2,
        damageHealed: 9,
        logDescription: "Goblin's spell 'Fire Bolt' was countered — 9 HP healed, 1 condition(s) removed, 2 target effect(s) cleared on TestCaster.",
      });

      const { savedCallback, addEventListenerSpy } = await triggerAndCapture(
        makeAction(), makePlayerStats()
      );

      // Pin the internal broadcast (fire → before branch → seen by riders)
      let broadcastDetail = null;
      const broadcastListener = (e) => { broadcastDetail = e.detail; };
      window.addEventListener('counterspell-save-result', broadcastListener);

      await savedCallback({
        detail: { promptId: 'save-test-prompt', success: false },
      });

      expect(rollbackSpellEffects).toHaveBeenCalledTimes(1);
      expect(rollbackSpellEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          attackerName: 'Goblin',
          targetName: 'TestCaster',
          damageFormula: '3d6',
          damageName: 'Fire Bolt',
        }),
        campaignName,
        'Counterspell',
        expect.objectContaining({ creatures: expect.any(Array) }),
      );

      // Initial trigger log is ability_use; failed-save result is save_result
      const saveResultCall = addEntry.mock.calls.find(
        call => call[1]?.type === 'save_result' && call[1]?.success === false
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-counterspell',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'CON',
        success: false,
        description: 'Goblin failed CON save. Counterspell counters \'Fire Bolt\'!',
      });

      // Rollback log carries the exact logDescription from rollbackSpellEffects
      const abilityUseCall = addEntry.mock.calls.find(
        call => call[1]?.type === 'ability_use' && call[1]?.description?.includes('was countered')
      );
      expect(abilityUseCall).toBeDefined();
      expect(abilityUseCall[1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: "Goblin's spell 'Fire Bolt' was countered — 9 HP healed, 1 condition(s) removed, 2 target effect(s) cleared on TestCaster.",
      });

      expect(broadcastDetail).toEqual({
        promptId: 'save-test-prompt',
        attackerName: 'Goblin',
        spellName: 'Fire Bolt',
        saveDc: 15,
        success: false,
        spellResult: 'failed',
        counterspellResult: 'counters',
      });

      window.removeEventListener('counterspell-save-result', broadcastListener);
      addEventListenerSpy.mockRestore();
    });

    it('should log save_result on successful save', async () => {
      const { savedCallback, addEventListenerSpy } = await triggerAndCapture(
        makeAction(), makePlayerStats()
      );

      let broadcastDetail = null;
      const broadcastListener = (e) => { broadcastDetail = e.detail; };
      window.addEventListener('counterspell-save-result', broadcastListener);

      await savedCallback({
        detail: { promptId: 'save-test-prompt', success: true },
      });

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-counterspell',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'CON',
        success: true,
        description: 'Goblin succeeded on CON save. Counterspell fails to counter \'Fire Bolt\'.',
      });

      // Spell resolved — nothing to roll back (no-side-effect guard)
      expect(rollbackSpellEffects).not.toHaveBeenCalled();

      expect(broadcastDetail).toEqual({
        promptId: 'save-test-prompt',
        attackerName: 'Goblin',
        spellName: 'Fire Bolt',
        saveDc: 15,
        success: true,
        spellResult: 'succeeded',
        counterspellResult: 'fails to counter',
      });

      window.removeEventListener('counterspell-save-result', broadcastListener);
      addEventListenerSpy.mockRestore();
    });
  });

  describe('AoE spell handling', () => {
    it('should use affectedTargets from lastAttack for rollback', async () => {
      findLastAttack.mockResolvedValue(makeLastAttack({
        attackEvent: {
          damageName: 'Fireball',
          attackName: 'Fireball',
          saveType: 'DEX',
          saveDc: 14,
          saveResult: 'failure',
          affectedTargets: ['TestCaster', 'Orc'],
          statusEffects: ['burning'],
        },
      }));
      rollbackSpellEffects.mockResolvedValue({
        targetsHealed: 2,
        conditionsRemoved: [],
        effectsRemoved: 0,
        damageHealed: 18,
        logDescription: "Goblin's spell 'Fireball' was countered — 18 HP healed, no conditions to remove, no target effects to clear on TestCaster, Orc.",
      });

      const { savedCallback, addEventListenerSpy } = await triggerAndCapture(
        makeAction(), makePlayerStats()
      );

      await savedCallback({
        detail: { promptId: 'save-test-prompt', success: false },
      });

      // Handler passes the full attackEvent through — affectedTargets intact
      expect(rollbackSpellEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          affectedTargets: ['TestCaster', 'Orc'],
          damageName: 'Fireball',
        }),
        campaignName,
        'Counterspell',
        expect.objectContaining({ creatures: expect.any(Array) }),
      );

      // Rollback log mirrors the AoE logDescription verbatim
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: "Goblin's spell 'Fireball' was countered — 18 HP healed, no conditions to remove, no target effects to clear on TestCaster, Orc.",
      });

      addEventListenerSpy.mockRestore();
    });
  });

  describe('handleSaveResult early return', () => {
    it('should ignore events with mismatched promptId', async () => {
      const { savedCallback, addEventListenerSpy } = await triggerAndCapture(
        makeAction(), makePlayerStats()
      );

      await savedCallback({
        detail: { promptId: 'wrong-prompt', success: false },
      });

      // Guard rejects foreign prompts — no rollback, no result logs
      expect(rollbackSpellEffects).not.toHaveBeenCalled();
      expect(addEntry.mock.calls.filter(call => call[1]?.type === 'save_result')).toHaveLength(0);

      // Positive control: listener stays armed — the correct prompt still resolves
      await savedCallback({
        detail: { promptId: 'save-test-prompt', success: false },
      });

      expect(rollbackSpellEffects).toHaveBeenCalledTimes(1);

      addEventListenerSpy.mockRestore();
    });
  });
});
