// @maintained-by-ai
// MA-0554 base CANON: Darkmantle Darkness Aura (actions[1], 15-ft self
// emanation, 1/Day) — self-origin zone rows arm the authored te ON SELF via
// resolveSelfAuraRow, spend the row's 1/Day through the MA-0020
// monsterSpellUses economy, and refuse the second activation with
// `<slug>_refused` + zero spend/zero te. Light/vision legs stay §70 advisory
// on the arm log + popup.
//
// selfAura family split (cite-owner convention, per #1134 family map):
//   this file          MA-0554 base CANON — isSelfAuraRow truth table,
//     first-click/refusal machinery, double-spend guard, inert-row tolerance,
//     §70 fallback builders + advisory precedence, darkmantle disk bytes.
//   monsterSelfAura.ink-cloud.test.js  MA-0813/MA-1251 — ink_cloud te
//     golden, giant-octopus + octopus disk bytes, ungated zero-spend leg.
//   monsterSelfAura.giant-squid-ink-cloud.test.js  MA-0830 CLOSED #1134 —
//     giant-squid disk bytes + squid day-economy lifecycle.
//   monsterAbilityUses.test.js         CANON #1082 — gate truth table
//     (:105-126), refusal wording pinned ONCE exact (#829), spend arithmetic.
//   MonsterCardModal.darkmantle-aura.test.jsx      MA-0554 modal chip seam
//     only — routes clicks here, never re-proves the math.
//
// PRESERVED-CITED-BY:
//  - refusal machinery (was :100-117) — cited LIVE by ink-cloud #1135 fold;
//    kept as the store-faithful exhausted leg of the lifecycle below (#1091):
//    exhausted press → darkness_aura_refused bytes + zero extra te/spend +
//    'Uses Exhausted' popup (wording shape cited to #1082, never re-pinned).
//  - isSelfAuraRow truth table, double-spend guard, inert-row tolerance,
//    §70 fallback builder — cited by BOTH ticket-lane headers (#1134 squid
//    :13-15, ink-cloud :17-19 "Never re-driven here"). Both lanes defer
//    generic false-negatives to this truth table — it is the sole owner.
//  - :77 te stamp — duration:'concentration' is stamped generically on every
//    self-aura arm (honest-metadata note #1134); matches RAW on darkmantle
//    (authored Concentration). Pinned as the exact te-meta tuple.
// #903: it.each tables dominate. Builder legs run SYNTHETIC rows only —
// monster bytes are never re-locked here (squid #1134, ink-cloud/octopus
// #1135; darkmantle bytes are owned by this MA-0554 base lane).
// No wall-clock seams (#app MANDATORY): expiry-clock prose reaches the
// builders only via injected armedRounds (enforcement is off in the unit
// env ⇒ 'GM-enforced' prose on live presses); Date.now() lives in log
// timestamps and is never asserted.
// old→new: old 'disk data shape' → test 1 (verbatim bytes + seam acceptance);
// old 'isSelfAuraRow: true only for…' inline asserts → it.each truth table
// (superset: junk-key tolerance #1085, honest no_save/empty/null legs
// #945/#967, save_dc-0 edge); old 'first click' + old refusal :100-117 →
// consolidated store-faithful lifecycle (exact log/popup bytes, campaign-
// keyed tuple #932/#1019, advisory-precedence falsifier); old 'double-spend
// guard' kept, strengthened (#1035 reach-branch: pins refusal log bytes,
// loud console guard, zero-write #1026; #1136 flip: pin flipped from
// 'popup silent' to the mid-flight refusal popup exact bytes — the guard no
// longer refuses silently); old 'non-self-aura inert' →
// inert it.each with full zero-write pins (#934); old '§70 fallback builder'
// → builder it.each (fallback/precedence/clock-kind legs + popup builder).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isSelfAuraRow,
  resolveSelfAuraRow,
  buildSelfAuraArmLog,
  buildSelfAuraPopup,
  SELF_AURA_LIGHT_ADVISORY,
} from './monsterSelfAura.js';
import monstersData from '../../../public/data/monsters.json';

// Real on-disk darkmantle rows — no transcription (#977); this lane OWNS the
// darkmantle bytes (squid bytes → #1134, ink-cloud/octopus → #1135, #1132).
const darkmantle = monstersData.find(m => m.name === 'Darkmantle');
const CRUSH_ROW = darkmantle.actions[0];
const AURA_ROW = darkmantle.actions[1];

