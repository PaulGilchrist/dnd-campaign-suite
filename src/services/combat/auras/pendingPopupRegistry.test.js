import { describe, it, expect } from 'vitest';

import { registerPendingPopupSetter, getPendingPopupSetter } from './pendingPopupRegistry.js';

describe('pendingPopupRegistry', () => {
  // The module uses a singleton Map. Tests rely on unique keys and the
  // delete-on-get behavior to avoid cross-test contamination.

  describe('registerPendingPopupSetter', () => {
    it('should store a setter function for a given promptId', () => {
      const promptId = `test-prompt-1-${Date.now()}`;
      const mockSetter = vi.fn();

      registerPendingPopupSetter(promptId, mockSetter);

      const retrieved = getPendingPopupSetter(promptId);
      expect(retrieved).toBe(mockSetter);
    });

    it('should overwrite an existing setter for the same promptId', () => {
      const promptId = `test-prompt-2-${Date.now()}`;
      const setter1 = vi.fn();
      const setter2 = vi.fn();

      registerPendingPopupSetter(promptId, setter1);
      registerPendingPopupSetter(promptId, setter2);

      const retrieved = getPendingPopupSetter(promptId);
      expect(retrieved).toBe(setter2);
    });

    it('should store different setters for different promptIds', () => {
      const setterA = vi.fn();
      const setterB = vi.fn();
      const idA = `id-a-${Date.now()}`;
      const idB = `id-b-${Date.now()}`;

      registerPendingPopupSetter(idA, setterA);
      registerPendingPopupSetter(idB, setterB);

      expect(getPendingPopupSetter(idA)).toBe(setterA);
      expect(getPendingPopupSetter(idB)).toBe(setterB);
    });
  });

  describe('getPendingPopupSetter', () => {
    it('should return null when no setter is registered for the promptId', () => {
      const result = getPendingPopupSetter(`nonexistent-${Date.now()}`);
      expect(result).toBeNull();
    });

    it('should retrieve and delete the setter (one-time use)', () => {
      const promptId = `test-prompt-delete-${Date.now()}`;
      const mockSetter = vi.fn();

      registerPendingPopupSetter(promptId, mockSetter);

      // First retrieval should return the setter and delete it
      const first = getPendingPopupSetter(promptId);
      expect(first).toBe(mockSetter);

      // Second retrieval should return null (setter was deleted)
      const second = getPendingPopupSetter(promptId);
      expect(second).toBeNull();
    });

    it('should return the stored function and allow it to be called', () => {
      const promptId = `test-prompt-call-${Date.now()}`;
      const mockSetter = vi.fn();

      registerPendingPopupSetter(promptId, mockSetter);

      const setter = getPendingPopupSetter(promptId);
      expect(setter).toBe(mockSetter);

      const testData = { html: '<div>test</div>', value: 42 };
      setter(testData);

      expect(mockSetter).toHaveBeenCalledWith(testData);
    });

    it('should handle string promptIds', () => {
      const promptId = `simple-string-id-${Date.now()}`;
      const mockSetter = vi.fn();

      registerPendingPopupSetter(promptId, mockSetter);

      const retrieved = getPendingPopupSetter(promptId);
      expect(retrieved).toBe(mockSetter);
    });

    it('should handle numeric-looking string promptIds', () => {
      const promptId = `12345-${Date.now()}`;
      const mockSetter = vi.fn();

      registerPendingPopupSetter(promptId, mockSetter);

      const retrieved = getPendingPopupSetter(promptId);
      expect(retrieved).toBe(mockSetter);
    });
  });

  describe('integration', () => {
    it('should support register-then-use-then-reuse cycle with different setters', () => {
      const promptId = `test-reuse-cycle-${Date.now()}`;
      const setter1 = vi.fn();
      const setter2 = vi.fn();

      // Register first setter
      registerPendingPopupSetter(promptId, setter1);

      // Get and use it
      const retrieved1 = getPendingPopupSetter(promptId);
      expect(retrieved1).toBe(setter1);
      retrieved1('first-call-data');
      expect(setter1).toHaveBeenCalledWith('first-call-data');

      // Setter is now deleted, so null
      expect(getPendingPopupSetter(promptId)).toBeNull();

      // Register a new setter for the same promptId
      registerPendingPopupSetter(promptId, setter2);

      // Get and use the new one
      const retrieved2 = getPendingPopupSetter(promptId);
      expect(retrieved2).toBe(setter2);
      retrieved2('second-call-data');
      expect(setter2).toHaveBeenCalledWith('second-call-data');
    });

    it('should work with complex data objects', () => {
      const promptId = `test-complex-data-${Date.now()}`;
      const mockSetter = vi.fn();
      const complexData = {
        html: '<div>complex</div>',
        value: 100,
        nested: { a: 1, b: 2 },
        flags: ['flag1', 'flag2'],
      };

      registerPendingPopupSetter(promptId, mockSetter);
      const setter = getPendingPopupSetter(promptId);
      setter(complexData);

      expect(mockSetter).toHaveBeenCalledWith(complexData);
    });
  });
});
