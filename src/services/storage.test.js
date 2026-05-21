import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import storage from './storage.js';
import utils from './utils.js';

vi.mock('./utils.js', () => ({
  default: {
    getFirstName: vi.fn((name) => name?.split(' ')[0] || name)
  }
}));

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('should return null for non-existent key', () => {
      const result = storage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return parsed value for existing key', () => {
      const testData = { name: 'Test', value: 123 };
      localStorage.setItem('test-key', JSON.stringify(testData));

      const result = storage.get('test-key');
      expect(result).toEqual(testData);
    });
  });

  describe('set', () => {
    it('should store value in localStorage', () => {
      const testData = { name: 'Test', value: 456 };
      storage.set('test-key', testData);

      const stored = JSON.parse(localStorage.getItem('test-key'));
      expect(stored).toEqual(testData);
    });

    it('should make fetch call to sync', () => {
      const testData = { name: 'Test' };
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock;

      storage.set('TestName', testData, 'TestCampaign');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaigns/TestCampaign/TestName',
        expect.objectContaining({
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: testData })
        })
      );
    });

    it('should handle fetch errors silently', () => {
      const testData = { name: 'Test' };
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock;

      // Should not throw
      expect(() => storage.set('test-key', testData)).not.toThrow();
    });
  });

  describe('getProperty', () => {
    it('should return null when object does not exist', () => {
      const result = storage.getProperty('NonExistent', 'property', 'TestCampaign');
      expect(result).toBeNull();
    });

    it('should return null when property does not exist', () => {
      const testData = { name: 'Test' };
      localStorage.setItem('Test', JSON.stringify(testData));

      const result = storage.getProperty('Test', 'nonExistentProperty', 'TestCampaign');
      expect(result).toBeNull();
    });

    it('should return property value when it exists', () => {
      const testData = { name: 'Test', level: 5 };
      localStorage.setItem('Test', JSON.stringify(testData));

      const result = storage.getProperty('Test', 'level', 'TestCampaign');
      expect(result).toBe(5);
    });

    it('should use utils.getFirstName to get first name', () => {
      const testData = { level: 10 };
      localStorage.setItem('John', JSON.stringify(testData));

      storage.getProperty('John Doe', 'level', 'TestCampaign');

      expect(utils.getFirstName).toHaveBeenCalledWith('John Doe');
    });
  });

  describe('setProperty', () => {
    it('should create new object and set property', () => {
      storage.setProperty('NewName', 'level', 3, 'TestCampaign');

      const stored = JSON.parse(localStorage.getItem('NewName'));
      expect(stored).toEqual({ level: 3 });
    });

    it('should update existing object with new property', () => {
      const testData = { name: 'Test' };
      localStorage.setItem('Test', JSON.stringify(testData));

      storage.setProperty('Test', 'level', 5, 'TestCampaign');

      const stored = JSON.parse(localStorage.getItem('Test'));
      expect(stored).toEqual({ name: 'Test', level: 5 });
    });

    it('should update existing property', () => {
      const testData = { level: 1, name: 'Test' };
      localStorage.setItem('Test', JSON.stringify(testData));

      storage.setProperty('Test', 'level', 10, 'TestCampaign');

      const stored = JSON.parse(localStorage.getItem('Test'));
      expect(stored.level).toBe(10);
    });

    it('should use utils.getFirstName to get first name', () => {
      storage.setProperty('John Doe', 'level', 5, 'TestCampaign');

      expect(utils.getFirstName).toHaveBeenCalledWith('John Doe');
    });
  });
});
