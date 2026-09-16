// MA-0104: banished_demiplane te renders its own badge (monster legendary
// Banish) — honest non-concentration tooltip, distinct from the PC spell
// `banishment` badge. Wrong target excluded; GM-removable on localhost.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionEffectBadges from './ConditionEffectBadges.jsx';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({})),
}));

const CREATURE_NAME = 'ElderPaladin';
const CAMPAIGN_NAME = 'test-campaign';
const DRAGON = 'Adult Gold Dragon 1';

function renderWithTargetEffect(targetEffect) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === CREATURE_NAME && key === 'activeBuffs') return [];
        return null;
    });
    computeConditionEffects.mockReturnValue({});
    return render(
        <ConditionEffectBadges
            conditions={[]}
            targetEffects={targetEffect ? [targetEffect] : []}
            creatureName={CREATURE_NAME}
            campaignName={CAMPAIGN_NAME}
            isLocalhost={true}
        />
    );
}

describe('MA-0104 ConditionEffectBadges banished_demiplane badge', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders the Banished (Demiplane) badge with honest dragon-turn tooltip', () => {
        renderWithTargetEffect({ effect: 'banished_demiplane', target: CREATURE_NAME, source: DRAGON, duration: 'until_start_of_attacker_next_turn' });
        const badge = screen.getByText('Banished (Demiplane)');
        expect(badge).toBeInTheDocument();
        const title = badge.closest('[title]')?.getAttribute('title') || badge.closest('button')?.getAttribute('title');
        expect(title).toMatch(/Banished by Adult Gold Dragon 1/);
        expect(title).toMatch(/demiplane/i);
        expect(title).toMatch(/until the start of the dragon's next turn/i);
        expect(title).toMatch(/120 f/i);
        expect(title).toMatch(/GM-enforced/i);
        expect(title).not.toMatch(/concentration/i);
    });

    it('does not render for a wrong target', () => {
        renderWithTargetEffect({ effect: 'banished_demiplane', target: 'SomeoneElse', source: DRAGON });
        expect(screen.queryByText('Banished (Demiplane)')).not.toBeInTheDocument();
    });

    it('PC spell banishment still renders its own distinct badge', () => {
        renderWithTargetEffect({ effect: 'banishment', target: CREATURE_NAME, source: 'Cleric' });
        expect(screen.getByText('Banished')).toBeInTheDocument();
        expect(screen.queryByText('Banished (Demiplane)')).not.toBeInTheDocument();
    });
});
