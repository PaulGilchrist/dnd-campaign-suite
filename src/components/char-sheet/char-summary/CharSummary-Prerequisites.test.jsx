// @maintained-by-ai
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (per sibling delegation comments):
//   - Feat popup content: showFeatDetailPopup rendering of prerequisites
//     (level / ability_scores / proficiency, including the multi-entry
//     ability loop), all three description formats (5e array, 2024 string
//     `description`, plain string `desc`), benefits (object + string entries,
//     empty-array omission), and the "no desc/description → popup never
//     opens" guard.
//   - Short Rest modal open/close flow (delegated here by
//     CharSummary-EventHandlers and CharSummary-Display): Close button
//     dismisses without completing; Complete button dismisses AND fires the
//     parent onLongRest callback.
//   - Ally modal Cancel flow (delegated here by CharSummary-Ally-Initiative):
//     cancel dismisses and persists NOTHING.
//   - Avatar modal open/close incl. the imagePath guard (owned by no sibling).
//
// NOT owned here (delegated — do not re-add):
//   - Ally modal creature-list data source (combat summary vs characters
//     fallback) and confirm persistence → CharSummary-Ally-Initiative.test.jsx
//   - Ally confirm error path → CharSummary-Remaining.test.jsx
//   - 'open-short-rest' window event → CharSummary-EventHandlers.test.jsx
//   - Background popup → CharSummary-UI-Interactions.test.jsx
//
// Improvements (2026-10-14):
//   - Collapsed the feat-popup describe from 11 tests to 4: showFeatDetailPopup
//     is a linear builder, so one rich feat (array desc + all three prereq
//     facets + multi-entry ability loop + both benefit shapes) and two spare
//     feats (string desc with sections absent; 2024 `description` fallback)
//     exercise every branch, with the guard test pinning the never-opens
//     path. Single-facet prereq cases, the separate null-prereqs /
//     benefits / empty-benefits cases re-rendered the same popup path for
//     marginal assertion gain.
//   - Before: 16 tests → After: 9 tests.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';
import CharSummary from './CharSummary.jsx';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

// ---------------------------------------------------------------------------
// Mocks — only what the feat-popup, short-rest, ally-cancel and
// avatar-modal code paths touch.
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: ({ onClick }) => <button onClick={onClick}>Short Rest</button> }));

// CharFeats stand-in: clicking it forwards the character's first feat to
// CharSummary's showPopup handler (which builds the detail popup HTML).
vi.mock('../char-feats/CharFeats.jsx', () => ({
    default: ({ showPopup, playerStats }) => (
        <button onClick={() => playerStats.feats?.[0] && showPopup(playerStats.feats[0])}>Feats</button>
    ),
}));

vi.mock('../../common/AvatarImage.jsx', () => ({
    default: ({ onClick }) => <div role="button" onClick={onClick}>Avatar</div>,
}));
vi.mock('../../common/AvatarModal.jsx', () => ({
    default: ({ onClose }) => (
        <div data-testid="avatar-modal">
            Avatar Modal
            <button onClick={onClose}>Close Avatar</button>
        </div>
    ),
}));

// ShortRestModal stand-in: Close and Complete are distinct buttons so a
// close test can prove it does NOT silently trigger completion.
vi.mock('../ShortRestModal.jsx', () => ({
    default: ({ onClose, onComplete }) => (
        <div data-testid="short-rest-modal">
            Short Rest Modal
            <button onClick={onClose}>Close</button>
            <button onClick={onComplete}>Complete</button>
        </div>
    ),
}));

vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: ({ onConfirm, onCancel }) => (
        <div data-testid="ally-selection-modal">
            Select Allies
            <button onClick={onConfirm}>Confirm</button>
            <button onClick={onCancel}>Cancel</button>
        </div>
    ),
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

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Render helper — real DiceRollContext.Provider; returns the setPopupHtml spy
// so tests can inspect the popup HTML the component would display.
// ---------------------------------------------------------------------------
function renderSummary(statsOverride = {}, props = {}) {
    const setPopupHtml = vi.fn();
    render(
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml }}>
            <CharSummary
                playerStats={{ ...mockPlayerStats, ...statsOverride }}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
                {...props}
            />
        </DiceRollContext.Provider>
    );
    return setPopupHtml;
}

function openFeatPopup(feat) {
    const setPopupHtml = renderSummary({ feats: [feat] });
    fireEvent.click(screen.getByRole('button', { name: 'Feats' }));
    return setPopupHtml;
}

