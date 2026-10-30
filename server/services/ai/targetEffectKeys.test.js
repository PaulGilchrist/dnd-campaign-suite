// @maintained-by-ai
// Referee target_effect key allowlist — parser unit + DRIFT GUARD.
// The drift guard is the load-bearing pin: the server parses the registry's
// raw source (it cannot import the module — client runtime hooks), so this
// test proves the parsed set equals the keys of the ACTUAL imported
// TARGET_EFFECT_DEFINITIONS. If the registry format ever changes in a way
// the parser misses, this fails instead of the prompt silently losing keys.
import { describe, it, expect, vi } from 'vitest';
import { parseTargetEffectKeys, loadTargetEffectKeys } from './targetEffectKeys.js';

// The registry module imports the client runtime-store hooks; stub the
// boundary so the pure definitions can be imported inside a server test.
vi.mock('../../../src/hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
import { TARGET_EFFECT_DEFINITIONS } from '../../../src/services/combat/conditions/targetEffectDefinitions.js';

describe('parseTargetEffectKeys', () => {
    it('extracts only definition keys — ignores comments, prose, and dynamic values', () => {
        const source = `
  // te.effect value lives in the runtime store
  {
    effect: 'alpha_key',
    label: 'Alpha',
    description: 'effect: fake inside prose',
  },
  {
    effect: 'beta_2',
  },
  function f() { return { effect: effectKey } }
`;
        expect(parseTargetEffectKeys(source)).toEqual(['alpha_key', 'beta_2']);
    });

    it('dedupes repeated keys', () => {
        expect(parseTargetEffectKeys("effect: 'dup',\neffect: 'dup',")).toEqual(['dup']);
    });
});

describe('loadTargetEffectKeys — drift guard', () => {
    it('parsed key set EXACTLY equals the live registry keys (single source of truth)', () => {
        const parsed = [...loadTargetEffectKeys()].sort();
        const registry = TARGET_EFFECT_DEFINITIONS.map(d => d.effect).sort();
        expect(parsed).toEqual(registry);
        expect(new Set(parsed).size).toBe(parsed.length); // no duplicates
        expect(parsed.length).toBeGreaterThan(100);        // the full registry, not a fragment
    });

    it('carries the keys the referee prompt tests pin', () => {
        const keys = loadTargetEffectKeys();
        expect(keys).toContain('speed_half');
        expect(keys).toContain('redirect_attack');
        expect(keys).not.toContain('poisoned'); // a CONDITION key — not a te key
    });
});
