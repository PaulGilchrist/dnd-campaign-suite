// @maintained-by-ai
//
// CharSummary test lane: ally-modal data source + confirm happy path, and
// click-to-roll initiative (advantage ternary + exhaustion penalty).
// Sibling lanes (do not duplicate here):
//   - Ally modal cancel            → CharSummary-Prerequisites.test.jsx
//   - Ally confirm error paths     → CharSummary-Remaining.test.jsx
//   - effectiveInitiative formula  → CharSummary.test-mocks.test.jsx (calc level)
//   - initiative-rolled event display → CharSummary-EventHandlers.test.jsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import CharSummary from './CharSummary.jsx';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addEntry } from '../../../services/ui/logService.js';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';

// ---------------------------------------------------------------------------
// Mocks — only what the ally-modal and initiative code paths touch.
// ---------------------------------------------------------------------------
const rollInitiative = vi.fn();

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

// AllySelectionModal stand-in: lists the creatures it receives so tests can
// verify which data source populated it, and exposes a confirm action.
// (Cancel behavior is exercised in CharSummary-Prerequisites.test.jsx.)
vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: vi.fn(({ onConfirm, creatures }) => (
        <div data-testid="ally-selection-modal">
            <button data-testid="ally-select-all" onClick={() => onConfirm((creatures || []).map(c => c.name))}>Select All</button>
            {(creatures || []).map(c => (
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
    useSyncedState: vi.fn((_name, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
    showBackgroundPopup: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn(), rollInitiative })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Render helper — wraps in the real DiceRollContext and applies common props.
// ---------------------------------------------------------------------------
function renderSummary(props = {}) {
    render(
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            <CharSummary
                playerStats={mockPlayerStats}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                {...props}
            />
        </DiceRollContext.Provider>
    );
}

function openAllyModal() {
    fireEvent.click(screen.getByText(/Allies \(1\)/));
    return screen.getByTestId('ally-selection-modal');
}

// ---------------------------------------------------------------------------
// Ally modal — which data source populates the creature list.
// ---------------------------------------------------------------------------
describe('CharSummary - Ally Modal data source', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue({ creatures: [] });
    });

    it.each([
        {
            label: 'combat summary (taking precedence over the characters prop)',
            summaryCreatures: [
                { name: 'Ally1', type: 'player', currentHp: 30, maxHp: 45 },
                { name: 'Ally2', type: 'enemy', currentHp: 10, maxHp: 20 },
            ],
            characters: [{ name: 'NotInCombat', type: 'player' }],
            expectedNames: ['Ally1', 'Ally2'],
            unexpectedNames: ['NotInCombat'],
        },
        {
            label: 'characters prop fallback when the combat summary has no creatures',
            summaryCreatures: null,
            characters: [
                { name: 'Character1', type: 'player' },
                { name: 'Character2', type: 'npc' },
            ],
            expectedNames: ['Character1', 'Character2'],
            unexpectedNames: [],
        },
    ])('populates the ally modal from $label', ({ summaryCreatures, characters, expectedNames, unexpectedNames }) => {
        getCombatSummary.mockReturnValue({ creatures: summaryCreatures });
        renderSummary({ characters });

        // Modal must not be present until the allies badge is clicked.
        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();

        openAllyModal();

        for (const name of expectedNames) {
            expect(screen.getByTestId(`creature-${name}`)).toBeInTheDocument();
        }
        for (const name of unexpectedNames) {
            expect(screen.queryByTestId(`creature-${name}`)).not.toBeInTheDocument();
        }
    });

    it('persists the confirmed selection and logs it to the campaign', () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Ally1', type: 'player', currentHp: 30, maxHp: 45 },
                { name: 'Ally2', type: 'enemy', currentHp: 10, maxHp: 20 },
            ],
        });
        renderSummary({ characters: [] });
        openAllyModal();

        fireEvent.click(screen.getByTestId('ally-select-all'));

        // Server-first: selection is written to the runtime store...
        expect(setRuntimeValue).toHaveBeenCalledWith(
            mockPlayerStats.name, 'selectedAllies', ['Ally1', 'Ally2'], mockCampaignName
        );
        // ...and every automation logs to the campaign log.
        expect(addEntry).toHaveBeenCalledWith(
            mockCampaignName,
            expect.objectContaining({
                type: 'ability_use',
                characterName: mockPlayerStats.name,
                abilityName: 'Ally Selection',
                description: 'Thorin selected allies: Ally1, Ally2',
            })
        );
        // Modal closes immediately on confirm.
        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Initiative — clicking the Initiative value rolls through the engine with
// the effective modifier (initiative − 2 × exhaustionLevel, rendered with an
// explicit sign) and forces advantage only when the character has advantage.
// The click targets the sign-formatted value itself, so each case also pins
// the display: if formatting breaks, getByText fails before the roll check.
// ---------------------------------------------------------------------------
describe('CharSummary - Initiative', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { label: 'no advantage', initiative: 2, initiativeAdvantage: false, exhaustionLevel: 0, displayText: '+2', expectedMod: 2, expectedOpts: undefined },
        { label: 'forced advantage', initiative: 2, initiativeAdvantage: true, exhaustionLevel: 0, displayText: '+2', expectedMod: 2, expectedOpts: { forcedMode: 'advantage' } },
        { label: 'exhaustion penalty producing a negative modifier', initiative: 1, initiativeAdvantage: false, exhaustionLevel: 1, displayText: '-1', expectedMod: -1, expectedOpts: undefined },
    ])('clicking Initiative rolls $expectedMod with $label', ({ initiative, initiativeAdvantage, exhaustionLevel, displayText, expectedMod, expectedOpts }) => {
        renderSummary({
            playerStats: { ...mockPlayerStats, initiative, initiativeAdvantage },
            exhaustionLevel,
        });

        fireEvent.click(screen.getByText(displayText));

        expect(rollInitiative).toHaveBeenCalledTimes(1);
        expect(rollInitiative).toHaveBeenCalledWith(expectedMod, expectedOpts);
    });
});
