// @improved-by-ai
// @cleaned-by-ai

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { mockPlayerStats, mockCampaignName } from './CharSummary.test-mocks.test.jsx';
import CharSummary from './CharSummary.jsx';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import { DiceRollContext } from '../../../hooks/combat/DiceRollContext.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------
vi.mock('./CharGold.jsx', () => ({ default: () => <div>Gold</div> }));
vi.mock('./CharHitPoints.jsx', () => ({ default: () => <div>HP</div> }));
vi.mock('./CharClassFeatures.jsx', () => ({ default: () => <div>Class Features</div> }));
vi.mock('../char-feats/CharFeats.jsx', () => ({
    default: vi.fn(({ showPopup, playerStats }) => (
        <button
            onClick={() => {
                const feat = (playerStats?.feats && playerStats.feats[0]) || {
                    name: 'Heavy Armor',
                    desc: 'Can wear heavy armor',
                };
                showPopup(feat);
            }}
        >
            Feats
        </button>
    )),
}));
vi.mock('../../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ onClick }) => (
        <div onClick={onClick}>Avatar</div>
    )),
}));
vi.mock('../../common/AvatarModal.jsx', () => ({
    default: vi.fn(({ onClose }) => (
        <div>
            Avatar Modal
            <button onClick={onClose}>Close</button>
        </div>
    )),
}));
vi.mock('../../common/AllySelectionModal.jsx', () => ({
    default: vi.fn(({ onConfirm, onCancel, currentAllies }) => (
        <div>
            Select Allies
            <button onClick={() => onConfirm(currentAllies || ['Thorin'])}>Confirm</button>
            <button onClick={onCancel}>Cancel</button>
        </div>
    )),
}));
vi.mock('../LongRestButton.jsx', () => ({ default: () => <div>Long Rest</div> }));
vi.mock('../ShortRestButton.jsx', () => ({
    default: vi.fn(({ onClick }) => (
        <button onClick={onClick}>Short Rest</button>
    )),
}));
vi.mock('../ShortRestModal.jsx', () => ({
    default: vi.fn(({ onClose, onComplete }) => (
        <div>
            Short Rest Modal
            <button onClick={() => { onClose(); onComplete?.(); }}>Close</button>
        </div>
    )),
}));
vi.mock('./CharConditions.jsx', () => ({ default: () => <div>Conditions</div> }));

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
// Shared render helper — provides DiceRollContext and returns the spy
// ---------------------------------------------------------------------------
const renderWithDiceContext = (ui, { wrapper: externalWrapper, ...renderOptions } = {}) => {
    const mockSetPopupHtml = vi.fn();
    const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
        </DiceRollContext.Provider>
    );
    return {
        ...render(ui, {
            wrapper: externalWrapper ? (p) => <wrapper><externalWrapper {...p} /></wrapper> : wrapper,
            ...renderOptions,
        }),
        mockSetPopupHtml,
    };
};

