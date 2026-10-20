// @maintained-by-ai
// LANE — dominate-repeat damage-trigger CONSUMER seam: handleWardedDamageEvents
// (applyDamage.js:808-813) finds the domination and routes the dominated target
// through handleDominateRepeatSave (:1091-1180) INSTEAD of the generic
// unconditional charm-strip (:554-556). This lane owns: findDomination gate
// (:1062 charmed / :1065 dominate-regex / :1068 'dominated' marker), save-DC
// resolution (:1077 characters → :1080 concentration.dc fallback → :1081 null),
// NPC auto-roll vs PC queued-prompt branch (:1153/:1173), end/resist outcomes
// (:1097/:1131), and the exact log bytes (#app log exact).
// Producer bytes consulted (#967), NEVER re-driven here:
//   dominateHandler.js           — the ONLY writer of 'dominated' expirations
//     (applyDamage.js:1057); producer internals canon → dominateHandler.beast.test.js
//     (#1901), whose header :28-29 explicitly delegates this consumer seam here.
// Dup map (#1038):
//   resistance halving CANON → applyDamage.helpers.test.js :52-84 (#1182)
//   Hypnotic Pattern trio break → applyDamage.hypnotic-break.test.js (SP-069)
//   concentration lifecycle → concentrationService (existing 🔴 x3 @ledger)
//   buffs/auras/attacker riders/compelled duel → #1186/#1185/#1184/#1187 lanes
// Rec #1139 verdict (owner-verified live #1038): the carried "duplicate ender
// simulation" targets the selfBuff ender suite — monsterSelfBuff.test.js
// :322-368 (refreshed #1146) owns endSelfBuffOnTrigger (te-drop + expiration
// clock). Domination end is a DIFFERENT mechanism (caster concentration clear +
// charm-strip + combatSummary persist, :1097-1128) and lives ONLY here
// (grep 'Repeat Save'/'spell ends on successful save' → this file + the
// dominateHandler.beast.test.js pointer to it). NOT applicable — nothing cut.
// Store-faithful keyed runtime stub (#1137/#1057/#1186): every get/set is
// `${name}.${key}`; 'pendingExpirations' lives under the CASTER's name only —
// a mutant reading expirations off the target's name dies. setRuntimeValue
// WRITES the store, so post-resolution reads are store-truth; the strip-only
// write census tolerates concentrationService's harmless double-write of [].
// Zero-effect honest legs (#948/#1026): DC-null leg pins zero rolls, zero
// prompts, zero condition writes while damage bytes still land (#1160 newHp).
// Seams are event/scheme-based — never wall-clock (#app MANDATORY): domination
// end is driven by save outcome, the only setTimeouts are microtask flushes of
// the promise chain (benign event-loop yield).
// old -> new map (10 its -> 4 tables/12 legs):
//   findDomination positive            -> T1 positive row (positive also rides every consumer leg)
//   findDomination no-charm          -> T1 row 2 (NEW clause falsifier — old file had none for :1062)
//   findDomination Haste caster      -> T1 row 3 (:1065 regex)
//   NPC fail auto-roll               -> T2 fail leg (+exact log bytes, auto-roll pin, persist-not pin)
//   NPC success ender                -> T2 success leg (+store-truth [], strip-only write census, persist pin)
//   DC unresolvable                  -> T2 null-leg (+zero-roll/zero-prompt census) ; fallback DC :1080 NEW leg (T2)
//   PC queued prompt fail            -> T3 fail leg (+no-auto-roll pin, exact payload transport bytes)
//   PC prompt success                -> T3 success leg
//   non-dominate NPC charm strip     -> T4 row 1 ('took damage (Charm)' exact)
//   non-dominate PC charm strip      -> T4 row 2 ('took damage (Friends)' exact — OLD asserted no reason)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { applyDamageToTarget, findDomination } from './applyDamage.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import storage from '../../ui/storage.js';
import { rollD20 } from '../../dice/diceRoller.js';

const { store } = vi.hoisted(() => ({ store: {} }));

// ── Mocks ─────────────────────────────────────────────────────────
// Store-faithful keyed runtime (#1137): set writes, get reads back.

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store[`${name}.${key}`]),
  setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; }),
  getAllStoreKeys: vi.fn(() => []),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001'), getName: vi.fn((n) => String(n).toLowerCase()) } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Helpers ───────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';
const CASTER = 'DivinationWizard';
const PROMPT_ID = 'test-guid-001';

const rstore = (name, key) => `${name}.${key}`;
const conditionWrites = () => setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeConditions');
const logEntries = () => addEntry.mock.calls.map((c) => c[1]).filter(Boolean);
const flush = () => new Promise((r) => setTimeout(r, 0)); // microtask flush of the save-promise chain (benign yield)

