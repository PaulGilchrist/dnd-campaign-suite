import { describe, it, expect } from 'vitest';
import {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} from './featureCategories2024.js';

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

    it('should contain action features', () => {
      expect(actions).toContain('Sneak Attack');
      expect(actions).toContain('Eldritch Blast');
          });

    it('should exclude features with automations', () => {
      expect(actions).not.toContain('Action Surge');
      expect(actions).not.toContain('Reckless Attack');
          });
       });

  describe('bonusActions', () => {
    it('should be an array', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
         });

    it('should contain bonus action features', () => {
      expect(bonusActions).toContain('Cunning Action');
      expect(bonusActions).not.toContain('Flurry of Blows');
      expect(bonusActions).not.toContain('Second Wind');
          });
       });

  describe('reactions', () => {
    it('should be an array', () => {
      expect(Array.isArray(reactions)).toBe(true);
         });

    it('should contain reaction features', () => {
      expect(reactions).toContain('Opportunity Attack');
      expect(reactions).not.toContain('Uncanny Dodge');
      expect(reactions).not.toContain('Deflect Attacks');
          });
       });

  describe('characterAdvancement', () => {
    it('should be an array', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
         });

    it('should contain character advancement features', () => {
      expect(characterAdvancement).toContain('Martial Arts');
      expect(characterAdvancement).not.toContain('Expertise');
      expect(characterAdvancement).not.toContain('Metamagic');
      expect(characterAdvancement).not.toContain('Giant Ancestry');
          });
       });
});
