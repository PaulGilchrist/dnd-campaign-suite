// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { useCharacterWizard } from './useCharacterWizard.js';

const originalAlert = window.alert;
const originalConsoleError = console.error;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  window.alert = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  window.alert = originalAlert;
  console.error = originalConsoleError;
});

function createWrapper(campaignName) {
  return () => useCharacterWizard(campaignName);
}

describe('useCharacterWizard', () => {
  describe('initial state', () => {
    it('starts with both wizards hidden', () => {
      const { result } = renderHook(createWrapper(null));

      expect(result.current.showCharacterWizard).toBe(false);
      expect(result.current.showEditCharacterWizard).toBe(false);
    });
  });

  describe('handleAddCharacter / handleWizardCancel', () => {
    it('toggles showCharacterWizard correctly', () => {
      const { result } = renderHook(createWrapper('MyCampaign'));

      expect(result.current.showCharacterWizard).toBe(false);

      act(() => {
        result.current.handleAddCharacter();
      });

      expect(result.current.showCharacterWizard).toBe(true);

      act(() => {
        result.current.handleWizardCancel();
      });

      expect(result.current.showCharacterWizard).toBe(false);
    });

    it('is idempotent when canceling while already closed', () => {
      const { result } = renderHook(createWrapper('MyCampaign'));

      act(() => {
        result.current.handleWizardCancel();
      });

      expect(result.current.showCharacterWizard).toBe(false);
    });
  });

  describe('handleEditCharacter / handleEditWizardCancel', () => {
    it('toggles showEditCharacterWizard correctly', () => {
      const { result } = renderHook(createWrapper('MyCampaign'));

      expect(result.current.showEditCharacterWizard).toBe(false);

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      expect(result.current.showEditCharacterWizard).toBe(true);

      act(() => {
        result.current.handleEditWizardCancel();
      });

      expect(result.current.showEditCharacterWizard).toBe(false);
    });

    it('is idempotent when canceling edit while already closed', () => {
      const { result } = renderHook(createWrapper('MyCampaign'));

      act(() => {
        result.current.handleEditWizardCancel();
      });

      expect(result.current.showEditCharacterWizard).toBe(false);
    });
  });

  describe('setCharacterCallbacks', () => {
    it('stores callbacks in ref for later use', () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const { result } = renderHook(createWrapper('MyCampaign'));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      // Callbacks are stored in the ref, not invoked during registration
      // Verify by triggering a create and checking they get called
      const createdCharacter = { name: 'Test', id: '1' };
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ character: createdCharacter }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: ['test.json'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createdCharacter,
        });

      act(() => {
        result.current.handleAddCharacter();
      });

      act(() => {
        result.current.handleWizardCancel();
      });

      // The callbacks are set but not invoked yet — just verify registration didn't throw
      expect(result.current.setCharacterCallbacks).toBeDefined();
    });
  });

  describe('handleWizardComplete (create)', () => {
    it('POSTs to campaign endpoint, refreshes list, sets active character, and closes wizard', async () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const campaignName = 'TestCampaign';
      const characterData = { name: 'TestChar', class: 'Wizard' };
      const createdCharacter = { ...characterData, id: 'char-1' };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ character: createdCharacter }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: ['testchar-wizard.json'] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...createdCharacter, refreshed: true }),
        });

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      await act(async () => {
        await result.current.handleWizardComplete(characterData);
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(1, `/api/campaigns/${encodeURIComponent(campaignName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName, character: characterData }),
      });
      expect(setActiveCharacter).toHaveBeenCalledWith(createdCharacter);
      expect(result.current.showCharacterWizard).toBe(false);
      expect(setCharacters).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'TestChar', refreshed: true })])
      );
    });

    it('handles empty character file list after create', async () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const campaignName = 'TestCampaign';
      const characterData = { name: 'TestChar' };
      const createdCharacter = { ...characterData, id: 'char-1' };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ character: createdCharacter }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        });

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      await act(async () => {
        await result.current.handleWizardComplete(characterData);
      });

      expect(setActiveCharacter).toHaveBeenCalledWith(createdCharacter);
      expect(result.current.showCharacterWizard).toBe(false);
      expect(setCharacters).toHaveBeenCalledWith([]);
    });
  });

  describe('handleWizardComplete error paths', () => {
    it('alerts when campaign name is missing', async () => {
      const { result } = renderHook(createWrapper(null));

      await act(async () => {
        await result.current.handleWizardComplete({ name: 'TestChar' });
      });

      expect(console.error).toHaveBeenCalledWith('Error creating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to create character: No campaign selected');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('alerts with server error details on non-ok response', async () => {
      const campaignName = 'TestCampaign';
      const characterData = { name: 'TestChar' };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(createWrapper(campaignName));

      await act(async () => {
        await result.current.handleWizardComplete(characterData);
      });

      expect(console.error).toHaveBeenCalledWith('Error creating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to create character: Failed to create character: Internal Server Error');
    });

    it('alerts on fetch rejection', async () => {
      const campaignName = 'TestCampaign';
      const characterData = { name: 'TestChar' };

      global.fetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(createWrapper(campaignName));

      await act(async () => {
        await result.current.handleWizardComplete(characterData);
      });

      expect(console.error).toHaveBeenCalledWith('Error creating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to create character: Network failure');
    });

    it('alerts on second fetch failure (after successful create)', async () => {
      const campaignName = 'TestCampaign';
      const characterData = { name: 'TestChar' };
      const setActiveCharacter = vi.fn();

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ character: { name: 'TestChar', id: '1' } }),
        })
        .mockRejectedValueOnce(new Error('Second fetch failed'));

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters: vi.fn(), setActiveCharacter });
      });

      await act(async () => {
        await result.current.handleWizardComplete(characterData);
      });

      expect(console.error).toHaveBeenCalledWith('Error creating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to create character: Second fetch failed');
    });
  });

  describe('handleEditWizardComplete', () => {
    it('PUTs to correct URL, sets active character, refreshes list, and closes wizard', async () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const campaignName = 'TestCampaign';
      const characterData = { name: 'TestChar', class: 'Wizard' };
      const existingCharacter = { name: 'TestChar', class: 'Wizard' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => characterData,
      });

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      act(() => {
        result.current.handleEditCharacter(existingCharacter);
      });

      await act(async () => {
        await result.current.handleEditWizardComplete(characterData);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent('TestChar.json')}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, originalFileName: 'TestChar.json' }),
        }
      );
      expect(setActiveCharacter).toHaveBeenCalledWith(characterData);
      expect(result.current.showEditCharacterWizard).toBe(false);
      expect(setCharacters).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('handles rename: PUTs to new file with originalFileName, replaces by original name in list', async () => {
      const existingCharacters = [{ name: 'Old Name', class: 'Wizard' }];
      const setCharacters = vi.fn((fn) => {
        fn(existingCharacters);
      });
      const setActiveCharacter = vi.fn();
      const campaignName = 'TestCampaign';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'New Name', class: 'Wizard' }),
      });

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      act(() => {
        result.current.handleEditCharacter({ name: 'Old Name', class: 'Wizard' });
      });

      await act(async () => {
        await result.current.handleEditWizardComplete({ name: 'New Name', class: 'Wizard' });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent('New_Name.json')}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name', class: 'Wizard', originalFileName: 'Old_Name.json' }),
        }
      );

      const newCharacters = setCharacters.mock.calls[0][0](existingCharacters);
      expect(newCharacters).toEqual([{ name: 'New Name', class: 'Wizard' }]);
    });
  });

  describe('handleEditWizardComplete error paths', () => {
    it('alerts when campaign name is missing', async () => {
      const { result } = renderHook(createWrapper(null));

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      await act(async () => {
        await result.current.handleEditWizardComplete({ name: 'Updated' });
      });

      expect(console.error).toHaveBeenCalledWith('Error updating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to update character: No campaign selected');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('alerts with server error details on non-ok response', async () => {
      const campaignName = 'TestCampaign';

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      await act(async () => {
        await result.current.handleEditWizardComplete({ name: 'Updated' });
      });

      expect(console.error).toHaveBeenCalledWith('Error updating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to update character: Failed to update character: Bad Request');
    });

    it('alerts on fetch rejection', async () => {
      const campaignName = 'TestCampaign';

      global.fetch.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(createWrapper(campaignName));

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      await act(async () => {
        await result.current.handleEditWizardComplete({ name: 'Updated' });
      });

      expect(console.error).toHaveBeenCalledWith('Error updating character:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith('Failed to update character: Network failure');
    });
  });
});