// ---------------------------------------------------------------------------
// Feat Popup Prerequisites
// ---------------------------------------------------------------------------
describe('CharSummary - Feat Popup Prerequisites', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it.each([
        [
            'level only',
            { prerequisites: { level: 1 } },
            ['Level 1'],
            ['or higher', 'Proficiency with'],
        ],
        [
            'ability_scores only',
            { prerequisites: { ability_scores: [{ name: 'STR', minimum: 16 }] } },
            ['STR 16 or higher'],
            ['Level', 'Proficiency with'],
        ],
        [
            'proficiency only',
            { prerequisites: { proficiency: 'Heavy Armor' } },
            ['Proficiency with Heavy Armor'],
            ['Level', 'or higher'],
        ],
        [
            'level + ability_scores',
            { prerequisites: { level: 1, ability_scores: [{ name: 'STR', minimum: 16 }] } },
            ['Level 1', 'STR 16 or higher'],
            ['Proficiency with'],
        ],
        [
            'level + proficiency',
            { prerequisites: { level: 1, proficiency: 'Heavy Armor' } },
            ['Level 1', 'Proficiency with Heavy Armor'],
            ['or higher'],
        ],
        [
            'ability_scores + proficiency',
            { prerequisites: { ability_scores: [{ name: 'STR', minimum: 16 }], proficiency: 'Heavy Armor' } },
            ['STR 16 or higher', 'Proficiency with Heavy Armor'],
            ['Level'],
        ],
        [
            'null prerequisites',
            { prerequisites: null },
            ['Tough'],
            ['Prerequisites:'],
        ],
        [
            'empty prerequisites object',
            { prerequisites: {} },
            ['Tough', 'Prerequisites:'],
            ['Level', 'or higher', 'Proficiency with'],
        ],
        [
            'multiple ability_scores entries',
            { prerequisites: { ability_scores: [
                { name: 'INT', minimum: 13 },
                { name: 'WIS', minimum: 13 },
                { name: 'CHA', minimum: 13 },
            ] } },
            ['INT 13 or higher', 'WIS 13 or higher', 'CHA 13 or higher'],
            [],
        ],
    ])('renders feat popup with %s prerequisite', (_name, featOverrides, expectedIncludes, expectedExcludes) => {
        const { mockSetPopupHtml } = renderWithDiceContext(
            <CharSummary
                playerStats={{
                    ...mockPlayerStats,
                    feats: [{
                        name: featOverrides.prerequisites?.proficiency ? 'Heavy Armor' : 'Tough',
                        desc: 'Can wear heavy armor',
                        ...featOverrides,
                    }],
                }}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        const featsBtn = screen.getByRole('button', { name: 'Feats' });
        fireEvent.click(featsBtn);
        expect(mockSetPopupHtml).toHaveBeenCalled();
        const html = mockSetPopupHtml.mock.calls[0][0];
        for (const text of expectedIncludes) {
            expect(html).toContain(text);
        }
        for (const text of expectedExcludes) {
            expect(html).not.toContain(text);
        }
    });

    it('does not call setPopupHtml when feat has no desc or description', () => {
        const { mockSetPopupHtml } = renderWithDiceContext(
            <CharSummary
                playerStats={{
                    ...mockPlayerStats,
                    feats: [{ name: 'Tough', desc: null, prerequisites: {} }],
                }}
                campaignName={mockCampaignName}
                exhaustionLevel={0}
            />
        );
        const featsBtn = screen.getByRole('button', { name: 'Feats' });
        fireEvent.click(featsBtn);
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Modal onClose Handlers
// ---------------------------------------------------------------------------
describe('CharSummary - Modal onClose Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('closes ally modal when cancel is clicked', () => {
        const stats = {
            ...mockPlayerStats,
            race: { name: 'Human', type: 'Human', subrace: null },
            class: { name: 'Rogue', subclass: null, major: { name: 'Rogue' } },
            armorClass: 14,
            armorClassFormula: '14 + Dex',
            inventory: { equipped: [] },
            equipment: [],
            automation: { passives: [], actions: [] },
            passives: [],
        };
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} characters={[{ name: 'Ally' }]} />);
        const allyBadge = screen.getByText(/Allies \(1\)/);
        fireEvent.click(allyBadge);
        expect(screen.getByText('Select Allies')).toBeInTheDocument();
        const cancelButton = screen.getByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelButton);
        expect(screen.queryByText('Select Allies')).not.toBeInTheDocument();
    });

    it('closes short rest modal when close button is clicked', () => {
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
        render(<CharSummary playerStats={mockPlayerStats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const shortRestBtn = screen.getByRole('button', { name: 'Short Rest' });
        fireEvent.click(shortRestBtn);
        expect(screen.getByText('Short Rest Modal')).toBeInTheDocument();
        const closeModalBtn = screen.getByRole('button', { name: 'Close' });
        fireEvent.click(closeModalBtn);
        expect(screen.queryByText('Short Rest Modal')).not.toBeInTheDocument();
    });

    it('closes avatar modal when close button is clicked', () => {
        const stats = {
            ...mockPlayerStats,
            imagePath: '/images/thorin.png',
        };
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} />);
        const avatarImage = screen.getByText('Avatar');
        fireEvent.click(avatarImage);
        expect(screen.getByText('Avatar Modal')).toBeInTheDocument();
        const closeModalBtn = screen.getByRole('button', { name: 'Close' });
        fireEvent.click(closeModalBtn);
        expect(screen.queryByText('Avatar Modal')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Ally Modal Open Fallback Characters Map
// ---------------------------------------------------------------------------
describe('CharSummary - Ally Modal Open Fallback Characters Map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
    });

    it('uses characters.map fallback when combatSummary.creatures is null', () => {
        const stats = {
            ...mockPlayerStats,
            race: { name: 'Human', type: 'Human', subrace: null },
            class: { name: 'Rogue', subclass: null, major: { name: 'Rogue' } },
            armorClass: 14,
            armorClassFormula: '14 + Dex',
            inventory: { equipped: [] },
            equipment: [],
            automation: { passives: [], actions: [] },
            passives: [],
        };
        vi.mocked(getCombatSummary).mockReturnValue(null);
        const characters = [
            { name: 'Thorin', type: 'player' },
            { name: 'Grimjaw', type: 'monster' },
        ];
        render(<CharSummary playerStats={stats} campaignName={mockCampaignName} exhaustionLevel={0} characters={characters} />);
        const allyBadge = screen.getByText(/Allies \(1\)/);
        fireEvent.click(allyBadge);
        expect(screen.getByText('Select Allies')).toBeInTheDocument();
    });
});
