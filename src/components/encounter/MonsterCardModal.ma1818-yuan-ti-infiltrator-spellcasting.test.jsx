// @maintained-by-ai
// MA-1818 data lock: Yuan-ti Infiltrator Spellcasting rode the MA-0421 /
// MA-1742 / MA-1814 markup-gap family — plain-text spell names (zero
// affordances, row inert) while the save_dc 12 + save_type Wisdom pair sat
// byte-present and header-swallowed (§89/§532 fork). DATA-MARKUP fix mirrors
// the MA-1742 YOCHLOL / MA-1814 ABOMINATION INLINE byte-shape: <strong> tier
// headers + <em> per spell name, "; " tier delimiters preserved, NO <br>
// (original prose was inline — adding <br> breaks stripTags byte-equality,
// §MA-1742 pitfall). The byte-exact fixed-description lock below subsumes
// the markup-contains, no-<br> and pre-fix strip-tags twins (any prose
// drift fails toBe). "At Will:"/"2/Day:" headers end ":" → fake-chip guard
// skips them (MonsterCardHelpers.js:399); "2/Day:" matches the uses-header
// regex (:440) binding Suggestion maxUses 2. "(snakes only)" advisory paren
// stays OUTSIDE markup (§158 unresolvable-name guard).
// TWIN IDENTITY (MA-1814 #727): the spell pair here is the byte-twin of the
// Abomination's (Animal Friendship + Suggestion) — spell-DB shape (WIS dc /
// dc_success none / damage-free / concentration split) is pinned there at
// ma1814-...abomination-spellcasting.test.jsx:178-190 and is NOT duplicated
// here; this file pins only the infiltrator-distinct bytes: DC 12 and the
// 2/Day gate. Generic lanes are OWNED by spellcasting.test.jsx and not
// re-asserted: counter badge render :275, exhausted spend + spell-named
// refusal shape :288-302, multi-key independence :522-548, At Will null
// store :327/:561. DC arithmetic restatement removed (row dc bytes pinned
// once). diceRoller mock purged — the save seam rolls only through the fully
// mocked useLoggedDiceRoll hook.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const YT_SPELLS = ['Animal Friendship', 'Suggestion'];

// Exact byte-lock: two <strong> headers + two <em> names, "(snakes only)"
// OUTSIDE the <em>, "; " tier delimiter byte-kept, inline (no <br>/\n).
// Infiltrator-distinct vs the #727 abomination twin: "spell save DC 12" and
// "2/Day:" (that twin carries DC 15 / 3/Day). The extractor exact-map below
// proves no fake chips (§161/§648).
const YTI_FIXED_BYTES = 'The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12): <strong>At Will:</strong> <em>Animal Friendship</em> (snakes only); <strong>2/Day:</strong> <em>Suggestion</em>';

const yuanTi = monsters.find(m => m.index === 'yuan-ti-infiltrator');
const row = yuanTi.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Yuan-ti Infiltrator 1';

// ── Mocks (mirror MonsterCardModal.ma1814-yuan-ti-abomination-spellcasting.test.jsx) ───

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? spells2024 : realSpells(YT_SPELLS))),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollSavingThrow,
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

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && (name == null || e.abilityName === name));
}

function renderYuanTi() {
  const m = makeMonster({ name: yuanTi.name, index: 'yuan-ti-infiltrator', type: 'monstrosity', actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: yuanTi.hit_points, maxHp: yuanTi.hit_points, conditions: [] },
    { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock ────────────────────────────────────────────────────────────────

describe('MA-1818 monsters.json data lock: Yuan-ti Infiltrator Spellcasting row', () => {
  it('description is byte-exact INLINE house style + numeric save_dc 12 / save_type Wisdom pair kept byte-untouched (§89)', () => {
    expect(row.description).toBe(YTI_FIXED_BYTES);
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Wisdom');
  });

  it('extractor harvests exactly both names and gates Suggestion only — headers and "(snakes only)" never enter the harvest (§57/§144, no fake chips §161/§648)', () => {
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(YT_SPELLS);
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ Suggestion: 2 });
  });

  it('fix scoped to the Spellcasting row only: four sibling actions byte-plain', () => {
    expect(yuanTi.actions.map(a => a.name)).toEqual(['Multiattack', 'Scimitar', 'Poison Ray', 'Spellcasting']);
    for (const a of yuanTi.actions.filter(x => x.name !== 'Spellcasting')) {
      expect(a.description).not.toContain('<strong>');
      expect(a.description).not.toContain('<em>');
    }
  });
});

// ── Modal: chips + cast routing ──────────────────────────────────────────────

describe('MA-1818 MonsterCardModal Yuan-ti Infiltrator Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders two chips in authored order — counter on Suggestion only, At Will chip bare (the zero-chip inert row is gone)', () => {
    renderYuanTi();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(YT_SPELLS);
    expect(linkByText('Suggestion').textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(linkByText('Animal Friendship').textContent).not.toMatch(/\/Day/);
  });

  it('At Will Animal Friendship repeats ungated — each cast LIVE-routes the enforced WIS DC 12 save (dc_success none, snakes-only paren never blocks resolution), zero refusals', async () => {
    renderYuanTi();
    // ability_use lands only after the save resolves (mock never resolves);
    // this lane's affordance proof is the save seam itself.
    for (let i = 0; i < 2; i++) {
      await act(async () => { fireEvent.click(linkByText('Animal Friendship')); });
      await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(i + 1));
    }

    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Animal Friendship');
    expect(context.saveDc).toBe(12);
    expect(context.saveType).toBe('WIS');
    expect(context.dcSuccess).toBe('none');
    expect(refusals()).toHaveLength(0);
    // null monsterSpellUses store is owned by spellcasting.test.jsx:327/:561.
  });

  it('Suggestion spends 2→0 over two casts (each logs a 2/Day remaining-today record carrying DC 12 WIS), refuses the 3rd zero-spend', async () => {
    renderYuanTi();
    for (let i = 0; i < 2; i++) {
      await act(async () => { fireEvent.click(linkByText('Suggestion')); });
    }

    await waitFor(() => expect(abilityUseEntries('Suggestion').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Suggestion: 2 });
    expect(abilityUseEntries('Suggestion')[0].description).toMatch(/casts Suggestion via Spellcasting/);
    expect(abilityUseEntries('Suggestion')[0].description).toMatch(/spell save DC 12, WIS/);
    // dc_success "none" gate lane logs the record (DC bytes ride the log) —
    // no auto-roll seam; save routing on this row is owned by the AF test.
    expect(rollSavingThrow).toHaveBeenCalledTimes(0);
    const spends = abilityUseEntries('Suggestion').map(e => e.description).join('\n');
    expect(spends).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(spends).toMatch(/2\/Day use spent — 0 remaining today/);

    // Exhausted-refuse shape owned by spellcasting.test.jsx:288-302; this
    // pins only the 2/Day-specific refusal bytes + gate holding the record.
    await act(async () => { fireEvent.click(linkByText('Suggestion')); });
    await waitFor(() => expect(refusals('Suggestion').length).toBe(1));
    expect(refusals('Suggestion')[0].description).toMatch(/already cast Suggestion today \(2\/Day\)/);
    expect(abilityUseEntries('Suggestion').length).toBe(2);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Suggestion: 2 });
  });
});
