// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MonsterCardModal from './MonsterCardModal.jsx';

// ── Scope (base render contract, #763/#769 re-verification) ─────────────────
// This file owns the PRIMARY stat-block contract: null honesty, name +
// creatureName override (rendering.test.jsx :12 cedes these here), type-line
// subtype option, close button, single numeric 'walk 30' speed form
// (rendering.test.jsx :14 cedes), AC/HP/hit-dice/initiative, ability grid,
// defenses-row strings, IRV present/absent, legendary_resistance 3/day +
// null-hidden (rendering.test.jsx owns the falsy-zero '0/day' arm), action
// row formats (attack chip, damage-only row, save DC, recharge/usage notes —
// recharge-cone.test.jsx owns spend/rest economy, not this format leg),
// section census (traits/reactions/legendary/lair/regional/description),
// overlay non-close, missing-data dashes, speedZero display (helpers.test.jsx
// cedes speedZero here), senses empty-hidden + multi-sense join
// (senses-and-fallback.test.jsx :24 cedes).
// Mocks are bisected: conditionEffects rig backs the speedZero pin only
// (capture/store — stays per #755 restore rule); the rest short-circuit
// mount fetches/rolls that no test here presses.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../services/ui/sanitize.js', () => ({
    sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
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
    findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [] })),
    getResistanceNotice: vi.fn(() => null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
    getAbilitySaveModifier: vi.fn(() => 0),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
    let _speedZero = false;
    const computeConditionEffects = vi.fn(() => ({
        autoFailSaves: [],
        attackDisadvantageCount: 0,
        abilityCheckDisadvantage: false,
        strCheckDisadvantage: false,
        speedZero: _speedZero,
    }));
    return {
        computeConditionEffects,
        combineAttackModes: vi.fn(() => 'normal'),
        CONDITIONS_THAT_CANNOT_ACT: new Set(),
        __setSpeedZero(val) { _speedZero = val; },
    };
});

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
    useRuntimeValue: vi.fn((_campaign, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'inspiringMovementNoOA') return false;
        if (key === 'remarkableAthleteNoOA') return false;
        return null;
    }),
    getRuntimeValue: vi.fn((_characterKey, _propertyName) => null),
}));

// Re-import mocked modules for test setup helpers
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';

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

function renderMonster(monster) {
    return renderModal({ monster });
}

