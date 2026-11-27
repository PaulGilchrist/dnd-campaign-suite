// @maintained-by-ai 2026-11-26
// Hook-lane contract for useCharacterWizard: wizard open/close flags, the
// create/edit service wiring (client-side name-normalization mirror, rename
// filename derivation via characterFileName, roster refresh and by-original-name
// list replacement), the CLA-118/CLA-139 stamp CALL wiring on subrace change,
// and the in-app Save Failed dialog face (Item 7 native-alert retirement:
// error.message surfaces VERBATIM — single-owner prefix law).
// Owned ELSEWHERE (do not restate here): POST/PUT URL+body shape and the
// service-side "Failed to ..." prefixes (campaignService.test.js); the stamp
// key/value internals (elfishLineageHandler.test.js, fiendishLegacyHandler.test.js);
// the donning save-then-strip ordering (useCharacterWizard.donning.test.js);
// the level-change toll (useCharacterWizard.level-confirm.test.js); the captured
// edit seed + closeWizards (useCharacterWizard.campaign-switch.test.js).
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/campaign/campaignService.js', () => ({
  createCharacter: vi.fn(),
  updateCharacter: vi.fn(),
}));
vi.mock('../../services/rules/features/mageArmorService.js', () => ({
  endMageArmorOnDonning: vi.fn(async () => true),
}));
vi.mock('../../services/automation/handlers/class-other/elfishLineageHandler.js', () => ({
  stampElfishLineageRuntime: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-other/fiendishLegacyHandler.js', () => ({
  stampFiendishLegacyRuntime: vi.fn(),
}));

import { useCharacterWizard } from './useCharacterWizard.js';
import * as campaignService from '../../services/campaign/campaignService.js';
import { stampElfishLineageRuntime } from '../../services/automation/handlers/class-other/elfishLineageHandler.js';
import { stampFiendishLegacyRuntime } from '../../services/automation/handlers/class-other/fiendishLegacyHandler.js';

const originalConsoleError = console.error;