function makeDeps(stored = {}) {
  const store = { ...stored };
  return {
    store,
    registerTargetEffect: vi.fn(),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn(() => Promise.resolve()),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('MA-0554 darkmantle disk data shape (base owns these bytes)', () => {
  it('Darkness Aura carries the self-origin MA-0043 zone dict, numeric uses, save-less; the Crush row stays out of the lane', () => {
    expect(AURA_ROW.name).toBe('Darkness Aura');
    expect(AURA_ROW.uses).toBe('1/Day');
    expect(AURA_ROW.maxUses).toBe(1);
    expect(AURA_ROW.range).toBe('15-foot Emanation');
    expect(AURA_ROW.duration).toBe('Concentration, up to 10 minutes');
    expect(AURA_ROW.zone).toEqual({
      self: true,
      radius_ft: 15,
      no_save: true,
      effect_key: 'lair_darkness',
      noun: 'darkness',
      advisory: 'No illumination model (§70): darkvision suppression and light immunity are not computed in-engine — GM-enforced.',
    });
    expect(AURA_ROW.save_dc).toBeUndefined();
    expect(AURA_ROW.attack_bonus).toBeUndefined();
    expect(isSelfAuraRow(AURA_ROW)).toBe(true);
    expect(isSelfAuraRow(CRUSH_ROW)).toBe(false);
    expect(darkmantle.actions).toHaveLength(2);
  });
});

describe('isSelfAuraRow truth table (sole owner — both sibling lanes cite here for generic false-negatives)', () => {
  it.each([
    ['self + radius + no_save — the MA-0043 self-zone shape', { zone: { self: true, radius_ft: 15, no_save: true } }, true],
    ['honest: no_save flag NOT required — predicate reads save_dc, not zone.no_save (#967 byte-swap falsifier)', { zone: { self: true, radius_ft: 10 } }, true],
    ['junk keys tolerated (#1085-class)', { name: 'X', junk: 1, attack_bonus: 7, zone: { self: true, radius_ft: 12, no_save: true, junk_key: true } }, true],
    ['string radius admits — Number() coercion deferred to resolve (#959 class)', { zone: { self: true, radius_ft: '20', no_save: true } }, true],
    ['explicit save_dc:null still admits', { save_dc: null, zone: { self: true, radius_ft: 15 } }, true],
    ['null row', null, false],
    ['undefined row', undefined, false],
    ['empty row', {}, false],
    ['zone without self flag — lair MA-0043 rows never arm the self-grant path', { zone: { radius_ft: 15, no_save: true, effect_key: 'lair_darkness' } }, false],
    ['self:false', { zone: { self: false, radius_ft: 15, no_save: true } }, false],
    ['self without radius — nothing to arm', { zone: { self: true, no_save: true } }, false],
    ['save-bearing row never arms (save seam owns them)', { save_dc: 12, zone: { self: true, radius_ft: 15 } }, false],
    ['honest edge: save_dc:0 still counts as save-bearing (#945 honest-zero)', { save_dc: 0, zone: { self: true, radius_ft: 15 } }, false],
  ])('%s', (_label, row, expected) => {
    expect(isSelfAuraRow(row)).toBe(expected);
  });
});

describe('MA-0554 day economy — full arm + PRESERVED refusal machinery (cited LIVE @ink-cloud #1135)', () => {
  it('press spends 1/Day, arms lair_darkness te on self r15 with the authored §70 advisory (never fallback-doubled); store-faithful second press refuses darkness_aura_refused with zero extra te and zero extra spend (#1091)', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const press = () => resolveSelfAuraRow({
      action: AURA_ROW,
      monsterName: 'Darkmantle 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: deps.store.uses || {},
      deps,
    });

    // Fresh press: full arm — result tuple, exact te stamp, exact logs, popup.
    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'lair_darkness', radiusFt: 15, remaining: 0 });
    // Exact te-meta tuple — honest-metadata (#1134): :77 stamps 'concentration'
    // generically on every self-aura; here it matches the authored RAW duration.
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Darkmantle 1',
      'lair_darkness',
      'Darkmantle 1',
      { radiusFt: 15, noun: 'darkness', duration: 'concentration' },
    );
    // Spend persisted to the MA-0020 store as the exact campaign-keyed tuple
    // (#932/#1019); the 'monsterSpellUses' key constant itself is pinned at #1082.
    expect(deps.setRuntimeValue).toHaveBeenCalledWith('Darkmantle 1', 'monsterSpellUses', { 'Darkness Aura': 1 }, 'test-campaign');
    expect(deps.store.uses).toEqual({ 'Darkness Aura': 1 });
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(deps.addEntry.mock.calls.every(c => c[0] === 'test-campaign')).toBe(true); // campaign-keyed #932
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toBe('Darkmantle 1 uses Darkness Aura — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.type).toBe('automation');
    expect(arm.characterName).toBe('Darkmantle 1');
    expect(arm.abilityName).toBe('Darkness Aura');
    // Bytes composed from the disk row: advisory precedence falsifier — the
    // AUTHORED §70 clause rides and the fallback never co-appears (#967/#1036).
    expect(arm.description).toBe(`Darkmantle 1 Darkness Aura: lair_darkness self aura armed on Darkmantle 1 (radius 15 ft, no save). ${AURA_ROW.zone.advisory} Duration ${AURA_ROW.duration} — GM-enforced.`);
    expect(arm.description).not.toContain(SELF_AURA_LIGHT_ADVISORY);
    expect(setPopupHtml.mock.calls[0][0]).toBe(`<div class="mc-prerequisite-refusal"><h3>Darkness Aura — 15-ft Aura</h3><p>Darkmantle 1 arms lair_darkness on itself (radius 15 ft, no save). ${AURA_ROW.zone.advisory} 0 use(s) left today (resets at dawn, GM-enforced).</p></div>`);

    // Exhausted press (store-faithful refusal machinery, no hand-reset):
    // refuse loud, burn zero — cited LIVE by the ink-cloud #1135 fold.
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(1);
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(deps.store.uses).toEqual({ 'Darkness Aura': 1 }); // byte-for-byte unchanged
    const refusal = deps.addEntry.mock.calls.map(c => c[1]).find(l => l.automationType === 'darkness_aura_refused');
    expect(refusal.characterName).toBe('Darkmantle 1');
    expect(refusal.description).toBe('Darkmantle 1 has already used Darkness Aura today (1/Day) — Darkness Aura refused. Uses reset at dawn; GM-enforced for monsters.');
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    // Refusal popup wording pinned ONCE at #1082 (#829) — shape cited, not re-pinned.
    expect(setPopupHtml.mock.calls[1][0]).toContain('Uses Exhausted');
    expect(setPopupHtml.mock.calls[1][0]).toContain('Darkmantle 1 has already used Darkness Aura today (1/Day).');
  });
});

