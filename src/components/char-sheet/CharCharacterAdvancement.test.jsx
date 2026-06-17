import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({
    showPopup: vi.fn(),
    popupHtml: null,
    setPopupHtml: vi.fn(),
  })),
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ html, onClickOrKeyDown }) {
    return (
      <div data-testid="popup" onClick={onClickOrKeyDown}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  },
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../../services/automation/index.js', () => ({
  executeHandler: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: function SpellMasteryModal({ _payload, _onConfirm, _onClose }) {
    return (
      <div data-testid="spell-mastery-modal">
        <span>Spell Mastery Modal</span>
      </div>
    );
  },
}));

vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: function SignatureSpellsModal({ _payload, _onConfirm, _onClose }) {
    return (
      <div data-testid="signature-spells-modal">
        <span>Signature Spells Modal</span>
      </div>
    );
  },
}));

vi.mock('../../services/automation/handlers/class-wizard/spellMasteryHandler.js', () => ({
  onSpellMasterySelected: vi.fn().mockResolvedValue(null),
  handle: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-wizard/signatureSpellsHandler.js', () => ({
  onSignatureSpellsSelected: vi.fn().mockResolvedValue(null),
  handle: vi.fn().mockResolvedValue(null),
}));

const basePlayerStats = {
  name: 'Test Character',
  characterAdvancement: [
    {
      name: 'Feature 1',
      description: 'A feature description',
      details: 'Feature details',
    },
    {
      name: 'Feature 2',
      description: 'Another feature',
    },
  ],
};

const baseProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
};

describe('CharCharacterAdvancement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders character advancement section header', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });

  it('renders feature with name and description', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    expect(screen.getByText('Feature 1:')).toBeInTheDocument();
    expect(screen.getByText('A feature description')).toBeInTheDocument();
  });

  it('renders all features', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    expect(screen.getByText('Feature 1:')).toBeInTheDocument();
    expect(screen.getByText('Feature 2:')).toBeInTheDocument();
  });

  it('renders feature name as clickable when it has details', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    const feature1 = screen.getByText('Feature 1:');
    expect(feature1).toHaveClass('clickable');
  });

  it('renders feature name as non-clickable when no details and no automation', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    const feature2 = screen.getByText('Feature 2:');
    expect(feature2).not.toHaveClass('clickable');
  });

  it('renders feature description as sanitized HTML', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    expect(screen.getByText('A feature description')).toBeInTheDocument();
  });

  it('renders popup when feature with details is clicked', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    const feature1 = screen.getByText('Feature 1:');
    fireEvent.click(feature1);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('renders half-line at end', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    expect(document.querySelector('.half-line')).toBeInTheDocument();
  });

  it('renders empty character advancement when no features', () => {
    const stats = {
      ...basePlayerStats,
      characterAdvancement: [],
    };
    render(<CharCharacterAdvancement playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('renders empty character advancement when null', () => {
    const stats = {
      ...basePlayerStats,
      characterAdvancement: null,
    };
    render(<CharCharacterAdvancement playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });

  it('renders empty character advancement when undefined', () => {
    const stats = {
      ...basePlayerStats,
      characterAdvancement: undefined,
    };
    render(<CharCharacterAdvancement playerStats={stats} {...baseProps} />);
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });
});
