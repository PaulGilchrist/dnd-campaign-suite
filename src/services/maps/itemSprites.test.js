// @maintained-by-ai
// Lane: itemSprites registry contract — the gate between the Blender sprite
// lane (public/images/items/<type>.png, rendered by PlacedItems/ItemsPanel via
// image href) and the legacy inline SVG <use> fallback. Owned elsewhere: the
// actual <image> wiring (PlacedItems.test.jsx), palette thumbnails
// (ItemsPanel.test.jsx), and the PNG pixels themselves (Blender review pass).
import { describe, it, expect } from 'vitest';
import { itemSpriteHref } from './itemSprites';

const TYPED = ['altar', 'bed', 'door', 'barrel', 'secretDoor', 'web'];

describe('itemSpriteHref', () => {
    it.each(TYPED)('maps %s to its public sprite path', (type) => {
        expect(itemSpriteHref(type)).toBe(`/images/items/${type}.png`);
    });

    it('returns null for creature tokens and unknown/legacy ids (SVG fallback)', () => {
        expect(itemSpriteHref('npc')).toBeNull();
        expect(itemSpriteHref('monster')).toBeNull();
        expect(itemSpriteHref('mystery-prop')).toBeNull();
    });
});