describe('double-spend guard (#1035 reach-branch — cited by BOTH ticket lanes #1134/#1135)', () => {
  it('gate fresh on stale snapshot but store spent: refuses exhausted — zero te, zero spend write, mid-flight refusal popup exact bytes (#1136: no longer silent), loud console guard once', async () => {
    const deps = makeDeps({ uses: { 'Darkness Aura': 1 } });
    const setPopupHtml = vi.fn();
    const guard = vi.spyOn(console, 'error');
    const result = await resolveSelfAuraRow({
      action: AURA_ROW,
      monsterName: 'Darkmantle 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {}, // stale mid-flight snapshot slips past the gate
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled(); // zero te
    expect(deps.setRuntimeValue).not.toHaveBeenCalled(); // zero burn (#1026)
    expect(deps.store.uses).toEqual({ 'Darkness Aura': 1 }); // store unchanged
    expect(guard).toHaveBeenCalledTimes(1); // guard stays loud
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.filter(l => l.type === 'ability_use')).toHaveLength(0); // no spend logged
    expect(logs.find(l => l.automationType === 'darkness_aura_refused').description).toBe('Darkmantle 1 has already used Darkness Aura today (1/Day) — Darkness Aura refused. Uses reset at dawn; GM-enforced for monsters.');
    // #1136 FIX: the mid-flight guard no longer refuses silently — the raced
    // second click answers with its own popup, exact bytes pinned here.
    // Reason-distinct from the gate-exhausted arm (#1348): 'Already Armed',
    // never the 'Uses Exhausted' headline (that wording stays #1082-owned).
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Already Armed</h3><p>Darkmantle 1 is already activating Darkness Aura — a preceding click spent the 1/Day use. Darkness Aura refused: no second use spent, no aura re-armed. Uses reset at dawn (GM-enforced for monsters).</p></div>');
    expect(setPopupHtml.mock.calls[0][0]).not.toContain('Uses Exhausted');
  });
});

describe('inert rows — resolve answers not-self-aura with ZERO writes (#934/#1026 — cited by both ticket lanes)', () => {
  it.each([
    ['Crush attack row (darkmantle disk)', CRUSH_ROW],
    ['null action', null],
    ['zone-less junk row', { name: 'Radar', description: 'prose only' }],
    ['save-bearing self zone (save seam owns it)', { name: 'Ray', save_dc: 12, zone: { self: true, radius_ft: 5, no_save: true } }],
    ['non-self lair zone (area picker owns it)', { name: 'Shroud of Darkness', zone: { radius_ft: 15, no_save: true, effect_key: 'lair_darkness' } }],
  ])('%s is inert: no te, no spend, no log, no popup', async (_label, action) => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action,
      monsterName: 'M 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: false, reason: 'not-self-aura' });
    expect(deps.registerTargetEffect).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });
});

