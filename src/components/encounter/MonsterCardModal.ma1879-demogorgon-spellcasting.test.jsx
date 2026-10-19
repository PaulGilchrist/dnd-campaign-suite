// @maintained-by-ai
// MA-1879 data lock: Demogorgon Spellcasting rode the MA-0421/MA-1850 twin
// markup-gap template. Pre-fix the WHOLE description was plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// {} → SpellCastLinks null → ZERO .mc-dice-link-spell chips card-wide and the
// 3/Day + 1/Day usage lane dead-by-construction (uses bind MARKED names only,
// §144/§251). DATA fix, markup-only: house-style <strong>Tier:</strong>
// <em>Spell</em> INLINE (originally-inline prose, no <br> — MA-1850 archlich
// byte-shape); stripped-text byte-exact proof below. All SEVEN names resolve in
// 5e spells.json (every marked token is a ":" header or a resolvable name —
// MA-0599 fake-chip guard). "3/Day:"/"1/Day:" headers arm the per-spell uses
// gates WITHOUT "Each" (optional group, Helpers:440) — At-Will names stay ungated
// by design (§57). save_dc 23 + save_type "Charisma" pair byte-untouched
// (§89/§167; MA-1883 fixed the ability); row-level DC on a Spellcasting row is
// structurally unrenderable as a DC chip (MA-1294) — the DC rides every chip's
// cast record via buildMonsterSpellCastLog.
// Cited owners, not absorbed here: generic counter/gate/refusal/At-Will lanes
// MonsterCardModal.spellcasting.test.jsx :275/:281-302/:317 (null-store :317 and
// :561); store independence :522-548; demogorgon legendary Cast-a-Spell
// multi-spend monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js
// :136-210 and its modal shape ma1883-demogorgon-legendary-cast-spell.test.jsx
// :151-255 (incl. Feeblemind exhausted press :208); tentacles/summon lanes
// ma1877 transport #741. THIS file owns only this row's spell bytes + the
// un-"Each" 3/Day+1/Day gated modal lane.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const demogorgon = monsters.find(m => m.index === 'demogorgon');
const demogorgonRow = demogorgon.actions.find(a => a.name === 'Spellcasting');

const CHIP_NAMES = [
  'Detect Magic', 'Major Image',
  'Dispel Magic', 'Fear', 'Telekinesis',
  'Feeblemind', 'Project Image',
];
const AT_WILL = ['Detect Magic', 'Major Image'];
const THREE_DAY = ['Dispel Magic', 'Fear', 'Telekinesis'];
const ONE_DAY = ['Feeblemind', 'Project Image'];
const HEADERS = ['At Will:', '3/Day:', '1/Day:'];
const USES_KEY = 'monsterSpellUses';

// Pre-fix plain baseline: identical text, names unmarked.
const PRE_FIX_DESCRIPTION = 'The demogorgon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): At Will: Detect Magic, Major Image. 3/Day: Dispel Magic, Fear, Telekinesis. 1/Day: Feeblemind, Project Image.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Demogorgon 1';

// Mock hygiene (#739/#740): diceRoller purged — all SEVEN demogorgon spells are
// damage-less (no rollExpression/rollExpressionDoubled reachable from this cast
// lane); rangeValidation purged (pure parsers); mapsService purged (mapName=null
// short-circuits loadMapData at modal :2132); abilityLookup purged (not imported
// by the modal tree). Kept: logService (assertion target), sanitize (body render),
// dataLoader §177 below, useLoggedDiceRoll (destructured whole at modal :2211),
// conditionEffects + damageUtils (getCombatContext fires at :2125), runtime store.
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// §177: loadSpells mock MUST branch on the ruleset arg — findMonsterSpell is
// 5e-exact-first; all seven names resolve in 5e, Feeblemind has no 2024 twin.
const SPELLS_5E = CHIP_NAMES.map(n => spells5e.find(s => s.name === n));
const SPELLS_2024 = CHIP_NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
  };
});

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
    key: (characterKey, propertyName) => `${characterKey}.${propertyName}`,
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

