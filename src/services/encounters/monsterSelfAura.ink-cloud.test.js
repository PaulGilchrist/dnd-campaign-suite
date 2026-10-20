// @maintained-by-ai
// MA-0813: Giant Octopus Ink Cloud (reactions[0], formerly a zero-affordance
// inert prose row with a cosmetic string uses) — rides the MA-0554 self-aura
// byte-shape (Darkmantle Darkness Aura twin): self-origin save-less zone dict
// arms the registered te `ink_cloud` ON SELF via resolveSelfAuraRow, numeric
// maxUses:1 puts the chip counter on the MA-0020 monsterSpellUses economy,
// and the exhausted second click refuses with `ink_cloud_refused` + zero
// spend/zero te. Cube shape, swim-speed move, 1-minute/dispel clock and the
// underwater trigger stay advisory (GM-enforced) on the arm log + popup —
// no wall-clock seam (#app: seams never wall-clock).
// MA-1251: plain Octopus Ink Cloud (reactions[0], formerly prose-only zero
// affordance, RAW At-Will) — byte-twin zone dict at centered radius 3
// (5-foot Cube, MA-0919 decision-pin precedent), NO uses/maxUses so the
// uses-gate returns null and the press arms with zero spend (honest ungated).
//
// selfAura family split (cite-owner convention, per #1134 family map):
//   monsterSelfAura.test.js              MA-0554 base CANON — isSelfAuraRow
//     truth table, first-click/refusal shapes, double-spend guard, inert
//     non-zone rows, §70 fallback builders. Never re-driven here.
//   monsterSelfAura.giant-squid-ink-cloud.test.js  MA-0830 CLOSED #1134 —
//     squid disk bytes + squid day-economy lifecycle. Squid not re-locked.
//   monsterAbilityUses.test.js         CANON #1082 — gate truth table
//     fresh/partial/exhausted (:107-116) and unlimited-row→null (:120-125).
//   this file                          MA-0813/MA-1251 ink-cloud lane —
//     ink_cloud te description golden, giant-octopus and octopus disk bytes
//     verbatim BY NAME (#1086/#1094/#993), gated lifecycle end-to-end and
//     the ungated zero-spend leg (owned nowhere else in the family).
// Applied recs: gate fresh/spent (:77-83) folded-cite to CANON #1082 truth
// table + the row's locked name/maxUses bytes + lifecycle remaining:0;
// second-click refusal (:117-134) folded into the store-faithful lifecycle
// (#1091 never hand-reset); te census dup trimmed — key/label/group pinned by
// targetEffectDefinitions.test.js:54 golden row, Defensive label sort owned by
// rules/combat/healingBlock.test.js:28-29 — only the ticket description copy is
// golden here (census pins descriptions non-empty only).
// old->new: 'registers ink_cloud at its alphabetical slot' -> description golden
// (slot/sort cited); 'uses counter gate fresh/spent' -> lifecycle + CANON #1082;
// 'second click' -> lifecycle exhausted leg; 'RAW At-Will gate null' -> octopus
// disk bytes (absence) + CANON :120 + zero-spend press.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isSelfAuraRow,
  resolveSelfAuraRow,
} from './monsterSelfAura.js';
import { getEffectDefinition } from '../combat/conditions/targetEffectDefinitions.js';
import monstersData from '../../../public/data/monsters.json';

const octopus = monstersData.find(m => m.name === 'Giant Octopus');
const REACTION_ROW = octopus.reactions[0];
const smallOctopus = monstersData.find(m => m.name === 'Octopus');
const SMALL_OCTOPUS_ROW = smallOctopus.reactions[0];

