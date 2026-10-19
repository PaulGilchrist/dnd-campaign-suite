// @maintained-by-ai
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';

// ── Scope ────────────────────────────────────────────────────────────────────
//
// Pins for the base render contract that NO maintained sibling covers:
//   - terminal 'Monster' name fallback (MonsterCardModal.jsx:2113).
//     MonsterCardModal.test.jsx pins monster.name and creatureName override
//     only; senses-and-fallback covers senses/AC fallbacks.
//   - Speed line join for multi-mode string speeds (test.jsx pins the
//     single numeric 'walk 30' form only).
//   - Temp HP stat row fed from the runtime store (getRuntimeValue
//     'tempHp', MonsterCardModal.jsx:2114 → MonsterCardBody.jsx:163).
//     Other tempHp pins (emperyean, ma0875-cube-shape) assert store values
//     and picker props, not this stat row.
//   - languages ARRAY join (formatLanguages, MonsterCardBody.jsx:340 —
//     test.jsx uses a string languages value).
//   - legendary_resistance: 0 renders '0/day' (test.jsx pins 3/day and
//     null/undefined hidden; the falsy-zero arm is unpinned elsewhere).
//
// Everything else in the card (close button, overlay, section census,
// header bytes, 0/day siblings) is owned by MonsterCardModal.test.jsx and
// the dedicated feature-lane siblings — see coverage map in that file.
// No vi.mock: default props (creatures: [], mapName: null) short-circuit
// the mount fetch effects, and no interactions fire, so real modules are
// inert here (verified by bisect — see lane notes).

describe('MonsterCardModal base render contract', () => {
  beforeEach(() => {
    cleanup();
    getStore('Goblin').clear();
  });

  it('falls back to "Monster" when neither creatureName nor monster.name is present', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ name: undefined }), { creatureName: '' })} />);
    expect(screen.getByText('Monster')).toBeInTheDocument();
  });

  it('renders the Speed line: joins multiple modes, empty value when speed is missing', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ speed: { walk: '30 ft.', fly: '20 ft.' } }))} />);
    expect(screen.getByText('walk 30 ft., fly 20 ft.')).toBeInTheDocument();

    cleanup();
    render(<MonsterCardModal {...makeProps(makeMonster({ speed: {} }))} />);
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('Speed').nextElementSibling.textContent).toBe('');
  });

  it('shows a Temp HP stat from the runtime store and hides it when the store has none', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText('Temp HP')).not.toBeInTheDocument();

    cleanup();
    getStore('Goblin').set('tempHp', 5);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Temp HP')).toBeInTheDocument();
    expect(screen.getByText('Temp HP').nextElementSibling.textContent).toBe(' 5');
  });

  it('joins array-format languages with commas', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ languages: ['Common', 'Goblin', 'Draconic'] }))} />);
    expect(screen.getByText('Common, Goblin, Draconic')).toBeInTheDocument();
  });

  it('renders "0/day" when legendary_resistance is 0 (a valid count, not "none")', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ legendary_resistance: 0 }))} />);
    expect(screen.getByText('0/day')).toBeInTheDocument();
  });
});
