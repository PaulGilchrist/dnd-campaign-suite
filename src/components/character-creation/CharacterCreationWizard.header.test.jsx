// @maintained-by-ai
/**
 * Header-title lane for CharacterCreationWizard — pins the wizard title
 * BUILDING (WizardHeader itself is a generic prop pass-through, see
 * WizardHeader.test.jsx):
 *  - edit lane: header reads `Edit "<name>"` with straight double quotes,
 *    sourced from the CAPTURED edit target (`characterData` = the
 *    `editingCharacter` seeded by useCharacterWizard, never the draft's
 *    live name field — a rename mid-edit must not re-title the wizard).
 *  - create lane: header stays `Create New Character`.
 * Mock scaffolding mirrors CharacterCreationWizard.close-guard.test.jsx
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

beforeEach(() => {
  global.fetch = vi.fn((path) => {
    if (path === '/data/alignments.json') {
      return jsonResponse(['Lawful Good', 'True Neutral', 'Chaotic Evil']);
    }
    return jsonResponse([]);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const EDIT_TARGET = {
  ...cloneDeep(DEFAULT_FORM_DATA),
  id: 'war-cleric-1',
  name: 'War_Cleric',
  rules: '5e',
};

function renderWizard(props = {}) {
  return render(
    <CharacterCreationWizard
      onComplete={vi.fn()}
      onCancel={vi.fn()}
      allClasses={[]}
      characterData={null}
      isEditing={false}
      campaignName="test-campaign"
      existingCharacters={[]}
      {...props}
    />
  );
}

const headerTitle = (container) => container.querySelector('.wizard-header h2');

describe('CharacterCreationWizard - header title', () => {
  it('edit lane: header reads Edit "<name>" with straight double quotes', () => {
    const { container } = renderWizard({ characterData: EDIT_TARGET, isEditing: true });

    expect(headerTitle(container).textContent).toBe('Edit "War_Cleric"');
  });

  it('edit lane: title tracks the CAPTURED target, not the draft name field', () => {
    const { container } = renderWizard({ characterData: EDIT_TARGET, isEditing: true });
    // Edit mode lands on Basic Information — rename the draft.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'RenamedCleric' } });

    expect(screen.getByRole('textbox')).toHaveValue('RenamedCleric');
    expect(headerTitle(container).textContent).toBe('Edit "War_Cleric"');
  });

  it('create lane: header stays Create New Character', () => {
    const { container } = renderWizard();

    expect(headerTitle(container).textContent).toBe('Create New Character');
  });
});
