// @maintained-by-ai 2026-11-28 — trimmed 8→4 (10-18 pass 9→8): kept the bog-specific
// disk locks (row seam bytes + strip-tags markup-only proof) and folded the five-chip
// extraction lock and the 1/Day counter-render lock into ONE render fingerprint + the
// MA-0454 DC-13 save-leg e2e. Vacuous drops: extractSpellNamesFromSpellcasting unit
// equality subsumed by the chip render it drives; wis/pb DC arithmetic restatement and
// monsterSpellAttackBonus echo (#652/ma0576/ma0619 precedent — strip-tags test full-text
// pins the "spell save DC 13, +5" prose); Ray of Sickness + Vitriolic Sphere spell-byte
// census (attack seam owned by MonsterCardModal.spell-attack.test.jsx, Ray 2024-fallback
// resolution + 5e-absent pin owned by ma0619:139/:179, and the e2e context here re-pins
// Vitriolic 10d4/Acid/dc_success-none through behavior). loadSpells mock now returns the
// FULL disk tables (ma0619 pattern, lazy binding) — the old 5e:[] subset forced the
// fallback branch for At-Will names that DO resolve 5e-first (findMonsterSpell,
// MonsterCardModal.jsx:1852). Dead mocks purged by empirical bisect (ma0619 twin, same
// lanes): damageUtils, rangeValidation, mapsService, abilityLookup — Bandit has no
// characters entry so getSaveModifierForSaveType never reaches abilityLookup.
// GENERIC legs cite-skipped (behavioral coverage lives in the spellcasting family):
// cast-click logs / advisory records / row-DC-in-log → MonsterCardModal.spellcasting
// .test.jsx:196/:377/:393, :601; save routing with dc_success :227; 1/Day spend +
// second-cast refusal :282 (usage :571); At Will ungated repeat casts :318; per-day
// counter on limited only :276; extractSpellcastingSpellUses parsing :334/:341;
// counter-label render class → ma1591:201; spell-attack seam routing (+bonus,
// isSpellAttackSpell, never-save) → spell-attack.test.jsx:196/:331; no-armed-target
// refusal :255; bone-naga save-pair byte-shape → ma0421:161.
// MA-0452 data lock: Bullywug Bog Sage Multiattack "replace any attack with
// Spellcasting to cast Ray of Sickness" rode the Spellcasting-row chips (MA-0223), but
// the row wrapped ONLY "Vitriolic Sphere" in markup — the other four names were plain
// text, so extraction yielded ONE chip and the replace clause was inert (MA-0421
// fingerprint). DATA-MARKUP fix wraps each name in <em> (Vitriolic keeps <strong>);
// strip-tags byte-equality below is the markup-only-diff proof. MA-0454 EXTENSION: the
// row lacked save_dc/save_type — spell_save_dc never reached
// buildAbilitySaveRollContext (DC Unknown cast burning the 1/Day use) — MA-0237 data
// pair added; DC-enforced save-leg e2e below.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const bog = monsters.find(m => m.index === 'bullywug-bog-sage');
const bogRow = bog.actions.find(a => a.name === 'Spellcasting');

const BOG_SPELLS = ['Dancing Lights', 'Druidcraft', 'Ray of Sickness', 'Speak with Plants', 'Vitriolic Sphere'];
const ONE_DAY = ['Speak with Plants', 'Vitriolic Sphere'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff
// proof: strip every tag from the FIXED row and it equals this byte-for-byte.
const BOG_PLAIN_ORIGINAL = 'The bullywug casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks):\nAt Will: Dancing Lights, Druidcraft, Ray of Sickness\n1/Day Each: Speak with Plants, Vitriolic Sphere';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Bullywug Bog Sage 1';

// ── Mocks (mirror MonsterCardModal.ma0619-dracolich-spellcasting.test.jsx) ─

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// dataLoader LIVE: render suspends until loadSpells resolves — full disk tables so
// findMonsterSpell resolves 5e-first exactly as in production (lazy const refs, the
// arrow body runs only when a cast resolves).
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? spells2024 : spells5e)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();

  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollSavingThrow,
  };
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

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderBog() {
  const m = makeMonster({ name: 'Bullywug Bog Sage', actions: [bogRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: 'Bandit', ac: 16, currentHp: 52, maxHp: 52, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 30, maxHp: 30, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: bullywug-bog-sage Spellcasting row bytes ─────────────────────

describe('MA-0452/MA-0454 monsters.json data lock: Bullywug Bog Sage Spellcasting row', () => {
  it('authors the casting seams: spell_attack_bonus 5, spell_save_dc 13 + MA-0237 save_dc/save_type pair, Wisdom', () => {
    expect(bogRow.spell_attack_bonus).toBe(5);
    expect(bogRow.spell_save_dc).toBe(13);
    expect(bogRow.save_dc).toBe(13);
    expect(bogRow.save_type).toBe('Wisdom');
    expect(bogRow.spellcasting_ability).toBe('Wisdom');
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(bogRow.description)).toBe(BOG_PLAIN_ORIGINAL);
  });
});

// ── Modal: MA-0452 five-chip fingerprint + MA-0454 DC-enforced save leg ─────

describe('MA-0452/MA-0454 MonsterCardModal Bog Sage: five chips, 1/Day gating, DC 13 save seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders all five names as clickable chips (was zero affordances for Ray); the 1/Day counter rides only the 1/Day Each pair', () => {
    renderBog();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...BOG_SPELLS].sort());
    for (const name of ONE_DAY) {
      expect(linkByText(name).textContent).toMatch(/\(1\/Day · 1 left\)/);
    }
    for (const name of BOG_SPELLS.filter(n => !ONE_DAY.includes(n))) {
      expect(linkByText(name).textContent).not.toMatch(/\/Day/);
    }
  });

  it('Vitriolic Sphere click routes an adjudicated DEX save at DC 13 — 10d4 Acid, dc_success none, no more DC Unknown', async () => {
    renderBog();
    await act(async () => { fireEvent.click(linkByText('Vitriolic Sphere')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Vitriolic Sphere');
    expect(context.saveDc).toBe(13);
    expect(context.saveType).toBe('DEX');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('10d4');
    expect(context.autoDamageDamageType).toBe('Acid');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('Bandit');
  });
});
