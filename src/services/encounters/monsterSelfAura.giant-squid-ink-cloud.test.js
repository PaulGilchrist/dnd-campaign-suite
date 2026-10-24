// @maintained-by-ai
// MA-0830: Giant Squid Ink Cloud (reactions[0], formerly a zero-affordance
// inert prose row with a cosmetic string uses) — BYTE-TWIN of MA-0813 (Giant
// Octopus): rides the MA-0554 self-aura byte-shape via the SAME registered te
// `ink_cloud` (NOT re-registered) through resolveSelfAuraRow, numeric
// maxUses:1 puts the chip counter on the MA-0020 monsterSpellUses economy,
// and the exhausted second click refuses with `ink_cloud_refused` + zero
// spend/zero te. 15-ft Cube modeled honestly at 8-ft centered radius (§62);
// swim-speed move, 1-minute/dispel clock and the underwater trigger stay
// advisory (GM-enforced) on the arm log + popup — no wall-clock seam.
//
// selfAura family split (cite-owner convention):
//   monsterSelfAura.test.js        MA-0554 base CANON — isSelfAuraRow truth
//     table, resolve machinery (first-click arm, refusal, double-spend guard,
//     inert non-zone rows, §70 fallback builders). Never re-driven here.
//   monsterSelfAura.ink-cloud.test.js  MA-0813/MA-1251 — ink_cloud te
//     REGISTRATION golden (label/group/slot/description), giant-octopus and
//     octopus disk bytes. uses-gate fresh/spent retargeted per rec #1135 to
//     the uses-lane CANON #1082 (monsterAbilityUses.test.js MA-0020).
//   this file                      MA-0830 — giant-squid disk row verbatim
//     bytes + those bytes resolving: 8-ft centered self-arm, 1/Day chip
//     economy end-to-end (store-faithful refusal, zero-applied-must-not-burn).
// old->new: 'te reuse (no re-registration)' -> ink-cloud.test.js te registry;
// 'uses counter gate fresh/spent' -> uses-lane CANON monsterAbilityUses.test.js (#1082/#1135);
// 'first click' + 'second click' -> consolidated day-economy lifecycle below.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isSelfAuraRow,
  resolveSelfAuraRow,
} from './monsterSelfAura.js';
import monstersData from '../../../public/data/monsters.json';

const squid = monstersData.find(m => m.name === 'Giant Squid');
const REACTION_ROW = squid.reactions[0];

function makeDeps() {
  const store = {};
  return {
    store,
    registerTargetEffect: vi.fn(),
    getRuntimeValue: vi.fn(() => store.uses || {}),
    setRuntimeValue: vi.fn((c, k, v) => { store.uses = v; return Promise.resolve(); }),
    addEntry: vi.fn((c, entry) => { store.logs = store.logs || []; store.logs.push(entry); return Promise.resolve(); }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MA-0830 giant squid disk data shape', () => {
  it('Ink Cloud reaction row carries verbatim self-zone bytes: 8-ft centered radius, numeric maxUses 1, save-less', () => {
    expect(REACTION_ROW.name).toBe('Ink Cloud');
    expect(REACTION_ROW.trigger).toBe('The squid takes damage while underwater.');
    expect(REACTION_ROW.description).toBe('The squid releases ink that fills a 15-foot <strong>Cube</strong> centered on itself, and the squid moves up to its Swim Speed. The Cube is <strong>Heavily Obscured</strong> for 1 minute or until a strong current or similar effect disperses the ink.');
    expect(REACTION_ROW.uses).toBe('1/Day');
    expect(REACTION_ROW.maxUses).toBe(1);
    expect(REACTION_ROW.range).toBe('15-foot Cube');
    expect(REACTION_ROW.duration).toBe('1 minute (advisory)');
    expect(REACTION_ROW.save_dc).toBeUndefined();
    expect(REACTION_ROW.attack_bonus).toBeUndefined();
    expect(REACTION_ROW.zone).toEqual({
      self: true,
      radius_ft: 8,
      no_save: true,
      effect_key: 'ink_cloud',
      noun: 'ink',
      advisory: 'Cube NOT parsed (§62): 15-foot Cube modeled at 8-ft centered radius, heavily obscured for 1 minute or until a strong current disperses the ink; squid moves up to its Swim Speed; underwater trigger precondition — all GM-enforced. No vision model (§70).',
    });
    // Self-aura seam accepts this exact row; co-located rows survive intact
    // (generic false-negatives are base-owned: monsterSelfAura.test.js).
    expect(isSelfAuraRow(REACTION_ROW)).toBe(true);
    expect(squid.reactions).toHaveLength(1);
    expect(squid.actions.map(a => a.name)).toEqual(['Multiattack', 'Bite', 'Tentacle']);
  });
});

describe('MA-0830 activation', () => {
  it('day economy: press spends 1/Day, arms ink_cloud te on self radius 8 with advisory + advisory-clock prose; second press refuses ink_cloud_refused with zero extra te and zero extra spend', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const press = () => resolveSelfAuraRow({
      action: REACTION_ROW,
      monsterName: 'Giant Squid 1',
      campaignName: 'test-campaign',
      setPopupHtml,
      storedUses: deps.store.uses || {},
      deps,
    });

    // Fresh press: full arm — result tuple, exact te stamp, exact logs, popup.
    const first = await press();
    expect(first).toEqual({ resolved: true, effectKey: 'ink_cloud', radiusFt: 8, remaining: 0 });
    expect(deps.registerTargetEffect).toHaveBeenCalledWith(
      'test-campaign',
      'Giant Squid 1',
      'ink_cloud',
      'Giant Squid 1',
      expect.objectContaining({ radiusFt: 8, noun: 'ink' }),
    );
    // Spend persisted to the MA-0020 monsterSpellUses store (never hand-set).
    expect(deps.store.uses).toEqual({ 'Ink Cloud': 1 });
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.description).toBe('Giant Squid 1 uses Ink Cloud — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');
    const arm = logs.find(l => l.automationType === 'self_aura_armed');
    expect(arm.characterName).toBe('Giant Squid 1');
    expect(arm.description).toMatch(/^Giant Squid 1 Ink Cloud: ink_cloud self aura armed on Giant Squid 1 \(radius 8 ft, no save\)\./);
    expect(arm.description).toContain(REACTION_ROW.zone.advisory);
    expect(arm.description).toMatch(/Duration 1 minute \(advisory\) — GM-enforced\.$/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/Ink Cloud — 8-ft Aura/);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/0 use\(s\) left today/);

    // Exhausted press (store-faithful, no hand-reset): refuse loud, burn zero.
    const second = await press();
    expect(second).toEqual({ resolved: false, reason: 'exhausted' });
    expect(deps.registerTargetEffect).toHaveBeenCalledTimes(1);
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    const refusal = deps.addEntry.mock.calls.map(c => c[1]).find(l => l.automationType === 'ink_cloud_refused');
    expect(refusal.characterName).toBe('Giant Squid 1');
    expect(refusal.description).toBe('Giant Squid 1 has already used Ink Cloud today (1/Day) — Ink Cloud refused. Uses reset at dawn; GM-enforced for monsters.');
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(setPopupHtml.mock.calls[1][0]).toMatch(/Uses Exhausted/);
    expect(setPopupHtml.mock.calls[1][0]).toContain('Giant Squid 1 has already used Ink Cloud today (1/Day).');
  });
});
