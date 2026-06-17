import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonsterCardModal from './MonsterCardModal.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
    sanitizeHtml: (html) => html,
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 7, rolls: [7], modifier: 0 })),
    rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [7, 7], modifier: 0 })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        rollAbilityCheck: vi.fn(),
        rollSavingThrow: vi.fn(),
        rollSkillCheck: vi.fn(),
        rollInitiative: vi.fn(),
        quickRollPlayerSave: vi.fn(),
    })),
}));

vi.mock('../../common/Popup.jsx', () => ({ default: ({ children, onClick }) => <div data-testid="popup" onClick={onClick}>{children}</div> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result">Dice Roll Result</div> }));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => types.join(', ')),
    getTargetFromAttacker: vi.fn(() => null),
    getCombatContext: vi.fn(() => Promise.resolve(null)),
    findCreatureByName: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
    getAbilitySaveModifier: vi.fn(() => 0),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        autoFailSaves: [],
        attackDisadvantageCount: 0,
        abilityCheckDisadvantage: false,
        strCheckDisadvantage: false,
    })),
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
    getDistanceFeet: vi.fn(() => 5),
    getNearestPlacedItem: vi.fn(() => null),
    rangeToFeet: vi.fn((range) => parseInt(range, 10) || 30),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((campaign, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'inspiringMovementNoOA') return false;
        if (key === 'remarkableAthleteNoOA') return false;
        return null;
    }),
}));

const mockMonster = {
    name: 'Goblin',
    size: 'Small',
    type: 'Humanoid',
    subtype: 'Goblinoid',
    alignment: 'Neutral Evil',
    armor_class: 15,
    hit_points: 7,
    hit_dice: '1d6',
    speed: { walk: 30 },
    initiative_details: '+2',
    ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 9 },
    ability_score_modifiers: { str: -1, dex: 2, con: 0, int: -1, wis: -1, cha: -1 },
    saving_throws: { dex: { modifier: 2 } },
    skills: { stealth: { modifier: 6 } },
    senses: { darkvision: 60, passive_perception: 9 },
    languages: 'Common, Goblin',
    challenge_rating: 0.25,
    xp: 50,
    actions: [
        {
            name: 'Scimitar',
            attack_bonus: 4,
            damage_dice_primary: '1d6+2',
            damage_type_primary: 'slashing',
            description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target.',
        },
    ],
    traits: [],
    reactions: [],
    legendary_actions: [],
};

const mockCampaignName = 'test-campaign';
const mockOnClose = vi.fn();

describe('MonsterCardModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders monster name', () => {
        render(<MonsterCardModal monster={mockMonster} onClose={mockOnClose} campaignName={mockCampaignName} />);
        expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('renders close button', () => {
        render(<MonsterCardModal monster={mockMonster} onClose={mockOnClose} campaignName={mockCampaignName} />);
        const closeBtn = document.querySelector('.mc-close');
        expect(closeBtn).toBeInTheDocument();
    });

    it('returns null when monster is null', () => {
        const { container } = render(<MonsterCardModal monster={null} onClose={mockOnClose} campaignName={mockCampaignName} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders creature name from creatureName prop', () => {
        render(<MonsterCardModal monster={mockMonster} onClose={mockOnClose} campaignName={mockCampaignName} creatureName="Custom Goblin" />);
        expect(screen.getByText('Custom Goblin')).toBeInTheDocument();
    });
});
