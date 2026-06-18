import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockShowPopup, mockSetPopupHtml, mockGetRuntimeValue, mockSetRuntimeValue, mockExecuteHandler } = vi.hoisted(() => ({
  mockShowPopup: vi.fn(),
  mockSetPopupHtml: vi.fn(),
  mockGetRuntimeValue: vi.fn(),
  mockSetRuntimeValue: vi.fn().mockResolvedValue(undefined),
  mockExecuteHandler: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({
    showPopup: mockShowPopup,
    popupHtml: null,
    setPopupHtml: mockSetPopupHtml,
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

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((feature) => !!(feature?.automation)),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: mockExecuteHandler,
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: function SpellMasteryModal() {
    return <div data-testid="spell-mastery-modal"><span>Spell Mastery Modal</span></div>;
  },
}));

vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: function SignatureSpellsModal() {
    return <div data-testid="signature-spells-modal"><span>Signature Spells Modal</span></div>;
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

describe('CharCharacterAdvancement - Choice Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  it('renders choice options when feature has automation with multiple options (strings)', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Option A', 'Option B', 'Option C'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('renders choice options when feature has automation with multiple options (objects)', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: [{ name: 'Opt 1' }, { name: 'Opt 2' }],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Opt 1')).toBeInTheDocument();
    expect(screen.getByText('Opt 2')).toBeInTheDocument();
  });

  it('does not render choices when feature has single option', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Single Feature',
          description: 'Only one choice',
          automation: {
            options: ['Only Option'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
  });

  it('highlights currently selected option from runtime state', () => {
    mockGetRuntimeValue.mockReturnValue('Option B');
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Option A', 'Option B', 'Option C'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const optionB = screen.getByText('Option B');
    expect(optionB.style.fontWeight).toBe('bold');
    expect(optionB.style.textDecoration).toBe('underline');
    const optionA = screen.getByText('Option A');
    expect(optionA.style.opacity).toBe('0.6');
  });

  it('defaults to first option when no runtime value stored (string options)', () => {
    mockGetRuntimeValue.mockReturnValue(null);
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Option A', 'Option B'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const optionA = screen.getByText('Option A');
    expect(optionA.style.fontWeight).toBe('bold');
    expect(optionA.style.textDecoration).toBe('underline');
  });

  it('calls setRuntimeValue and dispatches event when choice is clicked', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Option A', 'Option B'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Option B'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_Feature_option',
        'Option B',
        'test-campaign'
      );
    });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'buffs-updated' })
    );
    dispatchSpy.mockRestore();
  });

  it('does not render choice UI when automation has no options', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'No Options',
          description: 'Feature without choice',
          automation: { type: 'test' },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
  });

  it('calls setRuntimeValue with object option name when options are objects', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: [{ name: 'Opt 1' }, { name: 'Opt 2' }],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Opt 2'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_Feature_option',
        'Opt 2',
        'test-campaign'
      );
    });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'buffs-updated' })
    );
    dispatchSpy.mockRestore();
  });

  it('renders separator between options', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Alpha', 'Beta'],
          },
        },
      ],
    };
    const { container } = render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const separators = container.querySelectorAll('[style*="opacity: 0.4"]');
    expect(separators.length).toBe(1);
    expect(separators[0]).toHaveTextContent('|');
  });

  it('renders feature without a name using fallback key', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          description: 'Nameless feature',
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Nameless feature')).toBeInTheDocument();
  });

  it('stops choice click propagation to feature handler', async () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Opt A', 'Opt B'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Opt B'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalled();
    });
    expect(mockExecuteHandler).not.toHaveBeenCalled();
  });
});
