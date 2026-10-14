import { describe, it, expect } from 'vitest';
import * as raceRulesModule from './index.js';
import rules5e from './5e.js';
import rules2024 from './2024.js';

describe('race-rules/index', () => {
  describe('exports', () => {
    it('exports rules5e as the default from 5e.js and rules2024 as the default from 2024.js', () => {
      expect(raceRulesModule.rules5e).toBe(rules5e);
      expect(raceRulesModule.rules2024).toBe(rules2024);
    });

    it('exports only rules5e and rules2024', () => {
      expect(Object.keys(raceRulesModule)).toEqual(['rules5e', 'rules2024']);
    });
  });
});
