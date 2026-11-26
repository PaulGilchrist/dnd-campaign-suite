// @maintained-by-ai 2026-11-17
//
// Coverage ownership (CharSummary family delegation):
//   OWNED HERE (bug: imageless avatar armed a hidden showAvatarModal flag that
//   self-opened the NEXT image-bearing character's sheet):
//   - The imageless avatar receives NO button tier — CharSummary gates
//     AvatarImage's onClick on playerStats.imagePath (mirrors NPCFormModal
//     and MonsterCardHeader), so activation can never arm the zoom.
//   - showAvatarModal resets whenever playerStats.name changes — an open or
//     armed zoom never survives a sidebar character switch.
//   NOT owned here (delegated — do not re-add):
//   - Avatar modal open/close happy path + the render-guard face →
//     CharSummary-Prerequisites.test.jsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';
import CharSummary from './CharSummary.jsx';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';

// ---------------------------------------------------------------------------
// Mocks — mirror CharSummary-Prerequisites.test.jsx, with one sharpening: the
// AvatarImage stand-in mirrors the REAL component's activation tier (role/
// tabIndex exist only when onClick is wired), so the gated-face pins below
// actually prove CharSummary withheld the handler.
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div data-testid="char-gold">Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div data-testid="char-hp">HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div data-testid="char-class-features">Class Features</div> }));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div data-testid="char-conditions">Conditions</div> }));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div data-testid="long-rest-btn">Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({ default: ({ onClick }) => <button onClick={onClick}>Short Rest</button> }));

vi.mock('../../common/AvatarImage.jsx', () => ({
    default: ({ name, onClick }) => (
        <div
            data-testid="avatar"
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {name}
        </div>
    ),
}));
vi.mock('../../common/AvatarModal.jsx', () => ({
    default: ({ onClose }) => (
        <div data-testid="avatar-modal">
            Avatar Modal
            <button onClick={onClose}>Close Avatar</button>
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
// Render helper — swaps characters by re-rendering the SAME CharSummary
// instance (exactly the sidebar-switch shape the bug rode: the component
// keeps its local state across switches, it never unmounts).
// ---------------------------------------------------------------------------
function sheetFor(statsOverride) {
    return (setPopupHtml) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml }}>
            <CharSummary
                playerStats={{ ...mockPlayerStats, ...statsOverride }}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        </DiceRollContext.Provider>
    );
}

function renderSheet(statsOverride) {
    const setPopupHtml = vi.fn();
    const view = render(sheetFor(statsOverride)(setPopupHtml));
    return {
        ...view,
        switchTo: (nextOverride) => view.rerender(sheetFor(nextOverride)(setPopupHtml)),
    };
}

describe('CharSummary - avatar zoom arming (imageless gate + switch reset)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('imageless avatar renders no button tier and an activation click arms nothing', () => {
        renderSheet({ imagePath: '' });

        const avatar = screen.getByTestId('avatar');
        expect(avatar).not.toHaveAttribute('role');
        expect(avatar).not.toHaveAttribute('tabindex');

        fireEvent.click(avatar);
        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();
    });

    it('image-bearing avatar keeps the button tier and opens the zoom', () => {
        renderSheet({ imagePath: '/images/thorin.png' });

        const avatar = screen.getByTestId('avatar');
        expect(avatar).toHaveAttribute('role', 'button');
        expect(avatar).toHaveAttribute('tabindex', '0');

        fireEvent.click(avatar);
        expect(screen.getByTestId('avatar-modal')).toBeInTheDocument();
    });

    it('an open zoom never survives a character switch to the next image-bearing sheet', () => {
        const { switchTo } = renderSheet({ name: 'ElderPaladin', imagePath: '/images/elder.png' });

        fireEvent.click(screen.getByTestId('avatar'));
        expect(screen.getByTestId('avatar-modal')).toBeInTheDocument();

        // Switch to an imageless character: the render guard alone honestly
        // hid the overlay but LEFT the flag armed — the old self-open face.
        switchTo({ name: 'AasimarTest', imagePath: '' });
        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();

        // Switch to a third, image-bearing character with ZERO gesture on it:
        // before the fix the stale armed flag re-veiled this sheet on mount.
        switchTo({ name: 'CelestialWarlock', imagePath: '/images/warlock.png' });
        expect(screen.queryByTestId('avatar-modal')).not.toBeInTheDocument();
    });
});
