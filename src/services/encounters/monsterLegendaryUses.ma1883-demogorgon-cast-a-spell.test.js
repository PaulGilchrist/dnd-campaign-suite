// MA-1883: Demogorgon legendary_actions[3] "Cast a Spell (Costs 2 Actions)"
// (`delegates_to:"Spellcasting"`) — TWO defects, both fixed here.
//
// (A) ZERO-PAYLOAD SAVE SHELL: pre-fix the delegate rode the save_dc>0
// CAN-route (MA-1874 twin) into a payload-less save — the victim rolled WIS
// vs propagated DC 23, FAILED into empty air (no spell named/picked/resolved,
// zero condition/damage/hp_change, generic "DC Unknown" popup). Root: the
// Spellcasting master row (MA-1879 markup fix, b1174958e) carries spell chips
// + save fields but the LEGENDARY delegate collapsed to the master's save
// fields, not its LIVE chip lane. Fix (MA-1853/MA-1881 inherit-BEFORE-
// collapse precedent, taken to its lane): legendarySpellCastMaster (code-side
// inherit — monsters.json NOT mirrored) resolves the master Spellcasting row
// so the child arms gated spell chips; a spell-named press spends the RAW
// cost then casts through handleSpellCast (spells.json, real DC, payload). A
// press with NO spell chosen refuses honestly (no-spell-chosen) — the guard
// that replaces the empty-air save.
//
// (B) COST SPENT 1 NOT 2: expendLegendaryUse hardcoded used+1 (was
// monsterLegendaryUses.js:344); "Costs 2 Actions" was name-text only
// (MA-1847/MA-1872 family). Fix: legendaryActionCost parses "(Costs N
// Actions)" and the economy spends N, refusing insufficient-cost (zero spend)
// when N > remaining.
//
// The Demogorgon save is CHARISMA DC 23 (8 + PB8 + CHA +7), NOT Wisdom —
// the master row's own prose says so; save_type was a data bug, fixed here.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import spellsData from '../../../public/data/spells.json';
import spells2024Data from '../../../public/data/2024/spells.json';
import {
  legendaryActionCost, legendaryExpendGate, legendaryUsesRemaining, legendaryHeaderAction,
  expendLegendaryUse, buildLegendaryRefusalPopup, buildLegendaryRefusalLog, legendaryDelegateAction,
} from './monsterLegendaryUses.js';
import { legendarySpellCastMaster } from '../../components/encounter/MonsterCardHelpers.js';
import { legendaryDelegateChooserAction } from '../../components/encounter/MonsterCardModal.jsx';
import { parseSaveVariantChooser } from '../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const demo = monsters.find(m => m.index === 'demogorgon');
const la = demo.legendary_actions;
const header = la[0];
const castRow = la.find(a => a.name === 'Cast a Spell (Costs 2 Actions)');
const gazeRow = la.find(a => a.name === 'Gaze');
const tailRow = la.find(a => a.name === 'Tail');
const spellRow = () => demo.actions.find(a => a.name === 'Spellcasting');

// ── (A) Data lock: the live spell lane the delegate inherits ───────────────
describe('MA-1883 data lock: Spellcasting master carries the live spell lane + Demogorgon save is Charisma', () => {
  it('Spellcasting master row: numeric DC 23, CHARISMA save (row prose + 8+PB8+CHA+7=23, not Wisdom)', () => {
    const s = spellRow();
    expect(s.save_dc).toBe(23);
    expect(s.save_type).toBe('Charisma');
    expect(s.description).toMatch(/using Charisma as the spellcasting ability \(spell save DC 23\)/);
    // Wisdom would be DC 8+PB8+WIS+3 = 19, contradicting the printed DC 23.
    expect(s.description).not.toMatch(/Wisdom as the spellcasting ability/);
  });

  it('master row carries markup chips + usage tokens: 7 names, 3/Day x3 + 1/Day gates (delegable payload)', () => {
    const s = spellRow();
    const chips = ['Detect Magic', 'Major Image', 'Dispel Magic', 'Fear', 'Telekinesis', 'Feeblemind', 'Project Image'];
    chips.forEach(n => expect(s.description).toContain(`<em>${n}</em>`));
    // 3/Day + 1/Day tier headers arm per-spell N/Day uses on the cast lane.
    expect(s.description).toMatch(/<strong>3\/Day:<\/strong>/);
    expect(s.description).toMatch(/<strong>1\/Day:<\/strong>/);
    // every cast spell resolves in 5e spells.json (cast lane is live)
    chips.forEach(n => expect(spellsData.some(sp => sp.name === n)).toBe(true));
  });

  it('Feeblemind (the RAW combat pick) has a real DC + damage payload in spells.json', () => {
    const fb = spellsData.find(s => s.name === 'Feeblemind');
    expect(fb.dc.dc_type).toBe('INT');
    expect(fb.damage.damage_at_slot_level['8']).toBe('4d6');
    expect(canRollExpression('4d6')).toBe(true);
    // 2024 has no Feeblemind twin (MA-1879 §177) — 5e-exact-first is correct.
    expect(spells2024Data.some(s => s.name === 'Feeblemind')).toBe(false);
  });
});

