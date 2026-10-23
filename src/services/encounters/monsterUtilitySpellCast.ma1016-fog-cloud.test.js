// @maintained-by-ai
// MA-1016 fog lane: resolveUtilitySpellCastRow — the uses/innate axis the
// recharge origin lacks. Ice Mephit "Fog Cloud" is the BY-NAME disk row
// (monsters.json verbatim: Charisma, NO spell_save_dc, NO recharge, MA-0633
// numeric uses:1 + maxUses:1). Press flow, real services through injected
// deps (#1137/#1091): fresh cast spends at resolve via spendMonsterAbilityUse
// (single merged campaign-keyed MA-0020 write) + the advisory cast record
// carrying the RAW clauses (Charisma, no-components) with the DISK-faithful
// duration (§ spells.json "Up to 1 hour" — ≥1 min is combat-scoped, so the
// §70 advisory "GM adjudicates duration" is the honest duration-kind leg,
// never a fabricated round countdown). Zero-RNG: no dice at resolve; the
// Frost Breath Recharge-6 decoy rides inert (gate null, untouched bytes) and
// the exhausted re-press refuses with the shared mc-prerequisite popup +
// fog_cloud_refused log, ZERO extra write, ZERO second cast (§57/§172).
// Rest-rearm of the 1/Day key stays the known §70 residual (GM clears dawn).
//
// utilitySpellCast family map (no base file — ticket-distinct lanes):
//   * ma1014-ice-wall (origin, #1157): recharge-gated spell_save_dc row
//   * ma1016-fog-cloud (THIS): uses/innate no-DC legs + §70 fog/invis advisories
//
// dup-map leg table (#1038) — legs owned elsewhere, cited NEVER re-driven:
//   recharge gate/refusal/d6 recovery            → ma1014 origin + monsterRecharge.test.js #1132
//   uses-gate truth-table, coercion, refusal
//     bytes (#829), double-spend guard          → monsterAbilityUses.test.js #1082 CANON
//   not-utility-row guard (zero-store-read #1035) → ma1014 (stronger copy; the
//     hand-seeded duplicate here was deleted per #1157 carried rec)
//   imp/Invisibility migrated OFF this lane
//     (disk row carries MA-0658 automation)     → MonsterAction.ma1016-chip :120 + monsterSelfBuff
//   chip fingerprint, spent-class, transport
//     exact-if-fetch #1010, restored uses       → MonsterAction/MonsterCardModal.ma1016 siblings
//   fog uses-spend + advisory + exhausted latch   → THIS lane (own fog bytes #1154)
//
// old→new map:
//   old 'fresh row spends the MA-0020 use...'   → test 1 (strengthened: exact
//     merged write tuple, decoy-recharge survivor, store-key census, exact logs)
//   old 'imp twin (no uses)...'                  → test 3, re-driven honest with the
//     REAL disk row — the old hand-authored no-automation imp row does not exist
//     on disk and can never reach this seam (transport fingerprint rejects it)
//   old 'second press refuses...' (hand seed)    → test 2 (latch seeded by the
//     REAL first spend bytes, #949)
//   old ':103-111 not-utility-row MA-1014 pin'  → DELETED per #1157 carried rec;
//     stronger zero-store-read version lives in origin ma1014
import { describe, it, expect, vi } from 'vitest';
import { resolveUtilitySpellCastRow } from './monsterUtilitySpellCast.js';

const CAMPAIGN = 'test-campaign';

// monsters.json verbatim BY NAME (#1086/#1094): Ice Mephit "Fog Cloud".
const MONSTER = 'Ice Mephit 1';
const FOG_ROW = {
  name: 'Fog Cloud',
  description: 'The mephit casts <strong>Fog Cloud</strong>, requiring no spell components and using Charisma as the spellcasting ability.',
  spellcasting_ability: 'Charisma',
  usage: '1/Day',
  uses: 1,
  maxUses: 1,
};
// spells.json verbatim: concentration, "Up to 1 hour" — honest disk duration.
const FOG_SPELL = { name: 'Fog Cloud', level: 1, concentration: true, duration: 'Up to 1 hour' };

// Loud decoy (#948): the mephit's REAL disk sibling "Frost Breath" recharge
// map, spent — must not block the no-recharge fog row and must survive inert.
const RECHARGE_DECOY = { 'Frost Breath': { recharged: false, threshold: 6 } };

function makeDeps({ initialUses = null, extraStore = {} } = {}) {
  const store = { [`${MONSTER}.monsterSpellUses`]: initialUses, ...extraStore };
  return {
    store,
    deps: {
      addEntry: vi.fn(() => Promise.resolve()),
      getRuntimeValue: vi.fn((c, k) => store[`${c}.${k}`] ?? null),
      setRuntimeValue: vi.fn((c, k, v) => { store[`${c}.${k}`] = v; return Promise.resolve(); }),
    },
  };
}

