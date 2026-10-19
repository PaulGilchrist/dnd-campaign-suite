// @maintained-by-ai
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';

// ── Scope ────────────────────────────────────────────────────────────────────
//
// Cited owner (rendering.test.jsx #763 header) for the senses / AC fallback
// faces of the stat block. Lanes pinned here:
//   - Senses row (MonsterCardBody.jsx:367 → hasSenseEntries gate +
//     formatSenses verbatim interpolation, MonsterCardHelpers.js:27/46):
//     raw value bytes pass through untouched — numeric and 'ft.'-string
//     shapes both come from real disk fixtures (monsters.json: Adult Black
//     Dragon blindsight 60 numeric, Androsphinx truesight "120 ft." string);
//     null/undefined members are skipped per-key; the whole row disappears
//     when there is nothing to show.
//   - Shield of Faith AC lane (computeShieldOfFaithBonus,
//     MonsterCardModal.jsx:1464-1465 → MonsterCardBody.jsx:153): the only
//     AC modifier the card renders; unowned elsewhere in this folder
//     (CharSummary/* pins the player sheet; useLoggedDiceRoll pins popups).
//
// Not re-pinned here (owned elsewhere): multi-sense combined row,
// darkvision+passive defaults, senses:{}-hidden — MonsterCardModal.test.jsx
// :201-206/:559-580. Terminal 'Monster' name, speed join, temp HP row,
// languages join, legendary_resistance falsy-zero — rendering.test.jsx.
//
// Zero vi.mock (bisect, same discipline as rendering.test.jsx #763/#739):
// default props (creatures: [], mapName: null, actions: []) short-circuit
// every mount fetch, no interactions fire, and setup.js keeps fetch and
// EventSource inert. Runtime state is driven through the real in-memory
// store via getStore — the exact pattern rendering.test.jsx uses for tempHp
// — replacing the former hand-built runtime/condition/damage mock rig.

const acValue = () =>
  screen.getByText('Armor Class').closest('.mc-stat').querySelector('.mc-stat-value').textContent;
const sensesValue = () => screen.getByText('Senses').nextElementSibling.textContent;

describe('MonsterCardModal senses row', () => {
  beforeEach(() => {
    cleanup();
    getStore('Goblin').clear();
  });

  it.each([
    { senseKey: 'blindsight', value: 60, expectedText: 'blindsight 60' },
    { senseKey: 'truesight', value: 120, expectedText: 'truesight 120' },
    { senseKey: 'tremorsense', value: 60, expectedText: 'tremorsense 60' },
    { senseKey: 'passive_perception', value: 15, expectedText: 'passive Perception 15' },
    { senseKey: 'darkvision', value: 60, expectedText: 'darkvision 60' },
    { senseKey: 'darkvision', value: '60 ft.', expectedText: 'darkvision 60 ft.' },
  ])('renders a lone $senseKey $value verbatim', ({ senseKey, value, expectedText }) => {
    const m = makeMonster({ senses: { [senseKey]: value } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it('skips null/undefined sense members, keeping the rest comma-joined', () => {
    const m = makeMonster({ senses: { blindsight: 60, darkvision: null, truesight: undefined, tremorsense: 30 } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(sensesValue()).toBe('blindsight 60, tremorsense 30');
  });

  it.each([
    { label: 'null', senses: null },
    { label: 'absent', senses: undefined },
    { label: 'all-null members', senses: { blindsight: null, darkvision: null, truesight: null, tremorsense: null, passive_perception: null } },
  ])('renders no Senses row when senses is $label', ({ senses }) => {
    const m = makeMonster({ senses });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Senses')).not.toBeInTheDocument();
  });
});

describe('MonsterCardModal Shield of Faith AC lane', () => {
  beforeEach(() => {
    cleanup();
    getStore('Goblin').clear();
  });

  it('shows base AC untouched when no buff grants shield_of_faith', () => {
    getStore('Goblin').set('activeBuffs', []);
    render(<MonsterCardModal {...makeProps(makeMonster({ armor_class: 15 }))} />);
    expect(acValue()).toBe('15');

    cleanup();
    getStore('Goblin').clear();
    getStore('Goblin').set('activeBuffs', [
      { name: 'Bless', effect: 'bless' },
      { name: 'Protection from Evil and Good', effect: 'protection_from_evil_and_good' },
    ]);
    render(<MonsterCardModal {...makeProps(makeMonster({ armor_class: 15 }))} />);
    expect(acValue()).toBe('15');
    expect(screen.queryByText(/Shield of Faith/)).not.toBeInTheDocument();
  });

  it('shows AC + 2 with the exact "(+2 Shield of Faith)" suffix when the buff is active', () => {
    getStore('Goblin').set('activeBuffs', [{ name: 'Shield of Faith', effect: 'shield_of_faith' }]);
    render(<MonsterCardModal {...makeProps(makeMonster({ armor_class: 15 }))} />);
    expect(acValue()).toBe('17 (+2 Shield of Faith)');
  });
});
