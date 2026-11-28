// @maintained-by-ai 2026-11-28 — trimmed 5→2 (10-18 pass 5→5): one disk-row data lock
// (extraction + gates + save_dc pair + strip-tags markup-only proof folded into one
// pure-function test) + one e2e (chip fingerprint → Hold Person DC-12 WIS save seam +
// 1/Day spend). Vacuous drops: Command spell-byte census (non-arming of a DC-bearing
// damageless spell WITHOUT an "or be X" tail is behaviorally owned by
// MonsterCardHelpers.damageless-spell-save-leg.test.js:38/:66 truth table, and "row
// carries save_dc yet clause-less spell stays advisory" by spellcasting-bandit-deceiver
// .test.jsx:156 — row save_dc 14, Disguise Self advisory); DC-arith restatement
// (8+WIS+PB=12) + /spell save DC 12/ regex (strip-tags test full-text pins the prose) +
// spell_save_dc/spellcasting_ability echoes (unread by the seam — e2e proves save_dc/
// save_type reach buildAbilitySaveRollContext; ma0459:163 is the twin echo) — #652/
// ma0576/ma0619/bullywug(#2090) precedent. Cite-skip owners: chip render + per-day
// counters spellcasting.test.jsx:184/:275 (MA-0003/MA-0012) + ability-save-uses.test
// .jsx:127 (pins chip bytes '(2/Day · 2 left)') + ma0543:213 (2/Day Each + 1/Day
// counters, twin of this row's tiers); gated spend/refusal wording spellcasting.test
// .jsx:282/:318/:508 (MA-0276) + usage.test.js:16-38 (#571); advisory cast-log with row
// DC ma0524:222 (Sleep); Hold Person spell shape MA-0348 owner
// damageless-spell-save-leg.test.js (BY-name disk fixture) + bandit-deceiver:167/:182
// (DC-14 modal twin); cultist Hellish Rebuke gate arm MonsterCardHelpers.hellish-
// rebuke.test.js (#2078). loadSpells mock now returns the FULL disk tables (ma0619/
// bullywug pattern, lazy const refs) — the old 5e:[Command,HoldPerson]/2024:[] subset
// forced findMonsterSpell's (MonsterCardModal.jsx:1852) fallback branch for At-Will
// names that DO resolve 5e-first. Dead mocks purged by empirical bisect (bullywug
// #2090 twin, same lanes): damageUtils, rangeValidation, mapsService, abilityLookup —
// Bandit has no characters entry so getSaveModifierForSaveType never reaches
// abilityLookup.
// MA-0532 data lock: Cultist Fanatic Spellcasting rode the MA-0421/MA-0500 markup-gap
// template (save fields already authored). Pre-fix ONLY the tier headers carried
// <strong>; Light/Thaumaturgy/Command/Hold Person were plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// returned {} → SpellCastLinks null → zero chips, and the row-level numeric save_dc 12
// + save_type Wisdom were orphaned by the Spellcasting-row fork. DATA fix: <em> on each
// spell name, Couatl MA-0524 byte-shape; headers byte-kept. Cultist fanatic disk spells
// are Light/Thaumaturgy/Command/Hold Person (no Sacred Flame/Guidance). ORIGIN
// save_dc-seam leg kept honest here: ma0459-cambion:163 cites MA-0532 for the row-level
// pair reaching buildAbilitySaveRollContext.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const cf = monsters.find(m => m.index === 'cultist-fanatic');
const cfRow = cf.actions.find(a => a.name === 'Spellcasting');

const REAL_SPELLS = ['Light', 'Thaumaturgy', 'Command', 'Hold Person'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff proof:
// strip every tag from the FIXED row and it equals this byte-for-byte.
const CF_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks):\nAt Will: Light, Thaumaturgy\n2/Day: Command\n1/Day: Hold Person';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cultist Fanatic 1';

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
  const _rollAttack = vi.fn();
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollAttack, _rollSavingThrow };
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const rollAttack = useLoggedDiceRoll._rollAttack;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderCultist() {
  const m = makeMonster({ name: 'Cultist Fanatic', actions: [cfRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 44, maxHp: 44, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cultist-fanatic Spellcasting row (fork fix + markup-only proof) ──

describe('MA-0532 monsters.json data lock: Cultist Fanatic Spellcasting row', () => {
  it('em-marked fix: strip-tags equals pre-fix bytes, the four BY-name spells extract as gates-bound chips (tier headers skipped), and the row-level save_dc 12 + save_type Wisdom pair the seam reads is present', () => {
    expect(stripTags(cfRow.description)).toBe(CF_PLAIN_ORIGINAL);
    expect(extractSpellNamesFromSpellcasting(cfRow.description)).toEqual(REAL_SPELLS);
    expect(extractSpellcastingSpellUses(cfRow.description)).toEqual({ Command: 2, 'Hold Person': 1 });
    expect(cfRow.save_dc).toBe(12);
    expect(cfRow.save_type).toBe('Wisdom');
  });
});

// ── Modal: chips live + save_dc seam e2e (the MA-0532 fork fix) ─────────────

describe('MA-0532 MonsterCardModal Cultist Fanatic Spellcasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('four spell chips render from the marked row and a Hold Person click routes the DC-12 WIS save seam (save_dc no longer orphaned by the Spellcasting-row fork) and spends its 1/Day', async () => {
    renderCultist();
    for (const name of REAL_SPELLS) {
      expect(linkByText(name), `chip for ${name}`).toBeTruthy();
    }

    await act(async () => { fireEvent.click(linkByText('Hold Person')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Hold Person');
    expect(context.saveDc).toBe(12);
    expect(context.saveType).toBe('WIS');
    expect(context.targetName).toBe('Bandit');
    expect(context.autoDamageFormula ?? null).toBeNull();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });
  });
});
