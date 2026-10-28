// @maintained-by-ai
// Regression pin for bug-character-delete-sanitizer-mismatch (live-reproved
// 2026-10-28): UI Delete of "QA RunV Wizard" fired
// DELETE /api/campaigns/test-campaign/qa-runv-wizard.json → 404 because the
// delete lane guessed `toLowerCase().replace(/\s+/g,'-')` while create wrote
// `QA_RunV_Wizard.json` ('_'-sanitized, case-preserved). The hook must send
// the SAME filename the create/save lane produced, for every name shape.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCharacterManagement from './useCharacterManagement.js';

vi.mock('lodash/cloneDeep', () => {
  const cloneDeep = vi.fn((val) => JSON.parse(JSON.stringify(val)));
  return { default: cloneDeep };
});

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n) },
}));

vi.mock('../../services/campaign/campaignService.js', () => ({
  deleteCharacter: vi.fn().mockResolvedValue(undefined),
}));

describe('useCharacterManagement delete filename (create === delete recipe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases = [
    // [display name, expected DELETE target]
    ['QA RunV Wizard', 'QA_RunV_Wizard.json'],
    ['AasimarTest', 'AasimarTest.json'], // case preserved for Linux hosts
    ["Marta O'Neil", 'Marta_O_Neil.json'],
    ['Jean-Luc Picard', 'Jean_Luc_Picard.json'],
    ['Frodo', 'Frodo.json'],
  ];

  it.each(cases)('deletes %s at the true server-written path', async (name, fileName) => {
    const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
    const { result } = renderHook(() => useCharacterManagement('test-campaign'));

    await act(async () => {
      result.current.handleDeleteCharacter(name);
    });

    expect(deleteCharacter).toHaveBeenCalledWith('test-campaign', fileName);
    // The old guess lower-cased and dashed — must never be sent again.
    expect(deleteCharacter).not.toHaveBeenCalledWith(
      'test-campaign',
      `${name.toLowerCase().replace(/\s+/g, '-')}.json`
    );
  });

  it('throws without a campaign and never calls the API', async () => {
    const { deleteCharacter } = await import('../../services/campaign/campaignService.js');
    const { result } = renderHook(() => useCharacterManagement(undefined));

    await expect(
      act(async () => {
        await result.current.handleDeleteCharacter('QA RunV Wizard');
      })
    ).rejects.toThrow('No campaign selected');
    expect(deleteCharacter).not.toHaveBeenCalled();
  });
});
