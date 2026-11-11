// @maintained-by-ai
/**
 * backToMapLabel.test.js — unit pin for the shared dynamic Back-button label
 * source (backlog 2026-11-11 JV). Both board toolbars (indoor MapToolbar.jsx,
 * outdoor HexMapToolbar.jsx) title/aria the back button with this helper: an
 * armed map-history top names the map the press will actually pop open; an
 * empty stack keeps the byte-identical "Back to maps" chrome. Entry shape
 * mirrors the App.jsx history-stack entry { mapName, mapDisplayName }.
 */
import { describe, it, expect } from 'vitest';
import { backToMapLabel, BACK_TO_MAPS } from './backToMapLabel.js';

describe('backToMapLabel (dynamic back-button label)', () => {
  it('byte-identical "Back to maps" for an empty stack / legacy hosts', () => {
    expect(BACK_TO_MAPS).toBe('Back to maps');
    for (const target of [undefined, null, {}, { mapName: '' }, { mapName: null }]) {
      expect(backToMapLabel(target)).toBe('Back to maps');
    }
  });

  it('prefers the stack entry display name', () => {
    expect(backToMapLabel({ mapName: 'qa-hex-2', mapDisplayName: 'QA Hex 2' }))
      .toBe('Back to QA Hex 2');
  });

  it('title-cases the slug when the entry carries no display name', () => {
    expect(backToMapLabel({ mapName: 'dungeon-1' })).toBe('Back to Dungeon 1');
    // .json bytes are stripped exactly like the board-header fallback
    expect(backToMapLabel({ mapName: 'inner-cave.json' })).toBe('Back to Inner Cave');
  });

  it('blank displayName still falls back to the slug', () => {
    expect(backToMapLabel({ mapName: 'mysterious-swamp', mapDisplayName: '' }))
      .toBe('Back to Mysterious Swamp');
  });
});
