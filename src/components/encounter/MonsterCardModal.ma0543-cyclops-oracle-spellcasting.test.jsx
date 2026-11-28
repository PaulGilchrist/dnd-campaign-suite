// @maintained-by-ai 2026-11-28 — trimmed 5→2 (ma0532/ma0536 twin pattern): one
// disk-row data lock (extraction + gate binding + save_dc pair + strip-tags
// markup-only proof folded into one pure-function test) + one e2e that RESTORES
// the dual-tier gate render cited by ma0459/ma0532/ma0536 as owned here (the
// prior pass cut it, leaving three cite-skips dangling): four chips render with
// per-tier counters (trio (2/Day · 2 left), Legend Lore (1/Day · 1 left)), then
// a Detect Magic cast logs the advisory row DC 16 Wisdom and spends 1 of 2.
// Vacuous drops: "headers skipped" not.toContain pair (implied by
// toEqual(REAL_SPELLS), ma0536 drop); /spell save DC 16/ regex (strip-tags
// full-text pins the prose); spell_save_dc/spellcasting_ability echoes — the
// utility-row fork (isUtilitySpellCastRow) excludes name==='Spellcasting' rows
// at the guard head, so these fields are unread by this seam (#652/ma0576/
// ma0619/ma0532/ma0536 precedent). Cite-skip owners: single-tier chip render +
// per-day counters spellcasting.test.jsx:185/:276; 2/Day counter bytes + save
// arm ability-save-uses.test.jsx:127; gated spend/refusal wording
// spellcasting.test.jsx:282/:508 + usage.test.js:16-38; advisory-class DC print
// ma0524:222 / ma0558:219; attack-seam negatives spell-attack.test.jsx.
// loadSpells mock now returns the FULL disk tables (ma0619/bullywug/ma0532
// pattern, lazy const refs) — the old 5e 4-spell/2024-empty subset forced
// findMonsterSpell's (MonsterCardModal.jsx:1852) stale 2024-fallback branch for
// names that resolve 5e-first. Dead mocks purged by empirical bisect (four
// twins agree): damageUtils, rangeValidation, mapsService, abilityLookup —
// Bandit has no characters entry so getSaveModifierForSaveType never reaches
// abilityLookup, and the advisory cast rolls no dice.
// MA-0543 data lock: Cyclops Oracle Spellcasting rode the MA-0421/MA-0532
// markup-gap template (save_dc 16 + save_type Wisdom already authored). Pre-fix
// ONLY the tier headers carried <strong>; Arcane Eye/Detect Magic/Locate
// Object/Legend Lore were plain text — extractSpellNamesFromSpellcasting
// returned [] and extractSpellcastingSpellUses returned {} → SpellCastLinks
// null → zero chips; the row-level save_dc/save_type were orphaned by the
// Spellcasting-row fork (MA-0524). DATA fix: <em> on each spell name, Cultist
// Fanatic MA-0532 byte-shape; headers byte-kept. Disk spells unchanged since
// writing: Arcane Eye/Detect Magic/Locate Object 2/Day Each + Legend Lore 1/Day.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const co = monsters.find(m => m.index === 'cyclops-oracle');
const coRow = co.actions.find(a => a.name === 'Spellcasting');

const REAL_SPELLS = ['Arcane Eye', 'Detect Magic', 'Locate Object', 'Legend Lore'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff proof:
// strip every tag from the FIXED row and it equals this byte-for-byte.
const CO_PLAIN_ORIGINAL = 'The cyclops casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 16):\n2/Day Each: Arcane Eye, Detect Magic, Locate Object\n1/Day: Legend Lore';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cyclops Oracle 1';

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
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook };
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

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderCyclops() {
  const m = makeMonster({ name: 'Cyclops Oracle', actions: [coRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'giant', targetName: 'Bandit', ac: 14, currentHp: 138, maxHp: 138, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cyclops-oracle Spellcasting row ───────────────────────────────

describe('MA-0543 monsters.json data lock: Cyclops Oracle Spellcasting row', () => {
  it('em-marked fix: strip-tags equals pre-fix bytes, the four BY-name spells extract as gate-bound chips (2/Day Each trio + Legend Lore 1, tier headers skipped), and the row-level save_dc 16 + save_type Wisdom pair the seam reads is present', () => {
    expect(stripTags(coRow.description)).toBe(CO_PLAIN_ORIGINAL);
    expect(extractSpellNamesFromSpellcasting(coRow.description)).toEqual(REAL_SPELLS);
    expect(extractSpellcastingSpellUses(coRow.description)).toEqual({ 'Arcane Eye': 2, 'Detect Magic': 2, 'Locate Object': 2, 'Legend Lore': 1 });
    expect(coRow.save_dc).toBe(16);
    expect(coRow.save_type).toBe('Wisdom');
  });
});

// ── Modal: dual-tier gate render (cited owner) + advisory cast seam ──────────

describe('MA-0543 MonsterCardModal Cyclops Oracle Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('dual-tier row renders four chips with per-tier counters (trio (2/Day · 2 left), Legend Lore (1/Day · 1 left)) and casting Detect Magic logs the advisory row DC 16 Wisdom, spending 1 of 2', async () => {
    renderCyclops();

    const names = Array.from(document.querySelectorAll('.mc-dice-link-spell')).map(el => el.textContent.split('(')[0].trim());
    expect(names).toEqual(REAL_SPELLS);
    for (const name of ['Arcane Eye', 'Detect Magic', 'Locate Object']) {
      expect(linkByText(name), `2/Day counter on ${name}`).toBeTruthy();
      expect(linkByText(name).textContent).toMatch(/\(2\/Day · 2 left\)/);
    }
    expect(linkByText('Legend Lore').textContent).toMatch(/\(1\/Day · 1 left\)/);

    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });

    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    const entry = abilityUseEntries('Detect Magic')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Detect Magic via Spellcasting \(spell save DC 16, Wisdom\)/);
    expect(entry.description).toMatch(/2\/Day use spent — 1 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Detect Magic': 1 });
  });
});