function creature(name, type, hp, extra = {}) {
  return {
    name,
    type,
    maxHp: hp,
    currentHp: hp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

const dominatedExpiration = (target) => ({
  target,
  effects: [{ type: 'dominated', condition: 'charmed' }],
  appliedRound: 1,
  expiryRounds: Infinity,
  expireOnCreatureName: null,
});

// Seeds a fully dominated scene: charmed target + caster concentrating on
// Dominate Person with the dominateHandler-written 'dominated' marker under
// the CASTER's key. Falsifier rows override exactly one fact.
function rig({
  target = 'Thug 1',
  targetType = 'npc',
  hp = 32,
  extra = {},
  concentration = { id: 'c1', spell: 'Dominate Person', dc: null },
  expirations = [dominatedExpiration(target)],
  charmed = true,
} = {}) {
  const caster = creature(CASTER, 'player', 70, { concentration });
  const targetCreature = creature(target, targetType, hp, extra);
  if (charmed) store[rstore(target, 'activeConditions')] = ['charmed'];
  store[rstore(target, 'currentHitPoints')] = hp;
  if (expirations) store[rstore(CASTER, 'pendingExpirations')] = expirations;
  return { caster, cs: { round: 1, creatures: [caster, targetCreature] } };
}

const wizardChar = (saveDc = 17) => ({ name: CASTER, computedStats: { spellAbilities: { saveDc } } });

// ── Tests ─────────────────────────────────────────────────────────

describe('SP-037: dominated target repeats its WIS save on damage (applyDamage consumer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach((k) => delete store[k]);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('T1 findDomination gate — each row falsifies exactly one clause (#1035)', () => {
    it.each([
      ['full dominate rig matches', {}, { casterName: CASTER, spellName: 'Dominate Person' }],
      ['charmed-less target is never dominated (:1062)', { charmed: false }, null],
      ['caster concentrating on Haste is not domination (:1065)', { concentration: { spell: 'Haste', dc: null } }, null],
      ['charmed-marker expiration is not a dominated latch (:1068)', { expirations: [{ target: 'Thug 1', effects: [{ type: 'charmed', condition: 'charmed' }] }] }, null],
    ])('%s', (_label, over, expected) => {
      const { cs } = rig(over);
      expect(findDomination('Thug 1', cs, CAMPAIGN)).toEqual(expected);
    });
  });

  describe('T2 NPC dominated target — inline auto-roll lane (:1173)', () => {
    it('failed auto-save: charmed and caster concentration retained, exact roll + ability_use log bytes, no persist, no prompt', async () => {
      const { caster, cs } = rig();
      rollD20.mockReturnValue(1);

      const result = await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: CAMPAIGN, characters: [wizardChar()] });

      expect(result.newHp).toBe(13);
      expect(rollD20).toHaveBeenCalledTimes(1);
      expect(store[rstore('Thug 1', 'activeConditions')]).toEqual(['charmed']);
      expect(caster.concentration).not.toBeNull();
      // NOTE: NPC lane persists combatSummary unconditionally (:917) — persist
      // is NOT dominate-distinct on the NPC side; the ender pin lives in T3 PC.
      expect(sendSavePrompt).not.toHaveBeenCalled();
      expect(conditionWrites().length).toBe(0);
      expect(logEntries().filter((e) => e.type === 'condition' && e.action === 'removed').length).toBe(0);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll',
        rollType: 'save',
        characterName: 'Thug 1',
        name: 'Dominate Person Repeat Save',
        rolls: [1, 1],
        total: 1,
        bonus: 0,
        saveType: 'WIS',
        saveDc: 17,
        saveResult: 'failure',
      });
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'ability_use',
        characterName: 'Thug 1',
        abilityName: 'Dominate Person',
        description: 'Thug 1 failed the repeat WIS save (DC 17) after taking damage — remains Charmed (dominated by DivinationWizard).',
        timestamp: expect.any(Number),
      });
    });

    it('successful auto-save ends the domination: concentration cleared, charmed store emptied by charmed-strip writes only, persist + exact removal log bytes', async () => {
      const { caster, cs } = rig();
      rollD20.mockReturnValue(17);

      const result = await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: CAMPAIGN, characters: [wizardChar()] });

      expect(result.newHp).toBe(13);
      expect(caster.concentration).toBeNull();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
      expect(store[rstore('Thug 1', 'activeConditions')]).toEqual([]);
      // Every condition write is a charmed-strip (endDomination :1105 + the real
      // concentrationService cleanup double-writes [] harmlessly — nothing re-adds).
      expect(conditionWrites().every((c) => Array.isArray(c[2]) && !c[2].includes('charmed'))).toBe(true);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll',
        rollType: 'save',
        characterName: 'Thug 1',
        name: 'Dominate Person Repeat Save',
        rolls: [17, 17],
        total: 17,
        bonus: 0,
        saveType: 'WIS',
        saveDc: 17,
        saveResult: 'success',
      });
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'condition',
        action: 'removed',
        characterName: 'Thug 1',
        condition: 'Charmed',
        reason: 'Dominate Person — spell ends on successful save against damage',
        timestamp: expect.any(Number),
      });
    });

    it('save DC falls back to the caster creature concentration.dc when no character sheet resolves (:1080)', async () => {
      const { cs } = rig({ concentration: { id: 'c1', spell: 'Dominate Person', dc: 15 } });
      rollD20.mockReturnValue(8);

      await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: CAMPAIGN, characters: [] });

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        name: 'Dominate Person Repeat Save',
        saveDc: 15,
        saveResult: 'failure',
      }));
    });

    it('no DC at all: zero rolls, zero prompts, zero condition writes — charmed retained and damage bytes still land (:1081/:1094)', async () => {
      const { caster, cs } = rig({ concentration: { id: 'c1', spell: 'Dominate Person', dc: null } });

      const result = await applyDamageToTarget(cs, 'Thug 1', 19, ['Fire'], { campaignName: CAMPAIGN, characters: [] });

      expect(rollD20).not.toHaveBeenCalled();
      expect(sendSavePrompt).not.toHaveBeenCalled();
      expect(conditionWrites().length).toBe(0);
      expect(logEntries().filter((e) => e.name === 'Dominate Person Repeat Save').length).toBe(0);
      expect(store[rstore('Thug 1', 'activeConditions')]).toEqual(['charmed']);
      expect(caster.concentration).not.toBeNull();
      expect(result.newHp).toBe(13);
    });
  });

  describe('T3 PC dominated target — queued save prompt, NEVER auto-roll (:1153)', () => {
    const pcRig = () => rig({
      target: 'EvasiveFighter',
      targetType: 'player',
      hp: 40,
      extra: { saveBonuses: { wis: 5 } },
    });

    it('damage queues a WIS/DC17 prompt (not an inline roll) and a failing result retains charmed + concentration with exact log bytes', async () => {
      const { caster, cs } = pcRig();

      const result = await applyDamageToTarget(cs, 'EvasiveFighter', 10, ['Slashing'], { campaignName: CAMPAIGN, characters: [wizardChar()] });

      expect(result.newHp).toBe(30);
      expect(store[rstore('EvasiveFighter', 'currentHitPoints')]).toBe(30);
      expect(rollD20).not.toHaveBeenCalled();
      expect(sendSavePrompt).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        promptId: PROMPT_ID,
        targetName: 'EvasiveFighter',
        attackerName: CASTER,
        saveType: 'WIS',
        saveDc: 17,
        dcSuccess: 'none',
        condition: 'charmed',
        sourceName: CASTER,
      }));
      // Charmed retained pre-resolution
      expect(conditionWrites().length).toBe(0);

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: PROMPT_ID, success: false, roll: 2, total: 7, saveBonus: 5, saveType: 'WIS', saveDc: 17 },
      }));
      await flush();

      expect(caster.concentration).not.toBeNull();
      expect(store[rstore('EvasiveFighter', 'activeConditions')]).toEqual(['charmed']);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll',
        rollType: 'save',
        characterName: 'EvasiveFighter',
        name: 'Dominate Person Repeat Save',
        rolls: [2],
        total: 7,
        bonus: 5,
        saveType: 'WIS',
        saveDc: 17,
        saveResult: 'failure',
      });
    });

    it('a successful save-result ends the domination: concentration cleared, persisted, charmed store emptied, exact removal log bytes', async () => {
      const { caster, cs } = pcRig();

      await applyDamageToTarget(cs, 'EvasiveFighter', 10, ['Slashing'], { campaignName: CAMPAIGN, characters: [wizardChar()] });

      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: PROMPT_ID, success: true, roll: 15, total: 20, saveBonus: 5, saveType: 'WIS', saveDc: 17 },
      }));
      await flush();

      expect(caster.concentration).toBeNull();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
      expect(store[rstore('EvasiveFighter', 'activeConditions')]).toEqual([]);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'condition',
        action: 'removed',
        characterName: 'EvasiveFighter',
        condition: 'Charmed',
        reason: 'Dominate Person — spell ends on successful save against damage',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('T4 non-dominate charm regression guard — generic strip still fires, reasons byte-distinct (:554-556)', () => {
    it.each([
      ['NPC charm strips with reason "took damage (Charm)"', { target: 'Thug 1', targetType: 'npc', hp: 32 }, 'took damage (Charm)'],
      ['PC charm strips with reason "took damage (Friends)"', { target: 'EvasiveFighter', targetType: 'player', hp: 40 }, 'took damage (Friends)'],
    ])('%s', async (_label, over, reason) => {
      const { cs } = rig({ ...over, concentration: null, expirations: null });

      await applyDamageToTarget(cs, over.target, 10, ['Slashing'], { campaignName: CAMPAIGN, characters: [] });

      expect(store[rstore(over.target, 'activeConditions')]).toEqual([]);
      expect(conditionWrites().length).toBe(1);
      expect(rollD20).not.toHaveBeenCalled();
      expect(sendSavePrompt).not.toHaveBeenCalled();
      expect(logEntries().filter((e) => e.name === 'Dominate Person Repeat Save').length).toBe(0);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: over.target,
        condition: 'Charmed',
        reason,
      }));
    });
  });
});
