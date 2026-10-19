// @maintained-by-ai
// Lane: slowEffects.js DIRECT module contract (SP-109 cleanup seam).
// Family map: slowHandler.test.js owns spell apply + triple-scoped re-apply filter;
// createRollConditionSaveHandler.test.jsx owns the consumer seam (mocks this module);
// CharConditions.slow.test.jsx owns the sheet UI strip button;
// conditionEffectsCompute.test.js owns folded() bytes; targetEffectDefinitions.test.js (#820)
// owns the te registry. THIS file is the only direct coverage of
// removeSlowEffectsForTarget/SLOW_TE_EFFECTS store semantics.
//
// Contract (from source, rules math hand-derived once):
//   strip = target+effect filter (NO source scoping — any caster's Slow te for the
//   target goes); exact POST bytes ('campaign','targetEffects',remaining,campaign);
//   write ONLY when something matched (length-differs guard); false + zero POST when
//   nothing matches, including null / non-array store (|| [] and Array.isArray guards).
// Old -> new: test1 strengthened (call-bytes pin + source-agnostic leg, redundant
// post-assertion loop dropped); tests 2+3 consolidated into one it.each falsifier table.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { removeSlowEffectsForTarget } from './slowEffects.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const campaignName = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('removeSlowEffectsForTarget', () => {
    it('POSTs the exact remaining set: strips all 6 slow keys for the target (any source), keeps everything else byte-identical', () => {
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'no_reactions', source: 'Wizard' },
            { target: 'Goblin', effect: 'dex_save_disadvantage', source: 'Wizard' },
            { target: 'Goblin', effect: 'ac_penalty', source: 'Wizard', value: 2 },
            { target: 'Goblin', effect: 'action_limit', source: 'Wizard' },
            { target: 'Goblin', effect: 'single_attack_limit', source: 'Wizard' },
            { target: 'Goblin', effect: 'somatic_failure_chance', source: 'Druid', chance: 25 },
            { target: 'Goblin', effect: 'holy_aura', source: 'Paladin' },
            { target: 'Orc', effect: 'no_reactions', source: 'Wizard' },
        ]);

        expect(removeSlowEffectsForTarget('Goblin', campaignName)).toBe(true);
        // Exact call bytes + exact remaining payload: this single toEqual
        // golden-pins SLOW_TE_EFFECTS membership (all 6 keys stripped),
        // target scoping (Orc survives), and source-agnostic strip (Druid's
        // somatic_failure_chance goes too) — no field-by-field loop needed.
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
            { target: 'Goblin', effect: 'holy_aura', source: 'Paladin' },
            { target: 'Orc', effect: 'no_reactions', source: 'Wizard' },
        ], campaignName);
    });

    it.each([
        ['target has only unrelated te', [{ target: 'Goblin', effect: 'holy_aura', source: 'Paladin' }]],
        ['store is null', null],
        ['store is a truthy non-array', { target: 'Goblin', effect: 'no_reactions', source: 'Wizard' }],
    ])('returns false and never POSTs when nothing matches: %s', (_label, stored) => {
        getRuntimeValue.mockReturnValue(stored);
        expect(removeSlowEffectsForTarget('Goblin', campaignName)).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
