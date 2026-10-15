// @maintained-by-ai
// SP-074 hook-seam contract: useCharacterWizard must invoke endMageArmorOnDonning
// with (original, saved, campaign) AFTER a successful character save, and never when
// the save fails. Wiring only — strip logic itself lives in mageArmorService.test.js;
// PUT payload/lineage flow lives in useCharacterWizard.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/campaign/campaignService.js', () => ({
  updateCharacter: vi.fn(async () => ({})),
  createCharacter: vi.fn(async () => ({ character: {} })),
}));

vi.mock('../../services/rules/features/mageArmorService.js', () => ({
  endMageArmorOnDonning: vi.fn(async () => true),
}));

import { useCharacterWizard } from './useCharacterWizard.js';
import * as campaignService from '../../services/campaign/campaignService.js';
import { endMageArmorOnDonning } from '../../services/rules/features/mageArmorService.js';

const CAMPAIGN = 'test-campaign';

vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWizard() {
  const setCharacters = vi.fn();
  const setActiveCharacter = vi.fn();
  const { result } = renderHook(() => useCharacterWizard(CAMPAIGN));
  // Register callbacks so the happy path completes instead of throwing on null refs.
  act(() => { result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter }); });
  return { result, setCharacters, setActiveCharacter };
}

describe('SP-074 useCharacterWizard — equipment save donning seam', () => {
  it('runs endMageArmorOnDonning with original+saved data after the character PUT succeeds', async () => {
    const { result } = renderWizard();
    const original = { name: 'HexWarlock', inventory: { equipped: [] } };

    act(() => result.current.handleEditCharacter(original));
    const saved = { name: 'HexWarlock', inventory: { equipped: ['Leather'] } };
    await act(async () => { await result.current.handleEditWizardComplete(saved); });

    expect(campaignService.updateCharacter).toHaveBeenCalledWith(
      CAMPAIGN, 'HexWarlock.json', saved, 'HexWarlock.json',
    );
    expect(endMageArmorOnDonning).toHaveBeenCalledWith(original, saved, CAMPAIGN);
    // Seam ordering invariant: the strip must run only after the save has succeeded.
    expect(campaignService.updateCharacter.mock.invocationCallOrder[0])
      .toBeLessThan(endMageArmorOnDonning.mock.invocationCallOrder[0]);
  });

  it('never strips when the character save fails', async () => {
    campaignService.updateCharacter.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderWizard();

    act(() => result.current.handleEditCharacter({ name: 'HexWarlock', inventory: { equipped: [] } }));
    await act(async () => { await result.current.handleEditWizardComplete({ name: 'HexWarlock', inventory: { equipped: ['Leather'] } }); });

    expect(campaignService.updateCharacter).toHaveBeenCalledTimes(1); // save attempted and failed
    expect(endMageArmorOnDonning).not.toHaveBeenCalled();
  });
});
