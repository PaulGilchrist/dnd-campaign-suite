// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

  it('renders choice options for string and object option arrays', () => {
    const stringStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'String Choices',
          description: 'A choice',
          automation: {
            options: ['Option A', 'Option B', 'Option C'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={stringStats} campaignName="test-campaign" />);
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();

    cleanup();

    const objectStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Object Choices',
          description: 'A choice',
          automation: {
            options: [{ name: 'Opt 1' }, { name: 'Opt 2' }],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={objectStats} campaignName="test-campaign" />);
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    expect(screen.getByText('Opt 1')).toBeInTheDocument();
    expect(screen.getByText('Opt 2')).toBeInTheDocument();
  });

  it('does not render choice UI when automation is missing, empty, or has a single option', () => {
    const baseStats = {
      name: 'Test Character',
      characterAdvancement: [
        { name: 'No Automation', description: 'No automation at all' },
        { name: 'No Options', description: 'Feature without choice', automation: { type: 'test' } },
        { name: 'Empty Options', description: 'Empty choices', automation: { options: [] } },
        { name: 'Single Option', description: 'Only one choice', automation: { options: ['Only Option'] } },
      ],
    };
    render(<CharCharacterAdvancement playerStats={baseStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
  });

  it('highlights the selected option as bold and underlined, others with reduced opacity', () => {
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

    mockGetRuntimeValue.mockReturnValue('Option B');
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Option B')).toHaveStyle({ fontWeight: 'bold', textDecoration: 'underline' });
    expect(screen.getByText('Option A')).toHaveStyle({ opacity: '0.6' });

    cleanup();
    mockGetRuntimeValue.mockReturnValue(null);
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Option A')).toHaveStyle({ fontWeight: 'bold', textDecoration: 'underline' });
    expect(screen.getByText('Option B')).toHaveStyle({ opacity: '0.6' });
  });

  it('calls setRuntimeValue and dispatches buffs-updated when an option is clicked (string and object options)', async () => {
    const dispatchSpy1 = vi.spyOn(window, 'dispatchEvent');
    const stringStats = {
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
    render(<CharCharacterAdvancement playerStats={stringStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Option B'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_Feature_option',
        'Option B',
        'test-campaign'
      );
      expect(dispatchSpy1).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'buffs-updated' })
      );
    });
    dispatchSpy1.mockRestore();
    cleanup();

    const dispatchSpy2 = vi.spyOn(window, 'dispatchEvent');
    const objectStats = {
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
    render(<CharCharacterAdvancement playerStats={objectStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Opt 2'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_Feature_option',
        'Opt 2',
        'test-campaign'
      );
      expect(dispatchSpy2).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'buffs-updated' })
      );
    });
    dispatchSpy2.mockRestore();
  });

  it('renders choice UI for multiple features with mixed automation', () => {
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
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('First Choice:')).toBeInTheDocument();
    expect(screen.getByText('No Choice:')).toBeInTheDocument();
    expect(screen.getByText('Second Choice:')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });
});