beforeEach(() => {
  vi.clearAllMocks();
  // Cold-success defaults; failure tests override with mockRejectedValueOnce.
  campaignService.createCharacter.mockResolvedValue({ character: {} });
  campaignService.updateCharacter.mockResolvedValue({});
  global.fetch = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

// The in-app save-failure face (Item 7): children carries the message VERBATIM
// (single-owner prefix law — the hook never re-wraps the service's message).
function expectErrorDialog(result, message) {
  const dialog = result.current.wizardDialog;
  expect(dialog, 'expected the in-app Save Failed dialog to be armed').not.toBeNull();
  expect(dialog.props.title).toBe('Save Failed');
  expect(dialog.props.children).toBe(message);
}

function renderWizard(campaignName = 'TestCampaign') {
  const setCharacters = vi.fn();
  const setActiveCharacter = vi.fn();
  const { result } = renderHook(() => useCharacterWizard(campaignName));
  act(() => {
    result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
  });
  return { result, setCharacters, setActiveCharacter };
}

describe('useCharacterWizard', () => {
  it('opens and closes the create and edit wizard lanes via add/cancel handlers', () => {
    const { result } = renderWizard();

    expect(result.current.showCharacterWizard).toBe(false);
    expect(result.current.showEditCharacterWizard).toBe(false);

    act(() => {
      result.current.handleAddCharacter();
    });
    expect(result.current.showCharacterWizard).toBe(true);

    act(() => {
      result.current.handleWizardCancel();
    });
    expect(result.current.showCharacterWizard).toBe(false);

    act(() => {
      result.current.handleEditCharacter({ name: 'TestChar' });
    });
    expect(result.current.showEditCharacterWizard).toBe(true);

    act(() => {
      result.current.handleEditWizardCancel();
    });
    expect(result.current.showEditCharacterWizard).toBe(false);
  });

  it('create: normalizes the name, hands the payload to the service, sets the created character active, refreshes the roster, closes the wizard', async () => {
    const { result, setCharacters, setActiveCharacter } = renderWizard();
    campaignService.createCharacter.mockResolvedValue({
      character: { name: 'Test Char', class: 'Wizard', id: 'char-1' },
    });
    // The post-create roster refresh is hook-owned inline fetching (not the service).
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: ['Test_Char.json'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Test Char', class: 'Wizard', id: 'char-1' }) });

    await act(async () => {
      await result.current.handleWizardComplete({ name: '  Test   Char ', class: 'Wizard' });
    });

    // Server-mirror normalization happens BEFORE the service call.
    expect(campaignService.createCharacter).toHaveBeenCalledWith(
      'TestCampaign',
      { name: 'Test Char', class: 'Wizard' },
    );
    expect(setActiveCharacter).toHaveBeenCalledWith({ name: 'Test Char', class: 'Wizard', id: 'char-1' });
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/TestCampaign');
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/TestCampaign/Test_Char.json');
    expect(setCharacters).toHaveBeenCalledWith([
      { name: 'Test Char', class: 'Wizard', id: 'char-1' },
    ]);
    expect(result.current.showCharacterWizard).toBe(false);
  });

  it('save with no campaign selected: both lanes arm the dialog with "No campaign selected" and touch no network', async () => {
    const { result } = renderWizard(null);

    await act(async () => {
      await result.current.handleWizardComplete({ name: 'TestChar' });
    });
    expect(console.error).toHaveBeenCalledWith('Error creating character:', expect.any(Error));
    expectErrorDialog(result, 'No campaign selected');
    expect(campaignService.createCharacter).not.toHaveBeenCalled();

    act(() => {
      result.current.handleEditCharacter({ name: 'TestChar' });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'Updated' });
    });
    expect(console.error).toHaveBeenCalledWith('Error updating character:', expect.any(Error));
    expectErrorDialog(result, 'No campaign selected');
    expect(campaignService.updateCharacter).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('create failure arms the Save Failed dialog with the error message VERBATIM (no hook-side prefix)', async () => {
    const { result } = renderWizard();
    // The SERVICE owns the single "Failed to create character: " prefix; the
    // hook must surface it exactly once (the old doubled-prefix bug-face).
    campaignService.createCharacter.mockRejectedValueOnce(
      new Error('Failed to create character: Conflict'),
    );

    await act(async () => {
      await result.current.handleWizardComplete({ name: 'TestChar' });
    });

    expect(console.error).toHaveBeenCalledWith('Error creating character:', expect.any(Error));
    expectErrorDialog(result, 'Failed to create character: Conflict');
  });

  it('rename edit: normalizes the name, derives both filenames from it, replaces the roster entry by the ORIGINAL name, sets the saved character active', async () => {
    const existingCharacters = [{ name: 'Old Name', class: 'Wizard' }];
    const { result, setActiveCharacter } = renderWizard();
    const setCharacters = vi.fn(updater => updater(existingCharacters));
    act(() => {
      result.current.setCharacterCallbacks({ setCharacters, setActiveCharacter });
    });

    act(() => {
      result.current.handleEditCharacter({ name: 'Old Name', class: 'Wizard' });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: '  New   Name ', class: 'Wizard' });
    });

    // Hook seam: filenames come from characterFileName on BOTH names (spaces →
    // underscores), originalFileName carries the pre-rename file (URL/body
    // assembly itself lives in campaignService.test.js).
    expect(campaignService.updateCharacter).toHaveBeenCalledWith(
      'TestCampaign',
      'New_Name.json',
      { name: 'New Name', class: 'Wizard' },
      'Old_Name.json',
    );
    expect(setActiveCharacter).toHaveBeenCalledWith({ name: 'New Name', class: 'Wizard' });
    const newCharacters = setCharacters.mock.calls[0][0](existingCharacters);
    expect(newCharacters).toEqual([{ name: 'New Name', class: 'Wizard' }]);
    expect(result.current.showEditCharacterWizard).toBe(false);
  });

  it('CLA-118/CLA-139 wiring: an Elf subrace change stamps elfish lineage and a Tiefling subrace change stamps fiendish legacy, each with (name, newSubrace, campaign)', async () => {
    const { result } = renderWizard('test-campaign');

    act(() => {
      result.current.handleEditCharacter({ name: 'ElfTest', race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'ElfTest', race: { name: 'Elf', subrace: { name: 'Drow' } } });
    });
    // Raw subrace name goes to the handler; key/value stamping internals are
    // pinned in elfishLineageHandler.test.js / fiendishLegacyHandler.test.js.
    expect(stampElfishLineageRuntime).toHaveBeenCalledWith('ElfTest', 'Drow', 'test-campaign');
    expect(stampFiendishLegacyRuntime).not.toHaveBeenCalled();

    act(() => {
      result.current.handleEditCharacter({ name: 'TieflingTest', race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } } });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'TieflingTest', race: { name: 'Tiefling', subrace: { name: 'Infernal Tiefling' } } });
    });
    expect(stampFiendishLegacyRuntime).toHaveBeenCalledWith('TieflingTest', 'Infernal Tiefling', 'test-campaign');
    expect(stampElfishLineageRuntime).toHaveBeenCalledTimes(1);
  });

  it('CLA-118/CLA-139 wiring: an unchanged subrace or a non-lineage race stamps nothing', async () => {
    const { result } = renderWizard('test-campaign');

    act(() => {
      result.current.handleEditCharacter({ name: 'ElfTest', race: { name: 'Elf', subrace: { name: 'Drow' } } });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'ElfTest', race: { name: 'Elf', subrace: { name: 'Drow' } } });
    });

    act(() => {
      result.current.handleEditCharacter({ name: 'GoliathTest', race: { name: 'Goliath', subrace: { name: 'Mountain' } } });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'GoliathTest', race: { name: 'Goliath', subrace: { name: 'Hill' } } });
    });

    expect(stampElfishLineageRuntime).not.toHaveBeenCalled();
    expect(stampFiendishLegacyRuntime).not.toHaveBeenCalled();
  });

  it('edit failure arms the Save Failed dialog with the service message VERBATIM — the prefix appears exactly once', async () => {
    const { result } = renderWizard();
    campaignService.updateCharacter.mockRejectedValueOnce(
      new Error('Failed to update character: Not Found'),
    );

    act(() => {
      result.current.handleEditCharacter({ name: 'TestChar' });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'TestChar' });
    });

    expect(console.error).toHaveBeenCalledWith('Error updating character:', expect.any(Error));
    expectErrorDialog(result, 'Failed to update character: Not Found');
  });
});
