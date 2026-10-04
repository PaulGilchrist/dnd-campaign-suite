import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory itemMeta quantities', () => {
  it('renders quantity suffix from itemMeta and keeps names printable', async () => {
    const { setup, renderComponent } = createRenderComponent();
    setup([]);
    const playerStats = {
      name: 'Testie',
      inventory: {
        backpack: ['Rope, Hempen', 'Torch'],
        equipped: [],
        gold: 0,
        magicItems: [],
        itemMeta: {
          'Rope, Hempen': { quantity: 3, description: 'Fifty feet of sturdy hempen rope.' },
          Torch: { quantity: 1 },
        },
      },
    };

    renderComponent(playerStats);

    expect(screen.getByText(/Rope, Hempen ×3/)).toBeTruthy();
    expect(screen.getByText('Torch')).toBeTruthy();
    expect(screen.queryByText(/×1/)).toBeNull();
  });

  it('prefers itemMeta description in the popup over the equipment database', async () => {
    const helpers = createRenderComponent();
    helpers.setup();
    const playerStats = {
      name: 'Testie',
      inventory: {
        backpack: ['Longsword'],
        equipped: [],
        gold: 0,
        magicItems: [],
        itemMeta: { Longsword: { quantity: 1, description: 'Engraved with elvish runes.' } },
      },
    };

    helpers.renderComponent(playerStats);
    await helpers.clickItemByText('Longsword');

    const html = helpers.setPopupHtmlSpy.mock.calls.at(-1)[0];
    expect(html).toContain('Engraved with elvish runes.');
    expect(html).not.toContain('A common sword.');
  });
});
