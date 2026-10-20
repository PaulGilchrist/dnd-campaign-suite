// @maintained-by-ai
// MA-1883 unit lane: Demogorgon legendary_actions[3] "Cast a Spell (Costs 2
// Actions)" (`delegates_to:"Spellcasting"`) — TWO defects, both fixed here.
//
// (A) ZERO-PAYLOAD SAVE SHELL: pre-fix the delegate rode the save_dc>0
// CAN-route (MA-1874 twin) into a payload-less save (victim rolled WIS vs
// propagated DC 23 into empty air, "DC Unknown" popup). Fix (MA-1853/MA-1881
// inherit-BEFORE-collapse precedent): legendarySpellCastMaster (code-side
// inherit — monsters.json NOT mirrored, MA-1881 single-source-of-truth)
// resolves the master Spellcasting row so the child arms gated spell chips;
// a spell-named press casts through handleSpellCast (spells.json, real DC,
// payload). A press with NO spell chosen refuses honestly (no-spell-chosen) —
// the guard that replaces the empty-air save. The Demogorgon save is
// CHARISMA DC 23 (8 + PB8 + CHA +7), not Wisdom — data bug fixed in MA-1879.
// (B) COST SPENT 1 NOT 2: expendLegendaryUse hardcoded used+1; "Costs 2
// Actions" was name-text only (MA-1847/MA-1872 family). Fix: legendaryActionCost
// parses "(Costs N Actions)" and the economy spends N, refusing insufficient-cost
// (zero spend) when N > remaining.
//
// Ownership-split cite table (#1105 verbatim split, verified 2026-10-20):
//   generic legendaryActionCost grammar + insufficient-cost vocabulary +
//     Demogorgon even-2-pool demands — OWNED HERE (old :136-244, cited #943/
//     #959 coercion honesty, #1105 near-miss shape)
//   odd-3 Tarrasque cost-2 chunk (3→1 walk) — ma1582-tarrasque-chomp-delegate.js :131-152
//   Spellcasting master-row bytes (DC 23/Charisma prose, 7 chips authored order,
//     3/Day+1/Day tiers, spells.json resolve, Feeblemind 2024-twin absence) —
//     MonsterCardModal.ma1879-demogorgon-spellcasting.test.jsx :159/:169-176/:201
//   modal through-production (chips render, Feeblemind live cast INT DC23 4d6
//     spends 2→0, exhaustion-before-spend, no-target guard) —
//     MonsterCardModal.ma1883-demogorgon-legendary-cast-spell.test.jsx :143-237
//   chooser inherit branches — MonsterCardModal.ma1881-demogorgon-legendary-gaze-inherit.test.js :40-95
//   boundary-gate vocabulary (turn latch / own-turn / spend-1 / regain) —
//     monsterLegendaryUses.test.js MA-0021 :79-110 (cited, not re-driven; the
//     gate ORDER insufficient-cost-after-boundary is source-pinned at
//     monsterLegendaryUses.js :187-202)
//   general Tarrasque header — ma1579 (OWNER #1102); delegates/advisory siblings ma1580 #1103, ma1581 #1104, ma1868 #1106
//   canon gates MA-0073/MA-0021 — cited everywhere, not re-driven per #1105.
//
// dup-map (#1038) old→new (old line numbers of the pre-trim file):
//   old data-lock its ×3 (:50/:59/:70 — master DC/Cha, chips/tiers, Feeblemind
//     payload) → DELETED: owned by ma1879 :159/:169-176/:201 + modal live-cast
//     ma1883.jsx :163 (stronger, live lane); no duplication here.
//   old 'child stays byte-clean' (:91) → folded into disk-bytes it :54
//   old gaze/tail null (:97) + bare zero-chip null (:102) → folded into
//     it.each null-guard table :78 (adds Innate-Spellcasting name decoy #948)
//   old no-spell-chosen popup (:110) + log (:119) → consolidated one it :95
//   old cast-cost-2 (:137) + non-cost-1 (:141) + grammar variants (:161) →
//     consolidated it.each grammar census :112 (PRESERVED #1105/#943/#959)
//   old gate allowed-2 (:202) + insufficient (:206) + exhausted-cost1 (:210) →
//     consolidated it.each gate table :160
//   old seeded insufficient (:191) + gaze-walk near-miss (:216) + insufficient
//     builders vocabulary (:237) → consolidated through-production near-miss it :141
//   kept (trimmed): identity landing :70, chooser-no-hijack :102, family
//     census :124, fresh-spend walk :129, refire-zero-burn :175
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  legendaryActionCost, legendaryExpendGate, legendaryUsesRemaining, legendaryHeaderAction,
  expendLegendaryUse, buildLegendaryRefusalPopup, buildLegendaryRefusalLog, legendaryDelegateAction,
} from './monsterLegendaryUses.js';
import { legendarySpellCastMaster, parseSaveVariantChooser } from '../../components/encounter/MonsterCardHelpers.js';
import { legendaryDelegateChooserAction } from '../../components/encounter/MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const demo = monsters.find(m => m.index === 'demogorgon');
const la = demo.legendary_actions;
const header = la[0];
const castRow = la.find(a => a.name === 'Cast a Spell (Costs 2 Actions)');
const gazeRow = la.find(a => a.name === 'Gaze');
const tailRow = la.find(a => a.name === 'Tail');
const spellRow = () => demo.actions.find(a => a.name === 'Spellcasting');

