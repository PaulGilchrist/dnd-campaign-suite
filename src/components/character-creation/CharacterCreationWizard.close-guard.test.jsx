// @maintained-by-ai
/**
 * Close-guard lane for CharacterCreationWizard — pins the unsaved-changes
 * toll on the three close paths (footer Cancel / header × / Escape, F11):
 *  - modified draft + close → the IN-APP named keep-progress toll
 *    (shared useReloadGuard + DiscardDraftDialog over DeleteConfirmModal —
 *    Item 7 F11 retired the wizard's surviving native window.confirm, whose
 *    unhandled dialog wedged every automated driver call): Keep (Cancel /
 *    Escape / backdrop) keeps the wizard open with the draft fully intact
 *    and zero writes; `Yes, Discard` answers the close.
 *  - unmodified draft + close → closes silently, NO toll (no friction).
 *  - deep dirty-check via the guard's lodash isEqual against the initial
 *    formData snapshot (edit reverted → clean → no toll).
 *  - edit mode: prefilled draft closes silently; an edit tolls naming the
 *    prefilled character even after the name field is cleared.
 * Footer note: the Cancel label renders only on the FIRST visible step
 * (create = step 1 ruleset, edit = step 2 Basic Info); mid-wizard the left
 * button is Previous, so modified-create Cancel flows route the dirty-edit
 * through step 2, walk Previous back to step 1, then Cancel. While the toll
 * is open TWO "Cancel" buttons exist (footer + dialog) — dialog locators
 * scope through within(dialog).
 * The mock scaffolding mirrors CharacterCreationWizard.integration.test.jsx
 * (data-loading boundary only; the wizard logic under test stays real).
 */
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

