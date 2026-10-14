// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharGold from './CharGold.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN_NAME = 'test-campaign';

// Per-test fixtures: spread overrides over a minimal default character.
function renderCharGold(playerStatsOverrides = {}) {
  return render(
    <CharGold
      playerStats={{ name: 'Test Character', inventory: { gold: 500 }, ...playerStatsOverrides }}
      campaignName={CAMPAIGN_NAME}
    />
  );
}

function getGoldLabel() {
  return screen.getByText('Gold:');
}

function openGoldEditor() {
  fireEvent.click(getGoldLabel());
  return screen.getByRole('spinbutton');
}

describe('CharGold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue(null);
  });

  describe('value display', () => {
    it('shows gold stored in the runtime store in preference to inventory.gold', () => {
      useRuntimeValue.mockReturnValue(250);

      renderCharGold();

      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.queryByText('500')).not.toBeInTheDocument();
    });

    it('treats stored zero gold as a real value instead of falling back to inventory.gold', () => {
      useRuntimeValue.mockReturnValue(0);

      renderCharGold({ inventory: { gold: 500 } });

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.queryByText('500')).not.toBeInTheDocument();
    });

    it('falls back to inventory.gold when nothing is stored at runtime', () => {
      renderCharGold({ inventory: { gold: 120 } });

      expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('falls back to 0 when runtime value and inventory.gold are both missing', () => {
      renderCharGold({ inventory: {} });

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('reads gold from the runtime store scoped to the character and campaign', () => {
      renderCharGold();

      expect(useRuntimeValue).toHaveBeenCalledWith('Test Character', 'gold', CAMPAIGN_NAME);
    });
  });

  describe('editing gold', () => {
    it('opens a numeric editor seeded with the current gold when the display is clicked', () => {
      useRuntimeValue.mockReturnValue(250);

      renderCharGold();
      const input = openGoldEditor();

      expect(input).toHaveValue(250);
    });

    it('opens the editor when Enter is pressed on the gold display (keyboard access)', () => {
      renderCharGold();

      fireEvent.keyDown(getGoldLabel(), { key: 'Enter' });

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('saves the new gold to the runtime store on Enter and closes the editor', () => {
      renderCharGold();
      const input = openGoldEditor();

      fireEvent.change(input, { target: { value: '750' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'gold', 750, CAMPAIGN_NAME);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('saves the new gold to the runtime store when the editor loses focus', () => {
      renderCharGold();
      const input = openGoldEditor();

      fireEvent.change(input, { target: { value: '320' } });
      fireEvent.blur(input);

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'gold', 320, CAMPAIGN_NAME);
    });

    it('clamps negative input up to zero before saving', () => {
      renderCharGold();
      const input = openGoldEditor();

      fireEvent.change(input, { target: { value: '-20' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'gold', 0, CAMPAIGN_NAME);
    });

    it('closes the editor without saving when the display is clicked again', () => {
      renderCharGold();
      expect(openGoldEditor()).toBeInTheDocument();

      fireEvent.click(getGoldLabel());

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
