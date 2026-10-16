// @maintained-by-ai
/**
 * banishment QUINTET seam map — five lanes share banishmentHandler.js:
 *  - #1872 banishmentHandler.handle.test.js — handle() core (L229-319): no-target popup,
 *        no-creatures popup, single-target save success/failure, multi-target via
 *        metaCtx.banishmentTargets, loose arrayContaining pins on addExpiration/conditions.
 *  - #1873 banishmentHandler.helpers.test.js — direct unit lane over BOTH exported
 *        predicates (isCreatureTrappedInBanishment L20-23 + isBanishmentBlocked L29-45).
 *  - #1874 banishmentHandler.isBanishmentBlocked.test.js — dedicated lane for the gate
 *        isBanishmentBlocked L29-45 (live consumer: hooks/combat/attackBlockers.js L10).
 *  - #1875 banishmentHandler.isCreatureTrappedInBanishment.test.js — dedicated lane for
 *        the runtime-store trapped predicate L20-23 (export-only: no non-test caller found —
 *        liveness caveat noted for the suite trim).
 *  - THIS LANE (edge-cases) — the defensive/edge branches of handle() NOT pinned by #1872,
 *        reached only through handle (its private callees are unexported, so they are
 *        honestly tested here rather than in separate lanes):
 *        resolveBanishmentTargets precedence chain L158-185 (metaCtx > automation.targetName
 *        > action.targetName > resolveTarget success leg) + missing-automation `|| {}` L230;
 *        createSaveListener options object pin L274-280 (dcSuccess:'none', metamagicHeighten
 *        → disadvantage); dispatchSaveResult field mapping L47-70 (bonus→saveBonus, window
 *        'save-result' CustomEvent detail); NPC-auto-roll vs player gate L270-292; second
 *        getCombatContext null concentration guard L260-263; banishFailingTarget falsy and
 *        non-array condition reads + incap dedupe L83-86; meta merge-not-replace L89-97;
 *        targetEffects same-target-AND-same-source replace L107-118 (direct setRuntimeValue
 *        write — no registerTargetEffect delegation exists in this handler);
 *        `?? 0` save-roll fallbacks in both legs L120-127 / L208-216;
 *        PERMANENT_BANISHMENT_TYPES strict table L72-79 via L100-101; storeSpellLastAttack
 *        payload pin L251-257; exact-ordered addExpiration payload L130-134 (#1872 pins
 *        this only with arrayContaining+objectContaining, dropping target/source/spell);
 *        summary ternary L307-309 full-string pins both branches.
 *
 * Reassignment / audit notes (verified at source 2026-10-16):
 *  - Old test 'handles NPC with null targetCreature using d20 fallback' was MISLABELED:
 *        the d20 fallback in npcBanishmentSaveResult L189-194 is DEAD via handle() —
 *        dispatch is gated at L290-292 on isTargetNpc, which requires targetCreature to be
 *        truthy (L272). What that test actually pinned was promise-driven resolution when
 *        the target is off-initiative. Renamed; differentiated from the null-target banish
 *        variant by making it the save-success leg; rollD20.not.toHaveBeenCalled pins the
 *        dead branch.
 *  - Old fey/aberration permanent tests collapsed into one strict table over all five
 *        PERMANENT_BANISHMENT_TYPES + case/space normalization + negatives.
 *  - Old 'creature type with spaces' test set `type: 'Fey Creature'`, but permanence reads
 *        monsterType (L100), not type — the branch it claimed never executed. Fixed:
 *        monsterType 'Celestial'/' FEY ' → permanent true; 'Fey Creature' → 'feycreature'
 *        (space-strip can never match a multi-word type) → permanent false quirk pinned.
 *  - getTargetFromAttacker mock dropped: handler imports only getCombatContext from
 *        damageUtils.js (L6) — the old pin asserted against a function the handler
 *        never imports.
 *
 * Turn-based: 'Concentration, up to 1 minute' is a latch string cleared at concentration/
 * initiative seams, never a clock; no timers in this file (Date.now() at L154 is a benign
 * log timestamp inside the mocked logService).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './banishmentHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { campaignName, makePlayerStats } from './banishmentHandler.test-utils.js';

const DC = 15;

const goblinNpc = () => ({
  name: 'Goblin', type: 'npc', monsterType: 'humanoid',
  saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30,
});
const failSave = { success: false, roll: 3, total: 5, bonus: 2 };
const failRoll = { ...failSave, rawRolls: [3] };

// MERGES automation overrides (does not replace the block wholesale).
function makeBanishmentAction({ automation: automationOverrides, ...rest } = {}) {
  return {
    name: 'Banishment',
    ...rest,
    automation: { type: 'banishment', saveType: 'CHA', saveDc: DC, ...automationOverrides },
  };
}

// Exact-key router over `${key}:${subKey}`; overrides replace their exact key only.
function runtimeRouter(overrides = {}) {
  const routes = {
    'campaign:targetEffects': [],
    'Goblin:activeConditions': [],
    'Goblin:activeConditionMeta': {},
    ...overrides,
  };
  return (key, subKey) => routes[`${key}:${subKey}`];
}

function primeDefaults() {
  getRuntimeValue.mockImplementation(runtimeRouter());
  getCombatContext.mockResolvedValue({ creatures: [goblinNpc()] });
  buildSaveDc.mockReturnValue(DC);
  rollSaveForCreature.mockReturnValue(failRoll);
  createSaveListener.mockReturnValue({
    promptId: 'prompt-1',
    promise: Promise.resolve(failSave),
  });
}

function lastTargetEffectsWrite() {
  const call = [...vi.mocked(setRuntimeValue).mock.calls].reverse()
    .find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
  return call?.[2];
}

describe('banishmentHandler.handle edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeDefaults();
  });

  describe('target resolution chain (L158-185)', () => {
    it('metaCtx.banishmentTargets beats automation.targetName', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({
        'Orc:activeConditions': [],
        'Orc:activeConditionMeta': {},
      }));
      getCombatContext.mockResolvedValue({
        creatures: [goblinNpc(), { name: 'Orc', type: 'npc', monsterType: 'humanoid', saveBonuses: { CHA: 1 } }],
      });

      const action = makeBanishmentAction({
        automation: { targetName: 'Goblin' },
        metaCtx: { banishmentTargets: ['Goblin', 'Orc'] },
      });

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener.mock.calls.map(c => c[1].targetName)).toEqual(['Goblin', 'Orc']);
      expect(result.payload.description).toBe('2 creature(s) banished: Goblin, Orc. 0 creature(s) saved: .');
    });

    it('empty metaCtx.banishmentTargets array falls through to automation.targetName', async () => {
      const action = makeBanishmentAction({
        automation: { targetName: 'Goblin' },
        metaCtx: { banishmentTargets: [] },
      });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin', saveType: 'CHA', saveDc: DC, dcSuccess: 'none', disadvantage: false,
      });
    });

    it('automation.targetName beats action.targetName', async () => {
      const action = makeBanishmentAction({
        automation: { targetName: 'Goblin' },
        targetName: 'Orc',
      });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(resolveTarget).not.toHaveBeenCalled();
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener.mock.calls[0][1].targetName).toBe('Goblin');
    });

    it('falls back to resolveTarget when there is no automation object at all', async () => {
      // Pins `action.automation || {}` (L230) and the resolveTarget success leg (L169-184);
      // the null-result popup leg is owned by #1872.
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      const action = { name: 'Banishment' };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
      expect(result.payload.description).toBe('1 creature(s) banished: Goblin. 0 creature(s) saved: .');
    });
  });

  describe('save prompt options and NPC/player dispatch gate (L270-292)', () => {
    it('pins full createSaveListener options and its cast-side side effects', async () => {
      const stats = makePlayerStats();
      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });

      await handle(action, stats, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, stats);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin', saveType: 'CHA', saveDc: DC, dcSuccess: 'none', disadvantage: false,
      });
      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster', spellName: 'Banishment', saveType: 'CHA', saveDc: DC, attackScope: 'single',
      });
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Banishment',
        description: 'TestCaster casts Banishment on Goblin! Goblin must make a CHA save (DC 15) or be banished.',
        promptId: 'prompt-1',
      });
    });

    it('flags disadvantage when metaCtx.metamagicHeighten is set', async () => {
      const action = makeBanishmentAction({
        automation: { targetName: 'Goblin' },
        metaCtx: { metamagicHeighten: true },
      });

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin', saveType: 'CHA', saveDc: DC, dcSuccess: 'none', disadvantage: true,
      });
    });

    it('maps NPC auto-roll fields to sendSaveResult and the window save-result detail', async () => {
      rollSaveForCreature.mockReturnValue({ success: true, roll: 15, total: 16, bonus: 1, rawRolls: [15] });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-7',
        promise: Promise.resolve({ success: true, roll: 15, total: 16, bonus: 1 }),
      });
      const onSaveResult = vi.fn();
      window.addEventListener('save-result', onSaveResult);

      try {
        const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
        await handle(action, makePlayerStats(), campaignName, null);

        expect(rollSaveForCreature).toHaveBeenCalledWith(goblinNpc(), 'CHA', DC, false, false);
        // bonus → saveBonus rename is the seam here (L47-70):
        expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Goblin', {
          promptId: 'prompt-7', success: true, roll: 15, total: 16, saveBonus: 1, rawRolls: [15],
        });
        expect(onSaveResult).toHaveBeenCalledTimes(1);
        expect(onSaveResult.mock.calls[0][0].detail).toEqual({
          promptId: 'prompt-7', targetName: 'Goblin', saveType: 'CHA', saveDc: DC,
          success: true, roll: 15, total: 16, saveBonus: 1, rawRolls: [15],
        });
      } finally {
        window.removeEventListener('save-result', onSaveResult);
      }
    });

    it('player target gets no auto-roll and no dispatch', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'player', saveBonuses: { CHA: 5 }, currentHp: 20, maxHp: 40 }],
      });

      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(sendSaveResult).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('1 creature(s) banished: Goblin. 0 creature(s) saved: .');
    });
  });

  describe('concentration guard (L260-263)', () => {
    it('second getCombatContext resolving null skips concentration but still banishes', async () => {
      // Positional chain: first call feeds the target loop, second feeds concentration.
      getCombatContext
        .mockResolvedValueOnce({ creatures: [goblinNpc()] })
        .mockResolvedValueOnce(null);

      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('1 creature(s) banished: Goblin. 0 creature(s) saved: .');
      expect(lastTargetEffectsWrite()).toEqual([
        {
          effect: 'banishment', target: 'Goblin', source: 'TestCaster',
          duration: 'Concentration, up to 1 minute', permanent: false,
        },
      ]);
    });
  });

  describe('banishFailingTarget defensive writes (L83-118)', () => {
    it('null storedConditions is replaced by exactly [incapacitated]', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({ 'Goblin:activeConditions': null }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['incapacitated'], campaignName);
    });

    it('non-array storedConditions is dropped, leaving only incapacitated', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({ 'Goblin:activeConditions': 'incapacitated' }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['incapacitated'], campaignName);
    });

    it('existing incapacitated is deduped and re-applied last', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({
        'Goblin:activeConditions': ['incapacitated', 'restrained'],
      }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['restrained', 'incapacitated'], campaignName);
    });

    it('null activeConditionMeta becomes exact { incapacitated: { dc, ability } }', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({ 'Goblin:activeConditionMeta': null }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditionMeta', { incapacitated: { dc: DC, ability: 'cha' } }, campaignName,
      );
    });

    it('merges incapacitated into existing meta without dropping unrelated keys or notes', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({
        'Goblin:activeConditionMeta': {
          frightened: { reason: 'aura' },
          incapacitated: { note: 'keep me' },
        },
      }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditionMeta', {
        frightened: { reason: 'aura' },
        incapacitated: { note: 'keep me', dc: DC, ability: 'cha' },
      }, campaignName);
    });

    it('null campaign targetEffects seeds exactly one banishment effect', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({ 'campaign:targetEffects': null }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(lastTargetEffectsWrite()).toEqual([{
        effect: 'banishment', target: 'Goblin', source: 'TestCaster',
        duration: 'Concentration, up to 1 minute', permanent: false,
      }]);
    });

    it('replaces only same-target AND same-source banishment when appending', async () => {
      getRuntimeValue.mockImplementation(runtimeRouter({
        'campaign:targetEffects': [
          { effect: 'banishment', target: 'Goblin', source: 'TestCaster', duration: 'stale', permanent: true },
          { effect: 'banishment', target: 'Goblin', source: 'RivalCaster', duration: 'other', permanent: false },
          { effect: 'banishment', target: 'Orc', source: 'TestCaster', duration: 'orc', permanent: false },
          { effect: 'stunned', target: 'Goblin', source: 'TestCaster', duration: 'other', permanent: false },
        ],
      }));

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(lastTargetEffectsWrite()).toEqual([
        { effect: 'banishment', target: 'Goblin', source: 'RivalCaster', duration: 'other', permanent: false },
        { effect: 'banishment', target: 'Orc', source: 'TestCaster', duration: 'orc', permanent: false },
        { effect: 'stunned', target: 'Goblin', source: 'TestCaster', duration: 'other', permanent: false },
        { effect: 'banishment', target: 'Goblin', source: 'TestCaster', duration: 'Concentration, up to 1 minute', permanent: false },
      ]);
    });
  });

  describe('save-roll nullish fallbacks (L120-127 / L208-216)', () => {
    it('null roll/total on failure lands as 0 in the addTargetResult payload', async () => {
      createSaveListener.mockReturnValue({
        promptId: 'prompt-1',
        promise: Promise.resolve({ success: false, roll: null, total: null, bonus: 2 }),
      });

      await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin', saveResult: 'failure', roll: 0, total: 0,
        conditions: ['incapacitated'], appliedDamage: 0,
      });
    });

    it('undefined roll/total on success lands as 0 in the saved-leg addTargetResult payload', async () => {
      createSaveListener.mockReturnValue({
        promptId: 'prompt-1',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin', saveResult: 'success', roll: 0, total: 0,
        conditions: [], appliedDamage: 0,
      });
      expect(result.payload.description).toBe('No creatures banished. 1 creature(s) saved: Goblin.');
    });
  });

  describe('PERMANENT_BANISHMENT_TYPES table (L72-79 via L100-101)', () => {
    it('table: listed types (case/space normalized) banish permanently; others stay temporary', async () => {
      const table = [
        ['aberration', true],
        ['celestial', true],
        ['elemental', true],
        ['fey', true],
        ['fiend', true],
        ['Celestial', true],   // lowercase normalization
        [' FEY ', true],       // whitespace strip normalization
        ['humanoid', false],
        ['giant', false],
        ['Fey Creature', false], // 'feycreature' ∉ set — multi-word types never match
        ['', false],              // missing monsterType
      ];

      for (const [monsterType, expected] of table) {
        vi.clearAllMocks();
        primeDefaults();
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'Goblin', type: 'npc', monsterType, saveBonuses: { CHA: 2 } }],
        });

        await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

        const effect = lastTargetEffectsWrite().find(te => te.effect === 'banishment');
        expect(effect.permanent, `monsterType ${JSON.stringify(monsterType)}`).toBe(expected);
      }
    });
  });

  describe('target missing from initiative', () => {
    it('banishes from the listener promise with exact addExpiration when target is off-initiative', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster', type: 'player' }] });

      const action = makeBanishmentAction({ automation: { targetName: 'Goblin' } });
      const result = await handle(action, makePlayerStats(), campaignName, null);

      // No creature → no rollSaveForCreature; the d20 fallback (L189-194) is dead via
      // handle() because dispatch (L290-292) requires a truthy targetCreature (L272).
      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(rollD20).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('1 creature(s) banished: Goblin. 0 creature(s) saved: .');
      expect(lastTargetEffectsWrite()).toEqual([{
        effect: 'banishment', target: 'Goblin', source: 'TestCaster',
        duration: 'Concentration, up to 1 minute', permanent: false,
      }]);
      // Exact-ordered payload #1872 only pins loosely (arrayContaining/objectContaining):
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'Goblin',
        effects: [
          { type: 'condition', condition: 'incapacitated' },
          { type: 'remove_target_effect', effectKey: 'banishment', target: 'Goblin', source: 'TestCaster' },
          { type: 'break_concentration', spell: 'Banishment' },
        ],
        campaignName,
      });
    });

    it('scores a save from the listener promise when target is off-initiative (renamed from d20-fallback mislabel)', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster', type: 'player' }] });
      createSaveListener.mockReturnValue({
        promptId: 'prompt-1',
        promise: Promise.resolve({ success: true, roll: 10, total: 10, bonus: 0 }),
      });

      const result = await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).not.toHaveBeenCalled();
      expect(rollD20).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('No creatures banished. 1 creature(s) saved: Goblin.');
    });
  });

  describe('summary composition (L307-309)', () => {
    it('all-saved summary is full-string and writes nothing to the runtime store', async () => {
      createSaveListener.mockReturnValue({
        promptId: 'prompt-1',
        promise: Promise.resolve({ success: true, roll: 18, total: 20, bonus: 2 }),
      });

      const result = await handle(makeBanishmentAction({ automation: { targetName: 'Goblin' } }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe('No creatures banished. 1 creature(s) saved: Goblin.');
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      // Concentration latches the caster even when every target saves:
      expect(addConcentration).toHaveBeenCalledWith({ creatures: [goblinNpc()] }, 'TestCaster', 'Banishment', DC);
    });
  });
});
