// @maintained-by-ai
// truePolymorph HEPTAD lane #1986 — .transforms (FINAL lane, closes the family).
// Subject: truePolymorphService.js. Seam map: truePolymorphHandleModes.test.js header
// (#1980–#1986). Siblings closed: #1980 handleModes 5, #1981 handler 29, #1982
// resolveMaxCR 33 (canonical), #1983 apply 17, #1984 queries (4 dead predicates retired),
// #1985 summon-revert 27 (owns summon-spawn + revert, recast-clobber consequence pinned there).
//
// OWNERSHIP (content judged at source, prior split misfiles reassessed):
//   · applyObjectTransform (:197-272) — FULL canonical authority for the OBJECT-side
//     transform lives HERE: no_target zero-write guard (:200), object-form stamp with
//     UNTOUCHED combat stats (objects borrow no form stats — the creature-side swap is
//     #1983's territory), forward incapacitated append (:232-236), three-key te cleanup
//     strict table (:241-253, superset of #1983's two-key stampTruePolymorphEffect),
//     concentration delegation exact DC (:255-258 → :87-92), cs persist by identity
//     (:238-239), full-string log incl. 'an stone_block' grammar bug (:260-269),
//     icon table (:205-214), addEntry reject-resilience (:269 catch).
//   · confirmTruePolymorphTransform (:139-195) — guards + unpinned deltas ONLY.
//     #1983 canonically owns the application-semantics suite; this file keeps only
//     what #1983's tables do NOT reach (see SHED LEDGER).
//
// SHED LEDGER (byte-twin consolidation NOTE executed here — this file sheds; canonical
// owners, exact test names):
//   · 'summons creature for object_into_creature mode' + 'summons creature with random
//     initiative when caster has no initiative' → #1985
//     'object_into_creature with NO target routes through confirmTruePolymorphTransform
//     to the summon seam (:140-150)' (pins ok + init '14.9' + random-spy UNREACHED +
//     slotLevel :146 drop — far stronger than the loadMonsters-was-called smoke here).
//   · 'overrides creature stats with beast form and stores originals' → #1983
//     'in-place MERGE, not replace: form overwrites maxHp/ac/speed + polymorph
//     bookkeeping only; currentHp/name/initiative/size/senses/equipment carry through'.
//   · 'sets temp HP to the full beast form HP' → #1983
//     'tempHp policy: THP anchored to FULL form HP regardless of wounded currentHp'.
//   · 'persists the combat summary' (confirm) → #1983 pins storage.set(cs BY IDENTITY) +
//     setCombatSummaryCache(cs) in 'caster absent from combat: transform still applies,
//     concentration silently skipped' and 'concentration DC contrast: object-shaped
//     abilities DO honor .CON.bonus — isolating the array-shape defect as strictly :88'.
//   · 'adds a true_polymorph targetEffect' + 'replaces an existing true_polymorph or
//     polymorph effect instead of duplicating' → #1983
//     'targetEffects stamp: exact strict table — array-target entries cleaned by
//     first-element match, unrelated effects kept, new te last, skipSync=true'.
//   · 'registers concentration on the caster' (any(Number) weak twin) → #1983
//     'PIN: BUG-FLAG abilities-ARRAY (:88) — concentration DC computed WITHOUT the CON
//     modifier on prod array-shaped abilities' + object-shape contrast pin.
//   · 'writes a true_polymorph pending expiration with infinite rounds' → #1983
//     'pendingExpirations: Infinity-rounds marker (no clock), replace-not-duplicate,
//     appliedRound from cs.round with 1 fallback'.
//   · 'logs the transformation' (includes-filter weak twin) → #1983
//     'logs the transformation with the exact composed save_result entry (saveDc 0 /
//     success:false hardcoded — cosmetic, pinned honest)'.
//
// RETAINED CONFIRM-SIDE DELTAS (reassigned HERE — verified absent from every sibling):
//   · no_target zero-write guard (:154-157): #1981 gates the HANDLER's target guards,
//     #1983 never seeds a missing-target cs; this is the only pin.
//   · te stamp mode fallback (:134 `mode || 'creature_to_creature'`): #1983's strict
//     table passes an explicit mode ('creature_to_object'), so the fallback branch was
//     unpinned family-wide. CharSheet.jsx:276 supplies the same default upstream —
//     prod-redundant but honest-pinned.
//   · applyCreatureForm stat defaults (:95-96 hit_points→0 / armor_class→10) + snapshot
//     ?? fallbacks (:99-101): #1983's fixtures are fully-populated; the default
//     branches were unpinned family-wide. The old weak 'defaults to 0' test is
//     strengthened to canonical here.
//
// FLAGS (raised here; production NOT touched):
//   1. BROKEN ICON (raised here): bronze_statue → 'fa-statue' (:212) does NOT exist in
//      FA Free — verified against node_modules/@fortawesome/fontawesome-free/metadata/
//      icons.yml (no top-level `statue:` key; all seven sibling icons present). Same
//      string on the UI chip at ObjectTransformModal.jsx:11 → bronze statue transforms
//      render glyph-missing in prod. Final-report action: pick a Free icon (fa-chess-
//      rook class). Pinned as shipped.
//   2. INPUT DRIFT modal→service (raised here): ObjectTransformModal.jsx:26 rewrites
//      'other' → customType.trim() || 'Stone Block' BEFORE calling, so the service's
//      `other: 'fa-circle'` table key (:213) is direct-call-only; arbitrary custom
//      strings AND 'Stone Block' (capitalised, spaced) are PROD-REACHABLE unknowns
//      that hit the default icon. Pinned honestly in the icon table.
//   3. CASE-SENSITIVITY SPLIT (raised here): forward incap check :233 is a case-
//      SENSITIVE includes('incapacitated'), while #1985's revert filter (:396) strips
//      case-INSENSITIVELY — a stored 'Incapacitated' therefore suppresses nothing
//      forward and yields a duplicate append. Pinned honest.
//   4. abilities-ARRAY (:88) cross-ref #1983 flag 1 / #1985 flag 1: object-side
//      delegation pinned at exact DC 12 (8+prof4+CON-lost) on prod array shape.
//   5. recast-snapshot-clobber cross-ref #1983 flag 2: :221 clobbers polymorphOriginal
//      unconditionally too; consequence (revert restores last snapshot) pinned in #1985.
//      Object-side is benign vs stats (apply never overwrites maxHp/ac/speed — guard
//      pinned below) but the stamp still re-snapshots post-transform values on recast.
//
// LIVENESS (verified fresh): applyObjectTransform LIVE via CharSheet.jsx:25/:282
// (arity 6/6 verified at call site — destructure is exactly {targetName, objectType,
// casterName, spell, campaignName, playerStats}; NO slotLevel key, spell.level unread —
// object transforms are slot-immutable; CharSheet :281 defaults target to CASTER =
// self-transform default). confirmTruePolymorphTransform LIVE via CharSheet.jsx:25/:268.
// getRuntimeValue is really 2-arg (useRuntimeState.js:63) — the prod 3rd campaignName
// arg is silently ignored; mocks here depend on (key, subKey) ONLY.
// Turn-based only: no timers in this lane or the source lanes; duration 'concentration'
// is combat-scoped (no-timers policy); the addEntry .catch (:269) is a network-rejection
// guard, not a game clock. No disk-row pins apply object-side: objectType values and the
// icon table are hardcoded (object side is CR-free — no challenge_rating touch; verified
// zero public/data hits for stone_block/iron_chain).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
}));

