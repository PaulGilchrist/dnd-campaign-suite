import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharHitPoints from './CharHitPoints.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('./DeathSavingThrows.jsx', () => ({
  default: vi.fn(({ playerStats, campaignName }) => (
    <div data-testid="death-saving-throws">
      Death Saving Throws for {playerStats.name} in {campaignName}
    </div>
  )),
}));

vi.mock('../../../services/combat/conditions/deathSaveRules.js', () => ({}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}));

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js';

const mockPlayerStats = {
  name: 'TestCharacter',
  hitPoints: 10,
};

describe('CharHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useRuntimeValue.mockImplementation((key, prop) => {
      if (prop === 'currentHitPoints') return null;
      if (prop === 'aidHpMaxIncrease') return 0;
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders hit points label with current and max', () => {
    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    expect(screen.getByText(/Hit Points:/)).toBeInTheDocument();
  });

  it('displays current hit points as max when no stored value', () => {
    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    expect(clickable.textContent).toContain('10');
  });

  it('shows stored current HP when available', () => {
    useRuntimeValue.mockImplementation((_key, prop) => {
      if (prop === 'currentHitPoints') return 5;
      if (prop === 'aidHpMaxIncrease') return 0;
      return null;
    });

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('uses aidHpMaxIncrease to calculate effective max HP', () => {
    useRuntimeValue.mockImplementation((_key, prop) => {
      if (prop === 'currentHitPoints') return null;
      if (prop === 'aidHpMaxIncrease') return 3;
      return null;
    });

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    expect(clickable.textContent).toContain('13');
  });

  it('toggles input visibility on click', () => {
    const { container } = render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = container.querySelector('.clickable');
    fireEvent.click(clickable);

    const input = container.querySelector('input[type="number"]');
    expect(input).toBeInTheDocument();
  });

  it('calls setRuntimeValue when current HP is changed', async () => {
    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    fireEvent.click(clickable);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        7,
        'test-campaign'
      );
    });
  });



  it('logs hp_change when HP delta is non-zero', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    fireEvent.click(clickable);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/log'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });

    global.fetch = originalFetch;
  });

  it('resets death saves when HP is set above 0', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    fireEvent.click(clickable);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'deathSaves',
        [false, false, false],
        'test-campaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'deathFailures',
        [false, false, false],
        'test-campaign'
      );
      expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'TestCharacter');
    });

    global.fetch = originalFetch;
  });

  it('renders DeathSavingThrows when current HP is 0 or less', () => {
    useRuntimeValue.mockImplementation((_key, prop) => {
      if (prop === 'currentHitPoints') return 0;
      if (prop === 'aidHpMaxIncrease') return 0;
      return null;
    });

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    expect(screen.getByTestId('death-saving-throws')).toBeInTheDocument();
  });

  it('does not render DeathSavingThrows when HP is positive', () => {
    useRuntimeValue.mockImplementation((_key, prop) => {
      if (prop === 'currentHitPoints') return 5;
      if (prop === 'aidHpMaxIncrease') return 0;
      return null;
    });

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    expect(screen.queryByTestId('death-saving-throws')).not.toBeInTheDocument();
  });

  it('initializes stored HP to max HP if null on mount', () => {
    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      10,
      'test-campaign'
    );
  });

  it('shows text-muted span with cur/max label', () => {
    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    expect(screen.getByText('(cur/max)')).toBeInTheDocument();
  });

  it('handles death-save-result event to update current HP', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const event = new CustomEvent('death-save-result', {
      detail: { targetName: 'TestCharacter', restoredToHp: 8 },
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        8,
        'test-campaign'
      );
    });

    global.fetch = originalFetch;
  });

  it('ignores death-save-result event for different character', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const event = new CustomEvent('death-save-result', {
      detail: { targetName: 'OtherCharacter', restoredToHp: 8 },
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        8,
        'test-campaign'
      );
    });

    global.fetch = originalFetch;
  });

  it('renders clickable div with proper attributes', () => {
    render(
      <CharHitPoints playerStats={mockPlayerStats} campaignName="test-campaign" />
    );

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    expect(clickable).toHaveAttribute('tabindex', '0');
  });
});
