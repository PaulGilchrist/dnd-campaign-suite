// @maintained-by-ai
// First-paint lane for WeaponKindMasteryModal: exact header + instruction copy before any
// selection (meleeOnly distinctness via prop omission, zero-selection count, default maxKinds 2).
// Other lanes: maxKinds computation → WeaponKindMasteryModalMaxKinds.test.jsx, weapon rows →
// WeaponKindMasteryModalWeaponList.test.jsx, selection/payload → ...Selection.test.jsx,
// result view/close → ...Result.test.jsx, payload production → weaponKindMasteryHandler.test.js.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

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

const mockWeapons = [
  { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
  { name: 'Blowgun', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Sap' },
  { name: 'Club', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
];

function renderModal(props = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockWeapons),
  });
  return render(
    <WeaponKindMasteryModal
      action={undefined}
      playerStats={mockPlayerStats}
      campaignName="test-campaign"
      onClose={vi.fn()}
      {...props}
    />
  );
}

function getInstruction() {
  return screen.getByText((content, el) =>
    el.tagName === 'P' && content.startsWith('Choose up to'));
}

describe('WeaponKindMasteryModal — first paint', () => {

  it('shows the mastery-choice header and zero-selection state before anything is picked', () => {
    renderModal();
    expect(screen.getByText(/Weapon Mastery — Choose Weapon Kinds/)).toBeInTheDocument();
    expect(screen.getByText('Selected: 0/2')).toBeInTheDocument();
  });

  it.each([
    [false, 'Choose up to 2 weapons to apply Weapon Mastery:'],
    [true, 'Choose up to 2 weapons to apply Weapon Mastery (Melee only):'],
  ])('renders exact instruction copy with meleeOnly=%s', (meleeOnly, expectedCopy) => {
    renderModal({ meleeOnly });
    expect(getInstruction().textContent).toBe(expectedCopy);
  });
});
