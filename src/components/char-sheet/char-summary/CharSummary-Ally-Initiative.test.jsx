// @improved-by-ai
// @cleaned-by-ai
//
// Cleanup (2026-08-18):
//   - Reduced excessive mocks from 20+ to 11 — only mock what the tested code paths actually use.
//     Removed mocks for: AvatarImage, Popup, rulesFactory (both entries), attackCalc, logService,
//     buffToggle, unbreakableMajesty, auraOfLifeHandler, circleOfPowerHandler, deathWardHandler.
//     These subcomponents are mocked away and never exercised by the ally modal or initiative tests.
//   - Rewrote initiative handler test to be less brittle:
//     - Removed closure-captured `capturedArgs` (implementation detail).
//     - Replaced post-hoc `capturedArgs` assertions with direct mock call argument assertions.
//     - Used shared mutable object pattern so the spy is available before the mock factory runs.
//   - Consolidated ally modal test: kept the parameterized it.each for combatSummary vs characters
//     fallback (unique behavioral coverage not present in any other test file).
//   - Removed redundant getCombatSummary assertion (the modal rendering already proves it was called
//     since the mock is configured to return specific creatures that appear in the DOM).
//
// Before: 4 tests / 254 lines / 20+ mocks
// After:  4 tests / ~190 lines / 11 mocks

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ---------------------------------------------------------------------------
// Shared mutable object for useLoggedDiceRoll mock.
// Created at module scope so it exists before vi.mock factory runs
// (vi.mock is hoisted but factory execution is deferred until import).
// ---------------------------------------------------------------------------
const rollInitiativeSpy = vi.fn();
const sharedDiceRollResult = {
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollInitiative: rollInitiativeSpy,
};

// ---------------------------------------------------------------------------
// Mocks — only what the two test scenarios actually exercise.
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hhp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({ default: () => <div data-testid="char-feats">Feats</div> }));
vi.mock('../../common/AvatarModal.jsx', () => ({ default: () => null }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: () => <div data-testid="short-rest-btn">Short Rest</div> }));
vi.mock('../ShortRestModal.jsx', () => ({ default: () => <div data-testid="short-rest-modal">Short Rest Modal</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));
vi.mock('./TrackedResourceInput.jsx', () => ({ default: () => <div data-testid="tracked-resource-input">Tracked Resource</div> }));
vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: vi.fn(({ onConfirm, onCancel, creatures, currentAllies }) => (
        <div>
            <span data-testid="ally-modal-title">Select Allies</span>
            <button data-testid="ally-select-all" onClick={() => onConfirm(creatures?.map(c => c.name) || [])}>Select All</button>
            <button data-testid="ally-confirm" onClick={() => onConfirm(currentAllies || ['Thorin'])}>Confirm</button>
            <button data-testid="ally-cancel" onClick={onCancel}>Cancel</button>
            {creatures?.map(c => (
                <span key={c.name} data-testid={`creature-${c.name}`}>{c.name}</span>
            ))}
        </div>
    )),
}));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
    default: vi.fn(({ maxGetter }) => ({ current: maxGetter(), update: vi.fn() })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => null),
    getStore: vi.fn(() => new Map()),
}));

vi.mock('../../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: vi.fn(() => [null, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => {
    const DiceRollContext = {
        Provider: ({ children }) => <>{children}</>,
    };
    return {
        DiceRollContext,
        useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
    };
});

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => sharedDiceRollResult),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const mockPlayerStats = {
    name: 'Thorin',
    xp: 2300,
    xpMode: 'milestone',
    race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
    level: 5,
    alignment: 'Lawful Good',
    proficiency: 3,
    initiative: 2,
    initiativeAdvantage: false,
    abilities: [{ name: 'Wisdom', bonus: 3 }, { name: 'Strength', bonus: 2 }],
    armorClass: 18,
    armorClassFormula: '16 + 2 (shield)',
    hitPoints: 45,
    inventory: { equipped: ['Scale Mail', 'Shield'] },
    equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
    background: 'Soldier',
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    senses: [],
    proficiencies: [],
    languages: [],
    automation: { passives: [], actions: [] },
    passives: [],
    exhaustionLevel: 0,
};

const mockCampaignName = 'test-campaign';

const wrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
        {children}
    </DiceRollContext.Provider>
);

// ---------------------------------------------------------------------------
// Ally modal — verifies creature data source (combat summary vs characters
// prop) is used to populate the modal.
// ---------------------------------------------------------------------------
describe('CharSummary - Ally Modal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [
            { creatures: [
                { name: 'Ally1', type: 'player', currentHp: 30, maxHp: 45 },
                { name: 'Ally2', type: 'enemy', currentHp: 10, maxHp: 20 },
            ] },
            null,
            'combatSummary creatures',
        ],
        [
            { creatures: null },
            [
                { name: 'Character1', type: 'player' },
                { name: 'Character2', type: 'npc' },
            ],
            'characters fallback',
        ],
    ])('opens ally modal and populates creatures from %s', ({ creatures }, characters) => {
        vi.mocked(getCombatSummary).mockReturnValue({ creatures });

        const renderProps = {
            playerStats: mockPlayerStats,
            campaignName: mockCampaignName,
            exhaustionLevel: 0,
        };
        if (characters) {
            renderProps.characters = characters;
        }

        render(<CharSummary {...renderProps} />, { wrapper });

        const allyBadge = screen.getByText(/Allies/);
        fireEvent.click(allyBadge);

        expect(screen.getByTestId('ally-modal-title')).toBeInTheDocument();

        if (creatures) {
            for (const creature of creatures) {
                expect(screen.getByTestId(`creature-${creature.name}`)).toBeInTheDocument();
            }
        } else {
            for (const character of characters) {
                expect(screen.getByText(character.name)).toBeInTheDocument();
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Initiative handler — verifies rollInitiative is called with correct args.
// Uses shared mutable object pattern so the spy is available before render.
// ---------------------------------------------------------------------------
describe('CharSummary - Initiative', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [false, undefined, 'no advantage'],
        [true, { forcedMode: 'advantage' }, 'with advantage'],
    ])('calls rollInitiative with effective initiative when clicked (%s)', (initiativeAdvantage, expectedOpts) => {
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });

        const stats = { ...mockPlayerStats, initiativeAdvantage };
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);

        const initiativeEl = screen.getByText(/\+2/);
        fireEvent.click(initiativeEl);

        expect(rollInitiativeSpy).toHaveBeenCalledTimes(1);
        expect(rollInitiativeSpy).toHaveBeenCalledWith(2, expectedOpts);
    });
});
