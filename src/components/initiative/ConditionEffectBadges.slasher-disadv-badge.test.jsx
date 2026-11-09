// @maintained-by-ai
// FT 2026-11-09 golden lane for the slasher_enhanced_critical badge valence:
// the targetAttackDisadvantageCount channel (conditionEffects :318 →
// combineAttackModes attackerEffects side) is the BEARER's own attack rolls
// being disadvantaged — so the badge must render in the debuff-red family
// (effect-debuff), never buff-blue, and its face must byte-match the registry
// label so picker chip, badge and audit log rows agree. Removal dispatch /
// audit-row ownership stays in target-effect-removal.test.jsx; the generic
// dedupe/wrong-target lanes live in common/auras.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

const VICTIM = 'Alice';
const CAMPAIGN = 'test-campaign';

function slasherEffect(source) {
    return { target: VICTIM, source, effect: 'slasher_enhanced_critical', duration: 'until_start_of_next_turn' };
}

describe('ConditionEffectBadges — slasher attack-disadvantage badge (FT 2026-11-09)', () => {
    beforeEach(() => {
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    it('renders the registry label on a debuff-red badge naming the slasher source', () => {
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={[slasherEffect('Grim the Slasher')]}
                creatureName={VICTIM}
                campaignName={CAMPAIGN}
                isLocalhost={true}
            />
        );
        const def = getEffectDefinition('slasher_enhanced_critical');
        const badge = screen.getByText(def.label);
        expect(badge.closest('.creature-badge')).toHaveClass('effect-debuff');
        expect(badge.getAttribute('title')).toContain('own attack rolls');
        expect(badge.getAttribute('title')).toContain('Grim the Slasher');
    });

    it('keeps the compute-guard-only face (no stored te match) in the debuff family', () => {
        // The channel also folds from derived te (clairvoyant_combatant
        // defender leg) — badge must still render, red family, generic tooltip.
        render(
            <ConditionEffectBadges
                conditions={[]}
                targetEffects={[{ target: VICTIM, effect: 'clairvoyant_combatant', source: 'Seer', defenderDisadvantage: true }]}
                creatureName={VICTIM}
                campaignName={CAMPAIGN}
                isLocalhost={true}
            />
        );
        const def = getEffectDefinition('slasher_enhanced_critical');
        const badge = screen.getByText(def.label);
        expect(badge.closest('.creature-badge')).toHaveClass('effect-debuff');
    });
});
