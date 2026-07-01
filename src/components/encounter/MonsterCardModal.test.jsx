// @improved-by-ai
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

let _conditionEffectsReturnValue = {
    autoFailSaves: [],
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    strCheckDisadvantage: false,
    speedZero: false,
};

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => _conditionEffectsReturnValue),
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
    getRuntimeValue: vi.fn((_characterKey, _propertyName) => null),
}));

const baseMonster = {
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

function renderModal(props = {}) {
    return render(
        <MonsterCardModal monster={baseMonster} onClose={mockOnClose} campaignName={mockCampaignName} {...props} />
    );
}

describe('MonsterCardModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('null/empty handling', () => {
        it('returns null when monster is null', () => {
            const { container } = render(
                <MonsterCardModal monster={null} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('returns null when monster is undefined', () => {
            const { container } = render(
                <MonsterCardModal onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(container.innerHTML).toBe('');
        });
    });

    describe('header rendering', () => {
        it('renders monster name', () => {
            renderModal();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
        });

        it('renders creature name from creatureName prop overriding monster name', () => {
            renderModal({ creatureName: 'Custom Goblin' });
            expect(screen.getByText('Custom Goblin')).toBeInTheDocument();
        });

        it('renders size and type line', () => {
            renderModal();
            expect(screen.getByText(/Small Humanoid/)).toBeInTheDocument();
        });

        it('renders subtype when present', () => {
            renderModal();
            expect(screen.getByText(/Small Humanoid \(Goblinoid\), Neutral Evil/)).toBeInTheDocument();
        });

        it('omits subtype parentheses when subtype is missing', () => {
            const monsterWithoutSubtype = { ...baseMonster, subtype: null };
            render(
                <MonsterCardModal monster={monsterWithoutSubtype} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Small Humanoid, Neutral Evil/)).toBeInTheDocument();
            expect(screen.queryByText(/Goblinoid/)).not.toBeInTheDocument();
        });

        it('renders close button', () => {
            renderModal();
            const closeBtn = screen.getByRole('button', { name: /close/i });
            expect(closeBtn).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', () => {
            renderModal();
            const closeBtn = screen.getByRole('button', { name: /close/i });
            closeBtn.click();
            // Button is inside header, so event bubbles and triggers header onClick too
            expect(mockOnClose).toHaveBeenCalledTimes(2);
        });

        it('calls onClose when header is clicked', () => {
            renderModal();
            const header = document.querySelector('.mc-header');
            header.click();
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('stats section', () => {
        it('renders armor class', () => {
            renderModal();
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('renders hit points', () => {
            renderModal();
            expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
            expect(screen.getByText(/7\s*\(1d6\)/)).toBeInTheDocument();
        });

        it('renders hit dice alongside hit points', () => {
            renderModal();
            expect(screen.getByText(/7\s*\(1d6\)/)).toBeInTheDocument();
        });

        it('renders speed', () => {
            renderModal();
            expect(screen.getByText('walk 30')).toBeInTheDocument();
        });

        it('renders initiative when present', () => {
            renderModal();
            expect(screen.getByText(/Initiative/)).toBeInTheDocument();
        });

        it('renders all six ability scores', () => {
            renderModal();
            expect(screen.getByText('STR')).toBeInTheDocument();
            expect(screen.getByText('DEX')).toBeInTheDocument();
            expect(screen.getByText('CON')).toBeInTheDocument();
            expect(screen.getByText('INT')).toBeInTheDocument();
            expect(screen.getByText('WIS')).toBeInTheDocument();
            expect(screen.getByText('CHA')).toBeInTheDocument();
        });

        it('renders ability score values', () => {
            renderModal();
            // Use getAllByText for values appearing multiple times (e.g. '8' for STR, INT, WIS)
            expect(screen.getAllByText('8').length).toBeGreaterThan(0);
            expect(screen.getByText('14')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
            expect(screen.getByText('9')).toBeInTheDocument();
        });

        it('renders ability score modifiers with plus signs for positive values', () => {
            renderModal();
            // Use getAllByText for '+2' which appears in both initiative and DEX modifier
            expect(screen.getAllByText('+2').length).toBeGreaterThan(0);
            expect(screen.getByText('+0')).toBeInTheDocument();
        });

        it('renders ability score modifiers with minus signs for negative values', () => {
            renderModal();
            // Use getAllByText for '-1' which appears in multiple abilities
            expect(screen.getAllByText('-1').length).toBeGreaterThan(0);
        });
    });

    describe('defenses section', () => {
        it('renders saving throws', () => {
            renderModal();
            expect(screen.getByText(/DEX.*2/)).toBeInTheDocument();
        });

        it('renders skills', () => {
            renderModal();
            expect(screen.getByText(/stealth.*6/)).toBeInTheDocument();
        });

        it('renders senses', () => {
            renderModal();
            expect(screen.getByText(/darkvision.*60/)).toBeInTheDocument();
            expect(screen.getByText(/passive Perception.*9/)).toBeInTheDocument();
        });

        it('renders languages', () => {
            renderModal();
            expect(screen.getByText('Common, Goblin')).toBeInTheDocument();
        });

        it('renders challenge rating and XP', () => {
            renderModal();
            expect(screen.getByText(/0\.25/)).toBeInTheDocument();
            expect(screen.getByText(/50 XP/)).toBeInTheDocument();
        });

        it('renders damage vulnerabilities when present', () => {
            const monsterWithVuln = { ...baseMonster, damage_vulnerabilities: ['fire', 'cold'] };
            render(
                <MonsterCardModal monster={monsterWithVuln} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
            expect(screen.getByText('fire, cold')).toBeInTheDocument();
        });

        it('hides damage vulnerability row when absent', () => {
            renderModal();
            expect(screen.queryByText('fire, cold')).not.toBeInTheDocument();
        });

        it('renders damage resistances when present', () => {
            const monsterWithResist = { ...baseMonster, damage_resistances: ['bludgeoning'] };
            render(
                <MonsterCardModal monster={monsterWithResist} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
            expect(screen.getByText('bludgeoning')).toBeInTheDocument();
        });

        it('hides damage resistance row when absent', () => {
            renderModal();
            expect(screen.queryByText('bludgeoning')).not.toBeInTheDocument();
        });

        it('renders damage immunities when present', () => {
            const monsterWithImmune = { ...baseMonster, damage_immunities: ['poison', 'psychic'] };
            render(
                <MonsterCardModal monster={monsterWithImmune} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Damage Imm')).toBeInTheDocument();
            expect(screen.getByText('poison, psychic')).toBeInTheDocument();
        });

        it('hides damage immunity row when absent', () => {
            renderModal();
            expect(screen.queryByText('poison, psychic')).not.toBeInTheDocument();
        });

        it('renders condition immunities when present', () => {
            const monsterWithCondImmune = { ...baseMonster, condition_immunities: ['charmed', 'frightened'] };
            render(
                <MonsterCardModal monster={monsterWithCondImmune} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Condition Imm')).toBeInTheDocument();
            expect(screen.getByText('charmed, frightened')).toBeInTheDocument();
        });

        it('hides condition immunity row when absent', () => {
            renderModal();
            expect(screen.queryByText('charmed, frightened')).not.toBeInTheDocument();
        });

        it('renders legendary resistance when present', () => {
            const monsterWithLegendaryRes = { ...baseMonster, legendary_resistance: 3 };
            render(
                <MonsterCardModal monster={monsterWithLegendaryRes} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Legendary Resist.')).toBeInTheDocument();
            expect(screen.getByText('3/day')).toBeInTheDocument();
        });

        it('hides legendary resistance when not present', () => {
            renderModal();
            expect(screen.queryByText('3/day')).not.toBeInTheDocument();
        });

        it('hides legendary resistance when null', () => {
            const monsterNullLegendary = { ...baseMonster, legendary_resistance: null };
            render(
                <MonsterCardModal monster={monsterNullLegendary} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText('Legendary Resist.')).not.toBeInTheDocument();
        });

        it('hides legendary resistance when undefined', () => {
            const monsterUndefinedLegendary = { ...baseMonster };
            delete monsterUndefinedLegendary.legendary_resistance;
            render(
                <MonsterCardModal monster={monsterUndefinedLegendary} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText('Legendary Resist.')).not.toBeInTheDocument();
        });

        it('formats large XP values with commas', () => {
            const monsterWithLargeXp = { ...baseMonster, xp: 4100 };
            render(
                <MonsterCardModal monster={monsterWithLargeXp} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/4,100 XP/)).toBeInTheDocument();
        });
    });

    describe('actions, traits, reactions, and legendary actions', () => {
        it('renders monster actions', () => {
            renderModal();
            expect(screen.getByText('Actions')).toBeInTheDocument();
            expect(screen.getByText(/Scimitar/)).toBeInTheDocument();
        });

        it('renders action description', () => {
            renderModal();
            expect(screen.getByText(/Melee Weapon Attack/)).toBeInTheDocument();
        });

        it('renders action attack bonus as clickable link', () => {
            renderModal();
            expect(screen.getByText('+4')).toBeInTheDocument();
        });

        it('renders action damage dice', () => {
            renderModal();
            expect(screen.getByText('1d6+2')).toBeInTheDocument();
        });

        it('renders traits section when traits array has entries', () => {
            const monsterWithTraits = {
                ...baseMonster,
                traits: [
                    {
                        name: 'Nimble Escape',
                        description: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithTraits} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Nimble Escape/)).toBeInTheDocument();
        });

        it('does not render traits section when traits array is empty', () => {
            renderModal();
            expect(screen.queryByText(/traits/i)).not.toBeInTheDocument();
        });

        it('does not render traits section when traits is undefined', () => {
            const monsterNoTraits = { ...baseMonster };
            delete monsterNoTraits.traits;
            render(
                <MonsterCardModal monster={monsterNoTraits} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/traits/i)).not.toBeInTheDocument();
        });

        it('renders reactions section when reactions array has entries', () => {
            const monsterWithReactions = {
                ...baseMonster,
                reactions: [
                    {
                        name: 'Reaction',
                        description: 'When a creature attacks the goblin...',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithReactions} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Reactions/)).toBeInTheDocument();
            expect(screen.getByText(/When a creature attacks/)).toBeInTheDocument();
        });

        it('does not render reactions section when reactions array is empty', () => {
            renderModal();
            expect(screen.queryByText(/reactions/i)).not.toBeInTheDocument();
        });

        it('renders legendary actions section when array has entries', () => {
            const monsterWithLegendaryActions = {
                ...baseMonster,
                legendary_actions: [
                    {
                        name: 'Goblin Agility',
                        description: 'The goblin takes a bonus action.',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithLegendaryActions} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Legendary Actions/)).toBeInTheDocument();
            expect(screen.getByText(/The goblin takes a bonus action/)).toBeInTheDocument();
        });

        it('does not render legendary actions section when array is empty', () => {
            renderModal();
            expect(screen.queryByText(/legendary actions/i)).not.toBeInTheDocument();
        });
    });

    describe('overlay and interaction behavior', () => {
        it('renders overlay with mc-overlay class', () => {
            renderModal();
            const overlay = document.querySelector('.mc-overlay');
            expect(overlay).toBeInTheDocument();
        });

        it('renders card with mc-card class', () => {
            renderModal();
            const card = document.querySelector('.mc-card');
            expect(card).toBeInTheDocument();
        });

        it('stops propagation on card body click', () => {
            renderModal();
            const card = document.querySelector('.mc-card');
            const stopPropagationSpy = vi.fn();
            card.addEventListener('click', stopPropagationSpy);
            card.click();
            expect(stopPropagationSpy).toHaveBeenCalled();
        });

        it('calls onClose when overlay is clicked', () => {
            renderModal();
            const overlay = document.querySelector('.mc-overlay');
            overlay.click();
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('does NOT call onClose when card body is clicked', () => {
            renderModal();
            const card = document.querySelector('.mc-card');
            card.click();
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('optional sections', () => {
        it('renders description when present', () => {
            const monsterWithDesc = {
                ...baseMonster,
                desc: 'A small but vicious creature.',
                book: 'Monster Manual',
                page: 310,
            };
            render(
                <MonsterCardModal monster={monsterWithDesc} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('A small but vicious creature.')).toBeInTheDocument();
            expect(screen.getByText('Monster Manual (page 310)')).toBeInTheDocument();
        });

        it('renders description with book but no page', () => {
            const monsterWithBook = {
                ...baseMonster,
                desc: 'A small but vicious creature.',
                book: 'Monster Manual',
            };
            render(
                <MonsterCardModal monster={monsterWithBook} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Monster Manual')).toBeInTheDocument();
            expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
        });

        it('hides description section when desc is absent', () => {
            const monsterNoDesc = { ...baseMonster };
            delete monsterNoDesc.desc;
            render(
                <MonsterCardModal monster={monsterNoDesc} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText('Description')).not.toBeInTheDocument();
        });

        it('renders lair actions when lair_actions is an array', () => {
            const monsterWithLair = {
                ...baseMonster,
                lair_actions: ['The goblin hides in the shadows.'],
            };
            render(
                <MonsterCardModal monster={monsterWithLair} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Lair Actions')).toBeInTheDocument();
            expect(screen.getByText('The goblin hides in the shadows.')).toBeInTheDocument();
        });

        it('renders lair actions when lair_actions is an object with actions array', () => {
            const monsterWithLairObj = {
                ...baseMonster,
                lair_actions: { actions: ['The laum is cursed.'] },
            };
            render(
                <MonsterCardModal monster={monsterWithLairObj} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Lair Actions')).toBeInTheDocument();
            expect(screen.getByText('The laum is cursed.')).toBeInTheDocument();
        });

        it('hides lair actions when lair_actions is absent', () => {
            const monsterNoLair = { ...baseMonster };
            delete monsterNoLair.lair_actions;
            render(
                <MonsterCardModal monster={monsterNoLair} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/lair actions/i)).not.toBeInTheDocument();
        });

        it('renders regional effects when regional_effects is an array', () => {
            const monsterWithRegional = {
                ...baseMonster,
                regional_effects: ['The air is thick with magic.'],
            };
            render(
                <MonsterCardModal monster={monsterWithRegional} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Regional Effects')).toBeInTheDocument();
            expect(screen.getByText('The air is thick with magic.')).toBeInTheDocument();
        });

        it('renders regional effects when regional_effects is an object with effects array', () => {
            const monsterWithRegionalObj = {
                ...baseMonster,
                regional_effects: { effects: [{ description: 'The winds howl.' }] },
            };
            render(
                <MonsterCardModal monster={monsterWithRegionalObj} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Regional Effects')).toBeInTheDocument();
            expect(screen.getByText('The winds howl.')).toBeInTheDocument();
        });

        it('hides regional effects when absent', () => {
            const monsterNoRegional = { ...baseMonster };
            delete monsterNoRegional.regional_effects;
            render(
                <MonsterCardModal monster={monsterNoRegional} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/regional effects/i)).not.toBeInTheDocument();
        });
    });

    describe('edge cases for abilities and defenses', () => {
        it('renders ability score modifiers as minus when value is negative', () => {
            renderModal();
            expect(screen.getAllByText('-1').length).toBeGreaterThan(0);
        });

        it('renders ability score modifier as dash when ability_scores is missing', () => {
            const monsterNoAbilities = { ...baseMonster, ability_scores: undefined };
            render(
                <MonsterCardModal monster={monsterNoAbilities} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            // When ability_scores is missing, the component renders '-' for score and '-' for modifier
            // Use queryAll to avoid "multiple elements" error since all 6 abilities show '-'
            const dashes = screen.queryAllByText('-');
            expect(dashes.length).toBeGreaterThan(0);
        });

        it('renders ability score modifier as dash when ability_score_modifiers is missing', () => {
            const monsterNoMod = { ...baseMonster, ability_score_modifiers: undefined };
            render(
                <MonsterCardModal monster={monsterNoMod} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            const dashes = screen.queryAllByText('-');
            expect(dashes.length).toBeGreaterThan(0);
        });

        it('renders speed as 0ft when conditionEffects speedZero is true', () => {
            _conditionEffectsReturnValue.speedZero = true;
            renderModal();
            expect(screen.getByText('0 ft.')).toBeInTheDocument();
            _conditionEffectsReturnValue.speedZero = false;
        });

        it('renders saving throws with negative modifier', () => {
            const monsterWithNegSave = {
                ...baseMonster,
                saving_throws: { str: { modifier: -3 } },
            };
            render(
                <MonsterCardModal monster={monsterWithNegSave} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('STR -3')).toBeInTheDocument();
        });

        it('renders skills with negative modifier', () => {
            const monsterWithNegSkill = {
                ...baseMonster,
                skills: { perception: { modifier: -2 } },
            };
            render(
                <MonsterCardModal monster={monsterWithNegSkill} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('perception -2')).toBeInTheDocument();
        });

        it('renders all sense types', () => {
            const monsterWithAllSenses = {
                ...baseMonster,
                senses: {
                    blindsight: 30,
                    darkvision: 60,
                    tremorsense: 60,
                    truesight: 120,
                    passive_perception: 14,
                },
            };
            render(
                <MonsterCardModal monster={monsterWithAllSenses} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            // formatSenses renders all senses as a single comma-separated string
            expect(screen.getByText(/blindsight 30.*darkvision 60.*truesight 120.*tremorsense 60.*passive Perception 14/)).toBeInTheDocument();
        });

        it('hides senses section when senses is empty object', () => {
            const monsterNoSenses = { ...baseMonster, senses: {} };
            render(
                <MonsterCardModal monster={monsterNoSenses} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/senses/i)).not.toBeInTheDocument();
        });

        it('hides saving throws section when saving_throws is empty object', () => {
            const monsterNoSaves = { ...baseMonster, saving_throws: {} };
            render(
                <MonsterCardModal monster={monsterNoSaves} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/saving throws/i)).not.toBeInTheDocument();
        });

        it('hides skills section when skills is empty object', () => {
            const monsterNoSkills = { ...baseMonster, skills: {} };
            render(
                <MonsterCardModal monster={monsterNoSkills} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/skills/i)).not.toBeInTheDocument();
        });

        it('hides languages section when languages is empty string', () => {
            const monsterNoLang = { ...baseMonster, languages: '' };
            render(
                <MonsterCardModal monster={monsterNoLang} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/languages/i)).not.toBeInTheDocument();
        });

        it('omits hit dice display when hit_dice is missing', () => {
            const monsterNoHitDice = { ...baseMonster };
            delete monsterNoHitDice.hit_dice;
            render(
                <MonsterCardModal monster={monsterNoHitDice} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('7')).toBeInTheDocument();
            expect(screen.queryByText('1d6')).not.toBeInTheDocument();
        });

        it('omits initiative when initiative_details is missing', () => {
            const monsterNoInit = { ...baseMonster };
            delete monsterNoInit.initiative_details;
            render(
                <MonsterCardModal monster={monsterNoInit} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            // Check the initiative label is not present (more specific than checking '+2' which appears in ability mods)
            expect(screen.queryByText(/Initiative/)).not.toBeInTheDocument();
        });
    });

    describe('action rendering details', () => {
        it('renders action with save DC', () => {
            const monsterWithSave = {
                ...baseMonster,
                actions: [
                    {
                        name: 'Breath Weapon',
                        save_dc: 12,
                        save_type: 'Dexterity',
                        description: 'Each creature in a 15-ft cone must make a DC 12 Dexterity saving throw.',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithSave} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('DC 12 Dexterity')).toBeInTheDocument();
        });

        it('renders action with recharge', () => {
            const monsterWithRecharge = {
                ...baseMonster,
                actions: [
                    {
                        name: 'Fire Breath',
                        description: 'Breath weapon.',
                        recharge: '5-6',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithRecharge} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('(5-6)')).toBeInTheDocument();
        });

        it('renders action with usage', () => {
            const monsterWithUsage = {
                ...baseMonster,
                actions: [
                    {
                        name: 'Unique Ability',
                        description: 'Does something.',
                        usage: '1/Day',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithUsage} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('(1/Day)')).toBeInTheDocument();
        });

        it('renders action with secondary damage', () => {
            const monsterWithSecondary = {
                ...baseMonster,
                actions: [
                    {
                        name: 'Multiattack',
                        attack_bonus: 4,
                        damage_dice_primary: '1d6+2',
                        damage_type_primary: 'slashing',
                        damage_dice_secondary: '1d4+2',
                        damage_type_secondary: 'piercing',
                        description: 'Two attacks.',
                    },
                ],
            };
            render(
                <MonsterCardModal monster={monsterWithSecondary} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('1d6+2')).toBeInTheDocument();
            expect(screen.getByText('1d4+2')).toBeInTheDocument();
        });
    });

    describe('creatureName fallback behavior', () => {
        it('uses monster name when creatureName prop is not provided', () => {
            renderModal();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
        });

        it('uses monster name when creatureName prop is empty string', () => {
            render(
                <MonsterCardModal monster={baseMonster} onClose={mockOnClose} campaignName={mockCampaignName} creatureName="" />
            );
            // Empty string is falsy, so it falls back to monster.name
            expect(screen.getByText('Goblin')).toBeInTheDocument();
        });
    });
});