function makeDeps() {
  const store = {};
  return {
    store,
    registerTargetEffect: vi.fn((campaign, target, effect, source, extra) => {
      store.te = { campaign, target, effect, source, extra };
    }),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs = store.logs || []; store.logs.push(entry); return Promise.resolve(); }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0813 ink_cloud te golden', () => {
  // Census row targetEffectDefinitions.test.js:54 pins key/label/icon/cls/group;
  // Defensive label sort → healingBlock.test.js:28-29. Golden here: the ticket's
  // description copy (census pins descriptions non-empty only).
  it('ink_cloud description pins the Heavily Obscured cube/advisory ticket copy', () => {
    const def = getEffectDefinition('ink_cloud');
    expect(def).toBeTruthy();
    expect(def.description).toMatch(/Heavily Obscured ink cloud/i);
  });
});

describe('MA-0813 giant octopus disk data shape', () => {
  it('Ink Cloud reaction carries verbatim self-zone bytes: radius 5 cube, 1/Day numeric, save-less', () => {
    expect(REACTION_ROW.name).toBe('Ink Cloud');
    expect(REACTION_ROW.trigger).toBe('The octopus takes damage while underwater.');
    expect(REACTION_ROW.description).toBe('The octopus releases ink that fills a 10-foot <strong>Cube</strong> centered on itself, and the octopus moves up to its Swim Speed. The Cube is <strong>Heavily Obscured</strong> for 1 minute or until a strong current or similar effect disperses the ink.');
    expect(REACTION_ROW.uses).toBe('1/Day');
    expect(REACTION_ROW.maxUses).toBe(1);
    expect(REACTION_ROW.range).toBe('10-foot Cube');
    expect(REACTION_ROW.duration).toBe('1 minute (advisory)');
    expect(REACTION_ROW.zone).toEqual({
      self: true,
      radius_ft: 5,
      no_save: true,
      effect_key: 'ink_cloud',
      noun: 'ink',
      advisory: 'Cube NOT parsed (§62): 10-foot Cube modeled at 5-ft centered radius, heavily obscured for 1 minute or until a strong current disperses the ink; octopus moves up to its Swim Speed; underwater trigger precondition — all GM-enforced. No vision model (§70).',
    });
    expect(REACTION_ROW.save_dc).toBeUndefined();
    expect(REACTION_ROW.attack_bonus).toBeUndefined();
    // Self-aura seam accepts this exact row; co-located rows survive intact
    // (generic false-negatives are base-owned: monsterSelfAura.test.js).
    expect(isSelfAuraRow(REACTION_ROW)).toBe(true);
    expect(octopus.reactions).toHaveLength(1);
  });
});

describe('MA-0813 giant octopus day economy', () => {
  it('press spends 1/Day, arms ink_cloud te on self radius 5 with advisory prose; second store-faithful press refuses ink_cloud_refused with zero extra te and zero extra spend', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const press = () => resolveSelfAuraRow({
      action: REACTION_ROW,
      monsterName: 'Giant Octopus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: deps.store.uses || {},
      deps,
    });

    // Fresh press: full arm — result tuple, exact te stamp, exact logs, popup.
    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'ink_cloud', radiusFt: 5, remaining: 0 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Giant Octopus 1',
      'ink_cloud',
      'Giant Octopus 1',
      { radiusFt: 5, noun: 'ink', duration: 'concentration' },
    );
    // Spend persisted to the MA-0020 monsterSpellUses store (never hand-set #1091).
    expect(deps.store.uses).toEqual({ 'Ink Cloud': 1 });
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toBe('Giant Octopus 1 uses Ink Cloud — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Giant Octopus 1');
    expect(arm.description).toMatch(/^Giant Octopus 1 Ink Cloud: ink_cloud self aura armed on Giant Octopus 1 \(radius 5 ft, no save\)\./);
    expect(arm.description).toContain(REACTION_ROW.zone.advisory);
    expect(arm.description).toMatch(/Duration 1 minute \(advisory\) — GM-enforced\.$/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Ink Cloud — 5-ft Aura/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/0 use\(s\) left today/);

    // Exhausted press (store-faithful, no hand-reset): refuse loud, burn zero.
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(1);
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    const refusal = deps.addEntry.mock.calls.map(c => c[1]).find(l => l.automationType === 'ink_cloud_refused');
    expect(refusal.characterName).toBe('Giant Octopus 1');
    expect(refusal.description).toBe('Giant Octopus 1 has already used Ink Cloud today (1/Day) — Ink Cloud refused. Uses reset at dawn; GM-enforced for monsters.');
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(setPopupHtml.mock.calls[1][0]).toMatch(/Uses Exhausted/);
    expect(setPopupHtml.mock.calls[1][0]).toContain('Giant Octopus 1 has already used Ink Cloud today (1/Day).');
  });
});

