// @maintained-by-ai
// maxKinds computation lane for WeaponKindMasteryModal: the derived cap rendered in the
// instruction copy and the Selected counter across prop variations (numeric override,
// class_level_scaling derivation, missing-class fallbacks, singular/plural boundary).
// Other lanes: first-paint copy incl. default maxKinds 2 → ...Initial.test.jsx, rows /
// meleeOnly filter / toggle / disabled-cap → ...WeaponList.test.jsx, deselect / preselect /
// payload → ...Selection.test.jsx, result view / close → ...Result.test.jsx, payload
// production → weaponKindMasteryHandler.test.js.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

import WeaponKindMasteryModal from './WeaponKindMasteryModal.jsx';

const mockWeapons = [
  { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
  { name: 'Blowgun', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Sap' },
  { name: 'Club', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
  { name: 'Longbow', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Vex' },
  { name: 'Shortsword', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Vex' },
];

// Level-5 entry (weapon_mastery 3) is distinct from the modal's default cap of 2 so any
// derivation, fallback, or wrong-entry shortcut is visible in the rendered copy.
const scalingStats = {
  name: 'Fighter1',
  level: 5,
  class: {
    class_levels: [
      { level: 1, weapon_mastery: 2 },
      { level: 5, weapon_mastery: 3 },
    ],
  },
};

function renderModal(props = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(mockWeapons),
  });
  return render(
    <WeaponKindMasteryModal
      action={undefined}
      playerStats={scalingStats}
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

describe('WeaponKindMasteryModal — maxKinds computation', () => {

  it('renders numeric action.automation.maxKinds in the instruction and the Selected counter', () => {
    renderModal({ action: { automation: { maxKinds: 4 } } });
    expect(getInstruction().textContent).toBe('Choose up to 4 weapons to apply Weapon Mastery:');
    expect(screen.getByText('Selected: 0/4')).toBeInTheDocument();
  });

  it('derives maxKinds from the class_levels entry matching playerStats.level', () => {
    renderModal({ action: { automation: { maxKinds: 'class_level_scaling' } } });
    expect(getInstruction().textContent).toBe('Choose up to 3 weapons to apply Weapon Mastery:');
    expect(screen.getByText('Selected: 0/3')).toBeInTheDocument();
  });

  it('uses singular "weapon" and matching counter when maxKinds is 1', () => {
    renderModal({ action: { automation: { maxKinds: 1 } } });
    expect(getInstruction().textContent).toBe('Choose up to 1 weapon to apply Weapon Mastery:');
    expect(screen.getByText('Selected: 0/1')).toBeInTheDocument();
  });

  it.each([
    ['empty class_levels', { name: 'Fighter1', level: 10, class: { class_levels: [] } }],
    ['no class object', { name: 'Fighter1', level: 5 }],
    ['empty class object', { name: 'Fighter1', level: 5, class: {} }],
    // no entry matches level 5 — cap must fall back to 2, not adopt the level-1 entry's 4
    ['no entry matching level', { name: 'Fighter1', level: 5, class: { class_levels: [{ level: 1, weapon_mastery: 4 }] } }],
  ])('class_level_scaling falls back to 2 when class data has %s', (_label, playerStats) => {
    renderModal({ action: { automation: { maxKinds: 'class_level_scaling' } }, playerStats });
    expect(getInstruction().textContent).toBe('Choose up to 2 weapons to apply Weapon Mastery:');
    expect(screen.getByText('Selected: 0/2')).toBeInTheDocument();
  });
});
