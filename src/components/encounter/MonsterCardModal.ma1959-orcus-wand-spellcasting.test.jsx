// MA-1959 data lock + chip+shell fork lock: Orcus "Wand Spellcasting" rode a
// HALF-live fingerprint — the generic ActionSaveRoll shell was LIVE ("DC 18
// Wisdom" adjudicated on both faces) while the five spell names were plain
// text (zero .mc-dice-link-spell chips) because the row-name XOR at
// MonsterAction.jsx:422 is the EXACT /^spellcasting$/i test (MA-1958's
// sibling-row oracle on the SAME card). The bare shell was a MISLEADING
// affordance: it substituted a generic no-effect WIS save for a spell cast
// and paid nothing. Fix = MA-0421/MA-1958 inline markup DATA (+ honest
// dc_success:"none" — the row is damageless, half-default copy is MV-20
// misleading) PLUS the sanctioned chip+shell code fork: the canonical
// spell-selection idiom "casts one of the following spells" lets
// SpellOrSaveLinks render SpellCastLinks ALONGSIDE the untouched ActionSaveRoll
// shell. Charge economy stays §70 ADVISORY text (no charge-pool producer/
// consumer exists; "At Will (no charge)"/"1 Charge:"/"2 Charges:" miss the
// N/Day pattern → chips ungated fire-by-design, At-Will precedent).
// Whole-DB census pins the fork byte-inert: Wand Spellcasting is the ONLY
// non-"Spellcasting"-named row carrying idiom + marked names + save_dc>0.
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
const wandRow = orcus.actions.find(a => a.name === 'Wand Spellcasting');
const spellcastingRow = orcus.actions.find(a => a.name === 'Spellcasting');
const multiattackRow = orcus.actions.find(a => a.name === 'Multiattack');
const wandAttackRow = orcus.actions.find(a => a.name === 'Wand of Orcus');

const CHIP_NAMES = ['Animate Dead', 'Blight', 'Speak with Dead', 'Circle of Death', 'Power Word Kill'];
const HEADERS = ['At Will (no charge):', '1 Charge:', '2 Charges:'];
const ADVISORY_CHIPS = ['Animate Dead', 'Speak with Dead', 'Power Word Kill'];

// Pre-fix description bytes (git HEAD f3e493eeb, monsters.json) — strip-tag
// byte-equality pins the markup-only diff (house style: INLINE, no <br>,
// original prose was single-space separated — MA-1958 append §619/§251).
const PRE_FIX_DESCRIPTION = 'While holding the Wand of Orcus, Orcus casts one of the following spells (spell save DC 18). The wand has 7 charges: At Will (no charge): Animate Dead, Blight, Speak with Dead. 1 Charge: Circle of Death. 2 Charges: Power Word Kill. It regains 1d4 + 3 charges daily at dawn.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Orcus 1';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 30, rolls: [7, 8, 9, 6], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 60, rolls: [7, 8, 9, 6, 7, 8, 9, 6], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// §177: loadSpells mock MUST branch on the ruleset arg — findMonsterSpell is
// 5e-exact-first; all five names resolve in BOTH indexes (§158 trap INACTIVE).
const SPELLS_5E = CHIP_NAMES.map(n => spells5e.find(s => s.name === n));
const SPELLS_2024 = CHIP_NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
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
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
    _setPopupHtml,
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
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
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

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function rowByLeadingName(prefix) {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => {
    const s = r.querySelector('strong');
    return s && s.textContent.trim().startsWith(prefix);
  }) || null;
}

