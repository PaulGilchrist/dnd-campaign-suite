// CharInventory popup content and rendering
//
// Tests removed as duplicates already covered in:
//   CharInventory.popup.test.jsx - full popup HTML with cost/weight/category (line 117-134)
//   CharInventory.rendering.test.jsx - inventory section header rendering (line 33-40)
//
// Kept test (1):
//   KEEP: magic items should not have clickable class (unique assertion — only test checking CSS class on magic items)
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { createRenderComponent } from './charInventory.test-utils.jsx';

describe('CharInventory popup content and rendering', () => {
  let helpers;

  beforeEach(() => {
    helpers = createRenderComponent();
    helpers.setup();
  });

  it('should not render clickable class on magic items', () => {
    const stats = {
      inventory: {
        magicItems: [
          {
            name: 'Magic Sword',
            type: 'Weapon',
            rarity: 'Uncommon',
            description: 'A magical sword.',
          },
        ],
        equipped: [],
        backpack: [],
      },
    };
    helpers.renderComponent(stats);
    const magicItem = screen.getByText(/Magic Sword/);
    expect(magicItem).not.toHaveClass('clickable');
  });
});
