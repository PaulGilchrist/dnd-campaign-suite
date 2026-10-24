// @maintained-by-ai
// MA-0104: banished_demiplane te renders its own badge (monster legendary
// Banish, Adult Gold Dragon) — honest non-concentration tooltip, distinct
// from the PC spell `banishment` badge. GM removal filters only this te and
// leaves a same-target banishment te in place.
//
// Lane ownership (do not re-pin here):
// - Badge render mechanics / localhost gating / counts: CreatureBadge +
//   ConditionEffectBadges.auras.test.jsx (#820).
// - Wrong-target exclusion via findDirect: the generic machinery is covered
//   by ConditionEffectBadges.control-spells.test.jsx:71-77 and
//   auras.test.jsx:84-87 — banished_demiplane shares the identical
//   findDirect shape (jsx:457), so no wrong-target pin here.
// - Generic target_effect remove-click dispatch:
//   ConditionEffectBadges.target-effect-removal.test.jsx:104-138 (tests
//   'banishment' there; the banished_demiplane payload pin lives here).
// - PC spell banishment permanent/concentration tooltips:
//   ConditionEffectBadges.control-spells.test.jsx:143-159.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

// Isolate the banish lane: badge presence is driven purely by the
// targetEffects array, not by derived condition aggregation (owned by
// ConditionEffectBadges.test.jsx).
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({})),
}));

const CREATURE_NAME = 'ElderPaladin';
const CAMPAIGN_NAME = 'test-campaign';
const DRAGON = 'Adult Gold Dragon 1';

// The te shape saveProcessing writes on a failed dragon Banish save.
const demiplaneTe = (target = CREATURE_NAME) => ({
    target,
    effect: 'banished_demiplane',
    source: DRAGON,
    duration: 'until_start_of_attacker_next_turn',
});

function renderBadges(targetEffects) {
    getRuntimeValue.mockImplementation((name, key) =>
        name === 'campaign' && key === 'targetEffects' ? targetEffects : null
    );
    computeConditionEffects.mockReturnValue({});
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffects}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
        />
    );
}

describe('MA-0104 ConditionEffectBadges banished_demiplane badge', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders the monster Banish badge with exact registry bytes and an honest non-concentration tooltip', () => {
        const def = getEffectDefinition('banished_demiplane');
        renderBadges([demiplaneTe()]);

        // Exactly one badge, exactly one GM remove — nothing else leaked in.
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(1);
        expect(screen.getAllByTitle('Remove effect')).toHaveLength(1);

        const badge = screen.getByText(def.label);
        expect(badge.className).toBe(`creature-badge ${def.cls}`);
        expect(badge.querySelector('i').className).toBe(`fa-solid ${def.icon}`);

        const tooltip = badge.getAttribute('title');
        expect(tooltip).toContain(`Banished by ${DRAGON}`);
        expect(tooltip).toContain('demiplane');
        expect(tooltip).toContain("until the start of the dragon's next turn");
        expect(tooltip).toContain('120 ft');
        expect(tooltip).toContain('GM-enforced');
        // MA-0104 honesty contract: monster legendary Banish is NOT
        // concentration (unlike the PC spell badge owned by control-spells).
        expect(tooltip).not.toMatch(/concentration/i);
    });

    it('is a distinct te from PC spell banishment — both badges render, and removing Demiplane spares Banished', () => {
        const def = getEffectDefinition('banished_demiplane');
        const pcBanishment = { target: CREATURE_NAME, effect: 'banishment', source: 'Cleric' };
        const bystander = { target: 'SomeoneElse', effect: 'banishment', source: 'Cleric' };
        renderBadges([demiplaneTe(), pcBanishment, bystander]);

        // Two distinct badges, never conflated (exact count).
        expect(screen.getAllByTestId('creature-badge')).toHaveLength(2);
        expect(screen.getByText(def.label)).toBeInTheDocument();
        expect(screen.getByText('Banished')).toBeInTheDocument();

        // GM remove on the Demiplane badge posts its own effectType filter:
        // the same-target PC banishment te and the bystander te survive.
        const demiplaneRemove = screen.getByText(def.label)
            .parentElement.querySelector('.creature-badge-remove');
        fireEvent.click(demiplaneRemove);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [pcBanishment, bystander],
            CAMPAIGN_NAME
        );
    });
});