function wandRowEl() { return rowByLeadingName('Wand Spellcasting'); }
function wandChipByText(text) {
  return Array.from(wandRowEl().querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusalEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderOrcus() {
  const m = makeMonster({
    name: 'Orcus',
    type: 'fiend',
    subtype: 'Demon',
    actions: [multiattackRow, wandAttackRow, spellcastingRow, wandRow],
  });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 17, currentHp: 405, maxHp: 405, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: Orcus Wand Spellcasting row ─────────────────────────────────

describe('MA-1959 monsters.json data lock: Orcus Wand Spellcasting row', () => {
  it('extracts all five spell names as chips — tier headers ending ":" skipped', () => {
    const names = extractSpellNamesFromSpellcasting(wandRow.description);
    expect(names).toEqual(CHIP_NAMES);
    HEADERS.forEach(h => expect(names).not.toContain(h.replace(/:$/, '')));
  });

  it('charge tiers do NOT match the N/Day uses pattern — chips ungated fire-by-design, charge economy stays §70 advisory text', () => {
    expect(extractSpellcastingSpellUses(wandRow.description)).toEqual({});
  });

  it('dc_success "none" authored — damageless row, half-default copy is MV-20 misleading; save_dc 18 + save_type "Wisdom" pair byte-untouched', () => {
    expect(wandRow.dc_success).toBe('none');
    expect(wandRow.save_dc).toBe(18);
    expect(wandRow.save_type).toBe('Wisdom');
    expect(wandRow.description).toMatch(/spell save DC 18/);
    expect(wandRow.description).not.toMatch(/Hit:|Failure:|Success:/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte (INLINE twin, no <br> — original prose single-line, §619)', () => {
    expect(stripTags(wandRow.description)).toBe(PRE_FIX_DESCRIPTION);
    expect(wandRow.description).not.toMatch(/<br>/);
  });

  it('house style MA-0421/MA-1958: three tier headers <strong>-wrapped ending ":", five spell names <em>-wrapped', () => {
    HEADERS.forEach(h => expect(wandRow.description).toContain(`<strong>${h}</strong>`));
    CHIP_NAMES.forEach(n => expect(wandRow.description).toContain(`<em>${n}</em>`));
  });

  it('emphasis census: ONLY the three tier headers + five spell names carry markup — no §161 fake-chip decoys', () => {
    const tokens = (wandRow.description.match(/<(?:strong|em)>[^<]*<\/(?:strong|em)>/g) || []);
    expect(tokens).toEqual([
      '<strong>At Will (no charge):</strong>',
      '<em>Animate Dead</em>',
      '<em>Blight</em>',
      '<em>Speak with Dead</em>',
      '<strong>1 Charge:</strong>',
      '<em>Circle of Death</em>',
      '<strong>2 Charges:</strong>',
      '<em>Power Word Kill</em>',
    ]);
  });

  it('all five spells resolve in BOTH 5e and 2024 indexes; Blight/Circle of Death carry CON-half saves, the other three carry no dc → save-route vs advisory lanes', () => {
    CHIP_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    const blight = spells5e.find(s => s.name === 'Blight');
    const circle = spells5e.find(s => s.name === 'Circle of Death');
    expect(blight.dc).toEqual({ dc_type: 'CON', dc_success: 'half' });
    expect(blight.damage.damage_at_slot_level['4']).toBe('8d8');
    expect(circle.dc).toEqual({ dc_type: 'CON', dc_success: 'half' });
    expect(circle.damage.damage_at_slot_level['6']).toBe('8d6');
    ['Animate Dead', 'Speak with Dead', 'Power Word Kill'].forEach(n => {
      expect(spells5e.find(s => s.name === n).dc == null).toBe(true);
    });
  });

  it('whole-DB byte-inertness census of the chip+shell fork: Wand Spellcasting is the ONLY non-"Spellcasting" row with the idiom + marked names + numeric save_dc', () => {
    const idiom = /one of the following spells/i;
    const lists = ['actions', 'bonus_actions', 'reactions', 'legendary_actions', 'lair_actions'];
    const hits = [];
    monsters.forEach(mo => {
      lists.forEach(key => {
        (Array.isArray(mo[key]) ? mo[key] : []).forEach(a => {
          if (!a || typeof a !== 'object') return;
          if (/^spellcasting$/i.test(a.name || '')) return;
          if (!(Number(a.save_dc) > 0)) return;
          if (!idiom.test(a.description || '')) return;
          if (extractSpellNamesFromSpellcasting(a.description).length === 0) return;
          hits.push(`${mo.name}/${a.name}`);
        });
      });
    });
    expect(hits).toEqual(['Orcus/Wand Spellcasting']);
  });

  it('no 2024 monsters.json twin exists — single-file fix scope (§3)', () => {
    expect(() => readFileSync('public/data/2024/monsters.json', 'utf8')).toThrow();
  });
});

// ── Modal: five chips + live shell coexist ─────────────────────────────────

describe('MA-1959 MonsterCardModal Wand Spellcasting chip+shell fork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('Wand row renders five spell chips AND the DC 18 Wisdom shell — chip+shell coexist (was 0 chips + shell-only)', () => {
    renderOrcus();
    const row = wandRowEl();
    const wandSpellChips = Array.from(row.querySelectorAll('.mc-dice-link-spell'));
    expect(wandSpellChips.length).toBe(5);
    expect(wandSpellChips.map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    const shells = Array.from(row.querySelectorAll('.mc-dice-link-save-clickable'));
    expect(shells.length).toBe(1);
    expect(shells[0].textContent.trim()).toBe('DC 18 Wisdom');
  });

  it('ungated by design: NO Wand chip carries an N/Day counter; no monsterSpellUses spend on repeated casts (§70 charge advisory)', async () => {
    renderOrcus();
    Array.from(wandRowEl().querySelectorAll('.mc-dice-link-spell')).forEach(el => expect(el.textContent).not.toMatch(/\/Day/));
    await act(async () => { fireEvent.click(wandChipByText('Blight')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.click(wandChipByText('Blight')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusalEntries('Blight').length).toBe(0);
  });

  it('Blight chip press adjudicates DC 18 CON half 8d8 Necrotic via the MA-1879 cast lane (§204)', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(wandChipByText('Blight')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Blight');
    expect(context.actionName).toBe('Blight');
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('CON');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d8');
    expect(context.autoDamageDamageType).toBe('Necrotic');
    expect(context.isSpellDamage).toBe(true);
  });

  it('Circle of Death chip press adjudicates DC 18 CON half 8d6 Necrotic (spell keeps its OWN half — row dc_success:none never leaks onto save-route casts)', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(wandChipByText('Circle of Death')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Circle of Death');
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('CON');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('8d6');
    expect(context.isSpellDamage).toBe(true);
  });

  it('Animate Dead / Speak with Dead / Power Word Kill cast as honest advisory records carrying row DC 18 — no save prompt, no spend (§680 lane)', async () => {
    renderOrcus();
    for (const n of ADVISORY_CHIPS) {
      await act(async () => { fireEvent.click(wandChipByText(n)); });
    }
    await waitFor(() => expect(abilityUseEntries('Animate Dead').length).toBe(1));
    expect(abilityUseEntries('Animate Dead')[0].description).toMatch(/Orcus 1 casts Animate Dead via Spellcasting \(spell save DC 18, Wisdom\)/);
    expect(abilityUseEntries('Animate Dead')[0].description).toMatch(/GM-enforced for monsters/);
    expect(abilityUseEntries('Speak with Dead')[0].description).toMatch(/spell save DC 18/);
    expect(abilityUseEntries('Power Word Kill')[0].description).toMatch(/spell save DC 18/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(refusalEntries('Animate Dead').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('shell press STILL adjudicates the generic DC 18 Wisdom save byte-identically — dc_success "none" kills the half-copy leak, no damage arms (MV-20)', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(wandRowEl().querySelector('.mc-dice-link-save-clickable')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName == null).toBe(true);
    expect(context.actionName).toBe('Wand Spellcasting');
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.isSpellDamage).toBe(false);
    expect(context.autoDamageFormula == null).toBe(true);
  });

  it('sibling rows byte-inert: Multiattack stays chipless, Wand of Orcus keeps ONE attack chip, Spellcasting row keeps its XOR (three chips, no save shell)', () => {
    renderOrcus();
    expect(rowByLeadingName('Multiattack').querySelectorAll('.mc-dice-link').length).toBe(0);
    const wandAttack = rowByLeadingName('Wand of Orcus');
    expect(wandAttack.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    expect(wandAttack.querySelectorAll('.mc-dice-link').length).toBe(1);
    expect(wandAttack.querySelector('.mc-dice-link').textContent).toContain('+19');
    const sc = rowByLeadingName('Spellcasting');
    expect(Array.from(sc.querySelectorAll('.mc-dice-link-spell')).map(el => el.textContent.split('(')[0].trim())).toEqual(['Detect Magic', 'Dispel Magic', 'Time Stop']);
    expect(sc.querySelectorAll('.mc-dice-link-save-clickable').length).toBe(0);
  });
});
