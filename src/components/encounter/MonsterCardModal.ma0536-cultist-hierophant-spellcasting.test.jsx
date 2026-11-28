// @maintained-by-ai 2026-11-28 — trimmed 5→2 (ma0532/#2091 twin pattern): one
// disk-row data lock (extraction + gates + save_dc pair + strip-tags markup-only
// proof + Jallarsi homebrew row shape, all pure-function) + one e2e (four chips
// render → Jallarsi advisory cast at row DC 17 CHA + 1/Day spend, never a save
// leg). Vacuous drops: DC-arith restatement (8+CHA+PB=17) + /spell save DC 17/
// regex (strip-tags full-text pins the prose) + spell_save_dc/spellcasting_ability
// echoes (unread by the seam — e2e proves save_dc/save_type reach the cast path;
// #652/ma0576/ma0619/ma0532(#2091) precedent); "not.toContain('At Will')" headers
// lines (implied by toEqual(REAL_SPELLS)); spellHasDamage/spellDamagelessSaveCondition
// on Jallarsi — arming of a DC-bearing damageless spell WITHOUT an "or be X" tail
// is behaviorally owned by the MA-0348 truth table
// MonsterCardHelpers.damageless-spell-save-leg.test.js (bandit-deceiver:156 twin
// drop). Cite-skip owners: chip render + per-day counters spellcasting.test.jsx
// :185/:276; gated spend/refusal wording spellcasting.test.jsx:282/:318/:508 +
// archpriest:198 (1/Day Each twin); usage-text format MonsterCardHelpers.usage
// .test.js:16-38 (MA-0049); counter bytes ability-save-uses.test.jsx:127; tier
// renders ma0543:213; attack-seam negatives spell-attack.test.jsx. loadSpells
// mock now returns the FULL disk tables (ma0619/bullywug/ma0532 pattern) — the
// old 5e-subset mock forced findMonsterSpell's (MonsterCardModal.jsx:1852) dead
// 2024-fallback branch for At-Will names that resolve 5e-first. Dead mocks
// purged by empirical bisect (cultist+cambion twins, ma0532 #2091): damageUtils,
// rangeValidation, mapsService, abilityLookup — Bandit has no characters entry so
// getSaveModifierForSaveType never reaches abilityLookup; the advisory cast rolls
// no dice (diceRoller stayed purged per #649).
// MA-0536 data lock: Cultist Hierophant Spellcasting — near-exact twin of the
// MA-0532 lane on the MA-0421 markup-gap template (save fields already
// authored). Pre-fix ONLY tier headers carried <strong>; Mage Armor/
// Thaumaturgy/Jallarsi's Storm of Radiance/Mass Suggestion were plain text →
// zero chips, zero counters, orphaned row numeric save_dc 17 + save_type
// Charisma. DATA fix: <em> on each spell name, headers byte-kept.
// TICKET-DISTINCT: "Jallarsi's Storm of Radiance" is grep-zero RAW app-wide →
// registered honest homebrew entry in spells.json (level 7, 1 action, Self,
// CHA save DC-by-caster, no invented damage/duration) so findMonsterSpell
// resolves the chip and the cast logs advisory-clean (no damage, no
// "or be X" clause → CLA-325 advisory, console error-free — never a save
// leg; hierophant has no save-leg spell, unlike the twin's Hold Person at
// MA-0532).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const ch = monsters.find(m => m.index === 'cultist-hierophant');
const chRow = ch.actions.find(a => a.name === 'Spellcasting');
const JALLARSI = spells5e.find(s => s.name === "Jallarsi's Storm of Radiance");

const REAL_SPELLS = ['Mage Armor', 'Thaumaturgy', "Jallarsi's Storm of Radiance", 'Mass Suggestion'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff proof.
const CH_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Mage Armor (included in AC), Thaumaturgy\n1/Day Each: Jallarsi\'s Storm of Radiance (level 7 version), Mass Suggestion';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cultist Hierophant 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// dataLoader LIVE: render suspends until loadSpells resolves — full disk tables so
// findMonsterSpell resolves 5e-first exactly as in production.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? spells2024 : spells5e)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollSavingThrow };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderHierophant() {
  const m = makeMonster({ name: 'Cultist Hierophant', actions: [chRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 16, currentHp: 144, maxHp: 144, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cultist-hierophant row + Jallarsi homebrew registration ────────

describe('MA-0536 disk data lock: Cultist Hierophant Spellcasting row + Jallarsi homebrew', () => {
  it('markup-only proof + four BY-name em-marked spells extract with the 1/Day Each gate bound to exactly the two marked names, the row-level save_dc 17 + save_type Charisma pair the seam reads is present, and Jallarsi is registered honest homebrew (level 7, 1 action, Self, CHA DC-by-caster, nothing invented)', () => {
    expect(stripTags(chRow.description)).toBe(CH_PLAIN_ORIGINAL);
    expect(extractSpellNamesFromSpellcasting(chRow.description)).toEqual(REAL_SPELLS);
    expect(extractSpellcastingSpellUses(chRow.description)).toEqual({ "Jallarsi's Storm of Radiance": 1, 'Mass Suggestion': 1 });
    expect(chRow.save_dc).toBe(17);
    expect(chRow.save_type).toBe('Charisma');

    expect(JALLARSI.index).toBe('jallarsis-storm-of-radiance');
    expect(JALLARSI.level).toBe(7);
    expect(JALLARSI.casting_time).toBe('1 action');
    expect(JALLARSI.range).toBe('Self');
    expect(JALLARSI.dc).toEqual({ dc_type: 'CHA', dc_success: 'none' });
    expect(JALLARSI.damage ?? null).toBeNull();
    expect(JALLARSI.duration ?? null).toBeNull();
    expect(JALLARSI.area_of_effect ?? null).toBeNull();
    expect(JALLARSI.attack_type ?? null).toBeNull();
  });
});

// ── Modal e2e: chips live + advisory cast at row DC (the MA-0536 fix) ────────

describe('MA-0536 MonsterCardModal Cultist Hierophant Spellcasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it("four spell chips render from the marked row and a Jallarsi click casts console-error-free with an honest advisory log at row DC 17 CHA (save_dc no longer orphaned by the Spellcasting-row fork), spends its 1/Day, never a save leg", async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHierophant();
    for (const name of REAL_SPELLS) {
      expect(linkByText(name), `chip for ${name}`).toBeTruthy();
    }

    await act(async () => { fireEvent.click(linkByText("Jallarsi's Storm of Radiance")); });

    await waitFor(() => expect(abilityUseEntries("Jallarsi's Storm of Radiance").length).toBe(1));
    const entry = abilityUseEntries("Jallarsi's Storm of Radiance")[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Jallarsi's Storm of Radiance via Spellcasting \(spell save DC 17, CHA\)/);
    expect(entry.description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ "Jallarsi's Storm of Radiance": 1 });
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
