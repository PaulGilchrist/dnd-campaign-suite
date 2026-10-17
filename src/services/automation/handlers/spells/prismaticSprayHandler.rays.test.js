// @maintained-by-ai
// prismaticSpray SEXTET (#1940-#1944) — lane #1942 .rays: the PRISMATIC_RAYS table itself.
//
// SEAM MAP lives in prismaticSprayHandler.damage-regression.test.js — READ FIRST.
// Closed lanes: .damage-regression owns the SP-092 12d6 fix sites (table default,
// queueRaySave fallback, spells.json) and roll-expression threading — we pin
// damageFormula '12d6' here as payload-shaped row content ONLY; the 10d6-vs-12d6
// regression ownership is theirs (cross-ref). .handle owns per-creature ray
// dispatch counts incl. the two-prompt 8-count. .save-results owns immunity-skip
// plumbing, save_result/addTargetResult wiring, zero-damage guards, ability_use
// entries. .summaries owns popup text. .helpers owns isPrismaticSprayBlocked.
//
// Verified at source (prismaticSprayHandler.js L25-60): the table has SEVEN rows —
// an d8 roll of 8 is NOT a row, it re-rolls 2d7 and picks two rows in roll order.
// Row 6 (Indigo) type='restrained' and row 7 (Violet) type='banished' carry no
// damage; Violet's row type 'banished' maps via STATUS_RAY_META to the Blinded
// condition (banishment is the fail-of-WIS-save outcome, not the condition).
// PRISMATIC_RAYS is module-private, so the canonical pin is strict exact-key
// toEqual over each row's full save-listener payload, across all 7 rows, plus
// the strict ordered payload/condition arrays for the 8-re-roll mapping.
// Turn-based only: the blindedAt tracking marker is a stamp read at initiative
// seams, never a game timer — pinned as expect.any(Number).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve()),
  computeDamageAfterSave: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './prismaticSprayHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestWizard';
const targetName = 'Goblin';

// Single-target arena so every createSaveListener call maps 1:1 to a table row.
// .handle owns multi-target dispatch; .save-results owns immunity plumbing.
function makeContext(immunities = []) {
  return {
    creatures: [
      { name: targetName, type: 'monster', weaknessesAndResistivities: { immunities } },
      { name: casterName, gridX: 5, gridY: 10 },
    ],
    players: [{ name: casterName, gridX: 5, gridY: 10 }],
    placedItems: [],
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Prismatic Spray',
    automation: {
      type: 'prismatic_spray',
      saveType: 'DEX',
      saveDc: 15,
      damage: '12d6',
      ...automation,
    },
  };
}

function makePlayerStats() {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
  };
}

const originalRandom = Math.random;

// Force the d8 first roll of pickRays (one random draw per target).
function forceRoll(dieValue) {
  Math.random = () => (dieValue - 0.5) / 8;
}

// Force an exact draw sequence: [d8 first roll, then 2d7 draws for the 8-case].
function forceSequence(values) {
  let i = 0;
  Math.random = () => values[Math.min(i++, values.length - 1)];
}

const d7 = dieValue => (dieValue - 0.5) / 7;
const d8 = dieValue => (dieValue - 0.5) / 8;

// Full exact save-listener payload per row type. damageFormula '12d6' is pinned
// as exact row content here; formula-threading/regression is .damage-regression's.
const damagePayload = damageType => ({
  targetName,
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  disadvantage: false,
  damageFormula: '12d6',
  damageType,
});

// Exact-key equality also pins the ABSENCE of damageFormula/damageType —
// the no-damage signature of the two special status rows.
const statusPayload = {
  targetName,
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'none',
  disadvantage: false,
};

// Canonical 7-row table, verified byte-for-byte against PRISMATIC_RAYS at source.
const RAY_TABLE = [
  { roll: 1, name: 'Red', payload: damagePayload('fire') },
  { roll: 2, name: 'Orange', payload: damagePayload('acid') },
  { roll: 3, name: 'Yellow', payload: damagePayload('lightning') },
  { roll: 4, name: 'Green', payload: damagePayload('poison') },
  { roll: 5, name: 'Blue', payload: damagePayload('cold') },
  { roll: 6, name: 'Indigo', payload: statusPayload },
  { roll: 7, name: 'Violet', payload: statusPayload },
];

// ── Tests ──────────────────────────────────────────────────────

