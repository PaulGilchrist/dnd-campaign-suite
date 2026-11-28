// @maintained-by-ai 2026-11-28 — trimmed 4→2 (ma0543 twin pattern): one
// consolidated disk-row data lock (typo grep-zero + BY-name extraction +
// exact-match spell-DB resolution + 1/Day gate map folded into one
// pure-function test) + one merged advisory-cast e2e (single render, PWT +
// Greater Restoration, zero console errors — the pre-fix phantom-spell
// symptom). Vacuous drops: none — the three prior data-lock legs share zero
// execution paths with siblings (ma1202 locks the mummy-lord row, not this
// one). Cite-skipped owners: extraction/counter/refusal/spend template
// spellcasting.test.jsx:185/:276/:282/:318/:508, usage text #571
// usage.test.js:16-38, ability-save-uses :127, advisory class + dual-tier
// render ma0524-couatl:222 / ma0543:146, attack-seam negatives
// spell-attack.test.jsx. Empyrean legendary lane (Bolster/Shockwave/Smite)
// owned by legendary-uses-empyrean.test.jsx (#630) — zero legs here.
// Save-shell is dead on this advisory lane (#659): no rollSavingThrow/
// rollAttack legs; dataLoader stays LIVE (findMonsterSpell loads it, full
// disk tables so it resolves 5e-first). Dead mocks purged by empirical
// bisect (five twins agree): damageUtils, rangeValidation — the advisory
// cast rolls no dice.
// MA-0693 data lock: Empyrean Spellcasting authored the phantom spell name
// "Pass with Trace" — findMonsterSpell exact-match missed both spell DBs
// (canonical "Pass Without Trace"), so the chip cast logged a junk zero-
// adjudication ability_use and console.error'd "Spell not found".
// DATA fix (one string): <strong>Pass with Trace</strong> →
// <strong>Pass Without Trace</strong> in empyrean actions[3].description.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const rawMonsters = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(rawMonsters);
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const empyrean = monsters.find(m => m.index === 'empyrean');
const row = empyrean.actions.find(a => a.name === 'Spellcasting');
const SPELL = 'Pass Without Trace';
const OTHER_AT_WILL = 'Greater Restoration';

const MONSTER_NAME = 'Empyrean 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// dataLoader LIVE: full disk tables so findMonsterSpell resolves 5e-first as in prod.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? spells2024 : spells5e)),
}));

// Advisory lane never rolls — inert stub, full destructure shape only.
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

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderEmpyrean() {
  const m = makeMonster({ name: 'Empyrean', index: 'empyrean', actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 22, currentHp: 213, maxHp: 213, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

// ── Data lock: Empyrean Spellcasting row ────────────────────────────────────

describe('MA-0693 monsters.json data lock: Empyrean Spellcasting row', () => {
  it('canonical "Pass Without Trace" authored (phantom typo grep-zero across monsters.json), all seven spells extract BY-name and resolve exact-match against the spell DBs, and uses bind only to the 1/Day trio', () => {
    expect(row.description).toContain('<strong>Pass Without Trace</strong>');
    expect(rawMonsters).not.toContain('Pass with Trace');

    const names = extractSpellNamesFromSpellcasting(row.description);
    expect(names).toEqual(['Calm Emotions', 'Greater Restoration', SPELL, 'Water Breathing', 'Commune', 'Dispel Evil and Good', 'Plane Shift']);
    const findMonsterSpell = (name) => spells5e.find(s => s.name === name) || spells2024.find(s => s.name === name) || null;
    for (const name of names) {
      expect(findMonsterSpell(name), `spell "${name}" must resolve`).toBeTruthy();
    }

    expect(extractSpellcastingSpellUses(row.description)).toEqual({ 'Commune': 1, 'Dispel Evil and Good': 1, 'Plane Shift': 1 });
  });
});

// ── Modal: merged advisory-cast e2e (one render, multi-spell) ───────────────

describe('MA-0693 MonsterCardModal Empyrean Spellcasting advisory cast', () => {
  let consoleError;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('At Will chips render ungated and cast clean advisory records — concentration byte on PWT, zero console errors', async () => {
    const links = renderEmpyrean();
    const byText = (text) => links.find(el => el.textContent.includes(text));
    const pwt = byText(SPELL);
    expect(pwt).toBeTruthy();
    expect(pwt.textContent).not.toMatch(/\/Day/);
    expect(pwt.className).not.toMatch(/spent/);

    await act(async () => { fireEvent.click(pwt); });
    await waitFor(() => expect(abilityUseEntries(SPELL).length).toBe(1));

    await act(async () => { fireEvent.click(byText(OTHER_AT_WILL)); });
    await waitFor(() => expect(abilityUseEntries(OTHER_AT_WILL).length).toBe(1));

    const cast = abilityUseEntries(SPELL)[0];
    expect(cast.characterName).toBe(MONSTER_NAME);
    expect(cast.description).toMatch(/casts Pass Without Trace via Spellcasting/);
    expect(cast.description).toMatch(/Concentration \(Up to 1 hour\)/);
    expect(cast.description).toMatch(/Spell effect is recorded; GM-enforced/);
    expect(abilityUseEntries(OTHER_AT_WILL)[0].description).toMatch(/casts Greater Restoration via Spellcasting/);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
