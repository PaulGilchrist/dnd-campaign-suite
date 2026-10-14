import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

describe('CharCharacterAdvancement - Default Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  it.each([
    { options: ['Option A', 'Option B', 'Option C'], label: 'string' },
    { options: [{ name: 'Opt Alpha' }, { name: 'Opt Beta' }], label: 'object' },
    { options: ['String Option', { name: 'Object Option' }], label: 'mixed' },
  ])('renders %s options when no runtime value exists', ({ options }) => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose Feature',
          description: 'A choice',
          automation: { options },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Choice:')).toBeInTheDocument();
    for (const opt of options) {
      const text = typeof opt === 'object' ? opt.name : opt;
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('renders all options when automation.options has exactly 2 items', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Pick One',
          description: 'Pick one',
          automation: {
            options: ['Alpha', 'Beta'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Choice:')).toBeInTheDocument();
  });
});

describe('CharCharacterAdvancement - Option Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  it('selects a different option and calls setRuntimeValue with correct key', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Choose',
          description: 'Pick',
          automation: {
            options: ['First', 'Second'],
          },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(screen.getByText('Second'));
    await waitFor(() => {
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_Choose_option',
        'Second',
        'test-campaign'
      );
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'buffs-updated' }));
    dispatchSpy.mockRestore();
  });
});

describe('CharCharacterAdvancement - Null/Undefined Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  it.each([null, undefined])('does not render choice section when automation.options is %s', (optionsValue) => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Feature',
          description: 'No options',
          automation: { options: optionsValue },
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Choice:')).not.toBeInTheDocument();
  });

  it.each([null, undefined])('does not crash when automation is %s', (automationValue) => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        {
          name: 'Feature',
          description: 'No automation',
          automation: automationValue,
        },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.getByText('Feature:')).toBeInTheDocument();
    if (automationValue !== undefined) {
      expect(screen.getByText('No automation')).toBeInTheDocument();
    }
  });

  it.each([null, undefined])('handles campaignName being %s', (campaignNameValue) => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        { name: 'Feature', description: 'Desc' },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName={campaignNameValue} />);
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });
});
