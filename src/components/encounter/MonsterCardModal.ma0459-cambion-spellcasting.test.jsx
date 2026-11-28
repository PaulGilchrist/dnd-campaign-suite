// @maintained-by-ai 2026-11-28 — MA-0459 lane, trimmed 5→2 (ma0532/#2091 twin):
// one pure-function data lock (strip-tags markup-only proof + BY-name extraction +
// tier gates + row-level save_dc/save_type pair folded into one test) + one e2e
// (five chips render — the zero-affordance regression — and a Dominate Person click
// routes the DC-14 WIS save seam through buildAbilitySaveRollContext + logs one
// ability_use cast). Vacuous drops: DC-arith restatement (8+CHA+PB=14 — same class
// cut at ma0532/#2090; strip-tags full-text pin already locks the "spell save DC 14"
// prose and the e2e proves save_dc 14 reaches the seam), per-qualifier <em> toContain
// bytes (subsumed by byte-for-byte strip-tags equality), counter bytes on chips
// (render format pinned by ability-save-uses.test.jsx:127 '(2/Day · 2 left)' and
// 2/Day Each + 1/Day tier gates by ma0543-cyclops-oracle:213; gate BINDING for this
// row is data-locked here), save-clickable absence negative (spell-attack seam owned
// by MonsterCardModal.spell-attack.test.jsx), generic spend/refuse/advisory lanes
// cited-skipped to owners (spellcasting.test.jsx #588 :195/:281-315/:518-533; usage
// .test.js #571). loadSpells mock now returns the FULL disk tables (ma0619/bullywug
// #2090/ma0532 pattern, lazy const refs) — the old 5e-subset/2024:[] mock is the
// shape that forces findMonsterSpell's fallback branch. Dead mocks purged by
// empirical bisect (ma0532 twin, same lanes): damageUtils, rangeValidation,
// mapsService, abilityLookup. Key-order indexOf dropped (non-behavioral). Disk note:
// cambion carries NO Fiendish Luck and fly is speed.fly 60 ft. (movement lane) — no
// coverage owed here. MA-0459 data lock origin: row carried plain-text spell names
// (zero affordances, MA-0421 family) and spell_save_dc only — the save seam never
// reached buildAbilitySaveRollContext (MA-0532: row-level numeric save_dc/save_type
// required). DATA fix mirrors the MA-0421 bone-naga / MA-0454 bullywug-bog-sage
// byte-shape: five spell names in <em> with qualifiers OUTSIDE the tags (MA-0276),
// trailing save_dc: 14 + save_type: "Charisma" pair, tier headers byte-unchanged.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const CAMBION_SPELLS = ['Alter Self', 'Command', 'Detect Magic', 'Dominate Person', 'Plane Shift'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — the markup-only diff
// proof: strip every tag from the FIXED row and it must equal the original
// byte-for-byte (this also locks the "(spell save DC 14)" prose and the
// "(level 3 version)" / "(level 8 version)" / "(self only)" qualifier bytes).
const CAMBION_PLAIN_ORIGINAL = 'The cambion casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14):\n2/Day Each: Alter Self, Command (level 3 version), Detect Magic\n1/Day Each: Dominate Person (level 8 version), Plane Shift (self only)';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const cambion = monsters.find(m => m.index === 'cambion');
const cambionRow = cambion.actions.find(a => a.name === 'Spellcasting');

const MONSTER_NAME = 'Cambion 1';

// ── Mocks (mirror MonsterCardModal.ma0532-cultist-fanatic-spellcasting.test.jsx) ─

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

function renderCambion() {
  const m = makeMonster({ name: cambion.name, actions: [cambionRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'TestPC', currentHp: cambion.hit_points, maxHp: cambion.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cambion Spellcasting row (MA-0421-family fix + save_dc pair) ──

describe('MA-0459 monsters.json data lock: Cambion Spellcasting row', () => {
  it('em-marked fix: strip-tags equals pre-fix bytes, the five BY-name spells extract as chips with the 2/Day x3 + 1/Day x2 gates bound, and the row-level save_dc 14 + save_type Charisma pair the seam reads is present', () => {
    expect(stripTags(cambionRow.description)).toBe(CAMBION_PLAIN_ORIGINAL);
    expect(extractSpellNamesFromSpellcasting(cambionRow.description)).toEqual(CAMBION_SPELLS);
    expect(extractSpellcastingSpellUses(cambionRow.description)).toEqual({
      'Alter Self': 2, 'Command': 2, 'Detect Magic': 2,
      'Dominate Person': 1, 'Plane Shift': 1,
    });
    expect(cambionRow.save_dc).toBe(14);
    expect(cambionRow.save_type).toBe('Charisma');
  });
});

// ── Modal: chips live + save_dc seam e2e ────────────────────────────────────

describe('MA-0459 MonsterCardModal Cambion Spellcasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('five spell chips render from the marked row (was zero affordances) and a Dominate Person click routes the save leg through the newly-authored save_dc seam: DC 14 WIS, one ability_use cast record', async () => {
    renderCambion();
    for (const name of CAMBION_SPELLS) {
      expect(linkByText(name), `chip for ${name}`).toBeTruthy();
    }

    await act(async () => { fireEvent.click(linkByText('Dominate Person')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Dominate Person');
    expect(context.saveDc).toBe(14);
    expect(context.saveType).toBe('WIS');
    expect(context.targetName).toBe('TestPC');
    await waitFor(() => expect(abilityUseEntries('Dominate Person').length).toBe(1));
  });
});