beforeEach(() => {
  global.fetch = vi.fn((path) => {
    if (path === '/data/alignments.json') {
      return jsonResponse(['Lawful Good', 'True Neutral', 'Chaotic Evil']);
    }
    return jsonResponse([]);
  });
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
const closeX = () => screen.getByRole('button', { name: 'Close character wizard' });

// The shared toll face: role=dialog, named message, Cancel + Yes, Discard.
const expectToll = async (message) => {
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent(message);
  expect(dialog).toHaveTextContent('Discard Changes?');
  return dialog;
};
const tollKeep = (dialog) => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
const tollDiscard = (dialog) => fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Discard' }));
const expectNoToll = () => expect(screen.queryByRole('dialog')).toBeNull();
const expectWizardOpen = (container) => expect(container.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();

describe('CharacterCreationWizard - unsaved-changes toll', () => {
  describe('create flow', () => {
    it('unmodified draft: Cancel closes instantly with no toll', async () => {
      const { onCancel } = renderWizard();

      fireEvent.click(cancelBtn());

      expectNoToll();
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('unmodified draft: × closes instantly with no toll', async () => {
      const { onCancel } = renderWizard();

      fireEvent.click(closeX());

      expectNoToll();
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('modified draft: Cancel arms the NAMED toll and Yes-Discard closes', async () => {
      const { onCancel } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');
      // Cancel renders only on the first step — walk back with Previous.
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      fireEvent.click(cancelBtn());
      const dialog = await expectToll('Discard changes to "Aragorn"?');
      expect(onCancel).not.toHaveBeenCalled();

      tollDiscard(dialog);
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('modified draft: Keep dismisses the toll and the draft survives intact', async () => {
      const { onCancel, container } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      fireEvent.click(cancelBtn());
      const dialog = await expectToll('Discard changes to "Aragorn"?');

      tollKeep(dialog);
      await waitFor(() => expectNoToll());
      expect(onCancel).not.toHaveBeenCalled();
      expectWizardOpen(container);
      // Draft survived the Keep — the sidebar tab walks back to the Basic
      // step with the typed name intact.
      fireEvent.click(screen.getByRole('button', { name: /Basic Information/ }));
      await screen.findByText('Step 2: Basic Information');
      expect(screen.getByRole('textbox')).toHaveValue('Aragorn');
    });

    it('modified draft: × routes through the same toll (Keep stays open, Discard closes)', async () => {
      const { onCancel } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');

      fireEvent.click(closeX());
      const dialog = await expectToll('Discard changes to "Aragorn"?');
      tollKeep(dialog);
      await waitFor(() => expectNoToll());
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();

      fireEvent.click(closeX());
      tollDiscard(await expectToll('Discard changes to "Aragorn"?'));
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('modified with no name yet: the toll names the operation (new-character draft)', async () => {
      const { onCancel } = renderWizard();
      await enterBasicStep();
      // Dirty WITHOUT a name: pick a non-default alignment (rules pick of
      // '5e' is a no-op — DEFAULT_FORM_DATA.rules is already '5e').
      fireEvent.change(document.querySelector('select'), { target: { value: 'Chaotic Evil' } });

      fireEvent.click(closeX());
      const dialog = await expectToll('Discard this new character draft?');
      tollDiscard(dialog);
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    // F11 (visual audit 2026-11-25, Item 7): Escape rides the SAME close lane
    // as × / Cancel — the wizard was the only overlay that trapped it.
    it('Escape on an unmodified draft closes silently, no toll', async () => {
      const { onCancel } = renderWizard();

      fireEvent.keyDown(window, { key: 'Escape' });

      expectNoToll();
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('Escape on a modified draft arms the named toll; its own Escape answers KEEP', async () => {
      const { onCancel, container } = renderWizard();
      await enterBasicStep();
      typeName('Aragorn');

      fireEvent.keyDown(window, { key: 'Escape' });
      const dialog = await expectToll('Discard changes to "Aragorn"?');
      expect(onCancel).not.toHaveBeenCalled();

      // Escape while the toll is open belongs to the toll (its panel lane
      // answers KEEP — the browser routes keydown from the focused dialog up
      // through the window, so dispatch on the dialog). The wizard lane stays
      // suppressed behind the role="dialog" guard on the same event.
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expectNoToll());
      expect(onCancel).not.toHaveBeenCalled();
      expectWizardOpen(container);
      expect(screen.getByText('Step 2: Basic Information')).toBeInTheDocument();

      // And the wizard's Escape still reaches the toll for the verdict.
      fireEvent.keyDown(window, { key: 'Escape' });
      tollDiscard(await expectToll('Discard changes to "Aragorn"?'));
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });
  });

  describe('edit flow', () => {
    const characterData = {
      ...cloneDeep(DEFAULT_FORM_DATA),
      id: 'edgin-1',
      name: 'Edgin',
      rules: '5e',
    };

    // The edit walk arrives at Basic Information, which is no longer the
    // FIRST step (the Ruleset step is visible in edit mode too): one
    // Previous reaches step 1, where the footer renders Cancel.
    const backToFirstStep = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    it('prefilled unmodified draft: Cancel closes with no toll', async () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      backToFirstStep();
      fireEvent.click(cancelBtn());

      expectNoToll();
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('prefilled unmodified draft: × closes with no toll', async () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      fireEvent.click(closeX());

      expectNoToll();
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('edited draft: the toll names the character; Keep keeps it open', async () => {
      const { onCancel, container } = renderWizard({ characterData, isEditing: true });

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });

      backToFirstStep();
      fireEvent.click(cancelBtn());
      const dialog = await expectToll('Discard changes to "Edgin"?');
      tollKeep(dialog);
      await waitFor(() => expectNoToll());
      expect(onCancel).not.toHaveBeenCalled();
      expectWizardOpen(container);

      // Still on step 1 (where Cancel renders) — re-ask and discard.
      fireEvent.click(cancelBtn());
      tollDiscard(await expectToll('Discard changes to "Edgin"?'));
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('deep check: an edit reverted back to the initial value is clean — no toll', async () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      typeName('Edgin the Wise');
      typeName('Edgin');

      backToFirstStep();
      fireEvent.click(cancelBtn());

      expectNoToll();
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('cleared name on an edited draft still names the prefilled character', async () => {
      const { onCancel } = renderWizard({ characterData, isEditing: true });

      typeName('   ');

      fireEvent.click(closeX());
      const dialog = await expectToll('Discard changes to "Edgin"?');
      tollDiscard(dialog);
      await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });
  });
});
