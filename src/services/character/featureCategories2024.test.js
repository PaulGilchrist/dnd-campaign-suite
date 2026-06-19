import { describe, it, expect } from 'vitest';
import { categories2024 } from './featureCategories.js';

const {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} = categories2024;

describe('featureCategories2024', () => {
  describe('featuresToIgnore', () => {
    it('should be an array', () => {
      expect(Array.isArray(featuresToIgnore)).toBe(true);
         });

    it('should contain common features to ignore', () => {
      expect(featuresToIgnore).toContain('Ability Score Improvement');
      expect(featuresToIgnore).toContain('Feat');
      expect(featuresToIgnore).toContain('Darkvision');
      expect(featuresToIgnore).toContain('Spellcasting');
      expect(featuresToIgnore).toContain('Extra Attack');
         });

    it('should contain subclass features to ignore', () => {
      expect(featuresToIgnore).toContain('Fighter Subclass');
      expect(featuresToIgnore).toContain('Rogue Subclass');
      expect(featuresToIgnore).toContain('Wizard Subclass');
         });
       });

  describe('actions', () => {
    it('should be an array', () => {
      expect(Array.isArray(actions)).toBe(true);
         });
       });

  describe('bonusActions', () => {
    it('should be an array', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
         });
       });

  describe('reactions', () => {
    it('should be an array', () => {
      expect(Array.isArray(reactions)).toBe(true);
         });
       });

  describe('characterAdvancement', () => {
    it('should be an array', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
         });
       });
});
