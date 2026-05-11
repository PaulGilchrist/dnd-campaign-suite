import { renderHook, act } from '@testing-library/react';
import { useCharacterWizard } from './use-character-wizard.js';

vi.mock('lodash/cloneDeep', () => ({ default: vi.fn(val => val) }));

const originalAlert = window.alert;

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  window.alert = vi.fn();
});

afterEach(() => {
  window.alert = originalAlert;
});

function setup(campaign) {
  return { useCharacterWizard, campaign };
}

describe('useCharacterWizard', () => {
  describe('initial state', () => {
    it('sets showCharacterWizard and showEditCharacterWizard to false', async () => {
      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      expect(result.current.showCharacterWizard).toBe(false);
      expect(result.current.showEditCharacterWizard).toBe(false);
    });
  });

  describe('handleAddCharacter', () => {
    it('sets showCharacterWizard to true', async () => {
      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.handleAddCharacter();
      });

      expect(result.current.showCharacterWizard).toBe(true);
    });
  });

  describe('handleWizardCancel', () => {
    it('sets showCharacterWizard to false', async () => {
      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.handleAddCharacter();
      });

      expect(result.current.showCharacterWizard).toBe(true);

      act(() => {
        result.current.handleWizardCancel();
      });

      expect(result.current.showCharacterWizard).toBe(false);
    });
  });

  describe('handleEditCharacter', () => {
    it('sets showEditCharacterWizard to true', async () => {
      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      expect(result.current.showEditCharacterWizard).toBe(true);
    });
  });

  describe('handleEditWizardCancel', () => {
    it('sets showEditCharacterWizard to false', async () => {
      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      expect(result.current.showEditCharacterWizard).toBe(true);

      act(() => {
        result.current.handleEditWizardCancel();
      });

      expect(result.current.showEditCharacterWizard).toBe(false);
    });
  });

  describe('setCharacterCallbacks', () => {
    it('registers setCharacters and setActiveCharacter callbacks', async () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      expect(result.current.setCharacterCallbacks).toBeDefined();
    });
  });

  describe('handleWizardComplete (create)', () => {
    it('POSTs to /api/campaigns, sets active character, and refreshes character list', async () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const characterData = { name: 'TestChar', class: 'Wizard' };
      const createdCharacter = { ...characterData, id: 'char-1' };
      const campaignName = 'TestCampaign';

      const { useCharacterWizard, campaign } = setup(campaignName);

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

      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      await act(async () => {
        result.current.handleWizardComplete(characterData);
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenCalledWith(`/api/campaigns/${encodeURIComponent(campaignName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName, character: characterData }),
      });
      expect(setActiveCharacter).toHaveBeenCalledWith(createdCharacter);
      expect(result.current.showCharacterWizard).toBe(false);
      expect(setCharacters).toHaveBeenCalled();
    });
  });

  describe('handleWizardComplete error (no campaign)', () => {
    it('shows alert when no campaign in session storage', async () => {
      const characterData = { name: 'TestChar' };

      const { useCharacterWizard, campaign } = setup(null);
      const { result } = renderHook(() => useCharacterWizard(campaign));

      await act(async () => {
        result.current.handleWizardComplete(characterData);
      });

      expect(window.alert).toHaveBeenCalledWith('Failed to create character: No campaign selected');
    });
  });

  describe('handleWizardComplete error (fetch fail)', () => {
    it('shows alert on non-ok response', async () => {
      const characterData = { name: 'TestChar' };
      const campaignName = 'TestCampaign';

      const { useCharacterWizard, campaign } = setup(campaignName);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useCharacterWizard(campaign));

      await act(async () => {
        result.current.handleWizardComplete(characterData);
      });

      expect(window.alert).toHaveBeenCalledWith('Failed to create character: Failed to create character: Internal Server Error');
    });
  });

  describe('handleEditWizardComplete', () => {
    it('PUTs to correct URL with originalFileName and updates local character list', async () => {
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const characterData = { name: 'TestChar', class: 'Wizard' };
      const campaignName = 'TestCampaign';

      const { useCharacterWizard, campaign } = setup(campaignName);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => characterData,
      });

      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      await act(async () => {
        result.current.handleEditWizardComplete(characterData);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent('testchar.json')}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, originalFileName: 'testchar.json' }),
        }
      );
      expect(setActiveCharacter).toHaveBeenCalledWith(characterData);
      expect(result.current.showEditCharacterWizard).toBe(false);
    });

    it('handles rename: PUTs to new file name with originalFileName, replaces by original name', async () => {
      const existingCharacters = [{ name: 'Old Name', class: 'Wizard' }];
      const setCharacters = vi.fn();
      const setActiveCharacter = vi.fn();
      const campaignName = 'TestCampaign';

      const { useCharacterWizard, campaign } = setup(campaignName);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'New Name', class: 'Wizard' }),
      });

      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
      });

      act(() => {
        result.current.handleEditCharacter({ name: 'Old Name', class: 'Wizard' });
      });

      await act(async () => {
        result.current.handleEditWizardComplete({ name: 'New Name', class: 'Wizard' });
      });

      // Verify the PUT goes to the NEW file name
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/campaigns/${encodeURIComponent(campaignName)}/${encodeURIComponent('new-name.json')}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name', class: 'Wizard', originalFileName: 'old-name.json' }),
        }
      );

      // Verify setCharacters replaces by the ORIGINAL name
      expect(setCharacters).toHaveBeenCalledWith(
        expect.any(Function)
      );
      const newCharacters = setCharacters.mock.calls[0][0](existingCharacters);
      expect(newCharacters).toEqual([{ name: 'New Name', class: 'Wizard' }]);
    });
  });

  describe('handleEditWizardComplete error', () => {
    it('shows alert on failure', async () => {
      const characterData = { name: 'TestChar' };
      const campaignName = 'TestCampaign';

      const { useCharacterWizard, campaign } = setup(campaignName);
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const { result } = renderHook(() => useCharacterWizard(campaign));

      act(() => {
        result.current.handleEditCharacter({ name: 'TestChar' });
      });

      await act(async () => {
        result.current.handleEditWizardComplete(characterData);
      });

      expect(window.alert).toHaveBeenCalledWith('Failed to update character: Failed to update character: Bad Request');
    });
  });
});
