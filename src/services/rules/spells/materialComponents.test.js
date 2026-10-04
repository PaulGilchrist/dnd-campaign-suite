// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetRuntimeValue = vi.fn();
const mockAddEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn((...args) => mockSetRuntimeValue(...args)),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn((...args) => mockAddEntry(...args)),
}));

const {
  getConsumedMaterial,
  hasMaterial,
  consumeMaterial,
  getMaterialRequirementMessage,
} = await import('./materialComponents.js');

// --- Helpers ---

function mockSpell(name) {
  return { name };
}

function mockPlayerStats(backpackItems, name = 'Test Character') {
  return {
    name,
    inventory: { backpack: backpackItems },
  };
}

// Spells that have material components in the registry
const SPELLS_WITH_MATERIALS = [
  'Animate Dead',
  'Create Undead',
  'Arcane Lock',
  'Astral Projection',
  'Awaken',
  'Clone',
  'Continual Flame',
  'Divination',
  'Find Familiar',
  'Forcecage',
  'Gentle Repose',
  'Glyph of Warding',
  'Greater Restoration',
  'Hallow',
  "Heroes' Feast",
  'Illusory Script',
  'Legend Lore',
  'Magic Circle',
  'Magic Mouth',
  'Nondetection',
  'Planar Binding',
  'Protection from Evil and Good',
  'Raise Dead',
  'Reincarnate',
  'Resurrection',
  'Revivify',
  'Sequester',
  'Simulacrum',
  'Stone Skin',
  'Symbol',
  'Teleportation Circle',
  'True Resurrection',
  'True Seeing',
];

// Spells that do NOT have material components
const SPELLS_WITHOUT_MATERIALS = [
  'Fireball',
  'Cure Wounds',
  'Light cantrip',
  'Mage Hand',
];

// --- Tests ---