function renderDemogorgon() {
  const m = makeMonster({ name: 'Demogorgon', type: 'fiend', subtype: 'Demon', actions: [demogorgonRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 22, currentHp: 464, maxHp: 464, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: demogorgon Spellcasting row ───────────────────────────────────

describe('MA-1879 monsters.json data lock: Demogorgon Spellcasting row', () => {
  it('extractors exact-map: seven <em> names in authored order (colon headers skipped); 3/Day: binds its three names, 1/Day: its two, At Will ungated (§58/§251)', () => {
    const names = extractSpellNamesFromSpellcasting(demogorgonRow.description);
    expect(names).toEqual(CHIP_NAMES);
    HEADERS.forEach(h => expect(names).not.toContain(h.replace(/:$/, '')));
    expect(extractSpellcastingSpellUses(demogorgonRow.description)).toEqual({
      'Dispel Magic': 3, 'Fear': 3, 'Telekinesis': 3,
      'Feeblemind': 1, 'Project Image': 1,
    });
  });

  it('row-level numeric save_dc 23 + save_type Charisma (§89 pair; MA-1883 fixed the ability)', () => {
    expect(demogorgonRow.save_dc).toBe(23);
    // MA-1883: save_type "Wisdom" contradicted the row's OWN prose ("using
    // Charisma as the spellcasting ability (spell save DC 23)") and the app-
    // wide Spellcasting convention (save_type === prose ability, grep-proven
    // across ~90 monsters). Charisma: DC 23 = 8 + PB 8 + CHA mod +7 (CHA 25);
    // Wisdom would give 8 + 8 + 3 = 19 ≠ 23. DC byte-untouched.
    expect(demogorgonRow.save_type).toBe('Charisma');
    expect(demogorgonRow.description).toMatch(/spell save DC 23/);
  });

  it('markup-only house style: stripped text byte-exact pre-fix baseline, <strong> headers + <em> resolvable 5e names inline, no <br>, no fake chips (MA-0599 guard)', () => {
    const desc = demogorgonRow.description;
    expect(desc).not.toMatch(/<br>/);
    HEADERS.forEach(h => expect(desc).toContain(`<strong>${h}</strong>`));
    CHIP_NAMES.forEach(n => expect(desc).toContain(`<em>${n}</em>`));
    [...desc.matchAll(/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g)].map(m => m[1]).forEach(t => {
      const ok = t.endsWith(':') || (CHIP_NAMES.includes(t) && spells5e.some(s => s.name === t));
      expect(ok, `marked token must be header or resolvable spell name: ${t}`).toBe(true);
    });
    expect(stripTags(desc)).toBe(PRE_FIX_DESCRIPTION);
  });
});

// ── Modal: seven chips with counters, gates live ─────────────────────────────

describe('MA-1879 MonsterCardModal Demogorgon Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders the seven spell chips in authored order — counters on the 3/Day trio + 1/Day pair only, the zero-chip inert row is gone', () => {
    renderDemogorgon();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    THREE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(3\/Day · 3 left\)/));
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));
    AT_WILL.forEach(n => expect(linkByText(n).textContent).not.toMatch(/\/Day/));
  });

  it('At-Will Detect Magic casts ungated twice — zero uses stored, log prints row DC 23', async () => {
    renderDemogorgon();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/spell save DC 23/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`] ?? null).toBeNull();
  });

  it('usage gates live (§58): Fear spends 1→2→3 then fourth refused; Feeblemind spends its 1/Day then refire refused — refusals name the spell, zero extra spend', async () => {
    renderDemogorgon();
    for (let cast = 1; cast <= 3; cast++) {
      await act(async () => { fireEvent.click(linkByText('Fear')); });
      await waitFor(() => expect(abilityUseEntries('Fear').length).toBe(cast));
      expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Fear': cast });
    }
    expect(abilityUseEntries('Fear')[0].description).toMatch(/spell save DC 23/);

    await act(async () => { fireEvent.click(linkByText('Fear')); });
    await waitFor(() => expect(refusalEntries('Fear').length).toBe(1));
    expect(abilityUseEntries('Fear').length).toBe(3);
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Fear': 3 });

    await act(async () => { fireEvent.click(linkByText('Feeblemind')); });
    await waitFor(() => expect(abilityUseEntries('Feeblemind').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Fear': 3, 'Feeblemind': 1 });

    await act(async () => { fireEvent.click(linkByText('Feeblemind')); });
    await waitFor(() => expect(refusalEntries('Feeblemind').length).toBe(1));
    expect(abilityUseEntries('Feeblemind').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`]).toEqual({ 'Fear': 3, 'Feeblemind': 1 });
  });
});