describe('PRISMATIC_RAYS canonical table (#1942 rays lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(makeContext());
    savePrompt.buildSaveDc.mockReturnValue(15);
    diceRoller.rollExpression.mockReturnValue({ total: 30 });
    applyDamage.computeDamageAfterSave.mockReturnValue(15);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'prismatic-prompt',
      promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
    });
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  describe('d8 selection mapping — one row, exact payload', () => {
    it.each(RAY_TABLE)(
      'roll $roll selects $name with exact save payload',
      async ({ roll, payload }) => {
        forceRoll(roll);
        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
        expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, payload);
      },
    );
  });

  describe('d8 special case — roll 8 re-rolls 2d7 for two table rows', () => {
    it('maps 8 then (1,2) to fire-then-acid half-damage payloads, in roll order', async () => {
      forceSequence([d8(8), d7(1), d7(2)]);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener.mock.calls.map(c => c[1])).toEqual([
        damagePayload('fire'),
        damagePayload('acid'),
      ]);
    });

    it('maps 8 then (6,7) to two status prompts and applies Restrained-then-Blinded in order', async () => {
      forceSequence([d8(8), d7(6), d7(7)]);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener.mock.calls.map(c => c[1])).toEqual([
        statusPayload,
        statusPayload,
      ]);
      const conditionWrites = useRuntimeState.setRuntimeValue.mock.calls
        .filter(c => c[1] === 'activeConditions')
        .map(c => c[2]);
      expect(conditionWrites).toEqual([['restrained'], ['blinded']]);
    });
  });

  describe('row-type branching — immunity filters damage rows only', () => {
    // Plumbing/summary of immunity is .save-results; this pins only the table
    // contract: rows 1-5 types pass through the DAMAGE_RAY_TYPES immunity gate,
    // rows 6-7 types ('restrained'/'banished') never consult the immunity list.
    it('fire-immune target on row 1 queues no prompt and rolls no dice', async () => {
      damageUtils.getCombatContext.mockResolvedValue(makeContext(['fire']));
      forceRoll(1);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it.each([
      { roll: 6, name: 'Indigo' },
      { roll: 7, name: 'Violet' },
    ])('$name row still queues its save even when the target is immune to its status words', async ({ roll }) => {
      damageUtils.getCombatContext.mockResolvedValue(makeContext(['restrained', 'blinded', 'banished']));
      forceRoll(roll);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, statusPayload);
    });
  });

  describe('Indigo row application (row 6: Restrained + recurring CON saves)', () => {
    beforeEach(() => {
      forceRoll(6);
    });

    it('writes Restrained to activeConditions, deduplicating case-insensitively', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['restrained'], campaignName,
      );

      useRuntimeState.setRuntimeValue.mockClear();
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
        (name === targetName && key === 'activeConditions' ? ['Restrained', 'blinded'] : null));
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['blinded', 'restrained'], campaignName,
      );
    });

    it('stores CON-save condition metadata (dc + ability con)', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditionMeta',
        { restrained: { dc: 15, ability: 'con' } },
        campaignName,
      );
    });

    it('appends an exact prismatic_spray_indigo targetEffect', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [{ target: targetName, effect: 'prismatic_spray_indigo', source: casterName, dc: 15 }],
        campaignName,
      );
    });

    it('replaces only the same caster-source entry; a rival caster entry is kept', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') {
          return [
            { target: targetName, effect: 'prismatic_spray_indigo', source: casterName, dc: 12 },
            { target: targetName, effect: 'prismatic_spray_indigo', source: 'RivalWizard', dc: 13 },
          ];
        }
        return null;
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Same target+effect+source → in-place replace (dc 12→15); rival entry survives.
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [
          { target: targetName, effect: 'prismatic_spray_indigo', source: casterName, dc: 15 },
          { target: targetName, effect: 'prismatic_spray_indigo', source: 'RivalWizard', dc: 13 },
        ],
        campaignName,
      );
    });

    it('resets recurring-save tracking under the exact underscore-normalized key', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        '_prismaticSprayIndigo_Goblin',
        { successes: 0, failures: 0, dc: 15, casterName },
        campaignName,
      );
    });

    it('registers expirations for condition and targetEffect removal', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName,
        effects: [
          { type: 'condition', condition: 'restrained' },
          { type: 'remove_target_effect', effectKey: 'prismatic_spray_indigo', target: targetName, source: casterName },
        ],
        campaignName,
      });
    });

    it('logs the full Restrained condition entry (turn-based wording, no clock)', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Restrained',
        reason: 'Prismatic Spray (Indigo ray)',
        note: 'Goblin is Restrained by Prismatic Spray. At end of each turn, make CON save (DC 15). 3 successes = spell ends. 3 failures = Petrified.',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Violet row application (row 7: Blinded, banish on failed WIS save)', () => {
    beforeEach(() => {
      forceRoll(7);
    });

    it('writes Blinded to activeConditions, deduplicating case-insensitively', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['blinded'], campaignName,
      );

      useRuntimeState.setRuntimeValue.mockClear();
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
        (name === targetName && key === 'activeConditions' ? ['Blinded', 'restrained'] : null));
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['restrained', 'blinded'], campaignName,
      );
    });

    it('appends an exact prismatic_spray_violet targetEffect', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [{ target: targetName, effect: 'prismatic_spray_violet', source: casterName, dc: 15 }],
        campaignName,
      );
    });

    it('stamps violet tracking with caster, dc and a blindedAt marker (never a game timer)', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        '_prismaticSprayViolet_Goblin',
        { casterName, dc: 15, blindedAt: expect.any(Number) },
        campaignName,
      );
    });

    it('registers expirations for condition and targetEffect removal', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName,
        effects: [
          { type: 'condition', condition: 'blinded' },
          { type: 'remove_target_effect', effectKey: 'prismatic_spray_violet', target: targetName, source: casterName },
        ],
        campaignName,
      });
    });

    it('logs the full Blinded condition entry (WIS-save note, no clock)', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Blinded',
        reason: 'Prismatic Spray (Violet ray)',
        note: 'Goblin is Blinded by Prismatic Spray. At start of TestWizard\'s next turn, make WIS save (DC 15). Success = blinded ends. Failure = banished to another plane.',
        timestamp: expect.any(Number),
      });
    });
  });
});
