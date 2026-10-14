// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharGold from './CharGold.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN_NAME = 'test-campaign';

// Renders with a minimal default character; tests override only what they assert.
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

// Editor is HiddenInput: seeding, clamping, and blur commits are covered in
// src/components/common/HiddenInput.test.jsx — these tests cover CharGold's
// own wiring: store precedence, scoping, toggle, and save calls.
function openGoldEditorByMouse() {
  fireEvent.click(getGoldLabel());
  return screen.getByRole('spinbutton');
}

function openGoldEditorByKeyboard() {
  fireEvent.keyDown(getGoldLabel(), { key: 'Enter' });
  return screen.getByRole('spinbutton');
}

describe('CharGold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue(null);
  });

  describe('value display', () => {
    it.each([
      ['runtime store value over inventory.gold', 250, { gold: 500 }, '250'],
      ['stored zero gold as a real value, not an inventory fallback', 0, { gold: 500 }, '0'],
      ['inventory.gold when nothing is stored at runtime', null, { gold: 120 }, '120'],
      ['zero when runtime value and inventory.gold are both missing', null, {}, '0'],
    ])('shows %s', (_case, storedGold, inventory, expected) => {
      useRuntimeValue.mockReturnValue(storedGold);

      renderCharGold({ inventory });

      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(useRuntimeValue).toHaveBeenCalledWith('Test Character', 'gold', CAMPAIGN_NAME);
    });
  });

  describe('editing gold', () => {
    it.each([
      ['a mouse click', openGoldEditorByMouse],
      ['the Enter key', openGoldEditorByKeyboard],
    ])('opens the editor seeded with the current gold on %s, and closes without saving when toggled again', (_case, openEditor) => {
      useRuntimeValue.mockReturnValue(250);
      const { unmount } = renderCharGold();

      expect(openEditor()).toHaveValue(250);

      fireEvent.click(getGoldLabel());

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      unmount();
    });

    it('saves the typed gold to the runtime store on Enter and closes the editor', () => {
      const { unmount } = renderCharGold();
      const input = openGoldEditorByMouse();

      fireEvent.change(input, { target: { value: '750' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'gold', 750, CAMPAIGN_NAME);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      unmount();
    });
  });
});