// ── (A) Disk bytes: the child row this ticket fixed (#1086 raw anchor, #1104) ─
describe('MA-1883 disk bytes: Cast-a-Spell child delegates_to Spellcasting, exact-once + byte-clean', () => {
  it('raw anchor name→delegates_to→description exact-once app-wide; child authors NO save_dc/variants (MA-1881 code-side inherit, never mirrored); master bytes owned by ma1879 :169-176', () => {
    const raw = readFileSync('public/data/monsters.json', 'utf8');
    expect(raw.split('"name": "Cast a Spell (Costs 2 Actions)",\n        "delegates_to": "Spellcasting",').length - 1).toBe(1);
    expect(castRow.description).toBe('The demogorgon uses Spellcasting.');
    expect(castRow.save_dc).toBeUndefined();
    expect(castRow.variants).toBeUndefined();
    // name-lookup: the ONLY legendary row delegating to Spellcasting rides the named lane
    expect(la.filter(a => a.delegates_to === 'Spellcasting')).toEqual([castRow]);
    expect(legendaryHeaderAction(demo)).toBe(header);
  });
});

// ── (A) The spell-delegate resolves to the LIVE lane (code-side inherit) ─────
describe('MA-1883 legendarySpellCastMaster: delegate identity lands the live spell lane; every other lane stays null (#1101/#1103/#1035)', () => {
  it('Cast-a-Spell child resolves to the master Spellcasting row pointer — live chips + DC, not a save shell', () => {
    const master = legendarySpellCastMaster(demo, castRow);
    expect(master).toBe(spellRow());
    // the shared delegate seam lands the same master row (single source of truth)
    expect(legendaryDelegateAction(demo, castRow)).toBe(master);
  });

  it.each([
    ['Gaze (delegates_to Gaze — not Spellcasting)', demo, gazeRow],
    ['Tail (no delegates_to at all — byte-inert)', demo, tailRow],
    ['Spellcasting master with ZERO extractable chips (no fake live lane)',
      { actions: [{ name: 'Spellcasting', description: 'plain text, no markup' }], legendary_actions: [{ name: 'Cast', delegates_to: 'Spellcasting' }] },
      { name: 'Cast', delegates_to: 'Spellcasting' }],
    ['closest-confusion decoy: chips exist but master is "Innate Spellcasting" (#948 NAME-distinct from Bite/Swallow lanes)',
      { actions: [{ name: 'Innate Spellcasting', description: '<em>Fireball</em>' }], legendary_actions: [{ name: 'Cast', delegates_to: 'Innate Spellcasting' }] },
      { name: 'Cast', delegates_to: 'Innate Spellcasting' }],
  ])('%s → null', (_c, monster, action) => {
    expect(legendarySpellCastMaster(monster, action)).toBeNull();
  });
});

