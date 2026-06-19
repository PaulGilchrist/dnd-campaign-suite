import { describe, it, expect } from 'vitest';
import { categories5e } from './featureCategories.js';

const {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} = categories5e;

describe('featureCategories5e', () => {
  describe('featuresToIgnore', () => {
    it('should be an array', () => {
      expect(Array.isArray(featuresToIgnore)).toBe(true);
          });

    it('should contain common features to ignore', () => {
      expect(featuresToIgnore).toContain('Ability Score Improvement');
      expect(featuresToIgnore).toContain('Spellcasting');
      expect(featuresToIgnore).toContain('Rage');
      expect(featuresToIgnore).toContain('Extra Attack');
          });

    it('should contain subclass features to ignore', () => {
      expect(featuresToIgnore).toContain('Martial Archetype');
      expect(featuresToIgnore).toContain('Roguish Archetype');
      expect(featuresToIgnore).toContain('Monastic Tradition');
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
