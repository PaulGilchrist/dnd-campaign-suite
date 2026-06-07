import { describe, it, expect } from 'vitest';
import {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} from './featureCategories5e.js';

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

    it('should contain action features', () => {
      expect(actions).toContain('Sneak Attack');
      expect(actions).toContain('Eldritch Strike');
      expect(actions).not.toContain('Corona of Light');
      expect(actions).not.toContain('War Priest');
          });
        });

  describe('bonusActions', () => {
    it('should be an array', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
          });

    it('should contain bonus action features', () => {
      expect(bonusActions).toContain('Cunning Action');
      expect(bonusActions).toContain('Combat Wild Shape');
      expect(bonusActions).not.toContain('Frenzy');
          });
        });

  describe('reactions', () => {
    it('should be an array', () => {
      expect(Array.isArray(reactions)).toBe(true);
          });

    it('should contain reaction features', () => {
      expect(reactions).toContain('Wrath of the Storm');
      expect(reactions).not.toContain('Retaliation');
      expect(reactions).not.toContain('Warding Flare');
          });
        });

  describe('characterAdvancement', () => {
    it('should be an array', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
          });

    it('should contain character advancement features', () => {
      expect(characterAdvancement).toContain('Martial Arts');
      expect(characterAdvancement).toContain('Eldritch Invocations');
      expect(characterAdvancement).toContain('Unarmored Defense');
      expect(characterAdvancement).not.toContain('Expertise');
          });
        });
});
