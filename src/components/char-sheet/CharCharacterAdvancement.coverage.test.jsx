import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

describe('CharCharacterAdvancement - 2024 FeaturesToIgnore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  it('filters out 2024-specific features: Fighter Subclass, Bard Subclass, Feat, Darkvision', () => {
    const playerStats = {
      name: 'Test Character',
      rules: '2024',
      characterAdvancement: [
        { name: 'Fighter Subclass', description: 'Subclass feature' },
        { name: 'Bard Subclass', description: 'Subclass feature' },
        { name: 'Feat', description: 'A feat' },
        { name: 'Darkvision', description: 'See in darkness' },
        { name: 'Keep This', description: 'Should remain' },
      ],
    };
    render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
    expect(screen.queryByText('Fighter Subclass:')).not.toBeInTheDocument();
    expect(screen.queryByText('Bard Subclass:')).not.toBeInTheDocument();
    expect(screen.queryByText('Feat:')).not.toBeInTheDocument();
    expect(screen.queryByText('Darkvision:')).not.toBeInTheDocument();
    expect(screen.getByText('Keep This:')).toBeInTheDocument();
  });
});
