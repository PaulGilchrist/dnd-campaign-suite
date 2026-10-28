// @maintained-by-ai
/**
 * Close-guard lane for CharacterCreationWizard — pins the unsaved-changes
 * guard on the two close paths (footer Cancel / header ×):
 *  - modified draft + close → NAMED native confirm (house pattern, mirrors
 *    `Delete Note "X"?`); dismiss keeps the wizard open, accept closes.
 *  - unmodified draft + close → closes silently, NO confirm (no friction).
 *  - deep dirty-check via lodash isEqual against the initial formData
 *    snapshot (edit reverted → clean → no prompt).
 *  - edit mode: prefilled draft closes silently; an edit prompts naming the
 *    prefilled character even after the name field is cleared.
 * Footer note: the Cancel label only renders on the FIRST visible step
 * (create = step 1 ruleset, edit = step 2 Basic Info); mid-wizard the
 * left button is Previous, so modified-create Cancel flows route the
 * dirty-edit through step 2, walk Previous back to step 1, then Cancel.
 * The mock scaffolding mirrors CharacterCreationWizard.integration.test.jsx
 * (data-loading boundary only; the wizard logic under test stays real).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { DEFAULT_FORM_DATA } from '../../config/constants.js';

vi.mock('../../hooks/wizard/useWizardData.js', () => {
  const FIXTURE = {
    backgrounds: [{ name: 'Soldier' }],
    racesData: [
      { name: 'Human', subraces: [], speed: 30, size: 'Medium', languages: ['Common'] },
      { name: 'Elf', subraces: ['High Elf'], speed: 30, size: 'Medium', languages: ['Elvish'] },
    ],
    allRacesData: [{ name: 'Human' }, { name: 'Elf' }],
    classSubtypes: [{ className: 'Fighter', subtypes: [] }],
    allClassesData: [{ name: 'Fighter' }],
    feats: [],
    magicItems: [],
    isDataLoading: false,
  };
  return { default: () => FIXTURE };
});

const jsonResponse = (body) => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

let confirmSpy;

beforeEach(() => {
  global.fetch = vi.fn((path) => {
    if (path === '/data/alignments.json') {
      return jsonResponse(['Lawful Good', 'True Neutral', 'Chaotic Evil']);
    }
    return jsonResponse([]);
  });
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
});

afterEach(() => {
  confirmSpy.mockRestore();
});

function renderWizard(props = {}) {
  const onCancel = vi.fn();
  const utils = render(
    <CharacterCreationWizard
      onComplete={vi.fn()}
      onCancel={onCancel}
      allClasses={[]}
      characterData={null}
      isEditing={false}
      campaignName="test-campaign"
      existingCharacters={[]}
      {...props}
    />
  );
  return { onCancel, ...utils };
}

// Create flow: pick the ruleset card to reach the Basic step (name input).
async function enterBasicStep() {
  fireEvent.click(screen.getByTestId('rules-option-5e'));
  await screen.findByText('Step 2: Basic Information');
}

function typeName(value) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
}

const cancelBtn = () => screen.getByRole('button', { name: 'Cancel' });
const closeX = () => document.querySelector('.close-btn');

describe('CharacterCreationWizard - unsaved-changes guard', () => {
  describe('create flow', () => {
    it('unmodified draft: Cancel closes instantly with no confirm', () => {
      const { onCancel } = renderWizard();

      fireEvent.click(cancelBtn());

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('unmodified draft: × closes instantly with no confirm', () => {
      const { onCancel } = renderWizard();

      fireEvent.click(closeX());

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('modified draft: Cancel asks a NAMED confirm and accept closes', async () => {
      const { onCancel } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');
      // Cancel renders only on the first step — walk back with Previous.
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      confirmSpy.mockReturnValue(true);

      fireEvent.click(cancelBtn());

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Aragorn"?');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('modified draft: dismissing the confirm keeps the wizard open with the draft intact', async () => {
      const { onCancel, container } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      confirmSpy.mockReturnValue(false);

      fireEvent.click(cancelBtn());

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
      expect(container.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();
      // Draft survived the dismissed confirm — sidebar tab walks back to the
      // Basic step (the ruleset was already picked here, so footer Next would
      // advance too; the tab click is this test's direct route).
      fireEvent.click(screen.getByRole('button', { name: /Basic Information/ }));
      await screen.findByText('Step 2: Basic Information');
      expect(screen.getByRole('textbox')).toHaveValue('Aragorn');
    });

    it('modified draft: × routes through the same guard (dismiss stays open, accept closes)', async () => {
      const { onCancel } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');

      fireEvent.click(closeX());
      expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Aragorn"?');
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();

      confirmSpy.mockReturnValue(true);
      fireEvent.click(closeX());
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('modified with no name yet: confirm names the operation (new-character draft)', async () => {
      const { onCancel } = renderWizard();
      await enterBasicStep();
      // Dirty WITHOUT a name: pick a non-default alignment (rules pick of
      // '5e' is a no-op — DEFAULT_FORM_DATA.rules is already '5e').
      fireEvent.change(document.querySelector('select'), { target: { value: 'Chaotic Evil' } });
      confirmSpy.mockReturnValue(true);

      fireEvent.click(closeX());

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('Discard this new character draft?');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit flow', () => {
    const characterData = {
      ...cloneDeep(DEFAULT_FORM_DATA),
      id: 'edgin-1',
      name: 'Edgin',
      rules: '5e',
    };

    it('prefilled unmodified draft: Cancel closes with no confirm', () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      // Edit wizard starts on Basic Information — Cancel is right there.
      fireEvent.click(cancelBtn());

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('prefilled unmodified draft: × closes with no confirm', () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      fireEvent.click(closeX());

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('edited draft: confirm names the character; cancel-dismiss keeps it open', () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });

      fireEvent.click(cancelBtn());
      expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Edgin"?');
      expect(onCancel).not.toHaveBeenCalled();
      expect(document.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();

      confirmSpy.mockReturnValue(true);
      fireEvent.click(cancelBtn());
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('deep check: an edit reverted back to the initial value is clean — no prompt', () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      typeName('Edgin the Wise');
      typeName('Edgin');

      fireEvent.click(cancelBtn());

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('cleared name on an edited draft still names the prefilled character', () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      typeName('   ');
      confirmSpy.mockReturnValue(true);

      fireEvent.click(closeX());

      expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Edgin"?');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