describe('materialComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConsumedMaterial', () => {
    it('returns null when spell is null', () => {
      expect(getConsumedMaterial(null)).toBeNull();
    });

    it('returns null when spell is undefined', () => {
      expect(getConsumedMaterial(undefined)).toBeNull();
    });

    it('returns null when spell has no name', () => {
      expect(getConsumedMaterial({})).toBeNull();
    });

    it('returns null when spell name is empty string', () => {
      expect(getConsumedMaterial(mockSpell(''))).toBeNull();
    });

    it('returns material info for spells in the registry', () => {
      for (const spellName of SPELLS_WITH_MATERIALS) {
        const result = getConsumedMaterial(mockSpell(spellName));
        expect(result).not.toBeNull();
        expect(result.itemName).toBeDefined();
        expect(result.required).toBeDefined();
      }
    });

    it('returns null for spells not in the registry', () => {
      for (const spellName of SPELLS_WITHOUT_MATERIALS) {
        expect(getConsumedMaterial(mockSpell(spellName))).toBeNull();
      }
    });

    it('returns correct material info for specific spells', () => {
      expect(getConsumedMaterial(mockSpell('Animate Dead'))).toEqual({
        itemName: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
        required: 'a drop of blood, a piece of flesh, and a pinch of bone dust',
      });

      expect(getConsumedMaterial(mockSpell('Create Undead'))).toEqual({
        itemName: 'Black Onyx (150 gp)',
        required: 'one 150+ GP black onyx stone for each corpse',
      });

      expect(getConsumedMaterial(mockSpell('True Resurrection'))).toEqual({
        itemName: 'Diamond (25,000 gp)',
        required: 'diamonds worth 25,000+ GP, which the spell consumes',
      });

      expect(getConsumedMaterial(mockSpell("Heroes' Feast"))).toEqual({
        itemName: 'Gem-Encrusted Bowl (1,000 gp)',
        required: 'a gem-encrusted bowl worth 1,000+ GP, which the spell consumes',
      });
    });

    it('returns correct count of registered spells', () => {
      const allSpellNames = SPELLS_WITH_MATERIALS;
      for (const spellName of allSpellNames) {
        expect(getConsumedMaterial(mockSpell(spellName))).not.toBeNull();
      }
      expect(allSpellNames.length).toBe(33);
    });
  });

  describe('hasMaterial', () => {
    it('returns true when material is in backpack as object', () => {
      const stats = mockPlayerStats([
        { name: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust' },
      ]);
      expect(hasMaterial(stats, 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust')).toBe(true);
    });

    it('returns true when material is in backpack as string', () => {
      const stats = mockPlayerStats(['Drop of Blood, Piece of Flesh, Pinch of Bone Dust']);
      expect(hasMaterial(stats, 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust')).toBe(true);
    });

    it('returns false when material is not in backpack', () => {
      const stats = mockPlayerStats([
        { name: 'Some Other Item' },
      ]);
      expect(hasMaterial(stats, 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust')).toBe(false);
    });

    it('returns false when backpack is empty', () => {
      const stats = mockPlayerStats([]);
      expect(hasMaterial(stats, 'Any Material')).toBe(false);
    });

    it('returns false when backpack is missing', () => {
      const stats = mockPlayerStats(null);
      stats.inventory = {};
      expect(hasMaterial(stats, 'Any Material')).toBe(false);
    });

    it('handles mixed string and object items in backpack', () => {
      const stats = mockPlayerStats([
        'String Item',
        { name: 'Object Item' },
      ]);
      expect(hasMaterial(stats, 'String Item')).toBe(true);
      expect(hasMaterial(stats, 'Object Item')).toBe(true);
      expect(hasMaterial(stats, 'Missing Item')).toBe(false);
    });

    it('returns false when item has no name property', () => {
      const stats = mockPlayerStats([
        {},
        { name: '' },
      ]);
      expect(hasMaterial(stats, 'Some Material')).toBe(false);
    });
  });

  describe('consumeMaterial', () => {
    function mockFetchOk() {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(''),
      });
    }

    it('removes material from backpack and returns true', async () => {
      mockFetchOk();
      const stats = mockPlayerStats([
        'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
        'Other Item',
      ]);

      const result = await consumeMaterial(stats, 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', 'test-campaign');

      expect(result).toBe(true);
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'inventory',
        { backpack: ['Other Item'] },
        'test-campaign',
      );
    });

    it('decrements itemMeta quantity and keeps the backpack string when more remain', async () => {
      mockFetchOk();
      const stats = {
        name: 'Test Character',
        inventory: {
          backpack: ['Incense', 'Rations'],
          itemMeta: { Incense: { quantity: 3, description: 'burning' } },
        },
      };

      const result = await consumeMaterial(stats, 'Incense', 'test-campaign');

      expect(result).toBe(true);
      const updated = mockSetRuntimeValue.mock.calls.at(-1)[2];
      expect(updated.backpack).toContain('Incense');
      expect(updated.itemMeta.Incense.quantity).toBe(2);
      expect(updated.itemMeta.Incense.description).toBe('burning');
      expect(hasMaterial(stats, 'Incense')).toBe(true);
    });

    it('zeroes itemMeta quantity and removes the string when the last one is consumed', async () => {
      mockFetchOk();
      const stats = {
        name: 'Test Character',
        inventory: {
          backpack: ['Incense', 'Rations'],
          itemMeta: { Incense: { quantity: 1 } },
        },
      };

      const result = await consumeMaterial(stats, 'Incense', 'test-campaign');

      expect(result).toBe(true);
      const updated = mockSetRuntimeValue.mock.calls.at(-1)[2];
      expect(updated.backpack).toEqual(['Rations']);
      expect(updated.itemMeta.Incense.quantity).toBe(0);
    });

    it('removes material from backpack when items are objects', async () => {
      mockFetchOk();
      const stats = mockPlayerStats([
        { name: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust' },
        { name: 'Other Item' },
      ]);

      const result = await consumeMaterial(stats, 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', 'test-campaign');

      expect(result).toBe(true);
      expect(mockSetRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'inventory',
        { backpack: [{ name: 'Other Item' }] },
        'test-campaign',
      );
    });

    it('returns false when material is not in backpack', async () => {
      const stats = mockPlayerStats(['Some Other Item']);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await consumeMaterial(stats, 'Missing Material', 'test-campaign');

      expect(result).toBe(false);
      expect(mockSetRuntimeValue).not.toHaveBeenCalled();
      expect(mockAddEntry).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[materialComponents] No Missing Material found in backpack for Test Character',
      );

      consoleSpy.mockRestore();
    });

    it('logs material consumption to the campaign log', async () => {
      mockFetchOk();
      const stats = mockPlayerStats([
        'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
      ]);

      const result = await consumeMaterial(stats, 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust', 'test-campaign');

      expect(result).toBe(true);
      expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'material_consumed',
        characterName: 'Test Character',
        material: 'Drop of Blood, Piece of Flesh, Pinch of Bone Dust',
        timestamp: expect.any(Number),
      });
    });

    it('uses correct PATCH URL with encoded names', async () => {
      mockFetchOk();
      const stats = mockPlayerStats(['Some Material'], 'My Character');

      await consumeMaterial(stats, 'Some Material', 'test-campaign');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/campaigns/test-campaign/My_Character.json',
        expect.objectContaining({
          method: 'PATCH',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('handles fetch error gracefully', async () => {
      mockFetchOk();
      const stats = mockPlayerStats(['Some Material']);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Server error'),
      });

      const result = await consumeMaterial(stats, 'Some Material', 'test-campaign');

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[materialComponents] PATCH error body: Server error',
      );

      consoleSpy.mockRestore();
    });

    it('handles special characters in character name for file generation', async () => {
      mockFetchOk();
      const stats = mockPlayerStats(['Some Material'], 'Char @ # $ %');

      await consumeMaterial(stats, 'Some Material', 'test-campaign');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/campaigns/test-campaign/Char________.json',
        expect.any(Object),
      );
    });

    it('handles log entry error gracefully', async () => {
      mockFetchOk();
      const stats = mockPlayerStats(['Some Material']);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAddEntry.mockRejectedValue(new Error('Log error'));

      const result = await consumeMaterial(stats, 'Some Material', 'test-campaign');

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[materialComponents] Error logging material consumption:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getMaterialRequirementMessage', () => {
    it('returns null for spells without material components', () => {
      expect(getMaterialRequirementMessage(mockSpell('Fireball'))).toBeNull();
    });

    it('returns null when spell is null', () => {
      expect(getMaterialRequirementMessage(null)).toBeNull();
    });

    it('returns null when spell has no name', () => {
      expect(getMaterialRequirementMessage({})).toBeNull();
    });

    it('returns formatted message for spells with material components', () => {
      const message = getMaterialRequirementMessage(mockSpell('Animate Dead'));
      expect(message).toBe('Animate Dead requires a drop of blood, a piece of flesh, and a pinch of bone dust, which the spell consumes.');
    });

    it('formats message correctly for Heroes Feast', () => {
      const message = getMaterialRequirementMessage(mockSpell("Heroes' Feast"));
      expect(message).toBe("Heroes' Feast requires a gem-encrusted bowl worth 1,000+ GP, which the spell consumes.");
    });

    it('formats message correctly for Create Undead', () => {
      const message = getMaterialRequirementMessage(mockSpell('Create Undead'));
      expect(message).toBe('Create Undead requires one 150+ GP black onyx stone for each corpse, which the spell consumes.');
    });

    it('includes spell name at the start of the message', () => {
      const message = getMaterialRequirementMessage(mockSpell('True Resurrection'));
      expect(message).toMatch(/^True Resurrection requires/);
    });

    it('ends message with a single "which the spell consumes." suffix', () => {
      const message = getMaterialRequirementMessage(mockSpell('Clone'));
      expect(message).toBe('Clone requires a diamond worth 1,000+ GP, which the spell consumes.');
      expect(message.match(/which the spell consumes/g)).toHaveLength(1);
    });

    it('does not duplicate the consume suffix for Revivify', () => {
      const message = getMaterialRequirementMessage(mockSpell('Revivify'));
      expect(message).toBe('Revivify requires a diamond worth 300+ GP, which the spell consumes.');
    });
  });
});
