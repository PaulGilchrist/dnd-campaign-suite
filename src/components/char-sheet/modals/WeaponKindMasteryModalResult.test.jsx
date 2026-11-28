// @maintained-by-ai 2026-11-28
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';
import WeaponKindMasteryModal from './WeaponKindMasteryModal.jsx';
import { resetWeaponsCache } from './weapon-kind-mastery-cache.js';

// XSS posture of the sp-body sink (WeaponKindMasteryModal.jsx:65):
// payload.description is built by weaponKindMasteryHandler.applySelections (:46)
// from a hard-coded template interpolating checkbox-picked weapon names sourced
// from /data/equipment.json (trusted authored catalog). This is sanctioned
// trusted-content-from-disk HTML (same verified class as the ~40 sibling sinks
// audited in fix#17; cf. damageReductionHandler.js:272 <strong>) — no sanitizer
// is needed today and none is faked here. If this lane ever carries user-editable
// prose, DOMPurify must be added at the sink first.

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
    resetWeaponsCache();
    automation.applyWeaponKindMastery.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Weapon Mastery',
        description: RESULT_DESCRIPTION,
      },
    });
  });

  it('applies the selection, shows the exact result copy in place of the selection UI, and Done closes', async () => {
    const onClose = vi.fn();
    renderWithWeapons({ onClose });
    await waitForWeapons();

    await selectAndApply();

    // The result copy is injected into the modal body via dangerouslySetInnerHTML
    // (WeaponKindMasteryModal.jsx:65) — pin the raw innerHTML of that exact
    // container, not just that the words appear somewhere in the document.
    const body = document.querySelector('.sp-modal .sp-body');
    expect(body).not.toBeNull();
    expect(body.innerHTML).toBe(RESULT_DESCRIPTION);
    // selection UI is gone, replaced by Done
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders markup in the result description as live HTML (sanctioned sp-body sink)', async () => {
    // Discriminates the set-HTML sink from a children render: with plain text
    // both render identically, so only a markup-bearing description can prove
    // the tag structure survives verbatim (see the fix#17 posture note above;
    // cf. markup-bearing siblings like damageReductionHandler.js:272).
    automation.applyWeaponKindMastery.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Weapon Mastery',
        description: 'Weapon kinds set to: <b>Battleaxe, Club</b>. Mastery properties will be available when attacking with these weapons.',
      },
    });
    renderWithWeapons();
    await waitForWeapons();

    await selectAndApply();

    const body = document.querySelector('.sp-modal .sp-body');
    // set, not escaped: a children render would escape to &lt;b&gt; here
    expect(body.innerHTML).toMatch(/^Weapon kinds set to: <b>Battleaxe, Club<\/b>\. Mastery properties will be available when attacking with these weapons\.$/);
    // interpreted, not literal: a children render would leak the tag text here
    expect(body.textContent).toBe(RESULT_DESCRIPTION);
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
