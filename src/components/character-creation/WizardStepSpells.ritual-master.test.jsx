// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';

// Ritual Master step-wiring lane only: modal internals belong to a RitualMasterModal lane,
// generic summary/counts to WizardStepSpells.test.jsx, MI/FT/ST dispatch to .feature-touched.
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

// Real 2024 Ritual Master choice: two ritual spells (feat grants 2)
const RITUAL_SPELLS = [
  { name: 'Alarm', index: 'alarm', level: 1, ritual: true, school: 'Abjuration', description: ['x'] },
  { name: 'Detect Magic', index: 'detect-magic', level: 1, ritual: true, school: 'Divination', description: ['x'] },
];

const makeProps = (formData = {}) => ({
  stepNumber: 14,
  formData: {
    class: { name: 'Warlock' },
    level: 14,
    rules: '2024',
    abilities: [],
    spells: [],
    feats: [],
    ...formData,
  },
  allSpells: RITUAL_SPELLS,
  onArrayFieldChange: vi.fn(),
});

describe('WizardStepSpells — FT-068 Ritual Master wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { label: 'field missing', spells: undefined },
    { label: 'empty array', spells: [] },
  ])('auto-opens the modal for a holder with unconfigured spells ($label), and closing it stays banner-free until configured', ({ spells }) => {
    const formData = spells === undefined
      ? { feats: ['Ritual Master'] }
      : { feats: ['Ritual Master'], ritualMasterSpells: spells };
    render(<WizardStepSpells {...makeProps(formData)} />);

    expect(screen.getByTestId('ritual-master-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CloseRitualModal' }));
    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();

    // Unlike Magic Initiate, the RM banner gates on chosen spells —
    // an unconfigured holder who closes the modal must not see the banner
    expect(screen.queryByRole('button', { name: /Edit Ritual Spells/ })).not.toBeInTheDocument();
  });

  it('shows the Edit Ritual Spells banner with the chosen count once configured, and clicking it reopens the modal', () => {
    render(<WizardStepSpells {...makeProps({
      feats: ['Ritual Master'],
      ritualMasterSpells: ['Alarm', 'Detect Magic'],
    })} />);

    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ritual Spells (2)' }));
    expect(screen.getByTestId('ritual-master-modal')).toBeInTheDocument();
  });

  it('renders no ritual modal or banner for a non-holder even with chosen ritual spells on file', () => {
    render(<WizardStepSpells {...makeProps({
      feats: ['Poisoner'],
      ritualMasterSpells: ['Alarm', 'Detect Magic'],
    })} />);

    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Ritual Spells/ })).not.toBeInTheDocument();
  });
});
