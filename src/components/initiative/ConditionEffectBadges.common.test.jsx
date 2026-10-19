// @maintained-by-ai
// Common-lane contract for ConditionEffectBadges: the cross-effect machinery
// only — exact-label dedupe (first spec wins), stable spec-table ordering of
// a mixed-kind render (derived counters, activeBuffs, targetEffects, props),
// target honoring across kinds, and honesty for unknown effect keys.
// Per-effect golden faces live in the sibling lane files (auras #820,
// banished-demiplane #821, control-spells, spell-effects, save-ability,
// ma1012-frozen-grip owns the 'Speed -10' frozen_grip⇄speed_reduction
// collision); click→store removal lives in target-effect-removal /
// effect-removal; empty state lives in ConditionEffectBadges.test.jsx.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

const CREATURE_NAME = 'Alice';
const CAMPAIGN_NAME = 'test-campaign';

function renderBadges({ targetEffects = [], effects = {}, buffs = [], ...props } = {}) {
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return buffs;
        return null;
    });
    conditionEffects.computeConditionEffects.mockReturnValue({
        speedReduction: 0,
        attackAdvantageCount: 0,
        attackAdvantageReasons: [],
        targetAdvantageCount: 0,
        targetDisadvantageCount: 0,
        targetAttackDisadvantageCount: 0,
        saveAdvantageCount: 0,
        saveAdvantageReasons: [],
        saveDisadvantageCount: 0,
        saveDisadvantage: [],
        dexSaveAdvantageCount: 0,
        riderSaveDisadvantage: false,
        riderAttackBonus: 0,
        riderCannotOpportunityAttack: false,
        noAdvantageAgainst: false,
        abilityCheckDisadvantageAbilities: null,
        abilityCheckAdvantageAbilities: null,
        abilityCheckAdvantage: false,
        abilityCheckAdvantageReasons: [],
        hasteActive: false,
        barkskinActive: false,
        banePenalty: false,
        ...effects,
    });
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffects}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            {...props}
        />
    );
}

function renderedBadgeLabels() {
    return screen.queryAllByTestId('creature-badge').map(el => el.textContent.trim());
}

describe('ConditionEffectBadges - common badge machinery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dedupes exact-label collisions to the first-built spec and keeps distinct labels separate', () => {
        // Two specs both build the label 'Save Disadv': the rider-save spec
        // (earlier in BADGE_SPECS, tooltip falls back to the shared
        // description) and the hex accumulator (tooltip is the raw label).
        // dedupeByLabel must keep exactly one — the rider one — while the
        // similar-but-distinct 'Save Disadv (STR)' te badge renders on its own.
        renderBadges({
            effects: { riderSaveDisadvantage: true, saveDisadvantageCount: 1 },
            targetEffects: [{ target: CREATURE_NAME, source: 'Gray Ooze', effect: 'ability_save_disadvantage', ability: 'str' }],
        });
        expect(renderedBadgeLabels()).toEqual(['Save Disadv', 'Save Disadv (STR)']);
        // First-wins is observable via tooltip: the rider badge falls back to
        // the EFFECT_DESCRIPTIONS copy, the hex builder would have said just
        // 'Save Disadv'.
        expect(screen.getByText('Save Disadv')).toHaveAttribute('title', 'Has disadvantage on its next saving throw.');
    });

    it('renders the exact badge set in stable spec-table order across all effect kinds', () => {
        // One badge per kind: derived counter (attackAdvantageCount→'Adv'),
        // prop flag (coronaDisadvantage), activeBuffs handler (haste→'Hasted'),
        // targetEffects (silenced) — plus a same-te entry for another creature
        // that must not render, and a doubled advantage count that must stay
        // one badge.
        renderBadges({
            effects: { attackAdvantageCount: 2 },
            targetEffects: [
                { target: CREATURE_NAME, source: 'Bob', effect: 'silenced' },
                { target: 'Bob', source: 'Zzz', effect: 'silenced' },
            ],
            buffs: [{ name: 'Haste', effect: 'haste' }],
            coronaDisadvantage: true,
        });
        expect(renderedBadgeLabels()).toEqual([
            'Adv',
            'Disadv Fire/Radiant',
            'Hasted',
            'Silenced',
        ]);
    });

    it('renders nothing for unknown effect keys on targetEffects and activeBuffs', () => {
        // Honesty: the spec table must not fabricate a badge for effects it
        // does not know how to back.
        renderBadges({
            targetEffects: [{ target: CREATURE_NAME, source: 'Bob', effect: 'not_a_real_effect' }],
            buffs: [{ name: 'Mystery Aura', effect: 'also_not_real' }],
        });
        expect(screen.queryAllByTestId('creature-badge')).toHaveLength(0);
    });
});