describe('§70 builder legs (#903 table — synthetic rows only, #1132: monster bytes owned by their ticket lanes)', () => {
  const SYNTH = { name: 'Gloom Shroud', zone: { self: true, radius_ft: 30, no_save: true, effect_key: 'lair_darkness' } };
  const ARM_PREFIX = 'M Gloom Shroud: lair_darkness self aura armed on M (radius 30 ft, no save).';

  it.each([
    ['arm-log §70 fallback builder: no authored advisory → generic §70 copy, GM-adjudicated duration, no clock',
      () => buildSelfAuraArmLog({ monsterName: 'M', action: SYNTH, effectKey: 'lair_darkness', radiusFt: 30 }).description,
      `${ARM_PREFIX} ${SELF_AURA_LIGHT_ADVISORY} Duration GM-adjudicated — GM-enforced.`],
    ['advisory precedence (#967 falsifier): authored zone.advisory rides INSTEAD of the fallback, never both',
      () => buildSelfAuraArmLog({ monsterName: 'M', action: { ...SYNTH, zone: { ...SYNTH.zone, advisory: 'AUTHORED: cube not parsed (§62).' } }, effectKey: 'lair_darkness', radiusFt: 30 }).description,
      `${ARM_PREFIX} AUTHORED: cube not parsed (§62). Duration GM-adjudicated — GM-enforced.`],
    ['duration-kind leg — rounds clock armed (#1035 branch reach, injected rounds — never wall-clock)',
      () => buildSelfAuraArmLog({ monsterName: 'M', action: { ...SYNTH, duration: '3 rounds' }, effectKey: 'lair_darkness', radiusFt: 30, armedRounds: 3 }).description,
      `${ARM_PREFIX} ${SELF_AURA_LIGHT_ADVISORY} Duration 3 rounds — expiry clock armed (3 rounds (enforcement: zones)).`],
    ['duration-kind leg — combat-scoped clock (≥1 minute is never a round countdown, #app)',
      () => buildSelfAuraArmLog({ monsterName: 'M', action: { ...SYNTH, duration: '1 hour' }, effectKey: 'lair_darkness', radiusFt: 30, armedRounds: 'combat' }).description,
      `${ARM_PREFIX} ${SELF_AURA_LIGHT_ADVISORY} Duration 1 hour — expiry clock armed (combat-scoped — lasts the whole combat, swept at the next initiative roll or a rest (enforcement: zones)).`],
    ['popup §70 fallback + honest uses-note omission when remaining is null (ungated rows say nothing about counters)',
      () => buildSelfAuraPopup({ monsterName: 'M', action: SYNTH, effectKey: 'lair_darkness', radiusFt: 30, remaining: null }),
      '<div class="mc-prerequisite-refusal"><h3>Gloom Shroud — 30-ft Aura</h3><p>M arms lair_darkness on itself (radius 30 ft, no save). ' + SELF_AURA_LIGHT_ADVISORY + '</p></div>'],
  ])('%s', (_label, build, expected) => {
    expect(build()).toBe(expected);
  });
});
