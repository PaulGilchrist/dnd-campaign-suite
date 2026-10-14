// @improved-by-ai
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (per sibling delegation comments):
//   - Feat popup content: showFeatDetailPopup rendering of prerequisites
//     (level / ability_scores / proficiency, combinations, iteration),
//     5e array desc, 2024 string description, benefits, and the
//     "no desc → popup never opens" guard.
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
//   - Removed the "Ally Modal Open Fallback Characters Map" describe — it
//     merely asserted the modal opens (passes even if the fallback produced
//     an empty list); CharSummary-Ally-Initiative proves the fallback with
//     real creature-name assertions.
//   - Removed the pair-combination prerequisite cases (level+ability,
//     level+proficiency, ability+proficiency): the three single-facet cases
//     plus the all-three case cover the same independent truthy branches.
//   - Each it.each case now carries an explicit feat fixture instead of
//     deriving the feat name from its prerequisites (`?.proficiency ? 'Heavy
//     Armor' : 'Tough'` cleverness) — every popup is also asserted to carry
//     the feat name and description.
//   - Short rest mock splits Close (onClose only) from Complete (onComplete)
//     so closing no longer silently triggers completion; added a Complete
//     test asserting the parent onLongRest callback fires, and a Close test
//     asserting it does NOT.
//   - Added missing-description guard test, empty-benefits negative test,
//     5e array-desc and 2024 string-description content cases.
//   - Ally cancel now proves "cancel persists nothing": setRuntimeValue and
//     addEntry must not have been called.
//   - Copy-pasted 12-field stats overrides removed — every test renders
//     through mockPlayerStats + spread.
//   - Dropped unused mocks/imports (getActiveBuffs re-defaults, attackCalc
//     duplicate is kept only where the module graph needs it — it does,
//     charSummaryCalc imports it), the externalWrapper merge in the render
//     helper (never used), and the redundant jest-dom import (setup.js
//     registers it).
//
// Before: 14 tests / 345 lines
// After:  16 tests / ~300 lines

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

function openFeatPopup(feat, statsOverride = {}) {
    const setPopupHtml = renderSummary({ ...statsOverride, feats: [feat] });
    fireEvent.click(screen.getByRole('button', { name: 'Feats' }));
    return setPopupHtml;
}

// ---------------------------------------------------------------------------
// Feat popup — prerequisites section
// ---------------------------------------------------------------------------
describe('CharSummary - Feat Popup Prerequisites', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        {
            label: 'a level requirement only',
            feat: { name: 'Tough', desc: 'Extra hit points', prerequisites: { level: 9 } },
            expected: ['Level 9'],
            unexpected: ['or higher', 'Proficiency with'],
        },
        {
            label: 'an ability score requirement only',
            feat: { name: 'Alert', desc: 'Quick to react', prerequisites: { ability_scores: [{ name: 'STR', minimum: 13 }] } },
            expected: ['STR 13 or higher'],
            unexpected: ['Level ', 'Proficiency with'],
        },
        {
            label: 'a proficiency requirement only',
            feat: { name: 'Heavily Armored', desc: 'Can wear heavy armor', prerequisites: { proficiency: 'Heavy Armor' } },
            expected: ['Proficiency with Heavy Armor'],
            unexpected: ['Level ', 'or higher'],
        },
        {
            label: 'all three prerequisite types',
            feat: {
                name: 'Grappler',
                desc: 'You are a master of grappling',
                prerequisites: {
                    level: 4,
                    ability_scores: [{ name: 'DEX', minimum: 15 }],
                    proficiency: 'Martial Weapons',
                },
            },
            expected: ['Prerequisites:', 'Level 4', 'DEX 15 or higher', 'Proficiency with Martial Weapons'],
            unexpected: [],
        },
        {
            label: 'multiple ability score entries (each on its own line)',
            feat: {
                name: 'Metamagic Adept',
                desc: 'You have learned some of a sorcerer\u2019s magic',
                prerequisites: {
                    ability_scores: [
                        { name: 'INT', minimum: 13 },
                        { name: 'WIS', minimum: 13 },
                        { name: 'CHA', minimum: 13 },
                    ],
                },
            },
            expected: ['INT 13 or higher', 'WIS 13 or higher', 'CHA 13 or higher'],
            unexpected: ['Level ', 'Proficiency with'],
        },
    ])('lists $label when the feat popup opens', ({ feat, expected, unexpected }) => {
        const setPopupHtml = openFeatPopup(feat);

        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        const html = setPopupHtml.mock.calls[0][0];
        expect(html).toContain('<b>Prerequisites:</b>');
        expect(html).toContain(feat.name);
        expect(html).toContain(feat.desc);
        for (const text of expected) {
            expect(html).toContain(text);
        }
        for (const text of unexpected) {
            expect(html).not.toContain(text);
        }
    });

    it('omits the Prerequisites section entirely when prerequisites is null', () => {
        const feat = { name: 'Tough', desc: 'Extra hit points', prerequisites: null };
        const setPopupHtml = openFeatPopup(feat);

        expect(setPopupHtml).toHaveBeenCalledTimes(1);
        const html = setPopupHtml.mock.calls[0][0];
        expect(html).toContain(feat.name);
        expect(html).toContain(feat.desc);
        expect(html).not.toContain('Prerequisites:');
    });

    it('renders 5e array descriptions entry by entry', () => {
        const feat = {
            name: 'Lucky',
            desc: ['You have inexplicable luck.', 'You can reroll one roll.'],
            prerequisites: null,
        };
        const html = openFeatPopup(feat).mock.calls[0][0];

        expect(html).toContain(feat.desc[0]);
        expect(html).toContain(feat.desc[1]);
    });

    it('renders the 2024 string description field when desc is absent', () => {
        const feat = { name: 'Alert', description: 'You gain a +5 bonus to initiative.', prerequisites: null };
        const html = openFeatPopup(feat).mock.calls[0][0];

        expect(html).toContain('You gain a +5 bonus to initiative.');
        expect(html).not.toContain('undefined');
    });

    it('renders benefits from both object and string entries', () => {
        const feat = {
            name: 'Tough',
            desc: 'Extra hit points',
            prerequisites: null,
            benefits: [{ description: 'Hit point maximum increases by 2 per level' }, 'No encumbrance penalty'],
        };
        const html = openFeatPopup(feat).mock.calls[0][0];

        expect(html).toContain('<b>Benefits:</b>');
        expect(html).toContain('<li>Hit point maximum increases by 2 per level</li>');
        expect(html).toContain('<li>No encumbrance penalty</li>');
    });

    it('omits the Benefits section for an empty benefits array', () => {
        const feat = { name: 'Tough', desc: 'Extra hit points', prerequisites: null, benefits: [] };
        const html = openFeatPopup(feat).mock.calls[0][0];

        expect(html).not.toContain('Benefits:');
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
