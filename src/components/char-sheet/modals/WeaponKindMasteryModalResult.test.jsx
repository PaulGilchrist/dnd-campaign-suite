// @maintained-by-ai
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
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

// Exact copy produced by weaponKindMasteryHandler.applySelections
const RESULT_DESCRIPTION = 'Weapon kinds set to: Battleaxe, Club. Mastery properties will be available when attacking with these weapons.';

function renderWithWeapons(overrides) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockWeapons),
  });
  return render(<WeaponKindMasteryModal
    action={undefined}
    playerStats={mockPlayerStats}
    campaignName={mockCampaignName}
    onClose={vi.fn()}
    {...(overrides || {})}
  />);
}

async function waitForWeapons() {
  await waitFor(() => screen.getByRole('checkbox', { name: /Battleaxe/ }));
}

async function selectAndApply() {
  fireEvent.click(screen.getByRole('checkbox', { name: /Battleaxe/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Club/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  });
  await waitFor(() => screen.getByRole('button', { name: 'Done' }));
}

describe('WeaponKindMasteryModal — result state', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    automation.applyWeaponKindMastery.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Weapon Mastery',
        description: RESULT_DESCRIPTION,
      },
    });
  });

  it('replaces the selection UI with the applied result copy and a Done button', async () => {
    renderWithWeapons();
    await waitForWeapons();

    await selectAndApply();

    expect(screen.getByText(RESULT_DESCRIPTION)).toBeInTheDocument();
    // selection UI is gone, replaced by Done
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('calls onClose when Done is clicked in the result state', async () => {
    const onClose = vi.fn();
    renderWithWeapons({ onClose });
    await waitForWeapons();

    await selectAndApply();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without applying when Skip is clicked, even with a selection made', async () => {
    const onClose = vi.fn();
    renderWithWeapons({ onClose });
    await waitForWeapons();

    fireEvent.click(screen.getByRole('checkbox', { name: /Battleaxe/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(automation.applyWeaponKindMastery).not.toHaveBeenCalled();
  });

});
