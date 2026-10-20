// @maintained-by-ai
// MA-1014 origin lane: resolveUtilitySpellCastRow — adjudication behind the
// Ice Devil "Ice Wall" spell chip (spell_save_dc-only zone/utility row,
// Recharge 6). Pressing the chip: recharge spends at resolve via the REAL
// spendMonsterRecharge seam (MA-0633 spend-at-resolve byte-shape — this route
// has no picker; single merged map write, MA-0005 recipe) + the CLA-325
// advisory cast record carrying the RAW clauses (spell save DC 17,
// Intelligence, level 8 version, no components, §70 GM-enforced wall).
// Spent chip: shared .mc-recharge-refusal popup + ice_wall_refused log,
// ZERO extra write, ZERO cast record (§408/MA-0963 shape).
// Zero-RNG pin: no d6 rolls here — recovery rides the untouched
// turnStartEffects seam (recharge CANON #1132, cited never re-driven).
//
// utilitySpellCast family map (no base file — ticket-distinct lanes):
//   * ma1014-ice-wall (THIS, origin): recharge-gated spell_save_dc row
//   * ma1016-fog-cloud: uses-gated + no-DC innate legs (mc-prerequisite)
//   * MonsterCardModal.ma1014/-ma1016-spellcast.test.jsx: chip→seam press
//     transport (#1137/#1010) — cited, not re-driven here
//   * owners cited, never re-driven: monsterRecharge.test.js (#1132 d6
//     recovery/refusal builders), monsterAbilityUses.test.js (#1082),
//     te registry golden #1012, conditionEffects CANON #1000
//
// old→new map:
//   old 'spends recharge at resolve...'      → it.each available face 'never used'
//   old 'recovered row re-spends...'         → it.each available face 'recovered'
//   old 'refuses with the shared popup...'   → double-press cycle (latch #949)
//   old 'non-utility action...'              → kept, strengthened with the
//     zero-store-reads guard pin (#1035); the sibling ma1016 copy of this
//     guard press is a duplicate — removal recommended there, not done here.
import { describe, it, expect, vi } from 'vitest';
import { resolveUtilitySpellCastRow } from './monsterUtilitySpellCast.js';

const MONSTER = 'Ice Devil 1';
const CAMPAIGN = 'test-campaign';

const ICE_WALL_ROW = {
  name: 'Ice Wall',
  description: 'The devil casts <strong>Wall of Ice</strong> (level 8 version), requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 17).',
  spell_save_dc: 17,
  spellcasting_ability: 'Intelligence',
  recharge: '6',
};

const SPELL = { name: 'Wall of Ice', level: 6, concentration: true, duration: 'Up to 10 minutes' };

const SPENT_ENTRY = { 'Ice Wall': { recharged: false, threshold: 6 } };

function makeDeps(initialRecharge = null) {
  const store = { [`${MONSTER}.monsterRecharge`]: initialRecharge };
  return {
    store,
    deps: {
      addEntry: vi.fn(() => Promise.resolve()),
      getRuntimeValue: vi.fn((c, k) => store[`${c}.${k}`] ?? null),
      setRuntimeValue: vi.fn((c, k, v) => { store[`${c}.${k}`] = v; return Promise.resolve(); }),
    },
  };
}

function press(deps, setPopupHtml = vi.fn()) {
  return resolveUtilitySpellCastRow({
    action: ICE_WALL_ROW, spellName: 'Wall of Ice', spell: SPELL, castLevel: 8,
    monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml, deps,
  });
}

