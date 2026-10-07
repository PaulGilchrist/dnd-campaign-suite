import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('SP-074 useCharacterWizard — equipment save donning seam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs endMageArmorOnDonning with original+saved data after the character PUT succeeds', async () => {
    const { result } = renderHook(() => useCharacterWizard(CAMPAIGN));
    const original = { name: 'HexWarlock', inventory: { equipped: [] } };

    act(() => result.current.handleEditCharacter(original));
    const saved = { name: 'HexWarlock', inventory: { equipped: ['Leather'] } };
    await act(async () => { await result.current.handleEditWizardComplete(saved); });

    expect(campaignService.updateCharacter).toHaveBeenCalledWith(
      CAMPAIGN, 'HexWarlock.json', saved, 'HexWarlock.json',
    );
    expect(endMageArmorOnDonning).toHaveBeenCalledWith(original, saved, CAMPAIGN);
  });

  it('never strips when the character save fails', async () => {
    campaignService.updateCharacter.mockRejectedValueOnce(new Error('offline'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    window.alert = vi.fn();
    const { result } = renderHook(() => useCharacterWizard(CAMPAIGN));

    act(() => result.current.handleEditCharacter({ name: 'HexWarlock', inventory: { equipped: [] } }));
    await act(async () => { await result.current.handleEditWizardComplete({ name: 'HexWarlock', inventory: { equipped: ['Leather'] } }); });

    expect(endMageArmorOnDonning).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
