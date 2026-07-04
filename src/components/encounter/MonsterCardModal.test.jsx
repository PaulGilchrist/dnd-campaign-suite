// @cleaned-by-ai
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
        it('returns null when monster is null or undefined', () => {
            const { container: c1 } = render(
                <MonsterCardModal monster={null} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(c1.innerHTML).toBe('');

            const { container: c2 } = render(
                <MonsterCardModal onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(c2.innerHTML).toBe('');
        });
    });

    describe('header rendering', () => {
        it('renders monster name and creatureName override', () => {
            renderModal();
            expect(screen.getByText('Goblin')).toBeInTheDocument();

            renderModal({ creatureName: 'Custom Goblin' });
            expect(screen.getByText('Custom Goblin')).toBeInTheDocument();
        });

        it('renders size and type with optional subtype', () => {
            renderModal();
            expect(screen.getByText(/Small Humanoid \(Goblinoid\), Neutral Evil/)).toBeInTheDocument();

            const monsterWithoutSubtype = { ...baseMonster, subtype: null };
            render(
                <MonsterCardModal monster={monsterWithoutSubtype} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Small Humanoid, Neutral Evil/)).toBeInTheDocument();
            expect(screen.queryByText(/Goblinoid/)).not.toBeInTheDocument();
        });

        it('closes when close button or header is clicked', () => {
            renderModal();

            const closeBtn = screen.getByRole('button', { name: /close/i });
            closeBtn.click();
            expect(mockOnClose).toHaveBeenCalled();

            mockOnClose.mockClear();
            const header = document.querySelector('.mc-header');
            header.click();
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    describe('stats section', () => {
        it('renders armor class, hit points, hit dice, speed, and initiative', () => {
            renderModal();
            expect(screen.getByText('15')).toBeInTheDocument();
            expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
            expect(screen.getByText(/7\s*\(1d6\)/)).toBeInTheDocument();
            expect(screen.getByText('walk 30')).toBeInTheDocument();
            expect(screen.getByText(/Initiative/)).toBeInTheDocument();
        });

        it('renders all six ability scores with modifiers', () => {
            renderModal();
            expect(screen.getByText('STR')).toBeInTheDocument();
            expect(screen.getByText('DEX')).toBeInTheDocument();
            expect(screen.getByText('CON')).toBeInTheDocument();
            expect(screen.getByText('INT')).toBeInTheDocument();
            expect(screen.getByText('WIS')).toBeInTheDocument();
            expect(screen.getByText('CHA')).toBeInTheDocument();
            expect(screen.getByText('14')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
            expect(screen.getByText('9')).toBeInTheDocument();
            expect(screen.getAllByText('+2').length).toBeGreaterThan(0);
            expect(screen.getByText('+0')).toBeInTheDocument();
            expect(screen.getAllByText('-1').length).toBeGreaterThan(0);
        });
    });

    describe('defenses section', () => {
        it('renders saving throws, skills, senses, languages, and CR/XP', () => {
            renderModal();
            expect(screen.getByText(/DEX.*2/)).toBeInTheDocument();
            expect(screen.getByText(/stealth.*6/)).toBeInTheDocument();
            expect(screen.getByText(/darkvision.*60/)).toBeInTheDocument();
            expect(screen.getByText(/passive Perception.*9/)).toBeInTheDocument();
            expect(screen.getByText('Common, Goblin')).toBeInTheDocument();
            expect(screen.getByText(/0\.25/)).toBeInTheDocument();
            expect(screen.getByText(/50 XP/)).toBeInTheDocument();
        });

        it('formats large XP values with commas', () => {
            const monsterWithLargeXp = { ...baseMonster, xp: 4100 };
            render(
                <MonsterCardModal monster={monsterWithLargeXp} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/4,100 XP/)).toBeInTheDocument();
        });

        it.each([
            { field: 'damage_vulnerabilities', label: 'Damage Vuln.', value: 'fire, cold', data: ['fire', 'cold'] },
            { field: 'damage_resistances', label: 'Damage Resist.', value: 'bludgeoning', data: ['bludgeoning'] },
            { field: 'damage_immunities', label: 'Damage Imm', value: 'poison, psychic', data: ['poison', 'psychic'] },
            { field: 'condition_immunities', label: 'Condition Imm', value: 'charmed, frightened', data: ['charmed', 'frightened'] },
        ])('renders $label when $field is present and hides when absent', ({ field, label, value, data }) => {
            const monster = { ...baseMonster, [field]: data };
            render(
                <MonsterCardModal monster={monster} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(label)).toBeInTheDocument();
            expect(screen.getByText(value)).toBeInTheDocument();
        });

        it.each([
            { field: 'damage_vulnerabilities', value: 'fire, cold' },
            { field: 'damage_resistances', value: 'bludgeoning' },
            { field: 'damage_immunities', value: 'poison, psychic' },
            { field: 'condition_immunities', value: 'charmed, frightened' },
        ])('hides row when $field is absent', ({ field, value }) => {
            renderModal();
            expect(screen.queryByText(value)).not.toBeInTheDocument();
        });

        it('renders legendary resistance when present and hides when absent', () => {
            const monsterWithLegendaryRes = { ...baseMonster, legendary_resistance: 3 };
            render(
                <MonsterCardModal monster={monsterWithLegendaryRes} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Legendary Resist.')).toBeInTheDocument();
            expect(screen.getByText('3/day')).toBeInTheDocument();

            const monsterNullLegendary = { ...baseMonster, legendary_resistance: null };
            render(
                <MonsterCardModal monster={monsterNullLegendary} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText('Legendary Resist.')).not.toBeInTheDocument();

            const monsterUndefinedLegendary = { ...baseMonster };
            delete monsterUndefinedLegendary.legendary_resistance;
            render(
                <MonsterCardModal monster={monsterUndefinedLegendary} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText('Legendary Resist.')).not.toBeInTheDocument();
        });
    });

    describe('actions, traits, reactions, and legendary actions', () => {
        it('renders monster actions with attack bonus, damage dice, and description', () => {
            renderModal();
            expect(screen.getByText('Actions')).toBeInTheDocument();
            expect(screen.getByText(/Scimitar/)).toBeInTheDocument();
            expect(screen.getByText(/Melee Weapon Attack/)).toBeInTheDocument();
            expect(screen.getByText('+4')).toBeInTheDocument();
        });

        it('renders action damage dice when no attack bonus', () => {
            const monsterNoAttack = {
                ...baseMonster,
                actions: [{
                    name: 'Bite',
                    damage_dice_primary: '1d6+2',
                    damage_type_primary: 'piercing',
                }],
            };
            render(
                <MonsterCardModal monster={monsterNoAttack} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('1d6+2')).toBeInTheDocument();
        });

        it('renders action with save DC, recharge, usage, and secondary damage', () => {
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

            const monsterWithRecharge = {
                ...baseMonster,
                actions: [{ name: 'Fire Breath', description: 'Breath weapon.', recharge: '5-6' }];
            };
            render(
                <MonsterCardModal monster={monsterWithRecharge} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('(5-6)')).toBeInTheDocument();

            const monsterWithUsage = {
                ...baseMonster,
                actions: [{ name: 'Unique Ability', description: 'Does something.', usage: '1/Day' }];
            };
            render(
                <MonsterCardModal monster={monsterWithUsage} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('(1/Day)')).toBeInTheDocument();

            const monsterWithSecondary = {
                ...baseMonster,
                actions: [{
                    name: 'Multiattack',
                    attack_bonus: null,
                    damage_dice_primary: '1d6+2',
                    damage_type_primary: 'slashing',
                    damage_dice_secondary: '1d4+2',
                    damage_type_secondary: 'piercing',
                    description: 'Two attacks.',
                }],
            };
            render(
                <MonsterCardModal monster={monsterWithSecondary} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('1d6+2')).toBeInTheDocument();
            expect(screen.getByText('1d4+2')).toBeInTheDocument();
        });

        it('renders traits, reactions, and legendary actions sections', () => {
            const monsterWithTraits = {
                ...baseMonster,
                traits: [{ name: 'Nimble Escape', description: 'The goblin can take the Disengage or Hide action.' }],
            };
            render(
                <MonsterCardModal monster={monsterWithTraits} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Nimble Escape/)).toBeInTheDocument();

            const monsterWithReactions = {
                ...baseMonster,
                reactions: [{ name: 'Reaction', description: 'When a creature attacks the goblin...' }],
            };
            render(
                <MonsterCardModal monster={monsterWithReactions} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Reactions/)).toBeInTheDocument();
            expect(screen.getByText(/When a creature attacks/)).toBeInTheDocument();

            const monsterWithLegendaryActions = {
                ...baseMonster,
                legendary_actions: [{ name: 'Goblin Agility', description: 'The goblin takes a bonus action.' }],
            };
            render(
                <MonsterCardModal monster={monsterWithLegendaryActions} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText(/Legendary Actions/)).toBeInTheDocument();
            expect(screen.getByText(/The goblin takes a bonus action/)).toBeInTheDocument();
        });

        it('hides sections when arrays are empty or undefined', () => {
            renderModal();
            expect(screen.queryByText(/traits/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/reactions/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/legendary actions/i)).not.toBeInTheDocument();

            const monsterNoTraits = { ...baseMonster };
            delete monsterNoTraits.traits;
            render(
                <MonsterCardModal monster={monsterNoTraits} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/traits/i)).not.toBeInTheDocument();
        });
    });

    describe('overlay and interaction behavior', () => {
        it('renders overlay and card, closes on overlay click but not card click', () => {
            renderModal();

            const overlay = document.querySelector('.mc-overlay');
            expect(overlay).toBeInTheDocument();

            const card = document.querySelector('.mc-card');
            expect(card).toBeInTheDocument();

            mockOnClose.mockClear();
            overlay.click();
            expect(mockOnClose).toHaveBeenCalled();

            mockOnClose.mockClear();
            card.click();
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('optional sections', () => {
        it('renders description with optional book and page', () => {
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

            const monsterNoDesc = { ...baseMonster };
            delete monsterNoDesc.desc;
            render(
                <MonsterCardModal monster={monsterNoDesc} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText('Description')).not.toBeInTheDocument();
        });

        it.each([
            { name: 'array', data: ['The goblin hides in the shadows.'] },
            { name: 'object with actions', data: { actions: ['The laum is cursed.'] } },
        ])('renders lair actions when lair_actions is an $name', ({ data }) => {
            const monster = { ...baseMonster, lair_actions: data };
            render(
                <MonsterCardModal monster={monster} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Lair Actions')).toBeInTheDocument();
        });

        it('hides lair actions when absent', () => {
            const monsterNoLair = { ...baseMonster };
            delete monsterNoLair.lair_actions;
            render(
                <MonsterCardModal monster={monsterNoLair} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/lair actions/i)).not.toBeInTheDocument();
        });

        it.each([
            { name: 'array', data: ['The air is thick with magic.'] },
            { name: 'object with effects', data: { effects: [{ description: 'The winds howl.' }] } },
        ])('renders regional effects when regional_effects is an $name', ({ data }) => {
            const monster = { ...baseMonster, regional_effects: data };
            render(
                <MonsterCardModal monster={monster} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('Regional Effects')).toBeInTheDocument();
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
        it('renders dash for score and modifier when ability data is missing', () => {
            const monsterNoAbilities = { ...baseMonster, ability_scores: undefined };
            render(
                <MonsterCardModal monster={monsterNoAbilities} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            const dashes = screen.queryAllByText('-');
            expect(dashes.length).toBeGreaterThan(0);

            const monsterNoMod = { ...baseMonster, ability_score_modifiers: undefined };
            render(
                <MonsterCardModal monster={monsterNoMod} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            const dashes2 = screen.queryAllByText('-');
            expect(dashes2.length).toBeGreaterThan(0);
        });

        it('renders speed as 0ft when conditionEffects speedZero is true', () => {
            _conditionEffectsReturnValue.speedZero = true;
            renderModal();
            expect(screen.getByText('0 ft.')).toBeInTheDocument();
            _conditionEffectsReturnValue.speedZero = false;
        });

        it('renders saving throws and skills with negative modifiers', () => {
            const monsterWithNegSave = {
                ...baseMonster,
                saving_throws: { str: { modifier: -3 } },
            };
            render(
                <MonsterCardModal monster={monsterWithNegSave} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('STR -3')).toBeInTheDocument();

            const monsterWithNegSkill = {
                ...baseMonster,
                skills: { perception: { modifier: -2 } },
            };
            render(
                <MonsterCardModal monster={monsterWithNegSkill} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('perception -2')).toBeInTheDocument();
        });

        it('renders all sense types and hides when empty', () => {
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
            expect(screen.getByText(/blindsight 30.*darkvision 60.*truesight 120.*tremorsense 60.*passive Perception 14/)).toBeInTheDocument();

            const monsterNoSenses = { ...baseMonster, senses: {} };
            render(
                <MonsterCardModal monster={monsterNoSenses} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/senses/i)).not.toBeInTheDocument();
        });

        it('hides sections when saving_throws, skills, or languages are empty', () => {
            const monsterNoSaves = { ...baseMonster, saving_throws: {} };
            render(
                <MonsterCardModal monster={monsterNoSaves} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/saving throws/i)).not.toBeInTheDocument();

            const monsterNoSkills = { ...baseMonster, skills: {} };
            render(
                <MonsterCardModal monster={monsterNoSkills} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/skills/i)).not.toBeInTheDocument();

            const monsterNoLang = { ...baseMonster, languages: '' };
            render(
                <MonsterCardModal monster={monsterNoLang} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/languages/i)).not.toBeInTheDocument();
        });

        it('omits hit dice and initiative when missing', () => {
            const monsterNoHitDice = { ...baseMonster };
            delete monsterNoHitDice.hit_dice;
            render(
                <MonsterCardModal monster={monsterNoHitDice} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.getByText('7')).toBeInTheDocument();
            expect(screen.queryByText('1d6')).not.toBeInTheDocument();

            const monsterNoInit = { ...baseMonster };
            delete monsterNoInit.initiative_details;
            render(
                <MonsterCardModal monster={monsterNoInit} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByText(/Initiative/)).not.toBeInTheDocument();
        });

        it('uses monster name when creatureName prop is not provided or empty', () => {
            renderModal();
            expect(screen.getByText('Goblin')).toBeInTheDocument();

            render(
                <MonsterCardModal monster={baseMonster} onClose={mockOnClose} campaignName={mockCampaignName} creatureName="" />
            );
            expect(screen.getByText('Goblin')).toBeInTheDocument();
        });
    });
});
