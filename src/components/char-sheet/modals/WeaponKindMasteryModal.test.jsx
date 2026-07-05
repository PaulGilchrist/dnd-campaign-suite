// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';
import WeaponKindMasteryModal from './WeaponKindMasteryModal.jsx';

const mockPlayerStats = {
  name: 'Fighter1',
  level: 5,
  class: {
    class_levels: [
      { level: 1, weapon_mastery: 2 },
      { level: 5, weapon_mastery: 3 },
    ],
  },
};
const mockCampaignName = 'test-campaign';

const mockWeapons = [
  { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
  { name: 'Blowgun', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Sap' },
  { name: 'Club', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
  { name: 'Longbow', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Vex' },
  { name: 'Shortsword', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Vex' },
];

const baseProps = {
  action: undefined,
  playerStats: mockPlayerStats,
  campaignName: mockCampaignName,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderWithWeapons(overrides, weaponsToMock = mockWeapons) {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(weaponsToMock),
  });
  globalThis.fetch = fetchMock;
  return render(<WeaponKindMasteryModal {...makeProps(overrides)} />);
}

describe('WeaponKindMasteryModal', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal overlay with header, body, and action buttons', async () => {
      renderWithWeapons();
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      });
    });

    it('renders the Weapon Mastery header with crosshairs icon', async () => {
      renderWithWeapons();
      await waitFor(() => {
        expect(document.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
        const header = document.querySelector('.sp-header');
        expect(header.textContent).toContain('Weapon Mastery');
      });
    });

    it('renders the instruction text with maxKinds count', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).toContain('Choose up to');
        expect(bodyP.textContent).toContain('2');
        expect(bodyP.textContent).toContain('weapons');
      });
    });

    it('renders the Select and Skip buttons', async () => {
      renderWithWeapons();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
      });
    });

    it('renders the Select button disabled when no weapons are selected', async () => {
      renderWithWeapons();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
      });
    });
  });

  // ── Weapon list rendering ──

  describe('weapon list', () => {
    it('renders all weapons when meleeOnly is false', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const labels = document.querySelectorAll('label');
        const names = Array.from(labels).map(l => l.querySelector('strong')?.textContent);
        expect(names).toContain('Battleaxe');
        expect(names).toContain('Blowgun');
        expect(names).toContain('Club');
        expect(names).toContain('Longbow');
        expect(names).toContain('Shortsword');
      });
    });

    it('renders only melee weapons when meleeOnly is true', async () => {
      vi.resetModules();
      vi.doMock('../../../services/automation/index.js', () => ({
        applyWeaponKindMastery: vi.fn(),
      }));
      vi.doMock('../../../hooks/runtime/useRuntimeState.js', () => ({
        getRuntimeValue: vi.fn(),
        setRuntimeValue: vi.fn(),
      }));

      const mod = await import('./WeaponKindMasteryModal.jsx');
      const Modal = mod.default;

      const meleeWeapons = [
        { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
        { name: 'Blowgun', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Sap' },
        { name: 'Club', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(meleeWeapons),
      });
      globalThis.fetch = fetchMock;
      render(<Modal {...makeProps({ meleeOnly: true })} />);
      await waitFor(() => {
        const labels = document.querySelectorAll('label');
        const names = Array.from(labels).map(l => l.querySelector('strong')?.textContent);
        expect(names).toContain('Battleaxe');
        expect(names).toContain('Club');
        expect(names).not.toContain('Blowgun');
        expect(names).toHaveLength(2);
      });
    });

    it('renders weapon category and range info', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const labels = document.querySelectorAll('label');
        const firstLabel = labels[0];
        expect(firstLabel.textContent).toContain('[Martial Melee]');
      });
    });

    it('renders the mastery property for each weapon', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const labels = document.querySelectorAll('label');
        const firstLabel = labels[0];
        expect(firstLabel.textContent).toContain('Topple');
      });
    });

    it('renders "—" when a weapon has no mastery property', async () => {
      vi.resetModules();
      vi.doMock('../../../services/automation/index.js', () => ({
        applyWeaponKindMastery: vi.fn(),
      }));
      vi.doMock('../../../hooks/runtime/useRuntimeState.js', () => ({
        getRuntimeValue: vi.fn(),
        setRuntimeValue: vi.fn(),
      }));

      const mod = await import('./WeaponKindMasteryModal.jsx');
      const Modal = mod.default;

      const weaponsWithNoMastery = [
        { name: 'Test Weapon', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee' },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(weaponsWithNoMastery),
      });
      globalThis.fetch = fetchMock;
      render(<Modal {...makeProps()} />);
      await waitFor(() => {
        const labels = document.querySelectorAll('label');
        const firstLabel = labels[0];
        expect(firstLabel.textContent).toContain('—');
      });
    });

    it('renders weapons sorted alphabetically by name', async () => {
      vi.resetModules();
      vi.doMock('../../../services/automation/index.js', () => ({
        applyWeaponKindMastery: vi.fn(),
      }));
      vi.doMock('../../../hooks/runtime/useRuntimeState.js', () => ({
        getRuntimeValue: vi.fn(),
        setRuntimeValue: vi.fn(),
      }));

      const mod = await import('./WeaponKindMasteryModal.jsx');
      const Modal = mod.default;

      const unsortedWeapons = [
        { name: 'Zweihander', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Push' },
        { name: 'Axe', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
        { name: 'Mace', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Topple' },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(unsortedWeapons),
      });
      globalThis.fetch = fetchMock;
      render(<Modal {...makeProps()} />);
      await waitFor(() => {
        const labels = document.querySelectorAll('label');
        const names = Array.from(labels).map(l => l.querySelector('strong')?.textContent);
        expect(names).toEqual(['Axe', 'Mace', 'Zweihander']);
      });
    });

    it('filters out non-weapon items', async () => {
      vi.resetModules();
      vi.doMock('../../../services/automation/index.js', () => ({
        applyWeaponKindMastery: vi.fn(),
      }));
      vi.doMock('../../../hooks/runtime/useRuntimeState.js', () => ({
        getRuntimeValue: vi.fn(),
        setRuntimeValue: vi.fn(),
      }));

      const mod = await import('./WeaponKindMasteryModal.jsx');
      const Modal = mod.default;

      const mixedItems = [
        { name: 'Potion', equipment_category: 'Adventuring Gear' },
        { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mixedItems),
      });
      globalThis.fetch = fetchMock;
      render(<Modal {...makeProps()} />);
      await waitFor(() => {
        expect(screen.getByText('Battleaxe')).toBeInTheDocument();
        expect(screen.queryByText('Potion')).not.toBeInTheDocument();
      });
    });

    it('filters out weapons without weapon_category or weapon_range', async () => {
      vi.resetModules();
      vi.doMock('../../../services/automation/index.js', () => ({
        applyWeaponKindMastery: vi.fn(),
      }));
      vi.doMock('../../../hooks/runtime/useRuntimeState.js', () => ({
        getRuntimeValue: vi.fn(),
        setRuntimeValue: vi.fn(),
      }));

      const mod = await import('./WeaponKindMasteryModal.jsx');
      const Modal = mod.default;

      const items = [
        { name: 'Test Weapon', equipment_category: 'Weapon', weapon_range: 'Melee' },
        { name: 'Test Weapon 2', equipment_category: 'Weapon', weapon_category: 'Simple' },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        json: () => Promise.resolve(items),
      });
      globalThis.fetch = fetchMock;
      render(<Modal {...makeProps()} />);
      await waitFor(() => {
        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      });
    });
  });

  // ── maxKinds computation ──

  describe('maxKinds computation', () => {
    it('defaults to 2 when action is undefined', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).toContain('Choose up to');
        expect(bodyP.textContent).toContain('2');
        expect(bodyP.textContent).toContain('weapons');
      });
    });

    it('uses maxKinds from action.automation.maxKinds', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 4 } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).toContain('4');
        expect(bodyP.textContent).toContain('weapons');
      });
    });

    it('uses class_level_scaling from action.automation to derive from playerStats', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 'class_level_scaling' } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).toContain('Choose up to');
        expect(bodyP.textContent).toContain('3');
        expect(bodyP.textContent).toContain('weapons');
      });
    });

    it('falls back to 2 when class_level_scaling weapon_mastery is undefined', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 'class_level_scaling' } },
        playerStats: { name: 'Fighter1', level: 10, class: { class_levels: [] } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).toContain('Choose up to');
        expect(bodyP.textContent).toContain('2');
        expect(bodyP.textContent).toContain('weapons');
      });
    });

    it('shows singular "weapon" when maxKinds is 1', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 1 } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const text = document.querySelector('.sp-body p');
        expect(text.textContent).toContain('weapon');
        expect(text.textContent).not.toContain('weapons');
      });
    });
  });

  // ── Selection behavior ──

  describe('weapon selection', () => {
    it('has no weapons selected initially', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => expect(cb.checked).toBe(false));
      });
    });

    it('toggles a weapon selection on checkbox click', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[0].checked).toBe(true);
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[0].checked).toBe(false);
      });
    });

    it('enables the Select button after a weapon is selected', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        expect(screen.getByRole('button', { name: 'Select' })).not.toBeDisabled();
      });
    });

    it('prevents selecting more than maxKinds weapons', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 2 } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        expect(checkboxes[0].checked).toBe(true);
        expect(checkboxes[1].checked).toBe(true);
        expect(checkboxes[2].disabled).toBe(true);
      });
    });

    it('disables unchecked weapons when maxKinds is reached', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 1 } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[1].disabled).toBe(true);
        expect(checkboxes[2].disabled).toBe(true);
      });
    });

    it('allows deselecting a weapon to free up a slot', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 1 } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[1].disabled).toBe(true);
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[1].disabled).toBe(false);
      });
    });
  });

  // ── Selection counter ──

  describe('selection counter', () => {
    it('displays "Selected: 0/2" by default', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const counter = document.querySelector('.sp-body p:last-of-type');
        expect(counter.textContent).toContain('0');
        expect(counter.textContent).toContain('2');
      });
    });

    it('updates the counter after selecting and deselecting a weapon', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await waitFor(() => {
        const counter = document.querySelector('.sp-body p:last-of-type');
        expect(counter.textContent).toContain('1');
        expect(counter.textContent).toContain('2');
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await waitFor(() => {
        const counter = document.querySelector('.sp-body p:last-of-type');
        expect(counter.textContent).toContain('0');
        expect(counter.textContent).toContain('2');
      });
    });

    it('uses the correct maxKinds in the counter', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 3 } },
      });
      renderWithWeapons(props);
      await waitFor(() => {
        const counter = document.querySelector('.sp-body p:last-of-type');
        expect(counter.textContent).toContain('0');
        expect(counter.textContent).toContain('3');
      });
    });
  });

  // ── Melee-only label ──

  describe('melee-only label', () => {
    it('shows "(Melee only)" suffix when meleeOnly is true', async () => {
      renderWithWeapons({ meleeOnly: true });
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).toContain('Melee only');
      });
    });

    it('does not show "(Melee only)" suffix when meleeOnly is false or undefined', async () => {
      renderWithWeapons({ meleeOnly: false });
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).not.toContain('Melee only');
      });
      renderWithWeapons();
      await waitFor(() => {
        const bodyP = document.querySelector('.sp-body p');
        expect(bodyP.textContent).not.toContain('Melee only');
      });
    });
  });

  // ── HandleSelect (applyWeaponKindMastery) ──

  describe('handleSelect / applyWeaponKindMastery', () => {
    it('does not call applyWeaponKindMastery when no weapons are selected', async () => {
      renderWithWeapons();
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      expect(automation.applyWeaponKindMastery).not.toHaveBeenCalled();
    });

    it('calls applyWeaponKindMastery with selected weapons, playerStats, and campaignName', async () => {
      automation.applyWeaponKindMastery.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: 'Weapon kinds set to: Battleaxe, Club.',
        },
      });
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[2]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        expect(automation.applyWeaponKindMastery).toHaveBeenCalledWith(
          ['Battleaxe', 'Club'],
          mockPlayerStats,
          mockCampaignName
        );
      });
    });

    it('calls applyWeaponKindMastery with a single weapon when one is selected', async () => {
      automation.applyWeaponKindMastery.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: 'Weapon kinds set to: Battleaxe.',
        },
      });
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        expect(automation.applyWeaponKindMastery).toHaveBeenCalledWith(
          ['Battleaxe'],
          mockPlayerStats,
          mockCampaignName
        );
      });
    });
  });

  // ── Applied/result state ──

  describe('result state', () => {
    function setupResultState(result) {
      automation.applyWeaponKindMastery.mockResolvedValue(result);
      renderWithWeapons();
      return { checkboxes: () => document.querySelectorAll('input[type="checkbox"]') };
    }

    it('shows the result description after applying', async () => {
      setupResultState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: 'Weapon kinds set to: Battleaxe, Club.',
        },
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[2]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Weapon kinds set to/)).toBeInTheDocument();
      });
    });

    it('replaces the weapon list with a Done button after applying', async () => {
      setupResultState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: 'Weapon kinds set to: Battleaxe.',
        },
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        expect(screen.queryByLabelText('Battleaxe')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
      });
    });

    it('renders result payload description as HTML via dangerouslySetInnerHTML', async () => {
      setupResultState({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: '<strong>Battleaxe</strong> selected.',
        },
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.querySelector('strong')).toBeInTheDocument();
      });
    });

    it('renders result state when result payload description is falsy', async () => {
      const falsyDescription = '';
      automation.applyWeaponKindMastery.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: falsyDescription,
        },
      });
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when Done button is clicked in result state', async () => {
      const onClose = vi.fn();
      automation.applyWeaponKindMastery.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: 'Weapon kinds set to: Battleaxe.',
        },
      });
      renderWithWeapons({ onClose });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Skip button is clicked', async () => {
      const onClose = vi.fn();
      renderWithWeapons({ onClose });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call applyWeaponKindMastery when Skip is clicked', async () => {
      renderWithWeapons();
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      });
      expect(automation.applyWeaponKindMastery).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with no weapons when equipment.json returns empty array', async () => {
      renderWithWeapons([], []);
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
      });
    });

    it('renders with no weapons when no weapons match the filter criteria', async () => {
      const nonWeaponItems = [
        { name: 'Potion', equipment_category: 'Adventuring Gear' },
      ];
      renderWithWeapons({}, nonWeaponItems);
      await waitFor(() => {
        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      });
    });

    it('renders with meleeOnly=true when no melee weapons exist', async () => {
      const rangedOnly = [
        { name: 'Longbow', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Vex' },
      ];
      renderWithWeapons({ meleeOnly: true }, rangedOnly);
      await waitFor(() => {
        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      });
    });
  });

});
