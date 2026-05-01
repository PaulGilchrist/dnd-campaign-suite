import { describe, it, expect, vi, beforeEach } from 'vitest';
import storage from './storage';

// Mock the utils module
vi.mock('./utils', () => ({
  default: {
    getFirstName: vi.fn((name) => {
      if (!name || typeof name !== 'string') return 'Unknown';
      return name.split(' ')[0];
      })
    }
}));

import utils from './utils';

describe('storage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
    
    // Mock window.location.hostname
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
      configurable: true
      });
    });

  describe('get', () => {
    it('should return parsed JSON object for valid key', () => {
      const testData = { name: 'John', level: 5 };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.get('John');

      expect(result).toEqual(testData);
      });

    it('should return null for non-existent key', () => {
      const result = storage.get('NonExistent');

      expect(result).toBeNull();
      });

    it('should return null for empty localStorage value', () => {
      localStorage.setItem('Empty', '');

      const result = storage.get('Empty');

      expect(result).toBeNull();
      });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('Invalid', 'not valid json');

      // This should throw an error or return null depending on implementation
      expect(() => storage.get('Invalid')).toThrow();
      });

    it('should parse complex nested objects', () => {
      const testData = {
        player: {
          name: 'John',
          stats: {
            abilities: [{ name: 'STR', score: 15 }],
            spells: ['Fireball', 'Magic Missile']
            }
          }
      };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.get('John');

      expect(result.player.name).toBe('John');
      expect(result.player.stats.abilities[0].score).toBe(15);
      expect(result.player.stats.spells).toContain('Fireball');
      });
    });

  describe('set', () => {
    beforeEach(() => {
      // Mock fetch for set method
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      });

    it('should store JSON stringified value in localStorage', () => {
          const testData = { name: 'John', level: 5 };

      storage.set('John', testData);

          const stored = localStorage.getItem('John');
          expect(stored).toBe(JSON.stringify(testData));
           });

    it('should call fetch to sync data', async () => {
      const testData = { name: 'John', level: 5 };
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

      await storage.set('John', testData);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost/api/John/',
        expect.objectContaining({
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
          })
        );
      });

    it('should handle fetch errors silently', async () => {
      const testData = { name: 'John', level: 5 };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      // Should not throw error
      await storage.set('John', testData);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

    it('should store complex nested objects', () => {
      const testData = {
        player: {
          name: 'John',
          stats: {
            abilities: [{ name: 'STR', score: 15 }]
            }
          }
      };

      storage.set('John', testData);

      const stored = localStorage.getItem('John');
      expect(stored).toBe(JSON.stringify(testData));
      });
    });

  describe('getProperty', () => {
    it('should return property value when exists', () => {
      const testData = { name: 'John Doe', level: 5, class: 'Wizard' };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.getProperty('John Doe', 'level');

      expect(result).toBe(5);
      });

    it('should return null when property does not exist', () => {
      const testData = { name: 'John Doe', level: 5 };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.getProperty('John Doe', 'nonExistent');

      expect(result).toBeNull();
      });

    it('should return null when object does not exist', () => {
      const result = storage.getProperty('John Doe', 'level');

      expect(result).toBeNull();
      });

    it('should handle null property value', () => {
      const testData = { name: 'John Doe', level: null };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.getProperty('John Doe', 'level');

      expect(result).toBeNull();
      });

    it('should handle undefined property value', () => {
      const testData = { name: 'John Doe', level: undefined };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.getProperty('John Doe', 'level');

      expect(result).toBeNull();
      });

    it('should use getFirstName to extract key from full name', () => {
      const testData = { name: 'John Doe', level: 5 };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.getProperty('John Doe Smith', 'level');

      expect(result).toBe(5);
      expect(utils.getFirstName).toHaveBeenCalledWith('John Doe Smith');
      });

    it('should handle nested property access', () => {
      const testData = { name: 'John Doe', stats: { level: 5 } };
      localStorage.setItem('John', JSON.stringify(testData));

      const result = storage.getProperty('John Doe', 'stats');

      expect(result).toEqual({ level: 5 });
      });
    });

  describe('setProperty', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      });

    it('should set property on existing object', () => {
      const testData = { name: 'John Doe', level: 5 };
      localStorage.setItem('John', JSON.stringify(testData));

      storage.setProperty('John Doe', 'class', 'Wizard');

      const result = storage.get('John');
      expect(result.class).toBe('Wizard');
      expect(result.level).toBe(5); // Original property unchanged
      });

    it('should create new object if it does not exist', () => {
      storage.setProperty('John Doe', 'level', 5);

      const result = storage.get('John');
      expect(result).toEqual({ level: 5 });
      });

    it('should update existing property value', () => {
      const testData = { name: 'John Doe', level: 5 };
      localStorage.setItem('John', JSON.stringify(testData));

      storage.setProperty('John Doe', 'level', 10);

      const result = storage.get('John');
      expect(result.level).toBe(10);
      });

    it('should handle null value', () => {
      storage.setProperty('John Doe', 'level', null);

      const result = storage.get('John');
      expect(result.level).toBeNull();
      });

    it('should handle undefined value', () => {
      storage.setProperty('John Doe', 'level', undefined);

      const result = storage.get('John');
      expect(result.level).toBeUndefined();
      });

    it('should use getFirstName to extract key from full name', () => {
      storage.setProperty('John Doe Smith', 'level', 5);

      const result = storage.get('John');
      expect(result.level).toBe(5);
      expect(utils.getFirstName).toHaveBeenCalledWith('John Doe Smith');
      });

    it('should call fetch to sync data', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

      await storage.setProperty('John Doe', 'level', 5);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost/api/John/',
        expect.objectContaining({
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: 5 })
          })
        );
      });

    it('should preserve other properties when setting one property', () => {
      const testData = {
        name: 'John Doe',
        level: 5,
        class: 'Wizard',
        race: 'Human',
        spells: ['Fireball']
        };
      localStorage.setItem('John', JSON.stringify(testData));

      storage.setProperty('John Doe', 'level', 10);

      const result = storage.get('John');
      expect(result.level).toBe(10);
      expect(result.class).toBe('Wizard');
      expect(result.race).toBe('Human');
      expect(result.spells).toContain('Fireball');
      });

    it('should handle complex nested objects', () => {
      storage.setProperty('John Doe', 'stats', {
        abilities: [{ name: 'STR', score: 15 }],
        spells: ['Fireball']
        });

      const result = storage.get('John');
      expect(result.stats.abilities[0].score).toBe(15);
      expect(result.stats.spells).toContain('Fireball');
      });
    });

  describe('integration tests', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      });

    it('should get property after setting it', () => {
      storage.setProperty('John Doe', 'level', 5);

      const result = storage.getProperty('John Doe', 'level');

      expect(result).toBe(5);
      });

    it('should update property and retrieve updated value', () => {
      storage.setProperty('John Doe', 'level', 5);
      storage.setProperty('John Doe', 'level', 10);

      const result = storage.getProperty('John Doe', 'level');

      expect(result).toBe(10);
      });

    it('should handle multiple properties', () => {
      storage.setProperty('John Doe', 'level', 5);
      storage.setProperty('John Doe', 'class', 'Wizard');
      storage.setProperty('John Doe', 'race', 'Human');

      const level = storage.getProperty('John Doe', 'level');
      const class_ = storage.getProperty('John Doe', 'class');
      const race = storage.getProperty('John Doe', 'race');

      expect(level).toBe(5);
      expect(class_).toBe('Wizard');
      expect(race).toBe('Human');
      });

    it('should persist data across get/set operations', () => {
      const testData = {
        name: 'John Doe',
        level: 5,
        class: 'Wizard',
        spells: ['Fireball', 'Magic Missile']
        };

      storage.set('John', testData);

      const result = storage.get('John');

      expect(result).toEqual(testData);
      });
    });
});
