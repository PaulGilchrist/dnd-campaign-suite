// @maintained-by-ai
// MA-1958 data lock: Orcus Spellcasting rode the MA-0421/MA-1879 twin
// markup-gap template. Pre-fix the WHOLE description was plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// {} → SpellCastLinks null → ZERO .mc-dice-link-spell chips on the row, no
// spell on the card castable, and the 3/Day + 1/Day usage lane dead-by-
// construction (extractSpellcastingSpellUses binds MARKED names only,
// §144/§251); the row-level save_dc 23 was XOR-unreachable behind the row-
// NAME fork (MonsterAction.jsx renders SpellCastLinks, never ActionSaveRoll,
// for rows named "Spellcasting" — MA-0532/§118). DATA fix, markup-only:
// house-style <strong>Tier:</strong> <em>Spell</em> INLINE (originally-inline
// prose, no <br> — demogorgon MA-1879 byte-shape twin, same DC 23 tier
// ladder), emphasis-census + strip-tags byte-equality pinned. All three names
// resolve in BOTH spell indexes with zero dc/attack_type → chips are
// advisory-cast affordances with uses gates (§204 lane); DC 23 rides every
// chip's cast record via buildMonsterSpellCastLog.
// SOURCE axis, not this ticket: row save_type "Wisdom" contradicts the row's
// OWN prose ("using Charisma as the spellcasting ability", WIS +5 → 8+8+5=21
// ≠ 23; CHA +7 → 23) — the MA-1883 prose-ability adjudication axis; bytes
// pinned as-is (§89 pair present, byte-untouched per ticket scope).
// Cited owners, not absorbed here: generic counter badge :275, spend/refusal
// bytes :281-302, At-Will advisory/null-store :317/:561, store independence
// :522-548, Spellcasting-row no-save-shell :192 — all
// MonsterCardModal.spellcasting.test.jsx; Orcus wand lane (item-cast seam,
// DC 18, charges advisory) is ma1959-orcus-wand-spellcasting.test.jsx on the
// SAME card — spellbook rows only here; canonical legendary-uses lane
// :190-212/:304-326. THIS file owns only this row's spell bytes + the
// 3/Day+1/Day gated modal lane.
// Mock hygiene (#739-#748): diceRoller purged — all three Orcus spellbook
// spells damage-less (no rollExpression consumer in this lane); rangeValidation
// purged (pure parsers); mapsService purged (mapName=null short-circuits at
// modal :2132); abilityLookup purged (not imported by the modal tree);
// useLoggedDiceRoll popup-capture/roll exports purged (no test consumes them).
// Kept: logService (assertion target), sanitize (body render), dataLoader
// §177 below, conditionEffects + damageUtils (getCombatContext fires at
// :2125), runtime store.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const orcus = monsters.find(m => m.index === 'orcus');
const orcusRow = orcus.actions.find(a => a.name === 'Spellcasting');

const CHIP_NAMES = ['Detect Magic', 'Dispel Magic', 'Time Stop'];
const AT_WILL = ['Detect Magic'];
const THREE_DAY = ['Dispel Magic'];
const ONE_DAY = ['Time Stop'];
const HEADERS = ['At Will:', '3/Day:', '1/Day:'];
const USES_KEY = 'monsterSpellUses';