vi.mock('./truePolymorphHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('./polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

import {
  confirmTruePolymorphTransform,
  applyObjectTransform,
} from './truePolymorphService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

const SPELL = { name: 'True Polymorph', level: 9 };

const BEAR = {
  name: 'Bear', index: 'bear', size: 'Large',
  hit_points: 34, armor_class: 11, speed: '40 ft.', challenge_rating: '1',
};

// PROD ARRAY abilities shape (flag 4): .CON is undefined → DC = 8 + 4 + 0 = 12.
function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Constitution', baseScore: 14 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeTarget(overrides = {}) {
  return {
    name: targetName, type: 'monster',
    currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.',
    ...overrides,
  };
}

function objectArgs(overrides = {}) {
  return {
    targetName,
    objectType: 'stone_block',
    casterName,
    spell: SPELL,
    campaignName,
    playerStats: makePlayerStats(),
    ...overrides,
  };
}

function defaultRuntimeImpl() {
  getRuntimeValue.mockImplementation((key, subKey) => {
    if (key === 'campaign' && subKey === 'targetEffects') return [];
    if (key === targetName && subKey === 'activeConditions') return [];
    return undefined;
  });
}

function callsFor(subKey) {
  return vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === subKey);
}

describe('truePolymorphService.confirmTruePolymorphTransform — guards + unpinned deltas (#1986)', () => {
  // Stat-swap / tempHp / persist / te-table / conc-DC / pendingExpirations / log are
  // CANONICAL IN #1983 (.apply) — see SHED LEDGER in the header; not re-run here.

  beforeEach(() => {
    vi.clearAllMocks();
    defaultRuntimeImpl();
  });

  it('no_target (:154-157): exact refusal + ZERO writes + summon seam untouched — only pin family-wide', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = await confirmTruePolymorphTransform({
      targetName: 'Missing',
      creature: BEAR,
      casterName,
      spell: SPELL,
      playerStats: makePlayerStats(),
      campaignName,
    });

    expect(result).toEqual({ ok: false, reason: 'no_target' });
    expect(errorSpy).toHaveBeenCalledWith('[truePolymorphService] Target Missing not found in combat.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    // no summon-branch leak: non-summon confirm must never reach the dataLoader
    expect(loadMonsters).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('te stamp delta :134 — mode fallback `mode || "creature_to_creature"` (unreached by #1983, which passes explicit mode; CharSheet :276 supplies same default upstream)', async () => {
    const cs = { creatures: [makeTarget(), { name: casterName, type: 'player' }] };
    getCombatContext.mockResolvedValue(cs);

    // No mode key passed at all.
    const result = await confirmTruePolymorphTransform({
      targetName,
      creature: BEAR,
      casterName,
      spell: SPELL,
      playerStats: makePlayerStats(),
      campaignName,
    });

    expect(result).toEqual({ ok: true });
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{
        target: targetName,
        source: casterName,
        effect: 'true_polymorph',
        duration: 'concentration',
        beastName: 'Bear',
        mode: 'creature_to_creature',
      }],
      campaignName,
      true,
    );
  });

  it('applyCreatureForm stat defaults delta (:95-96, :99-101) — hit_points→0 / armor_class→10, snapshot ?? falls back to FORM stats when combat creature lacks them', async () => {
    // Combat creature missing maxHp AND ac — snapshot must fall back to the FORM's.
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, speed: '30 ft.' }, { name: casterName, type: 'player' }] };
    getCombatContext.mockResolvedValue(cs);

    await confirmTruePolymorphTransform({
      targetName,
      creature: BEAR,
      casterName,
      spell: SPELL,
      playerStats: makePlayerStats(),
      campaignName,
    });

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(34);
    expect(creature.ac).toBe(11);
    expect(creature.polymorphOriginal).toEqual({ maxHp: 34, ac: 11, speed: '30 ft.' });
    expect(creature.polymorphBeast).toEqual({
      name: 'Bear', index: 'bear', size: 'Large',
      hitPoints: 34, armorClass: 11, speed: '40 ft.', challengeRating: '1',
    });

    // Form with NO hit_points and NO armor_class → documented defaults 0 / 10.
    getCombatContext.mockResolvedValue(cs);
    await confirmTruePolymorphTransform({
      targetName,
      creature: { name: 'Bear', index: 'bear', size: 'Large', speed: '40 ft.', challenge_rating: '1' },
      casterName,
      spell: SPELL,
      playerStats: makePlayerStats(),
      campaignName,
    });

    expect(creature.maxHp).toBe(0);
    expect(creature.ac).toBe(10);
    expect(creature.polymorphBeast.hitPoints).toBe(0);
    expect(creature.polymorphBeast.armorClass).toBe(10);
    // THP policy follows the resolved hp (0 here) — anchored by applyCreatureForm :118-119.
    expect(callsFor('tempHp').at(-1)[2]).toBe(0);
    expect(callsFor('polymorphTempHp').at(-1)[2]).toBe(0);
  });
});