describe('MonsterCardModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        conditionEffects.__setSpeedZero(false);
    });

    describe('null/empty handling', () => {
        it('renders nothing when monster is null', () => {
            render(
                <MonsterCardModal monster={null} onClose={mockOnClose} campaignName={mockCampaignName} />
            );
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('header rendering', () => {
        it('renders monster name and overrides it with creatureName prop', () => {
            renderModal();
            expect(screen.getByText('Goblin')).toBeInTheDocument();

            cleanup();
            renderModal({ creatureName: 'Custom Goblin' });
            expect(screen.getByText('Custom Goblin')).toBeInTheDocument();
        });

        it('renders size/type line, with subtype only when present', () => {
            renderModal();
            expect(screen.getByText('Small Humanoid (Goblinoid), Neutral Evil')).toBeInTheDocument();

            cleanup();
            renderMonster({ ...baseMonster, subtype: null });
            expect(screen.getByText('Small Humanoid, Neutral Evil')).toBeInTheDocument();
            expect(screen.queryByText(/Goblinoid/)).not.toBeInTheDocument();
        });

        it('closes when the close button is clicked', () => {
            renderModal();
            const closeBtn = screen.getByRole('button', { name: /close/i });
            closeBtn.click();
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    describe('stats section', () => {
        it('renders armor class, hit points with hit dice, speed, and initiative', () => {
            renderModal();
            expect(screen.getByText('15')).toBeInTheDocument();
            expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
            expect(screen.getByText(/7\s*\(1d6\)/)).toBeInTheDocument();
            expect(screen.getByText('walk 30')).toBeInTheDocument();
            expect(screen.getByText(/Initiative/)).toBeInTheDocument();
        });

        it('renders all six ability scores with their modifiers', () => {
            renderModal();
            ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(label =>
                expect(screen.getByText(label)).toBeInTheDocument()
            );
            // scores str/int/wis=8, dex=14, con=10, cha=9
            expect(screen.getAllByText('8')).toHaveLength(3);
            expect(screen.getByText('14')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();
            expect(screen.getByText('9')).toBeInTheDocument();
            // mods: dex +2 (plus the '+2' initiative — exactly two), con +0, str/int/wis/cha -1
            expect(screen.getAllByText('+2')).toHaveLength(2);
            expect(screen.getByText('+0')).toBeInTheDocument();
            expect(screen.getAllByText('-1')).toHaveLength(4);
        });
    });

    describe('defenses section', () => {
        it('renders saving throws, skills, senses, languages, and CR/XP with exact bytes', () => {
            renderModal();
            expect(screen.getByText('DEX +2')).toBeInTheDocument();
            expect(screen.getByText('stealth +6')).toBeInTheDocument();
            expect(screen.getByText('darkvision 60, passive Perception 9')).toBeInTheDocument();
            expect(screen.getByText('Common, Goblin')).toBeInTheDocument();
            expect(screen.getByText('0.25 (50 XP)')).toBeInTheDocument();
        });

        it('formats large XP values with commas', () => {
            renderMonster({ ...baseMonster, xp: 4100 });
            expect(screen.getByText('0.25 (4,100 XP)')).toBeInTheDocument();
        });

        it('renders all four IRV rows when present', () => {
            renderMonster({
                ...baseMonster,
                damage_vulnerabilities: ['fire', 'cold'],
                damage_resistances: ['bludgeoning'],
                damage_immunities: ['poison', 'psychic'],
                condition_immunities: ['charmed', 'frightened'],
            });
            expect(screen.getByText('Damage Vuln.')).toBeInTheDocument();
            expect(screen.getByText('fire, cold')).toBeInTheDocument();
            expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
            expect(screen.getByText('bludgeoning')).toBeInTheDocument();
            expect(screen.getByText('Damage Imm')).toBeInTheDocument();
            expect(screen.getByText('poison, psychic')).toBeInTheDocument();
            expect(screen.getByText('Condition Imm')).toBeInTheDocument();
            expect(screen.getByText('charmed, frightened')).toBeInTheDocument();
        });

        it('hides all four IRV rows when absent', () => {
            renderModal();
            ['Damage Vuln.', 'Damage Resist.', 'Damage Imm', 'Condition Imm'].forEach(label =>
                expect(screen.queryByText(label)).not.toBeInTheDocument()
            );
        });

        it('renders legendary resistance when present and hides when absent', () => {
            renderMonster({ ...baseMonster, legendary_resistance: 3 });
            expect(screen.getByText('Legendary Resist.')).toBeInTheDocument();
            expect(screen.getByText('3/day')).toBeInTheDocument();

            // The gate is `legendary_resistance != null` — null and undefined
            // are the same arm (falsy-zero '0/day' owned by rendering.test.jsx).
            cleanup();
            renderMonster({ ...baseMonster, legendary_resistance: null });
            expect(screen.queryByText('Legendary Resist.')).not.toBeInTheDocument();
        });
    });

    describe('actions, traits, reactions, and legendary actions', () => {
        it('renders attack rows with name, attack chip, and description — and no recharge/usage notes on plain rows', () => {
            renderModal();
            expect(screen.getByText('Actions')).toBeInTheDocument();
            expect(screen.getByText(/Scimitar/)).toBeInTheDocument();
            expect(screen.getByText(/Melee Weapon Attack/)).toBeInTheDocument();
            expect(screen.getByText('+4')).toBeInTheDocument();
            expect(screen.queryByText('(5-6)')).not.toBeInTheDocument();
            expect(screen.queryByText('(1/Day)')).not.toBeInTheDocument();
        });

        it('renders primary and secondary damage chips on a row with no attack bonus', () => {
            renderMonster({
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
            });
            expect(screen.getByText('1d6+2')).toBeInTheDocument();
            expect(screen.getByText('1d4+2')).toBeInTheDocument();
        });

        it('renders action with save DC', () => {
            renderMonster({
                ...baseMonster,
                actions: [
                    {
                        name: 'Breath Weapon',
                        save_dc: 12,
                        save_type: 'Dexterity',
                        description: 'Each creature in a 15-ft cone must make a DC 12 Dexterity saving throw.',
                    },
                ],
            });
            expect(screen.getByText('DC 12 Dexterity')).toBeInTheDocument();
        });

        it('renders recharge and usage notes when authored', () => {
            renderMonster({
                ...baseMonster,
                actions: [{ name: 'Fire Breath', description: 'Breath weapon.', recharge: '5-6', usage: '1/Day' }],
            });
            expect(screen.getByText('(5-6)')).toBeInTheDocument();
            expect(screen.getByText('(1/Day)')).toBeInTheDocument();
        });

        it('renders traits rows when present and not on the base card (traits sections are untitled)', () => {
            renderMonster({
                ...baseMonster,
                traits: [{ name: 'Nimble Escape', description: 'The goblin can take the Disengage or Hide action.' }],
            });
            expect(screen.getByText(/Nimble Escape/)).toBeInTheDocument();

            cleanup();
            renderModal();
            expect(screen.queryByText(/Nimble Escape/)).not.toBeInTheDocument();
        });

        it('renders reactions section when present and hides when empty', () => {
            renderMonster({
                ...baseMonster,
                reactions: [{ name: 'Reaction', description: 'When a creature attacks the goblin...' }],
            });
            expect(screen.getByText(/Reactions/)).toBeInTheDocument();
            expect(screen.getByText(/When a creature attacks/)).toBeInTheDocument();

            cleanup();
            renderModal();
            expect(screen.queryByText(/reactions/i)).not.toBeInTheDocument();
        });

        it('renders legendary actions section when present and hides when empty', () => {
            renderMonster({
                ...baseMonster,
                legendary_actions: [{ name: 'Goblin Agility', description: 'The goblin takes a bonus action.' }],
            });
            expect(screen.getByText(/Legendary Actions/)).toBeInTheDocument();
            expect(screen.getByText(/The goblin takes a bonus action/)).toBeInTheDocument();

            cleanup();
            renderModal();
            expect(screen.queryByText(/legendary actions/i)).not.toBeInTheDocument();
        });
    });

    describe('overlay and interaction behavior', () => {
        it('does not close when the overlay background or the card is clicked', () => {
            renderModal();

            const overlay = document.querySelector('.mc-overlay');
            const card = document.querySelector('.mc-card');

            mockOnClose.mockClear();
            overlay.click();
            expect(mockOnClose).not.toHaveBeenCalled();
            expect(card).toBeInTheDocument();

            mockOnClose.mockClear();
            card.click();
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });

    describe('optional sections', () => {
        it('renders description with book/page reference, book alone, or not at all', () => {
            renderMonster({
                ...baseMonster,
                desc: 'A small but vicious creature.',
                book: 'Monster Manual',
                page: 310,
            });
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('A small but vicious creature.')).toBeInTheDocument();
            expect(screen.getByText('Monster Manual (page 310)')).toBeInTheDocument();

            cleanup();
            renderMonster({ ...baseMonster, desc: 'A small but vicious creature.', book: 'Monster Manual' });
            expect(screen.getByText('Monster Manual')).toBeInTheDocument();
            expect(screen.queryByText(/page/i)).not.toBeInTheDocument();

            cleanup();
            const monsterNoDesc = { ...baseMonster };
            delete monsterNoDesc.desc;
            renderMonster(monsterNoDesc);
            expect(screen.queryByText('Description')).not.toBeInTheDocument();
        });

        it('renders Lair Actions for array and object shapes, and hides when absent', () => {
            renderMonster({ ...baseMonster, lair_actions: ['The goblin hides in the shadows.'] });
            expect(screen.getByText('Lair Actions')).toBeInTheDocument();
            expect(screen.getByText('The goblin hides in the shadows.')).toBeInTheDocument();

            cleanup();
            renderMonster({ ...baseMonster, lair_actions: { actions: ['The lair is cursed.'] } });
            expect(screen.getByText('Lair Actions')).toBeInTheDocument();
            expect(screen.getByText('The lair is cursed.')).toBeInTheDocument();

            cleanup();
            const monsterNoLair = { ...baseMonster };
            delete monsterNoLair.lair_actions;
            renderMonster(monsterNoLair);
            expect(screen.queryByText(/lair actions/i)).not.toBeInTheDocument();
        });

        it('renders Regional Effects for array and object shapes, and hides when absent', () => {
            renderMonster({ ...baseMonster, regional_effects: ['The air is thick with magic.'] });
            expect(screen.getByText('Regional Effects')).toBeInTheDocument();
            expect(screen.getByText('The air is thick with magic.')).toBeInTheDocument();

            cleanup();
            renderMonster({ ...baseMonster, regional_effects: { effects: [{ description: 'The winds howl.' }] } });
            expect(screen.getByText('Regional Effects')).toBeInTheDocument();
            expect(screen.getByText('The winds howl.')).toBeInTheDocument();

            cleanup();
            const monsterNoRegional = { ...baseMonster };
            delete monsterNoRegional.regional_effects;
            renderMonster(monsterNoRegional);
            expect(screen.queryByText(/regional effects/i)).not.toBeInTheDocument();
        });
    });

    describe('edge cases for abilities and defenses', () => {
        it('renders dashes for every score and modifier cell when ability data is missing', () => {
            renderMonster({ ...baseMonster, ability_scores: undefined, ability_score_modifiers: undefined });
            expect(screen.getAllByText('-')).toHaveLength(12);
        });

        it('renders speed as 0ft when conditionEffects speedZero is true', () => {
            conditionEffects.__setSpeedZero(true);
            renderModal();
            expect(screen.getByText('0 ft.')).toBeInTheDocument();
        });

        it('renders negative saving throw and skill modifiers', () => {
            renderMonster({
                ...baseMonster,
                saving_throws: { str: { modifier: -3 } },
                skills: { perception: { modifier: -2 } },
            });
            expect(screen.getByText('STR -3')).toBeInTheDocument();
            expect(screen.getByText('perception -2')).toBeInTheDocument();
        });

        it('renders all sense types comma-joined in authored order', () => {
            renderMonster({
                ...baseMonster,
                senses: {
                    blindsight: 30,
                    darkvision: 60,
                    tremorsense: 60,
                    truesight: 120,
                    passive_perception: 14,
                },
            });
            expect(screen.getByText('blindsight 30, darkvision 60, truesight 120, tremorsense 60, passive Perception 14')).toBeInTheDocument();
        });

        it('hides senses when empty', () => {
            renderMonster({ ...baseMonster, senses: {} });
            expect(screen.queryByText(/senses/i)).not.toBeInTheDocument();
        });

        it('hides saving throws, skills, and languages rows when empty', () => {
            renderMonster({ ...baseMonster, saving_throws: {}, skills: {}, languages: '' });
            expect(screen.queryByText(/saving throws/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/skills/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/languages/i)).not.toBeInTheDocument();
        });

        it('omits hit dice and initiative when missing', () => {
            renderMonster({ ...baseMonster, hit_dice: undefined, initiative_details: undefined });
            expect(screen.getByText('7')).toBeInTheDocument();
            expect(screen.queryByText('1d6')).not.toBeInTheDocument();
            expect(screen.queryByText(/Initiative/)).not.toBeInTheDocument();
        });
    });
});