// Pre-fix plain baseline (git HEAD, monsters.json): identical text, names and
// tier headers unmarked.
const PRE_FIX_DESCRIPTION = 'Orcus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): At Will: Detect Magic. 3/Day: Dispel Magic. 1/Day: Time Stop.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Orcus 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// §177: loadSpells mock MUST branch on the ruleset arg — findMonsterSpell is
// 5e-exact-first; all three names resolve in BOTH indexes (§158 trap INACTIVE).
const SPELLS_5E = CHIP_NAMES.map(n => spells5e.find(s => s.name === n));
const SPELLS_2024 = CHIP_NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusalEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderOrcus() {
  const m = makeMonster({ name: 'Orcus', type: 'fiend', subtype: 'Demon', actions: [orcusRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 17, currentHp: 405, maxHp: 405, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: Orcus Spellcasting row ─────────────────────────────────────────

describe('MA-1958 monsters.json data lock: Orcus Spellcasting row', () => {
  it('extractors exact-map: three <em> names in authored order (colon headers skipped); 3/Day: binds Dispel Magic, 1/Day: binds Time Stop, At Will ungated (§58/§251)', () => {
    const names = extractSpellNamesFromSpellcasting(orcusRow.description);
    expect(names).toEqual(CHIP_NAMES);
    HEADERS.forEach(h => expect(names).not.toContain(h.replace(/:$/, '')));
    expect(extractSpellcastingSpellUses(orcusRow.description)).toEqual({
      'Dispel Magic': 3,
      'Time Stop': 1,
    });
  });

  it('row-level numeric save_dc 23 + save_type "Wisdom" pair byte-untouched (§89 pair present; prose says Charisma — MA-1883-scope adjudication axis, not this ticket)', () => {
    expect(orcusRow.save_dc).toBe(23);
    expect(orcusRow.save_type).toBe('Wisdom');
  });

  it('markup-only house style: emphasis census exact (three <strong> ":" headers + three <em> names, no decoys §161), no <br>, stripped text byte-exact pre-fix baseline; all three names resolve in BOTH indexes with zero dc/attack_type — advisory cast lane (§204)', () => {
    const desc = orcusRow.description;
    expect(desc.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g)).toEqual([
      '<strong>At Will:</strong>',
      '<em>Detect Magic</em>',
      '<strong>3/Day:</strong>',
      '<em>Dispel Magic</em>',
      '<strong>1/Day:</strong>',
      '<em>Time Stop</em>',
    ]);
    expect(desc).not.toMatch(/<br>/);
    expect(stripTags(desc)).toBe(PRE_FIX_DESCRIPTION);
    CHIP_NAMES.forEach(n => {
      const s = spells5e.find(sp => sp.name === n);
      expect(s).toBeDefined();
      expect(s.dc == null).toBe(true);
      expect(s.attack_type == null).toBe(true);
      expect(spells2024.some(sp => sp.name === n)).toBe(true);
    });
  });
});

// ── Modal: three chips with counters, usage gates live ────────────────────────

describe('MA-1958 MonsterCardModal Orcus Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders the three spell chips in authored order — counters on the 3/Day + 1/Day names only, the zero-chip inert row is gone', () => {
    renderOrcus();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    THREE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(3\/Day · 3 left\)/));
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At-Will Detect Magic casts ungated twice — zero uses stored, log prints row DC 23 (§204)', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/spell save DC 23/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`] ?? null).toBeNull();
  });

  it('usage gates live (§58): Dispel Magic spends 1→2→3 then fourth refused; Time Stop spends its 1/Day then refire refused — refusals name the spell, zero extra spend', async () => {
    renderOrcus();
    for (let cast = 1; cast <= 3; cast++) {
      await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
      await waitFor(() => expect(abilityUseEntries('Dispel Magic').length).toBe(cast));
      expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Dispel Magic': cast });
    }
    expect(abilityUseEntries('Dispel Magic')[0].description).toMatch(/spell save DC 23/);

    await act(async () => { fireEvent.click(linkByText('Dispel Magic')); });
    await waitFor(() => expect(refusalEntries('Dispel Magic').length).toBe(1));
    expect(abilityUseEntries('Dispel Magic').length).toBe(3);
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Dispel Magic': 3 });

    await act(async () => { fireEvent.click(linkByText('Time Stop')); });
    await waitFor(() => expect(abilityUseEntries('Time Stop').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Dispel Magic': 3, 'Time Stop': 1 });
    expect(abilityUseEntries('Time Stop')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Time Stop')); });
    await waitFor(() => expect(refusalEntries('Time Stop').length).toBe(1));
    expect(abilityUseEntries('Time Stop').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Dispel Magic': 3, 'Time Stop': 1 });
  });
});
