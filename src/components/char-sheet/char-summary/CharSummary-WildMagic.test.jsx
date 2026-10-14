// @improved-by-ai
//
// Owns: WildSurgeBadge rendering in CharSummary —
//   - one list item per surge effect, "#roll — effect" format
//   - name tooltip (on the item) and duration tooltip (hourglass icon)
//   - "Tamed" special case replacing the roll number
//   - no-render guards: null AND empty array (distinct branches of the
//     `surgeEffects && Array.isArray && length > 0` guard in CharSummary.jsx)
//
// NOT covered here (owned by siblings):
//   - CharSummary-EventHandlers.test.jsx: 'initiative-rolled' event clears
//     surge effects and writes null through the synced setter.
//
// Improvement notes (2026-10-14):
//   - Removed createUseSyncedStateMock/defaultSyncedStateKeys: every branch
//     of that helper returned the same [defaultValue, vi.fn()] except the
//     surge key, so it was noise. Replaced with a focused mockSurgeEffects.
//   - Assertions are now scoped inside the surge list via role queries and
//     check exact item count/text and per-item tooltip presence, so a broken
//     length guard or unconditional duration icon can no longer pass silently.
//   - Restored the empty-array test removed by a previous pass: the null test
//     cannot catch a regression of the `length === 0` guard (null short-circuits
//     before it), so the previous "redundant" judgment was wrong.

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { useSyncedState } from '../../../hooks/runtime/useSyncedState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/Popup.jsx', () => ({ default: ({ children, onClick }) => <div data-testid="popup" onClick={onClick}>{children}</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));
vi.mock('../../common/CreatureBadge.jsx', () => ({ default: ({ label }) => <span data-testid="creature-badge">{label}</span> }));
vi.mock('../../initiative/ConditionEffectBadges.jsx', () => ({ default: () => <div data-testid="condition-effect-badges">Badges</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn(),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative: vi.fn() })),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
    handle: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

/**
 * Serve `value` for the 'wildMagicSurgeEffects' synced-state key; every
 * other key falls back to its own default (all other summary features off).
 */
function mockSurgeEffects(value) {
    vi.mocked(useSyncedState).mockImplementation((_name, key, defaultValue) =>
        key === 'wildMagicSurgeEffects' ? [value, vi.fn()] : [defaultValue, vi.fn()]
    );
}

function renderSummary(surgeEffects) {
    mockSurgeEffects(surgeEffects);
    return render(
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            <CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />
        </DiceRollContext.Provider>
    );
}

describe('CharSummary - Wild Magic Surge Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // CharSummary gates GM-only affordances on hostname; jsdom defaults
        // to localhost, but pin it so the tests stay explicit and hermetic.
        window.location.hostname = 'localhost';
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
        vi.mocked(getRuntimeValue).mockReturnValue(null);
        mockSurgeEffects(null);
    });

    it('renders one list item per surge effect with roll number and tooltips', () => {
        renderSummary([
            { timestamp: 1000, roll: 5, effect: 'Fireball', duration: '1 round' },
            { timestamp: 2000, roll: 12, effect: 'Healing' },
        ]);

        expect(screen.getByText('Surge Effects:')).toBeInTheDocument();

        const list = screen.getByRole('list');
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(2);

        // "#roll — effect" format, with the effect name as item tooltip.
        expect(items[0]).toHaveTextContent('#5 — Fireball');
        expect(items[0]).toHaveAttribute('title', 'Fireball');
        expect(items[1]).toHaveTextContent('#12 — Healing');
        expect(items[1]).toHaveAttribute('title', 'Healing');

        // Duration tooltip only on entries that carry a duration.
        expect(within(items[0]).getByTitle('1 round')).toBeInTheDocument();
        expect(within(items[1]).queryByTitle(/.*/)).not.toBeInTheDocument();
    });

    it("shows 'Tamed' instead of a roll number for tamed surges", () => {
        renderSummary([{ timestamp: 3000, roll: 'tamed', effect: 'Wild Surge' }]);

        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveTextContent('Tamed — Wild Surge');
        expect(items[0].textContent).not.toContain('#');
    });

    it('does not render the surge section when surgeEffects is null', () => {
        renderSummary(null);

        expect(screen.queryByText('Surge Effects:')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('does not render the surge section when surgeEffects is an empty array', () => {
        renderSummary([]);

        expect(screen.queryByText('Surge Effects:')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
});