// ── (A) The spell-delegate resolves to the LIVE lane (code-side inherit) ───
describe('MA-1883 legendarySpellCastMaster: the delegate reaches the spell lane, not a save shell', () => {
  it('Cast-a-Spell child resolves to the master Spellcasting row (live chips + DC)', () => {
    expect(castRow.delegates_to).toBe('Spellcasting');
    const master = legendarySpellCastMaster(demo, castRow);
    expect(master).toBe(spellRow());
    // master is a live cast lane, not a save-only shell
    expect(master.name).toBe('Spellcasting');
    expect(legendaryDelegateAction(demo, castRow)).toBe(master);
  });

  it('child stays byte-clean: NO own save_dc/variants/mirrored prose (MA-1881 single-source-of-truth)', () => {
    expect(castRow.save_dc).toBeUndefined();
    expect(castRow.variants).toBeUndefined();
    expect(castRow.description).toBe('The demogorgon uses Spellcasting.');
  });

  it('non-spellcast delegates are byte-inert null (Lash/Gaze/Tail lanes untouched)', () => {
    expect(legendarySpellCastMaster(demo, gazeRow)).toBeNull(); // delegates to Gaze, not Spellcasting
    expect(legendarySpellCastMaster(demo, tailRow)).toBeNull(); // no delegates_to
  });

  it('a delegate whose Spellcasting master has ZERO extractable chips returns null (no fake live lane)', () => {
    const bare = { index: 'x', actions: [{ name: 'Spellcasting', description: 'plain text, no markup' }], legendary_actions: [{ name: 'Cast', delegates_to: 'Spellcasting' }] };
    expect(legendarySpellCastMaster(bare, bare.legendary_actions[0])).toBeNull();
  });
});