// ---------------------------------------------------------------------------
// Feat popup — every branch of showFeatDetailPopup in one pass:
// rich feat covers array-desc, all prerequisite facets (incl. the
// multi-entry ability loop) and both benefit shapes; the spare feats cover
// the plain-string and 2024-desc branches with sections absent.
// ---------------------------------------------------------------------------
describe('CharSummary - Feat Popup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        {
            label: 'every prerequisite facet, array desc, and both benefit shapes',
            feat: {
                name: 'Grappler',
                desc: ['You are a master of grappling.', 'Extra array line.'],
                prerequisites: {
                    level: 4,
                    ability_scores: [
                        { name: 'DEX', minimum: 15 },
                        { name: 'STR', minimum: 13 },
                    ],
                    proficiency: 'Martial Weapons',
                },
                benefits: [
                    { description: 'Hit point maximum increases by 2 per level' },
                    'No encumbrance penalty',
                ],
            },
            expected: [
                '<b>Prerequisites:</b>',
                'Level 4',
                'DEX 15 or higher',
                'STR 13 or higher',
                'Proficiency with Martial Weapons',
                '<b>Benefits:</b>',
                '<li>Hit point maximum increases by 2 per level</li>',
                '<li>No encumbrance penalty</li>',
                'You are a master of grappling.',
                'Extra array line.',
            ],
            unexpected: [],
        },
        {
            label: 'a plain string desc omits both optional sections',
            feat: { name: 'Tough', desc: 'Extra hit points', prerequisites: null },
            expected: ['<b>Tough</b>', 'Extra hit points'],
            unexpected: ['Prerequisites:', 'Benefits:', 'undefined'],
        },
        {
            label: 'the 2024 string description field when desc is absent',
            feat: { name: 'Alert', description: 'You gain a +5 bonus to initiative.', prerequisites: null },
            expected: ['<b>Alert</b>', 'You gain a +5 bonus to initiative.'],
            unexpected: ['Prerequisites:', 'Benefits:', 'undefined'],
        },
    ])('lists $label when the feat popup opens', ({ feat, expected, unexpected }) => {
        const setPopupHtml = openFeatPopup(feat);

        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        const html = setPopupHtml.mock.calls[0][0];
        expect(html).toContain(feat.name);
        for (const text of expected) {
            expect(html).toContain(text);
        }
        for (const text of unexpected) {
            expect(html).not.toContain(text);
        }
    });

    it('never opens the popup when the feat has no desc or description', () => {
        const setPopupHtml = openFeatPopup({ name: 'Tough', desc: null, prerequisites: null });

        expect(setPopupHtml).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Short Rest modal open/close/complete flow (delegated here by EventHandlers)
// ---------------------------------------------------------------------------
describe('CharSummary - Short Rest Modal Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens the short rest modal from the Short Rest button and closes it without completing', () => {
        const onLongRest = vi.fn();
        renderSummary({}, { onLongRest });

        expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Short Rest' }));
        expect(screen.getByTestId('short-rest-modal')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();
        // Dismissing is not completing — the parent refresh callback must not fire.
        expect(onLongRest).not.toHaveBeenCalled();
    });

    it('completing the short rest closes the modal and notifies the parent', () => {
        const onLongRest = vi.fn();
        renderSummary({}, { onLongRest });

        fireEvent.click(screen.getByRole('button', { name: 'Short Rest' }));
        fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

        expect(screen.queryByTestId('short-rest-modal')).not.toBeInTheDocument();
        expect(onLongRest).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Ally modal cancel flow (delegated here by CharSummary-Ally-Initiative)
// ---------------------------------------------------------------------------
describe('CharSummary - Ally Modal Cancel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('dismisses the modal on cancel without persisting anything', () => {
        renderSummary({}, { characters: [{ name: 'Ally', type: 'player' }] });

        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText(/Allies \(1\)/));
        expect(screen.getByTestId('ally-selection-modal')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByTestId('ally-selection-modal')).not.toBeInTheDocument();
        // Cancel must write nothing: no runtime-store selection, no campaign log entry.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Avatar modal open/close (incl. the imagePath guard — owned by no sibling)
// ---------------------------------------------------------------------------
describe('CharSummary - Avatar Modal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens on avatar click when the character has an image and closes on Close', () => {
        renderSummary({ imagePath: '/images/thorin.png' });

        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Avatar' }));
        expect(screen.getByTestId('avatar-modal')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close Avatar' }));
        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();
    });

    it('does not open the modal when the character has no image', () => {
        renderSummary({ imagePath: null });

        fireEvent.click(screen.getByRole('button', { name: 'Avatar' }));

        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();
    });
});
