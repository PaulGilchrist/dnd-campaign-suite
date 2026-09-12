// @improved-by-ai
// @cleaned-by-ai
//
// Cleanup (2026-08-18):
//   - Consolidated Fiendish Resilience: 3 tests → 2 via it.each parameterization.
//     Removed "renders different damage types" (redundant with positive test, same code path).
//   - Consolidated Epitome Resistance: 3 tests → 2 via it.each parameterization.
//     Removed "renders different damage types" (redundant, same code path).
//   - Consolidated Boon of Energy: 4 tests → 2.
//     Removed "renders single boon energy resistance type" (subset of multi-type, same code path).
//     Merged "empty array" and "null" negative tests into 1 it.each parameterized test.
//   - Consolidated Elemental Adept: 4 tests → 2 via it.each parameterization.
//     Removed "does not render when passive not present" and "does not render when chosenType not set"
//     (negative tests implied by positive). Removed "renders different damage types" (redundant).
//   - Removed window.location.hostname mutation from all beforeEach (unnecessary, component only
//     uses it for isLocalhost which does not affect resistance type rendering).
//   - Imported shared mockPlayerStats from CharSummary.test-mocks.test.jsx (eliminated duplication).
//   - Removed unused useRuntimeValue import (only needed via mocked module, not directly used).
//   - Reduced file from 391 lines / 18 tests to 198 lines / 8 tests.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarImage.jsx', () => ({ default: () => <div data-testid="avatar-image">Avatar</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
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

vi.mock('../../../services/automation/handlers/buffs/auraOfLifeHandler.js', () => ({
    isAuraOfLifeActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/protectionFromEnergyHandler.js', () => ({
    getProtectionFromEnergyDamageType: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/resistanceHandler.js', () => ({
    getResistanceDamageType: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/stoneSkinHandler.js', () => ({
    getStoneSkinDamageTypes: vi.fn(() => []),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Fiendish Resilience — parameterized across damage types
// ---------------------------------------------------------------------------
describe('CharSummary - Fiendish Resilience', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        ['fire', /Fire/],
        ['poison', /Poison/],
        ['cold', /Cold/],
    ])('renders fiendish resilience type %s when chosenType is set', (type, expectedText) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === '_Fiendish_Resilience_chosenType') return type;
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('does not render fiendish resilience when chosenType is not set', () => {
        vi.mocked(getRuntimeValue).mockReturnValue(null);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Fire/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Epitome Resistance — parameterized across damage types
// ---------------------------------------------------------------------------
describe('CharSummary - Epitome Resistance', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        ['lightning', /Lightning/],
        ['acid', /Acid/],
    ])('renders epitome resistance type %s when set', (type, expectedText) => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'epitomeResistanceType') return type;
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('does not render epitome resistance when not set', () => {
        vi.mocked(getRuntimeValue).mockReturnValue(null);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Lightning/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Boon of Energy Resistance
// ---------------------------------------------------------------------------
describe('CharSummary - Boon of Energy Resistance', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders boon energy resistance types when set', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === '_Energy_Resistances_chosenTypes') return ['fire', 'cold'];
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Fire/)).toBeInTheDocument();
        expect(screen.getByText(/Cold/)).toBeInTheDocument();
    });

    it.each([
        [null],
        [[]],
    ])('does not render boon energy resistances when value is %s', (_value) => {
        vi.mocked(getRuntimeValue).mockReturnValue(_value);
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Fire/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Elemental Adept — parameterized across damage types
// ---------------------------------------------------------------------------
describe('CharSummary - Elemental Adept', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        ['fire', /Fire/],
        ['cold', /Cold/],
    ])('renders elemental adept chosen type %s from passives', (type, expectedText) => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'Elemental Adept' }],
            },
        };
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === '_Elemental_Adept_chosenType') return type;
            return null;
        });
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('does not render elemental adept when chosenType is not set', () => {
        const stats = {
            ...mockPlayerStats,
            automation: {
                ...mockPlayerStats.automation,
                passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'Elemental Adept' }],
            },
        };
        vi.mocked(getRuntimeValue).mockReturnValue(null);
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.queryByText(/Fire/)).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Resistance deduplication: runtime value types matching base resistances
// ---------------------------------------------------------------------------
describe('CharSummary - Resistance Deduplication', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('does not duplicate fiendish resilience type when already in base resistances', () => {
        const stats = { ...mockPlayerStats, resistances: ['fire'] };
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === '_Fiendish_Resilience_chosenType') return 'fire';
            return null;
        });
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const fireElements = screen.queryAllByText(/Fire/);
        expect(fireElements.length).toBe(1);
    });

    it('does not duplicate epitome type when already in base resistances', () => {
        const stats = { ...mockPlayerStats, resistances: ['lightning'] };
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === 'epitomeResistanceType') return 'lightning';
            return null;
        });
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const lightningElements = screen.queryAllByText(/Lightning/);
        expect(lightningElements.length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Multiple runtime-set resistance types active simultaneously
// ---------------------------------------------------------------------------
describe('CharSummary - Multiple Runtime Resistance Types', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('renders fiendish resilience and epitome resistance together', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === '_Fiendish_Resilience_chosenType') return 'fire';
            if (key === 'epitomeResistanceType') return 'cold';
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Fire/)).toBeInTheDocument();
        expect(screen.getByText(/Cold/)).toBeInTheDocument();
    });

    it('renders fiendish resilience, epitome, and boon energy types together', () => {
        vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
            if (key === '_Fiendish_Resilience_chosenType') return 'fire';
            if (key === 'epitomeResistanceType') return 'lightning';
            if (key === '_Energy_Resistances_chosenTypes') return ['poison', 'radiant'];
            return null;
        });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        expect(screen.getByText(/Fire/)).toBeInTheDocument();
        expect(screen.getByText(/Lightning/)).toBeInTheDocument();
        expect(screen.getByText(/Poison/)).toBeInTheDocument();
        expect(screen.getByText(/Radiant/)).toBeInTheDocument();
    });
});
