import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BastionOfLawModal from './BastionOfLawModal.jsx';

// ── Ownership ──
// This file owns the CREATE-ward modal UI in isolation: target radio selection,
// SP input bounds/clamping, Create-Ward gating, and the confirm seam emitting
// exactly (spAmount, selectedTargetName) before onClose.
// Deferred to owners:
// - CharActionModals.inline-modals.test.jsx — onConfirm → handleApply payload
//   → setPopupHtml flow (CharActionModals.jsx wires the wrapper at its
//   bastionOfLawModal render site).
// - bastionOfLawHandler.js handleApply — SP pool enforcement, ward dice
//   writes to bastionOfLawWard* runtime keys, popups.
// - restRules-longRest.js resetBastionOfLaw — long-rest ward reset.
// - BastionOfLawSpendModal.test.jsx / CharReactions.*.test.jsx — the
//   reaction spend-dice lane (separate component).

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ──

// Live mutable store the mocked runtime read drains from — tests mutate
// spStore directly instead of re-mocking per scenario.
let spStore;

function makeProps(overrides = {}) {
  return {
    featureName: 'Bastion of Law',
    creatureTargets: [
      { name: 'Sorcerer1', type: 'player', currentHp: 45, maxHp: 45 },
      { name: 'AllyWarrior', type: 'npc', currentHp: 30, maxHp: 30 },
      { name: 'AllyRogue', type: 'npc', currentHp: 25, maxHp: 25 },
    ],
    playerName: 'Sorcerer1',
    campaignName: 'test-campaign',
    auto: { maxSP: 5, minSP: 1, range: '30_ft' },
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderModal(overrides) {
  return render(<BastionOfLawModal {...makeProps(overrides)} />);
}

const spInput = () => screen.getByLabelText('Sorcery Points to spend:');
const createBtn = () => screen.getByRole('button', { name: /Create Ward/ });
const targetRadio = (name) => screen.getByRole('radio', { name: new RegExp(name) });

// ── Tests ──

describe('BastionOfLawModal', () => {
  beforeEach(() => {
    spStore = { sorceryPoints: 10 };
    runtimeState.getRuntimeValue.mockImplementation(
      (_player, key) => spStore[key]
    );
  });

  afterEach(() => {
    runtimeState.getRuntimeValue.mockReset();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the ward prompt and every ward detail line verbatim', () => {
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(
        'Choose a creature to create a magical ward on. Each sorcery point spent creates one d8 in the ward dice pool.'
      )).toBeInTheDocument();
      expect(screen.getByText('Ward dice: 1d8')).toBeInTheDocument();
      expect(screen.getByText('Range: 30 ft')).toBeInTheDocument();
      expect(screen.getByText('Duration: Long Rest or until target uses it')).toBeInTheDocument();
      expect(screen.getByText('Target uses Reaction when taking damage to spend dice')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('lists each creature as an unchecked radio with exact HP and type segments', () => {
      renderModal();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
      expect(screen.getByText('Sorcerer1')).toBeInTheDocument();
      expect(screen.getByText('AllyWarrior')).toBeInTheDocument();
      expect(screen.getByText('AllyRogue')).toBeInTheDocument();
      expect(screen.getByText('45/45 HP')).toBeInTheDocument();
      expect(screen.getByText('30/30 HP')).toBeInTheDocument();
      expect(screen.getByText('25/25 HP')).toBeInTheDocument();
      expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    });

    it('reads the sorcery point pool from the runtime store once with exact arguments', () => {
      renderModal();
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        'Sorcerer1', 'sorceryPoints', 'test-campaign'
      );
    });
  });

  // ── SP input bounds and clamping ──

  describe('SP input bounds', () => {
    it.each([
      { label: 'defaults', auto: { maxSP: 5, minSP: 1, range: '30_ft' }, min: '1', max: '5', value: '1', rangeLine: 'Range: 30 ft' },
      { label: 'custom bounds and underscore range', auto: { maxSP: 8, minSP: 2, range: '60_ft' }, min: '2', max: '8', value: '2', rangeLine: 'Range: 60 ft' },
      { label: 'missing minSP and range', auto: { maxSP: 3 }, min: '1', max: '3', value: '1', rangeLine: 'Range: 30 ft' },
      { label: 'null auto', auto: null, min: '1', max: '5', value: '1', rangeLine: 'Range: 30 ft' },
      { label: 'undefined auto', auto: undefined, min: '1', max: '5', value: '1', rangeLine: 'Range: 30 ft' },
    ])('applies min/max/default and range for $label', ({ auto, min, max, value, rangeLine }) => {
      renderModal({ auto });
      const input = spInput();
      expect(input.min).toBe(min);
      expect(input.max).toBe(max);
      expect(input.value).toBe(value);
      expect(screen.getByText(rangeLine)).toBeInTheDocument();
    });

    it.each([
      { typed: '0', expected: '1', auto: { maxSP: 5, minSP: 1, range: '30_ft' } },
      { typed: '10', expected: '3', auto: { maxSP: 3, minSP: 1, range: '30_ft' } },
      { typed: '', expected: '1', auto: { maxSP: 5, minSP: 1, range: '30_ft' } },
      { typed: 'abc', expected: '1', auto: { maxSP: 5, minSP: 1, range: '30_ft' } },
      { typed: '4', expected: '4', auto: { maxSP: 5, minSP: 1, range: '30_ft' } },
    ])('clamps typed SP "$typed" to $expected and mirrors it in preview and button', ({ typed, expected, auto }) => {
      renderModal({ auto });
      const input = spInput();
      fireEvent.change(input, { target: { value: typed } });
      expect(input.value).toBe(expected);
      expect(screen.getByText(`Creates ${expected}d8 ward`)).toBeInTheDocument();
      expect(screen.getByText(`Ward dice: ${expected}d8`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Create Ward (${expected}d8)` })).toBeInTheDocument();
    });
  });

  // ── Selection gating ──

  describe('selection gating', () => {
    it('enables Create Ward only when a target radio is checked, and the check follows re-selection', () => {
      renderModal();
      expect(createBtn()).toBeDisabled();

      fireEvent.click(targetRadio('AllyWarrior'));
      expect(createBtn()).not.toBeDisabled();
      expect(targetRadio('AllyWarrior')).toBeChecked();
      expect(targetRadio('AllyRogue')).not.toBeChecked();

      fireEvent.click(targetRadio('AllyRogue'));
      expect(targetRadio('AllyRogue')).toBeChecked();
      expect(targetRadio('AllyWarrior')).not.toBeChecked();
      expect(createBtn()).not.toBeDisabled();
    });

    it('does not confirm or close when Create Ward is clicked with no target selected', async () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      renderModal({ onConfirm, onClose });

      await act(async () => {
        fireEvent.click(createBtn());
      });

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Confirm seam ──

  describe('confirm seam', () => {
    it('emits the exact (spAmount, selectedTargetName) payload, then closes once', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onConfirm, onClose });

      fireEvent.click(targetRadio('AllyWarrior'));
      fireEvent.change(spInput(), { target: { value: '2' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Ward (2d8)' }));
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(2, 'AllyWarrior');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('confirms the untouched minSP default with the selected target', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onConfirm, onClose, auto: { maxSP: 5, minSP: 3, range: '30_ft' } });

      fireEvent.click(targetRadio('AllyRogue'));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Ward (3d8)' }));
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(3, 'AllyRogue');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes without confirming when Cancel is clicked', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      renderModal({ onConfirm, onClose });

      fireEvent.click(targetRadio('AllyWarrior'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('stays inert when the overlay is clicked after selecting a target', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      renderModal({ onConfirm, onClose });

      fireEvent.click(targetRadio('AllyWarrior'));
      fireEvent.click(document.querySelector('.sp-overlay'));

      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(targetRadio('AllyWarrior')).toBeChecked();
    });
  });

  // ── Target list edges ──

  describe('target list edges', () => {
    it('renders no radios and keeps Create Ward disabled for an empty target list', () => {
      renderModal({ creatureTargets: [] });
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(createBtn()).toBeDisabled();
    });

    it('omits the HP segment for a target without HP', () => {
      renderModal({ creatureTargets: [{ name: 'Mystery', type: 'npc', currentHp: null, maxHp: null }] });
      expect(screen.getByRole('radio')).toBeEnabled();
      expect(screen.getByText('Mystery')).toBeInTheDocument();
      expect(screen.queryByText(/\d+\/\d+ HP/)).not.toBeInTheDocument();
    });
  });
});
