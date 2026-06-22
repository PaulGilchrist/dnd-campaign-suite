// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockGetRuntimeValue, mockSetRuntimeValue } = vi.hoisted(() => ({
  mockGetRuntimeValue: vi.fn(),
  mockSetRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

describe('CharCharacterAdvancement - Choice Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  it('renders choice options when feature has automation with multiple string options', () => {
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

  it('renders choice options when feature has automation with multiple object options', () => {
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
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    expect(screen.getByText('Opt 1')).toBeInTheDocument();
    expect(screen.getByText('Opt 2')).toBeInTheDocument();
  });

  it('does not render choice UI when feature has a single option', () => {
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

  it('does not render choice UI when options array is empty', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Empty Options',
          description: 'Empty choices',
          automation: {
            options: [],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
  });

  it('does not render choice UI when feature has no automation', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'No Automation',
          description: 'No automation at all',
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
  });

  it('highlights the current runtime-selected option as bold and underlined', () => {
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
    expect(optionB).toHaveStyle({ fontWeight: 'bold', textDecoration: 'underline' });
    const optionA = screen.getByText('Option A');
    expect(optionA).toHaveStyle({ opacity: '0.6' });
  });

  it('highlights the first option when no runtime value is stored', () => {
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
    expect(optionA).toHaveStyle({ fontWeight: 'bold', textDecoration: 'underline' });
    const optionB = screen.getByText('Option B');
    expect(optionB).toHaveStyle({ opacity: '0.6' });
  });

  it('does not highlight any option when runtime value does not match any option', () => {
    mockGetRuntimeValue.mockReturnValue('Nonexistent Option');
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
    expect(optionA).toHaveStyle({ opacity: '0.6' });
    const optionB = screen.getByText('Option B');
    expect(optionB).toHaveStyle({ opacity: '0.6' });
  });

  it('calls setRuntimeValue and dispatches buffs-updated event when a string option is clicked', async () => {
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

  it('calls setRuntimeValue with object option name when an object option is clicked', async () => {
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

  it('prevents choice click from triggering the feature handler', async () => {
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
  });

  it('renders a separator between options', () => {
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

  it('renders two separators between three options', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: {
            options: ['Alpha', 'Beta', 'Gamma'],
          },
        },
      ],
    };
    const { container } = render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const separators = container.querySelectorAll('[style*="opacity: 0.4"]');
    expect(separators.length).toBe(2);
  });

  it('renders feature description when feature has no name', () => {
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

  it('renders multiple features in sequence', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'First Feature',
          description: 'First description',
        },
        {
          name: 'Second Feature',
          description: 'Second description',
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText(/First Feature/)).toBeInTheDocument();
    expect(screen.getByText(/Second Feature/)).toBeInTheDocument();
    expect(screen.getByText('First description')).toBeInTheDocument();
    expect(screen.getByText('Second description')).toBeInTheDocument();
  });

  it('renders feature with no name using index-based key fallback', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          description: 'Unnamed feature at index 1',
        },
        {
          name: 'Named Feature',
          description: 'Has a name',
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Unnamed feature at index 1')).toBeInTheDocument();
  });

  it('renders choice UI for multiple features each with options', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'First Choice',
          description: 'First feature with choices',
          automation: {
            options: ['A', 'B'],
          },
        },
        {
          name: 'No Choice',
          description: 'Plain feature',
        },
        {
          name: 'Second Choice',
          description: 'Second feature with choices',
          automation: {
            options: ['X', 'Y', 'Z'],
          },
        },
      ],
    };
    const { container } = render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('First Choice:')).toBeInTheDocument();
    expect(screen.getByText('No Choice:')).toBeInTheDocument();
    expect(screen.getByText('Second Choice:')).toBeInTheDocument();
    const choiceLabels = container.querySelectorAll('span[style*="opacity: 0.7"]');
    expect(choiceLabels.length).toBe(2);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('renders mixed string and object options in the same options array', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Mixed Choice',
          description: 'Has mixed option types',
          automation: {
            options: ['String Option', { name: 'Object Option' }],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    expect(screen.getByText('String Option')).toBeInTheDocument();
    expect(screen.getByText('Object Option')).toBeInTheDocument();
  });

  it('applies choice container styling with marginTop and fontSize', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choice Feature',
          description: 'Has choices',
          automation: {
            options: ['A', 'B'],
          },
        },
      ],
    };
    const { container } = render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const choiceDivs = container.querySelectorAll('div[style]');
    const choiceContainer = Array.from(choiceDivs).find(div =>
      div.getAttribute('style')?.includes('margin-top') && div.getAttribute('style')?.includes('font-size')
    );
    expect(choiceContainer).toBeTruthy();
    expect(choiceContainer).toHaveStyle({ marginTop: '4px', fontSize: '0.9em' });
  });

  it('applies opacity styling to the Choice label', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choice Feature',
          description: 'Has choices',
          automation: {
            options: ['A', 'B'],
          },
        },
      ],
    };
    const { container } = render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const choiceDivs = container.querySelectorAll('div[style]');
    const choiceContainer = Array.from(choiceDivs).find(div =>
      div.getAttribute('style')?.includes('margin-top') && div.getAttribute('style')?.includes('font-size')
    );
    const spans = choiceContainer.querySelectorAll('span[style]');
    const choiceLabel = Array.from(spans).find(span =>
      span.getAttribute('style')?.includes('opacity: 0.7')
    );
    expect(choiceLabel).toBeTruthy();
    expect(choiceLabel).toHaveTextContent('Choice:');
  });

  it('calls setRuntimeValue and dispatches buffs-updated when an object option is clicked', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Object Choice',
          description: 'Object options',
          automation: {
            options: [{ name: 'First Object' }, { name: 'Second Object' }],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Second Object'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Object_Choice_option',
        'Second Object',
        'test-campaign'
      );
    });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'buffs-updated' })
    );
    dispatchSpy.mockRestore();
  });

  it('renders choice options with 4+ options showing correct separators', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Multi Choice',
          description: 'Many options',
          automation: {
            options: ['One', 'Two', 'Three', 'Four'],
          },
        },
      ],
    };
    const { container } = render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    const separators = container.querySelectorAll('[style*="opacity: 0.4"]');
    expect(separators.length).toBe(3);
  });
});
