import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';

vi.mock('./MagicInitiateModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="magic-initiate-modal" />),
}));

vi.mock('./FeyTouchedModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="fey-touched-modal" />),
  ShadowTouchedModal: vi.fn(() => <div data-testid="shadow-touched-modal" />),
}));

vi.mock('./RitualMasterModal.jsx', () => ({
  default: vi.fn(({ onClose }) => (
    <div data-testid="ritual-master-modal">
      <span>Ritual Spells</span>
      <button onClick={onClose}>CloseRitualModal</button>
    </div>
  )),
}));

vi.mock('./SelectableList.jsx', () => ({
  default: vi.fn(() => <div data-testid="selectable-list" />),
}));

vi.mock('../../services/rules/spells/spellLimits.js', () => ({
  getSpellLimits: vi.fn(async () => ({ cantrip: 8, spellType: 'known' })),
  validateSpellSelection: vi.fn(async () => ({ valid: true, violations: [] })),
}));

vi.mock('../../services/rules/spells/spellValidation.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getSpellValidationInfo: vi.fn(async () => ({ warnings: [] })),
}));

function makeFormData(overrides = {}) {
  return {
    level: 14,
    rules: '2024',
    class: { name: 'Warlock' },
    abilities: [],
    spells: [],
    feats: ['Ritual Master'],
    ...overrides,
  };
}

const allSpells = [
  { name: 'Eldritch Blast', index: 'eldritch-blast', level: 0, ritual: false, school: 'Evocation', description: ['x'] },
  { name: 'Alarm', index: 'alarm', level: 1, ritual: true, school: 'Abjuration', description: ['x'] },
  { name: 'Identify', index: 'identify', level: 1, ritual: true, school: 'Divination', description: ['x'] },
];

describe('WizardStepSpells — FT-068 Ritual Master picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('auto-opens the Ritual Master modal when the feat is held with no chosen spells (pitfall 34 mirror)', () => {
    render(
      <WizardStepSpells
        formData={makeFormData()}
        allSpells={allSpells}
        onArrayFieldChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('ritual-master-modal')).toBeInTheDocument();
  });

  it('shows the Edit Ritual Spells banner once spells are chosen and reopens the modal on click', () => {
    render(
      <WizardStepSpells
        formData={makeFormData({ ritualMasterSpells: ['Alarm', 'Identify', 'Comprehend Languages', 'Detect Magic', 'Purify Food and Drink'] })}
        allSpells={allSpells}
        onArrayFieldChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();
    const banner = screen.getByRole('button', { name: /Edit Ritual Spells/ });
    fireEvent.click(banner);
    expect(screen.getByTestId('ritual-master-modal')).toBeInTheDocument();
  });

  it('does not render the ritual picker for non-holders', () => {
    render(
      <WizardStepSpells
        formData={makeFormData({ feats: ['Poisoner'] })}
        allSpells={allSpells}
        onArrayFieldChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Ritual Spells/ })).not.toBeInTheDocument();
  });
});
