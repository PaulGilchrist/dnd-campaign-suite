import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import * as runtimeModule from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const basePayload = {
  allManeuvers: [
    { name: 'Trip Attack', actionType: 'attack_rider' },
    { name: 'Pushing Attack', actionType: 'movement' },
    { name: 'Disarming Attack', actionType: 'attack_rider' },
    { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
    { name: 'Evasive Footwork', actionType: 'reaction' },
    { name: 'Kicking Attack', actionType: 'skill_check' },
    { name: 'Rally', actionType: 'movement' },
    { name: 'Grasping Vine', actionType: 'grant_attack' },
  ],
  maxOptions: 3,
  knownManeuvers: [],
};

function makePayload(overrides = {}) {
  return { ...basePayload, ...overrides };
}

function makeProps(overrides = {}) {
  return {
    payload: makePayload(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  return render(<CombatSuperiorityModal {...makeProps(overrides)} />);
}

// ── Superiority dice logic ──

describe('CombatSuperiorityModal - superiority dice', () => {
  // Track spies for cleanup
  const spies = [];

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
    spies.length = 0;
  });

  // ── hasSuperiorityDice: getRuntimeValue path ──

  describe('getRuntimeValue path', () => {
    it('shows maneuver selection when getRuntimeValue returns a positive number', () => {
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(3);
      spies.push(spy);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it.each([
      [0],
      [-1],
      [null],
      [undefined],
    ])('shows no dice message when getRuntimeValue returns %s', (value) => {
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(value);
      spies.push(spy);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
    });
  });

  // ── hasSuperiorityDice: _trackedResources fallback path ──

  describe('_trackedResources fallback path', () => {
    it('falls back to _trackedResources when getRuntimeValue returns null', () => {
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(null);
      spies.push(spy);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: {
            name: 'TestCharacter',
            _trackedResources: { superiorityDice: { current: 2 } },
          },
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it.each([
      [{ superiorityDice: { current: 0 } }, '0'],
      [{ superiorityDice: { current: -5 } }, 'negative'],
      [undefined, 'missing _trackedResources'],
      [{}, 'missing superiorityDice key'],
      [{ superiorityDice: null }, 'null superiorityDice'],
      [{ superiorityDice: {} }, 'no current field'],
    ])('shows no dice when _trackedResources fallback is %s', (trackedResources, _label) => {
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(null);
      spies.push(spy);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter', _trackedResources: trackedResources },
        }),
      });
      expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
    });
  });

  // ── Missing playerStats / name ──

  describe('missing playerStats/name', () => {
    it.each([
      [undefined, 'playerStats is missing'],
      [{}, 'playerStats.name is missing'],
      [{ name: null }, 'playerStats.name is null'],
      [{ name: '' }, 'playerStats.name is empty string'],
    ])('shows maneuver selection when %s', (_stats, _label) => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: _stats,
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });
  });

  // ── selectionMode overrides dice check ──

  describe('selectionMode overrides dice check', () => {
    it.each([
      [0, 'no dice'],
      [null, 'null dice'],
    ])('shows maneuver selection when selectionMode is true even with %s', (diceValue, _label) => {
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(diceValue);
      spies.push(spy);
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      expect(screen.getByText(/Combat Superiority — Select Maneuvers/)).toBeInTheDocument();
      expect(screen.queryByText(/No Superiority Dice remaining/)).not.toBeInTheDocument();
    });
  });

  // ── Close button in no-dice state ──

  describe('close in no-dice state', () => {
    it('calls onClose when Close button is clicked in no dice state', () => {
      const onClose = vi.fn();
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(0);
      spies.push(spy);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
        onClose,
      });
      fireEvent.click(screen.getByRole('button', { name: /Close/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