describe('MA-1014 Ice Wall chip — available press spends at resolve', () => {
  // Gate-available faces (monsterRecharge.js:63): no entry, or a recovered
  // recharged:true entry — the chip re-spends with a fresh charge.
  it.each([
    ['never used', null],
    ['recovered (recharged:true)', { 'Ice Wall': { recharged: true, threshold: 6 } }],
  ])('%s: one merged recharge write + spend log + advisory cast, no popup', async (_face, initialRecharge) => {
    const { store, deps } = makeDeps(initialRecharge);
    const setPopupHtml = vi.fn();
    const res = await press(deps, setPopupHtml);

    expect(res).toEqual({ resolved: true, rechargeKey: 'Ice Wall' });
    expect(setPopupHtml).not.toHaveBeenCalled();
    // Single merged map write (MA-0005), campaign-keyed, exact stamp bytes.
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(deps.setRuntimeValue).toHaveBeenCalledWith(MONSTER, 'monsterRecharge', SPENT_ENTRY, CAMPAIGN);
    expect(store[`${MONSTER}.monsterRecharge`]).toEqual(SPENT_ENTRY);

    // Ordered log tuple, all campaign-keyed: recharge spend (recharge CANON
    // #1132 owns these bytes — light pin here) then the advisory cast.
    expect(deps.addEntry.mock.calls.map(c => c[0])).toEqual([CAMPAIGN, CAMPAIGN]);
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(2);
    expect(logs[0]).toMatchObject({ type: 'ability_use', characterName: MONSTER, abilityName: 'Ice Wall' });
    expect(logs[0].description).toMatch(/uses Ice Wall — Recharge 6/);
    expect(logs[1]).toMatchObject({ type: 'ability_use', characterName: MONSTER, abilityName: 'Wall of Ice' });
    // CLA-325 advisory verbatim: DC/ability/level/no-components/concentration
    // + honest §70 zero-consumer wall note (GM places the wall, rolls no save).
    expect(logs[1].description).toBe(
      'Ice Devil 1 casts Wall of Ice via Spellcasting (spell save DC 17, Intelligence). '
      + 'Level 8 version. No spell components required. Concentration (Up to 10 minutes). '
      + 'Wall/zone objects have no engine consumer (§70) — GM places the wall and adjudicates '
      + 'area placement, positioning saves and duration. GM-enforced for monsters.'
    );
  });
});

describe('MA-1014 Ice Wall chip — spent press refuses, latch holds', () => {
  it('double press: first cast spends, the latch refuses the re-press with popup + ice_wall_refused log, zero extra write, zero cast record', async () => {
    const { store, deps } = makeDeps(null);
    const setPopupHtml = vi.fn();

    const first = await press(deps, setPopupHtml);
    expect(first).toEqual({ resolved: true, rechargeKey: 'Ice Wall' });
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);

    // Refusal seeded by the REAL spend bytes (latch #949), not hand-authored.
    const second = await press(deps, setPopupHtml);
    expect(second).toEqual({ resolved: false, reason: 'not-recharged' });
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toContain('mc-recharge-refusal');
    expect(setPopupHtml.mock.calls[0][0]).toContain('Ice Wall');
    expect(setPopupHtml.mock.calls[0][0]).toContain('nothing spent');

    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1); // refusal writes nothing
    expect(store[`${MONSTER}.monsterRecharge`]).toEqual(SPENT_ENTRY);

    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(3); // spend + cast + refusal, no second cast
    expect(logs[2]).toMatchObject({
      type: 'automation',
      automationType: 'ice_wall_refused',
      characterName: MONSTER,
      abilityName: 'Ice Wall',
    });
    expect(logs[2].description).toContain('Zero spend, no save prompt.');
  });
});

describe('MA-1014 utility guard — non-utility rows never arm this route', () => {
  it('row with neither spell_save_dc nor spellcasting_ability resolves nothing, zero store reads/writes, zero log', async () => {
    const { deps } = makeDeps(null);
    const res = await resolveUtilitySpellCastRow({
      action: { name: 'Ice Spear', attack_bonus: 10 }, spellName: 'X',
      monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml: vi.fn(), deps,
    });
    expect(res).toEqual({ resolved: false, reason: 'not-utility-row' });
    expect(deps.getRuntimeValue).not.toHaveBeenCalled(); // guard short-circuits before any gate read (#1035)
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(deps.addEntry).not.toHaveBeenCalled();
  });
});