function pressMephit(deps, setPopupHtml = vi.fn()) {
  return resolveUtilitySpellCastRow({
    action: FOG_ROW, spellName: 'Fog Cloud', spell: FOG_SPELL,
    monsterName: MONSTER, campaignName: CAMPAIGN, setPopupHtml, deps,
  });
}

describe('MA-1016 Fog Cloud fresh press — 1/Day spend at resolve, decoys inert, zero-RNG', () => {
  it('spends via one merged campaign-keyed monsterSpellUses write + ordered spend-then-advisory logs; recharge decoy untouched; no zone object fabricated', async () => {
    const { store, deps } = makeDeps({ extraStore: { [`${MONSTER}.monsterRecharge`]: RECHARGE_DECOY } });
    const setPopupHtml = vi.fn();

    const res = await pressMephit(deps, setPopupHtml);

    expect(res).toEqual({ resolved: true, rechargeKey: null }); // gate null: fog carries no recharge
    expect(setPopupHtml).not.toHaveBeenCalled();

    // Single merged map write (MA-0005 recipe), exact producer bytes:
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(deps.setRuntimeValue).toHaveBeenCalledWith(MONSTER, 'monsterSpellUses', { 'Fog Cloud': 1 }, CAMPAIGN);
    expect(store[`${MONSTER}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });
    // Decoy survivor + census (#948/#1057): recharge economy byte-unchanged,
    // and no fog-zone/duration state invented on the store (§70 = GM's job).
    expect(store[`${MONSTER}.monsterRecharge`]).toEqual(RECHARGE_DECOY);
    expect(Object.keys(store).sort()).toEqual([`${MONSTER}.monsterRecharge`, `${MONSTER}.monsterSpellUses`]);

    // Ordered log tuple, campaign-keyed; consumed-pin honest (#1072/#1154).
    expect(deps.addEntry.mock.calls.map(c => c[0])).toEqual([CAMPAIGN, CAMPAIGN]);
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs[0]).toMatchObject({ type: 'ability_use', characterName: MONSTER, abilityName: 'Fog Cloud' });
    expect(logs[0].description).toBe('Ice Mephit 1 uses Fog Cloud — 1 use spent, 0 left today (resets at dawn, GM-enforced for monsters).');
    // Advisory verbatim: ability-no-DC parenthetical (#218 anti-"DC Unknown"),
    // disk duration, honest §70 fog note — no save DC, no round countdown.
    expect(logs[1].description).toBe(
      'Ice Mephit 1 casts Fog Cloud via Spellcasting (Charisma). No spell components required. '
      + 'Concentration (Up to 1 hour). Fog zones have no engine consumer (§70) — GM places the '
      + 'fog cloud and adjudicates obscurement and duration. GM-enforced for monsters.'
    );
  });
});

describe('MA-1016 Fog Cloud exhausted — store-backed latch refuses the re-press (#949)', () => {
  it('double press: first spends, refusal seeded by REAL spend bytes pays popup + fog_cloud_refused log, zero extra write, zero second cast', async () => {
    const { store, deps } = makeDeps();
    const setPopupHtml = vi.fn();

    const first = await pressMephit(deps, setPopupHtml);
    expect(first).toEqual({ resolved: true, rechargeKey: null });
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);

    // Latch comes from the spend the real service just wrote, not a hand seed.
    const second = await pressMephit(deps, setPopupHtml);
    expect(second).toEqual({ resolved: false, reason: 'uses-exhausted' });
    expect(setPopupHtml).toHaveBeenCalledTimes(1); // popup from the refusal press only (fresh press paid none)
    expect(setPopupHtml.mock.calls[0][0]).toContain('mc-prerequisite-refusal');
    expect(setPopupHtml.mock.calls[0][0]).toContain('Fog Cloud');
    expect(setPopupHtml.mock.calls[0][0]).toContain('nothing spent'); // #829 shape, cited

    // Zero-write refusal census (#1026): still exactly one write, counter 1/1.
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(store[`${MONSTER}.monsterSpellUses`]).toEqual({ 'Fog Cloud': 1 });

    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(3); // spend + cast + refusal — no second cast record
    expect(logs[2]).toMatchObject({
      type: 'automation',
      automationType: 'fog_cloud_refused',
      characterName: MONSTER,
      abilityName: 'Fog Cloud',
    });
    expect(logs[2].description).toContain('has already used Fog Cloud today (1/Day)');
  });
});

describe('mid-flight double-spend guard (#1136-class fix#79 census — WORSE site: advisory cast log landed post-refuse)', () => {
  it('gate fresh on snapshot but store spent before the spend re-read: refuses uses-exhausted with reason-distinct popup exact bytes, advisory cast record NEVER lands, zero write', async () => {
    // Deterministic single-threaded race: the resolve-time gate read sees
    // fresh; the spendMonsterAbilityUse store re-read sees the preceding
    // click's write ({'Fog Cloud':1}) that landed between the two reads.
    const RACED_WRITE = { 'Fog Cloud': 1 };
    let usesReads = 0;
    const store = {};
    const deps = {
      addEntry: vi.fn(() => Promise.resolve()),
      getRuntimeValue: vi.fn((c, k) => {
        if (k === 'monsterRecharge') return null; // fog carries no recharge
        usesReads += 1;
        return usesReads === 1 ? {} : RACED_WRITE;
      }),
      setRuntimeValue: vi.fn((c, k, v) => { store[`${c}.${k}`] = v; return Promise.resolve(); }),
    };
    const setPopupHtml = vi.fn();
    const guard = vi.spyOn(console, 'error');

    const res = await pressMephit(deps, setPopupHtml);

    expect(res).toEqual({ resolved: false, reason: 'uses-exhausted' });
    expect(usesReads).toBe(2); // fresh gate read, then the refused spend's re-read
    expect(deps.setRuntimeValue).not.toHaveBeenCalled(); // zero burn (#1026)
    expect(guard).toHaveBeenCalledTimes(1); // guard stays loud (audit side already correct, fix#79)
    // Two-defect closure: (1) the refusal now ANSWERS in the UI — reason-
    // distinct 'Already Casting' (#1348), never the gate arm's 'Uses
    // Exhausted' headline, same mc-prerequisite-refusal family cls; and
    // (2) the cast-advisory log NEVER lands for a refused cast.
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith('<div class="mc-prerequisite-refusal"><h3>Already Casting</h3><p>Ice Mephit 1 is already casting Fog Cloud — a preceding click spent the 1/Day use. Fog Cloud refused: no second use spent, no cast resolved. Uses reset at dawn (GM-enforced for monsters).</p></div>');
    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs).toHaveLength(1); // refusal audit log ONLY — no advisory cast record
    expect(logs[0]).toMatchObject({ type: 'automation', automationType: 'fog_cloud_refused', abilityName: 'Fog Cloud' });
    expect(logs.some(l => (l.description || '').includes('casts Fog Cloud'))).toBe(false);
  });
});

describe('MA-1016 at-will innate twin — no uses bytes means no gate, honest invisibility advisory', () => {
  // The honest no-uses twin is Faerie Dragon Adult's disk row (BY NAME): the
  // imp twin is cited-only — its real row carries MA-0658 self-buff
  // automation and never routes through this seam.
  const FAERIE = 'Faerie Dragon Adult 1';
  const FAERIE_ROW = {
    name: 'Superior Invisibility',
    description: 'The dragon casts <strong>Greater Invisibility</strong> on itself, requiring no spell components and using the same spellcasting ability as Spellcasting.',
    spellcasting_ability: 'Charisma',
  };
  const FAERIE_SPELL = { name: 'Greater Invisibility', level: 4, concentration: true, duration: 'Up to 1 minute' }; // spells.json verbatim

  it('resolves ungated with ZERO monsterSpellUses write and the §70 invisibility advisory', async () => {
    const store = {};
    const deps = {
      addEntry: vi.fn(() => Promise.resolve()),
      getRuntimeValue: vi.fn((c, k) => store[`${c}.${k}`] ?? null),
      setRuntimeValue: vi.fn((c, k, v) => { store[`${c}.${k}`] = v; return Promise.resolve(); }),
    };
    const setPopupHtml = vi.fn();

    const res = await resolveUtilitySpellCastRow({
      action: FAERIE_ROW, spellName: 'Greater Invisibility', spell: FAERIE_SPELL,
      monsterName: FAERIE, campaignName: CAMPAIGN, setPopupHtml, deps,
    });

    expect(res).toEqual({ resolved: true, rechargeKey: null });
    expect(setPopupHtml).not.toHaveBeenCalled();
    // usesGate null (no uses/maxUses — gate-null leg cited to #1082): no
    // counter invented, no spend, at-will stays free.
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(store[`${FAERIE}.monsterSpellUses`] ?? null).toBeNull();

    const logs = deps.addEntry.mock.calls.map(c => c[1]);
    expect(logs.length).toBe(1); // advisory cast only — no spend log
    expect(logs[0].description).toBe(
      'Faerie Dragon Adult 1 casts Greater Invisibility via Spellcasting (Charisma). '
      + 'No spell components required. Concentration (Up to 1 minute). Invisibility has no '
      + 'monster-side consumer (§70) — GM adjudicates the hidden state and its RAW enders. '
      + 'GM-enforced for monsters.'
    );
  });
});
