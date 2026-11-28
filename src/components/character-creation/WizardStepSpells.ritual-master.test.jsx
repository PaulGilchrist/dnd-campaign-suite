// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepSpells from './WizardStepSpells.jsx';

// Ritual Master step-wiring lane only: modal internals belong to a RitualMasterModal lane,
// generic summary/counts to WizardStepSpells.test.jsx, MI/FT/ST dispatch to .feature-touched.
// MagicInitiate/FeyTouched mocks bisected out: no fixture here selects those feats, so
// those modals never mount in this lane.
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
    { label: 'field absent', extra: {} },
    { label: 'empty array', extra: { ritualMasterSpells: [] } },
    { label: 'empty string', extra: { ritualMasterSpells: '' } },
  ])('auto-opens the modal for an unconfigured holder ($label) and closing it stays banner-free', ({ extra }) => {
    render(<WizardStepSpells {...makeProps({ feats: ['Ritual Master'], ...extra })} />);

    expect(screen.getByTestId('ritual-master-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CloseRitualModal' }));
    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();

    // Unlike Magic Initiate, the RM banner gates on chosen spells (count > 0) —
    // an unconfigured holder who closes the modal must not see the banner
    expect(screen.queryByRole('button', { name: /Edit Ritual Spells/ })).not.toBeInTheDocument();
  });

  it('shows the banner with the exact array cardinality once configured, and clicking it reopens the modal', () => {
    render(<WizardStepSpells {...makeProps({
      feats: ['Ritual Master'],
      ritualMasterSpells: ['Alarm', 'Detect Magic'],
    })} />);

    // Configured (2 spells) — no auto-open, exact-count banner instead
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

  // Fix#34 (pass #394): WizardStepSpells.jsx getEditBannerDescriptors (:109) counted with
  // .length on a raw payload — a STRING 'Alarm' (single-value disk/feature shape,
  // live-verified) yielded 'Alarm'.length = 5 -> bogus 'Edit Ritual Spells (5)' banner
  // post-close. Cardinality verdict: producer RitualMasterModal.jsx:37 writes arrays only;
  // disk row public/campaigns/test-campaign/HexWarlock.json:135 is an array; a string
  // payload is a SINGLE spell, never a comma-list (no join-writer exists; consumer
  // spellCalc2024.js:407/488 normalizes non-array without splitting).
  it('counts a single-value STRING payload as 1 spell, not its character count', () => {
    render(<WizardStepSpells {...makeProps({
      feats: ['Ritual Master'],
      ritualMasterSpells: 'Alarm',
    })} />);

    // String fails the auto-open guard's Array.isArray check — modal opens first;
    // closing it (the live sequence) must show the banner with count 1.
    fireEvent.click(screen.getByRole('button', { name: 'CloseRitualModal' }));
    expect(screen.queryByTestId('ritual-master-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Ritual Spells (5)' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Ritual Spells (1)' })).toBeInTheDocument();
  });
});
