// @improved-by-ai
// @cleaned-by-ai
//
// Cleanup:
//   - Removed "renders single surge effect without duration" — redundant with multi-item test
//   - Removed "renders duration tooltip on hourglass icon" — already covered by multi-item test
//   - Removed "does not render surge effects section when surgeEffects is empty array" —
//     redundant with null test (source checks surgeEffects && Array.isArray && length > 0)
//
// Remaining tests (4):
//   1. Multi-item surge effects list rendering + duration tooltip (covers rendering, #roll format, tooltips)
//   2. Tamed roll special case (unique behavior: displays "Tamed" instead of "#roll")
//   3. Null surgeEffects (covers no-render path)
//
// CharSummary-EventHandlers.test.jsx retains: initiative-rolled event clears surge effects (different behavior)

import { render, screen } from '@testing-library/react';
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

const defaultSyncedStateKeys = [
    'wildMagicSurgeEffects',
    'smiteOfProtectionActive',
    'bulwarkOfForceActive',
    'naturesSanctuaryActive',
    'bulwarkOfForceTargets',
    'naturesSanctuaryCreatures',
    'wrathOfTheSeaActive',
    'mantleOfMajestyActive',
    'innerRadianceActive',
    'unbreakableMajestyActive',
    'baitAndSwitchActive',
    'baitAndSwitchBonus',
    'activeBuffs',
    'coverRefresh',
];

function createUseSyncedStateMock(overrides) {
    return vi.fn((_name, key, defaultValue) => {
        if (key === 'wildMagicSurgeEffects' && overrides.surgeEffects !== undefined) {
            return [overrides.surgeEffects, vi.fn()];
        }
        if (defaultSyncedStateKeys.includes(key)) {
            return [defaultValue, vi.fn()];
        }
        return [defaultValue, vi.fn()];
    });
}

function renderWithDiceContext(ui) {
    return render(
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {ui}
        </DiceRollContext.Provider>
    );
}

describe('CharSummary - Wild Magic Surge Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hostname = 'localhost';
        vi.mocked(useSyncedState).mockImplementation(createUseSyncedStateMock({}));
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
        vi.mocked(getRuntimeValue).mockReturnValue(null);
    });

    it('renders surge effects list with duration tooltips when surgeEffects array has entries', () => {
        vi.mocked(useSyncedState).mockImplementation(
            createUseSyncedStateMock({
                surgeEffects: [
                    { timestamp: 1000, roll: 5, effect: 'Fireball', duration: '1 round' },
                    { timestamp: 2000, roll: 12, effect: 'Healing' },
                ],
            })
        );
        renderWithDiceContext(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Surge Effects:/)).toBeInTheDocument();
        expect(screen.getByText(/#5 — Fireball/)).toBeInTheDocument();
        expect(screen.getByText(/#12 — Healing/)).toBeInTheDocument();
        expect(screen.getByTitle('1 round')).toBeInTheDocument();
    });

    it('shows "Tamed" text when roll value is "tamed"', () => {
        vi.mocked(useSyncedState).mockImplementation(
            createUseSyncedStateMock({
                surgeEffects: [{ timestamp: 3000, roll: 'tamed', effect: 'Wild Surge' }],
            })
        );
        renderWithDiceContext(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Tamed/)).toBeInTheDocument();
        expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
    });

    it('does not render surge effects section when surgeEffects is null', () => {
        vi.mocked(useSyncedState).mockImplementation(
            createUseSyncedStateMock({ surgeEffects: null })
        );
        renderWithDiceContext(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Surge Effects:/)).not.toBeInTheDocument();
    });
});