// ── (A) Guard: a spell-delegate press MUST name a spell (no empty-air save) ───
describe('MA-1883 no-spell-chosen guard: refuse honestly instead of rolling a payload-less save', () => {
  it('popup + log builders both carry the chip-press vocabulary and zero-spend honesty — the MA-1874 "DC Unknown" empty-air signature never appears', () => {
    const args = { monsterName: 'Demogorgon 1', actionName: 'Cast a Spell (Costs 2 Actions)', reason: 'no-spell-chosen' };
    const popup = buildLegendaryRefusalPopup(args);
    expect(popup).toContain('Legendary Action Refused');
    expect(popup).toMatch(/press one of this row's spell chips/);
    expect(popup).toMatch(/Nothing spent, no roll\./);
    expect(popup).not.toMatch(/DC Unknown/);
    const log = buildLegendaryRefusalLog(args);
    expect(log.automationType).toBe('legendary_use_refused');
    expect(log.description).toMatch(/zero spend, no roll/);
  });

  // The MA-1881 chooser inherit must NOT hijack the spell-delegate lane — the
  // Spellcasting master arms NO variants chooser (spell chips own the press).
  // General chooser inherit branches: ma1881-gaze-inherit :40-95.
  it('spell-delegate child does NOT inherit a variants chooser (spell chips own the press)', () => {
    expect(parseSaveVariantChooser(spellRow())).toBeNull();
    const resolved = legendaryDelegateChooserAction(castRow, { monster: demo, parseSaveVariantChooser });
    expect(resolved.variants).toBeUndefined();
  });
});

// ── (B) Cost parsing: "(Costs N Actions)" → N ─── PRESERVED GENERIC (#1105) ───
describe('MA-1883 legendaryActionCost: "(Costs N Actions)" name-text is machine-read (#1105 generic grammar)', () => {
  it.each([
    ['Demogorgon Cast a Spell (Costs 2 Actions)', castRow, 2],
    ['Gaze — no cost text, byte-inert economy', gazeRow, 1],
    ['Tail — no cost text', tailRow, 1],
    ['Claw Attack — fabricated-free default', { name: 'Claw Attack' }, 1],
    ['undefined row — honest floor', null, 1],
    ['singular grammar "Costs 2 Action"', { name: 'Chitter (Costs 2 Action)' }, 2],
    ['extra spacing, inline, no parens', { name: 'Chitter  Costs 3  Actions  inline' }, 3],
    ['near-miss prose stays honest floor 1 (#943/#959 no coercion)', { name: 'No cost here' }, 1],
  ])('legendaryActionCost(%s) → %i', (_n, action, expected) => {
    expect(legendaryActionCost(action)).toBe(expected);
  });

  it('app-wide family: every "(Costs N Actions)" row parses to its N', () => {
    const seen = [];
    monsters.forEach(m => (m.legendary_actions || []).forEach(a => {
      const n = legendaryActionCost(a);
      if (n !== 1) seen.push([a.name, n]);
    }));
    // at minimum Demogorgon 2, Behemoth Trumpet 2, Androsphinx/Gynosphinx Cast-a-Spell 3
    expect(seen.some(([name, n]) => name === 'Cast a Spell (Costs 2 Actions)' && n === 2)).toBe(true);
    expect(seen.some(([name, n]) => name === 'Trumpet (Costs 2 Actions)' && n === 2)).toBe(true);
    expect(seen.some(([name, n]) => name === 'Cast a Spell (Costs 3 Actions)' && n === 3)).toBe(true);
    seen.forEach(([, n]) => expect(n).toBeGreaterThanOrEqual(2));
  });
});

// ── (B) Economy: pay the RAW cost, refuse insufficient honestly ───────────────
// Even-2-pool demands OWNED HERE (#1105); odd-3 Tarrasque chunk lives at
// ma1582 :131-152; boundary/turn vocabulary cited MA-0021 :79-110.
describe('MA-1883 expendLegendaryUse spends the parsed cost 2 with the Demogorgon pool (uses:2)', () => {
  let cs, deps, store, logs;
  beforeEach(() => {
    store = {};
    logs = [];
    cs = { round: 1, activeCreatureName: 'Bandit 1' };
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve(cs)),
    };
  });
  afterEach(() => vi.clearAllMocks());

  it('fresh press walks the even pool 2→0 exact: uses map + campaign-keyed latch stamp tuple ordered, spends-2 log, no cooldown writes (#932/#1019)', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(r).toEqual({ spent: true, remaining: 0, max: 2 });
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(store['Demogorgon 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Bandit 1' });
    // exactly two writes, ordered uses→latch, every write campaign-keyed
    expect(deps.setRuntimeValue.mock.calls.map(c => `${c[3]}:${c[1]}`)).toEqual([
      'test-campaign:monsterLegendaryUses',
      'test-campaign:_legendaryUses_usedRound',
    ]);
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/spends 2 legendary uses for Cast a Spell \(Costs 2 Actions\).*0 of 2 left/);
  });

  it('even-2-pool near-miss (#1105 shape): real Gaze spend 2→1, next-boundary cost-2 press refuses insufficient-cost — store frozen byte-for-byte, zero refusal writes, builders honest (#1026)', async () => {
    const g = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Gaze', campaignName: 'test-campaign', action: gazeRow, deps });
    expect(g).toEqual({ spent: true, remaining: 1, max: 2 });
    cs.activeCreatureName = 'Bandit 2';
    const before = JSON.stringify(store['Demogorgon 1.monsterLegendaryUses']);
    const r = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('insufficient-cost');
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual(JSON.parse(before));
    expect(legendaryUsesRemaining(header, store['Demogorgon 1.monsterLegendaryUses'])).toBe(1);
    // refusal wrote NOTHING further: only the Gaze spend's two writes fired
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(r.popupHtml).toMatch(/Cast a Spell \(Costs 2 Actions\) costs 2 legendary uses but Demogorgon 1 has only 1 left/);
    expect(r.popupHtml).toMatch(/Nothing spent, no roll\./);
    const ref = logs.find(e => e.automationType === 'legendary_use_refused');
    expect(ref.description).toMatch(/insufficient-cost: costs 2, 1 left/);
  });

  it.each([
    ['cost 2 vs exactly 2 remaining → allowed (spends both)', { max: 2, used: 0 }, 2, true, undefined],
    ['cost 2 vs 1 remaining → insufficient-cost (#943 near-miss vocabulary)', { max: 2, used: 1 }, 2, false, 'insufficient-cost'],
    ['cost 1 vs 0 remaining → exhausted (even-pool economy byte-inert, gate vocab MA-0021)', { max: 2, used: 2 }, 1, false, 'exhausted'],
  ])('legendaryExpendGate: %s', (_d, storedUses, cost, allowed, reason) => {
    const g = legendaryExpendGate({ header, storedUses, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Demogorgon 1', latch: null, cost });
    expect(g.allowed).toBe(allowed);
    expect(g.reason).toBe(reason);
  });

  it('refire after the 2→0 spend: exhausted refuses (before the latch), zero extra burn, exactly one ability_use log (#1026)', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(first).toEqual({ spent: true, remaining: 0, max: 2 });
    const second = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(second.spent).toBe(false);
    expect(second.reason).toBe('exhausted');
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(deps.setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(logs.filter(e => e.type === 'ability_use').length).toBe(1);
  });
});