// ── (A) Guard: a spell-delegate press MUST name a spell (no empty-air save) ─
describe('MA-1883 no-spell-chosen guard: refuse honestly instead of rolling a payload-less save', () => {
  it('popup carries the no-spell-chosen vocabulary + Nothing spent, no roll', () => {
    const popup = buildLegendaryRefusalPopup({ monsterName: 'Demogorgon 1', actionName: 'Cast a Spell (Costs 2 Actions)', reason: 'no-spell-chosen' });
    expect(popup).toContain('Legendary Action Refused');
    expect(popup).toMatch(/press one of this row's spell chips/);
    expect(popup).toMatch(/Nothing spent, no roll\./);
    // the MA-1874 defect signature — a bare "save" with no spell — never appears
    expect(popup).not.toMatch(/DC Unknown/);
  });

  it('refusal log names the row and swears zero spend', () => {
    const log = buildLegendaryRefusalLog({ monsterName: 'Demogorgon 1', actionName: 'Cast a Spell (Costs 2 Actions)', reason: 'no-spell-chosen' });
    expect(log.automationType).toBe('legendary_use_refused');
    expect(log.description).toMatch(/zero spend, no roll/);
  });

  // The MA-1881 chooser inherit must NOT hijack the spell-delegate lane — the
  // Spellcasting master arms NO variants chooser, so legendaryDelegateChooserAction
  // returns the child unchanged (the spell lane is the press surface, not a variant).
  it('spell-delegate child does NOT inherit a variants chooser (spell chips own the press)', () => {
    expect(parseSaveVariantChooser(spellRow())).toBeNull();
    const resolved = legendaryDelegateChooserAction(castRow, { monster: demo, parseSaveVariantChooser });
    expect(resolved.variants).toBeUndefined();
  });
});

// ── (B) Cost parsing: "(Costs N Actions)" → N ───────────────────────────────
describe('MA-1883 legendaryActionCost: "(Costs N Actions)" name-text is machine-read', () => {
  it('Demogorgon Cast-a-Spell costs 2', () => {
    expect(legendaryActionCost(castRow)).toBe(2);
  });

  it('non-cost legendary rows cost 1 (byte-inert economy)', () => {
    expect(legendaryActionCost(gazeRow)).toBe(1);
    expect(legendaryActionCost(tailRow)).toBe(1);
    expect(legendaryActionCost(null)).toBe(1);
    expect(legendaryActionCost({ name: 'Claw Attack' })).toBe(1);
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

  it('grammar variants: singular "Action", extra spacing, and NO cost → honest floor 1', () => {
    expect(legendaryActionCost({ name: 'Bite (Costs 2 Action)' })).toBe(2);
    expect(legendaryActionCost({ name: 'Bite  Costs 3  Actions  inline' })).toBe(3);
    expect(legendaryActionCost({ name: 'No cost here' })).toBe(1);
  });
});

// ── (B) Gate + expend: pay the RAW cost, refuse insufficient honestly ──────
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

  it('fresh press spends 2 of 2 → remaining 0, spends-2 log', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(r).toEqual({ spent: true, remaining: 0, max: 2 });
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/spends 2 legendary uses for Cast a Spell \(Costs 2 Actions\).*0 of 2 left/);
  });

  it('only 1 LA left (used:1 of the 2-pool) → INSUFFICIENT-COST refusal, ZERO spend', async () => {
    store['Demogorgon 1.monsterLegendaryUses'] = { max: 2, used: 1 };
    const r = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('insufficient-cost');
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    const ref = logs.find(e => e.automationType === 'legendary_use_refused');
    expect(ref.description).toMatch(/insufficient-cost: costs 2, 1 left/);
    expect(r.popupHtml).toMatch(/Nothing spent, no roll/);
  });

  it('cost 2 with exactly 2 remaining → allowed (spends both)', () => {
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 0 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Demogorgon 1', latch: null, cost: 2 }).allowed).toBe(true);
  });

  it('cost 2 with 1 remaining → insufficient-cost refusal', () => {
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 1 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Demogorgon 1', latch: null, cost: 2 }).reason).toBe('insufficient-cost');
  });

  it('exhausted (0 left) still refuses exhausted even for cost 1 (economy byte-inert)', () => {
    expect(legendaryExpendGate({ header, storedUses: { max: 2, used: 2 }, round: 1, activeCreatureName: 'Bandit 1', monsterName: 'Demogorgon 1', latch: null, cost: 1 }).reason).toBe('exhausted');
    expect(legendaryUsesRemaining(header, { max: 2, used: 2 })).toBe(0);
    expect(legendaryHeaderAction(demo)).toBe(header);
  });

  it('cost 2 after spending once on the same Demogorgon (2-pool) → 0 left, next-boundary press exhausted', async () => {
    await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Gaze', campaignName: 'test-campaign', action: gazeRow, deps });
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
    // same-boundary cast (cost 2, 1 left) refuses insufficient-cost, zero extra spend
    cs.activeCreatureName = 'Bandit 2';
    const r = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(r.reason).toBe('insufficient-cost');
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 });
  });

  it('once-per-boundary latch still honest: same-boundary refire of the cost-2 cast refuses (turn)', async () => {
    const first = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(first).toEqual({ spent: true, remaining: 0, max: 2 });
    // 0 left + latch (activeCreature unchanged) — exhausted fires before turn, both honest zero-spend
    const second = await expendLegendaryUse({ monsterName: 'Demogorgon 1', monster: demo, actionName: 'Cast a Spell (Costs 2 Actions)', campaignName: 'test-campaign', action: castRow, deps });
    expect(second.spent).toBe(false);
    expect(second.reason).toBe('exhausted');
    expect(store['Demogorgon 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(logs.filter(e => e.type === 'ability_use').length).toBe(1);
  });

  it('insufficient-cost popup/log vocabulary is distinct and honest (both builders)', () => {
    const popup = buildLegendaryRefusalPopup({ monsterName: 'Demogorgon 1', actionName: 'Cast a Spell (Costs 2 Actions)', reason: 'insufficient-cost', cost: 2, remaining: 1 });
    expect(popup).toContain('Legendary Action Refused');
    expect(popup).toMatch(/costs 2 legendary uses but Demogorgon 1 has only 1 left/);
    expect(popup).toMatch(/Nothing spent, no roll/);
    const log = buildLegendaryRefusalLog({ monsterName: 'Demogorgon 1', actionName: 'Cast a Spell (Costs 2 Actions)', reason: 'insufficient-cost', cost: 2, remaining: 1 });
    expect(log.description).toMatch(/insufficient-cost: costs 2, 1 left/);
  });
});