describe('truePolymorphService.applyObjectTransform — canonical object side (#1986)', () => {
  let cs;

  beforeEach(() => {
    vi.clearAllMocks();
    cs = { creatures: [makeTarget(), { name: casterName, type: 'player' }] };
    getCombatContext.mockResolvedValue(cs);
    defaultRuntimeImpl();
  });

  it('no_target (:200-203): exact refusal + ZERO writes (guard fires before icon table and any stamp)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = await applyObjectTransform(objectArgs({ targetName: 'Missing' }));

    expect(result).toEqual({ ok: false, reason: 'no_target' });
    expect(errorSpy).toHaveBeenCalledWith('[truePolymorphService] Target Missing not found in combat for object transform.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('object-form stamp: exact polymorphObject/objectType/source/original snapshot; combat stats UNTOUCHED (object side borrows no form stats); cs persisted BY IDENTITY; zero tempHp/beast/expiration keys', async () => {
    const result = await applyObjectTransform(objectArgs());

    expect(result).toEqual({ ok: true });
    const creature = cs.creatures[0];
    expect(creature.polymorphSource).toBe(casterName);
    expect(creature.polymorphOriginal).toEqual({ maxHp: 15, ac: 13, speed: '30 ft.' });
    expect(creature.polymorphObject).toEqual({ type: 'stone_block', icon: 'fa-cube' });
    expect(creature.objectType).toBe('stone_block');

    // no-side-effect guard: creature-form keys are NEVER written object-side.
    expect(creature.maxHp).toBe(15);
    expect(creature.ac).toBe(13);
    expect(creature.speed).toBe('30 ft.');
    expect(creature.polymorphBeast).toBeUndefined();
    expect(creature.beastName).toBeUndefined();
    expect(callsFor('tempHp')).toHaveLength(0);
    expect(callsFor('polymorphTempHp')).toHaveLength(0);
    expect(callsFor('pendingExpirations')).toHaveLength(0); // Infinity marker is confirm-side only (#1983)

    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('incapacitated appended when absent — exact single write [incapacitated] (no skipSync, 4-arg)', async () => {
    await applyObjectTransform(objectArgs({ objectType: 'iron_chain' }));

    expect(setRuntimeValue).toHaveBeenCalledWith(
      targetName,
      'activeConditions',
      ['incapacitated'],
      campaignName,
    );
    expect(callsFor('activeConditions')).toHaveLength(1);
  });

  it('PIN: CASE-FLAG :233 — suppression is case-SENSITIVE: lowercase present → zero writes; stored "Incapacitated" does NOT suppress, duplicate appended', async () => {
    // Phase A: exact lowercase hit → no condition write at all.
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['incapacitated'];
      return undefined;
    });
    await applyObjectTransform(objectArgs({ objectType: 'iron_chain' }));
    expect(callsFor('activeConditions')).toHaveLength(0);

    // Phase B (flag 3): revert strips case-INSENSITIVELY (#1985 :396) but the forward
    // includes() is case-sensitive — mixed-case store yields a duplicate append.
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['Incapacitated'];
      return undefined;
    });
    await applyObjectTransform(objectArgs({ objectType: 'iron_chain' }));
    expect(setRuntimeValue).toHaveBeenCalledWith(
      targetName,
      'activeConditions',
      ['Incapacitated', 'incapacitated'],
      campaignName,
    );
  });

  it('te strict table (:241-253) — array-target cleanup across ALL THREE polymorph keys (superset of #1983 stampTruePolymorphEffect), unrelated kept, new object_transform last, skipSync=true', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: [targetName], effect: 'polymorph', source: 'OldCaster' },
          { target: targetName, effect: 'object_transform', source: 'OldCaster' },
          { target: targetName, effect: 'true_polymorph', source: 'OldCaster' },
          { target: 'Other', effect: 'hold_monster', source: 'Other' },
        ];
      }
      return undefined;
    });

    await applyObjectTransform(objectArgs({ objectType: 'wooden_crate' }));

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [
        { target: 'Other', effect: 'hold_monster', source: 'Other' },
        {
          target: targetName,
          source: casterName,
          effect: 'object_transform',
          duration: 'concentration',
          objectType: 'wooden_crate',
        },
      ],
      campaignName,
      true,
    );
  });

  it('concentration delegation: exact DC 12 on PROD ARRAY abilities (:88 flag cross-ref #1983/#1985 — CON never counts), spell.name from arg, cs persisted by identity', async () => {
    await applyObjectTransform(objectArgs());

    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'True Polymorph', 12);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('caster absent from combat: object transform still lands ok:true, concentration skipped, main cs persist still fires (:238)', async () => {
    const csNoCaster = { creatures: [makeTarget()] };
    getCombatContext.mockResolvedValue(csNoCaster);

    const result = await applyObjectTransform(objectArgs());

    expect(result).toEqual({ ok: true });
    expect(csNoCaster.creatures[0].polymorphObject).toEqual({ type: 'stone_block', icon: 'fa-cube' });
    expect(addConcentration).not.toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', csNoCaster, campaignName);
  });

  it('logs the transformation — full composed save_result entry, grammar bug "an stone_block" pinned honest; addEntry rejection cannot break the transform (:269 catch)', async () => {
    const result = await applyObjectTransform(objectArgs());

    expect(result).toEqual({ ok: true });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'save_result',
      characterName: casterName,
      rollType: 'save-polymorph',
      targetName,
      saveDc: 0,
      saveType: 'WIS',
      success: false,
      description: "Goblin is transformed into an stone_block by TestCaster's True Polymorph.",
    });

    // Network-rejection hygiene (not a game timer): logged, swallowed, flow stays ok.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('log down');
    addEntry.mockRejectedValueOnce(boom);

    await expect(applyObjectTransform(objectArgs())).resolves.toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalledWith('[truePolymorphService:log-error]', boom);
    errorSpy.mockRestore();
  });

  it('icon table strict (:205-214) — all 7 UI enums + direct-call-only "other" + PROD-REACHABLE modal unknowns default to fa-circle', async () => {
    // Modal parity: ObjectTransformModal.jsx OBJECT_TYPES values map byte-identically to
    // the seven service enums EXCEPT bronze_statue whose 'fa-statue' is NOT in FA Free
    // (flag 1 — icons.yml has no `statue:` key; glyph-missing in prod, pinned as shipped).
    const TABLE = [
      ['stone_block', 'fa-cube'],
      ['iron_chain', 'fa-link'],
      ['wooden_crate', 'fa-box'],
      ['iron_bars', 'fa-grip-lines'],
      ['glass_vial', 'fa-flask'],
      ['leather_book', 'fa-book'],
      ['bronze_statue', 'fa-statue'],
      ['other', 'fa-circle'], // direct-call only: modal :26 rewrites 'other' before the call
    ];
    for (const [objectType, icon] of TABLE) {
      await applyObjectTransform(objectArgs({ objectType }));
      expect(cs.creatures[0].polymorphObject, objectType).toEqual({ type: objectType, icon });
    }

    // Modal :26 prod outputs — custom text or 'Stone Block' land as table MISSES
    // (fallback branch :228 `|| 'fa-circle'`), never the 'other' key.
    for (const objectType of ['Stone Block', 'Rock', 'mystery_type']) {
      await applyObjectTransform(objectArgs({ objectType }));
      expect(cs.creatures[0].polymorphObject, objectType).toEqual({ type: objectType, icon: 'fa-circle' });
    }
  });
});
