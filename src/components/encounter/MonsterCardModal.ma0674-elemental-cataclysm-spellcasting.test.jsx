// @maintained-by-ai — trimmed 9→4, spellcasting lane only (cataclysm
// legendary/delegate legs owned by MonsterCardModal.legendary-uses-elemental-
// cataclysm.test.jsx #629; generic uses-counter/refusal/At-Will-recast and
// formatActionUsage owned by spellcasting.test.jsx :275/:281/:317 and
// usage.test.js #571 — cite-skipped). Kept distinct: exact restructured-row
// bytes + no-DC seam, BY-name extraction with zero-uses gate map, save-less
// spells.json grounding for the advisory route, ONE merged cast e2e
// (chip → cast ×2 → advisory log, zero save/rolls). Dead-mock purge bisected
// on this lane: diceRoller, sanitize, conditionEffects, damageUtils,
// rangeValidation, mapsService, abilityLookup all green without their mocks
// (no rolls/DC/target legs on a save-less At-Will cast) — purged. LIVE:
// dataLoader (spell lookup payload), logService + useLoggedDiceRoll
// (assertion subjects); useRuntimeState kept — dropping it makes the
// zero-uses-spent assertion vacuous and lets real /api POSTs run.
// MA-0674 data lock: Elemental Cataclysm "Control Weather" was an inert
// other-type row — the SpellCastLinks branch is row-NAME gated
// (MonsterAction.jsx /^spellcasting$/i), so the spell name rendered plain
// bold with zero affordance and spellcasting_ability had no consumer.
// DATA fix (Option A): restructure actions[3] to the canonical Spellcasting
// byte-shape (MA-0611/MA-0619 twins, no-DC Ghast Gravecaller/Giant Owl
// shape): name "Spellcasting" + canonical prefix sentence +
// <strong>At Will:</strong> <em>Control Weather</em> tier markup,
// spellcasting_ability "Constitution" kept (twin convention). NO row
// save_dc/save_type — Control Weather is a save-less zero-target spell; the
// chip rides the advisory utility route (§70 weather stays GM-enforced).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const cataclysm = monsters.find(m => m.index === 'elemental-cataclysm');
const row = cataclysm.actions.find(a => a.name === 'Spellcasting');
const CONTROL_WEATHER = 'Control Weather';
const cw5e = spells5e.find(s => s.name === CONTROL_WEATHER);

const MONSTER_NAME = 'Elemental Cataclysm 1';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([cw5e])),
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
import { _rollSavingThrow, _rollAttack } from '../../hooks/combat/useLoggedDiceRoll.js';

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

async function castControlWeather() {
  const chip = spellLinks().find(el => el.textContent.includes(CONTROL_WEATHER));
  await act(async () => { fireEvent.click(chip); });
}

// ── Data lock: Elemental Cataclysm Spellcasting row ─────────────────────────

describe('MA-0674 monsters.json data lock: Elemental Cataclysm Spellcasting row', () => {
  it('row restructured to canonical Spellcasting byte-shape — exact description, ability kept, no invented DC fields', () => {
    expect(cataclysm.actions.some(a => a.name === CONTROL_WEATHER)).toBe(false);
    expect(cataclysm.actions[3].name).toBe('Spellcasting');
    expect(row.description).toMatch(/^The cataclysm casts one of the following spells, requiring no spell components and using Constitution as the spellcasting ability:\n<strong>At Will:<\/strong> <em>Control Weather<\/em>$/);
    expect(row.spellcasting_ability).toBe('Constitution');
    expect(row.save_dc).toBeUndefined();
    expect(row.save_type).toBeUndefined();
    expect(row.spell_save_dc).toBeUndefined();
  });

  it('extracts "Control Weather" BY-name with zero uses bound — tier header skipped, cast ungated', () => {
    const names = extractSpellNamesFromSpellcasting(row.description);
    expect(names).toEqual([CONTROL_WEATHER]);
    expect(names).not.toContain('At Will');
    expect(extractSpellcastingSpellUses(row.description)).toEqual({});
  });

  it('Control Weather is save-less and damage-less in spells.json — grounding for the no-DC advisory route', () => {
    expect(cw5e.level).toBe(8);
    expect(cw5e.concentration).toBe(true);
    expect(cw5e.duration).toBe('Up to 8 hours');
    expect(cw5e.damage).toBeUndefined();
    expect(cw5e.dc).toBeUndefined();
    expect(cw5e.attack_type).toBeUndefined();
  });
});

// ── Modal: chip renders and casts via the advisory utility route ──────────

describe('MA-0674 MonsterCardModal Elemental Cataclysm Spellcasting chip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders one counter-less chip; At Will casts twice ungated logging concentration + GM-enforced advisory with zero uses, refusals, save/attack rolls', async () => {
    const m = makeMonster({ name: 'Elemental Cataclysm', index: 'elemental-cataclysm', actions: [row] });
    const creatures = [
      { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 24, currentHp: 800, maxHp: 800, conditions: [] },
      { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
    ];
    render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);

    const chips = spellLinks();
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent.trim()).toBe(CONTROL_WEATHER);
    expect(chips[0].textContent).not.toMatch(/\/Day/);
    expect(chips[0].className).not.toMatch(/spent/);

    await castControlWeather();
    await waitFor(() => expect(abilityUseEntries(CONTROL_WEATHER).length).toBe(1));
    await castControlWeather();
    await waitFor(() => expect(abilityUseEntries(CONTROL_WEATHER).length).toBe(2));

    const entry = abilityUseEntries(CONTROL_WEATHER)[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Control Weather via Spellcasting/);
    expect(entry.description).toMatch(/Concentration \(Up to 8 hours\)/);
    expect(entry.description).toMatch(/Spell effect is recorded; GM-enforced/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals(CONTROL_WEATHER)).toHaveLength(0);
    expect(_rollSavingThrow).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
  });
});