describe('MA-1251 octopus disk data shape', () => {
  // Gate→null on rows without authored uses is CANON-owned (#1082:
  // monsterAbilityUses.test.js:120-125) — this pins only THIS row's bytes:
  // self-zone twin at centered radius 3 and honest ungated absence.
  it('octopus Ink Cloud reaction: self-zone dict byte-twin at radius 3, honestly ungated (no uses/maxUses authored)', () => {
    expect(SMALL_OCTOPUS_ROW.name).toBe('Ink Cloud');
    expect(SMALL_OCTOPUS_ROW.trigger).toBe('A creature ends its turn within 5 feet of the octopus while underwater');
    expect(SMALL_OCTOPUS_ROW.description).toBe('The octopus releases ink that fills a 5-foot <strong>Cube</strong> centered on itself, and the octopus moves up to its Swim Speed. The Cube is <strong>Heavily Obscured</strong> for 1 minute or until a strong current or similar effect disperses the ink.');
    expect(SMALL_OCTOPUS_ROW.uses).toBeUndefined();
    expect(SMALL_OCTOPUS_ROW.maxUses).toBeUndefined();
    expect(SMALL_OCTOPUS_ROW.zone).toEqual({
      self: true,
      radius_ft: 3,
      no_save: true,
      effect_key: 'ink_cloud',
      noun: 'ink',
      advisory: 'Cube NOT parsed (§62): 5-foot Cube modeled at centered radius, heavily obscured 1 minute or until strong current disperses — GM-enforced; octopus moves up to its Swim Speed; end-turn-within-5ft + underwater trigger preconditions GM-enforced. No vision model (§70).',
    });
    expect(SMALL_OCTOPUS_ROW.save_dc).toBeUndefined();
    expect(SMALL_OCTOPUS_ROW.attack_bonus).toBeUndefined();
    expect(isSelfAuraRow(SMALL_OCTOPUS_ROW)).toBe(true);
    expect(smallOctopus.reactions).toHaveLength(1);
  });
});

describe('MA-1251 octopus ungated activation', () => {
  it('press arms ink_cloud te on self radius 3 with ZERO spend — no counter, no decrement, no clock', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await resolveSelfAuraRow({
      action: SMALL_OCTOPUS_ROW,
      monsterName: 'Octopus 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: {},
      deps,
    });
    expect(result).toEqual({ resolved: true, effectKey: 'ink_cloud', radiusFt: 3, remaining: null });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Octopus 1',
      'ink_cloud',
      'Octopus 1',
      { radiusFt: 3, noun: 'ink', duration: 'concentration' },
    );
    // Zero-applied-must-not-burn census (#1026): economy store never touched.
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.store.uses).toBeUndefined();
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.some(l => l.type === 'ability_use')).toBe(false);
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Octopus 1');
    expect(arm.description).toMatch(/^Octopus 1 Ink Cloud: ink_cloud self aura armed on Octopus 1 \(radius 3 ft, no save\)\./);
    expect(arm.description).toContain(SMALL_OCTOPUS_ROW.zone.advisory);
    // Duration advisory honesty (#1134 shape): no authored duration ⇒ no clock.
    expect(arm.description).not.toMatch(/expiry clock armed/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Ink Cloud — 3-ft Aura/);
    expect(setPopupHtml.mock.calls[0][0]).not.toMatch(/use\(s\) left/);
  });
});
