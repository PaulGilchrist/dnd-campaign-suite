import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as automationPassives from '../../services/combat/automation/automationPassives.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath }) => {
        return <div data-testid={`avatar-${name}`} className="avatar-wrapper">{imagePath ? <img src={imagePath} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value, onChange, showBadge }) => {
        return <div data-testid="monster-autocomplete"><input data-testid="monster-name-input" value={value} onChange={(e) => onChange(e.target.value)} />{showBadge && <span data-testid="npc-match-badge">NPC Match</span>}</div>;
    }),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name, imageUrl, imagePath, onClick }) => {
        const src = imagePath || imageUrl;
        return <div data-testid={`npc-avatar-${name}`} className="npc-avatar" onClick={onClick}>{src ? <img src={src} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature, isLocalhost, onChange }) => {
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><input data-testid={`hp-input-${creature.name}`} type="number" defaultValue={creature.currentHp ?? 0} onBlur={(e) => onChange(creature.name, parseInt(e.target.value) || 0)} disabled={!isLocalhost && creature.type === 'player'} /><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
    }),
}));

vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ conditions, targetEffects, creatureName }) => {
        const children = [];
        (conditions || []).forEach(c => children.push(<span key={c.id} data-testid={`effect-condition-${c.id}`}>{c.label}</span>));
        (targetEffects || []).forEach(te => children.push(<span key={te.id} data-testid={`effect-target-${te.id}`}>{te.effect}</span>));
        return <div data-testid={`condition-effects-${creatureName}`}>{children}</div>;
    }),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    isBuffActive: vi.fn(() => false),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    useRuntimeValue: vi.fn((_campaignName, key) => {
        if (key === 'targetEffects') return runtimeTargetEffects;
        return null;
    }),
    getRuntimeValue: vi.fn((target, key, _campaignName) => {
        if (key === 'naturesSanctuaryActive') return sanctuaryMocks.naturesSanctuaryActive?.[target];
        if (key === 'naturesSanctuaryCreatures') return sanctuaryMocks.naturesSanctuaryCreatures?.[target];
        if (key === 'naturesSanctuaryResistance') return sanctuaryMocks.naturesSanctuaryResistance?.[target];
        if (key === 'wrathOfTheSeaActive') return wrathOfTheSeaMocks[target];
        if (key === 'concentration') return { spell: "Hunter's Mark" };
        if (key === 'targetEffects') return runtimeTargetEffects;
        if (key === 'activeBuffs') return runtimeActiveBuffs?.[target];
        return undefined;
    }),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

let sanctuaryMocks = {};
let wrathOfTheSeaMocks = {};
let runtimeTargetEffects = [];
let runtimeActiveBuffs = {};

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
    getResilientSphereSource: vi.fn(() => null),
}));

describe('CreatureCard', () => {
    let props;

    const defaultPlayerCreature = {
        name: 'Alice',
        type: 'player',
        currentHp: 20,
        maxHp: 20,
        initiative: 14,
        targetName: '',
        conditions: [],
        concentration: null,
    };

    const defaultNpcCreature = {
        name: 'Goblin',
        type: 'npc',
        currentHp: 7,
        maxHp: 7,
        initiative: 10,
        initiativeBonus: 2,
        targetName: '',
        conditions: [],
        concentration: null,
    };

    beforeEach(() => {
        props = {
            creature: defaultPlayerCreature,
            isActive: false,
            isLocalhost: true,
            campaignNpcs: [],
            overlays: [],
            allCreatures: [defaultPlayerCreature],
            campaignName: 'test-campaign',
            onRemoveNpc: vi.fn(),
            onNpcClick: vi.fn(),
            onNameChange: vi.fn(),
            onHpChange: vi.fn(),
            onInitiativeChange: vi.fn(),
            onTargetChange: vi.fn(),
            onRollConditionSave: vi.fn(),
            onBreakCondition: vi.fn(),
            onOpenEffectAdder: vi.fn(),
            onRollConcentrationSave: vi.fn(),
            onBreakConcentration: vi.fn(),
        };
        wrathOfTheSeaMocks = {};
        sanctuaryMocks = {};
        runtimeTargetEffects = [];
        runtimeActiveBuffs = {};
        buffToggle.isBuffActive.mockReturnValue(false);
    });

    describe('Nature\'s Sanctuary badge rendering', () => {
        it('should not render sanctuary badge when no sanctuary is active', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            expect(screen.queryByText('Sanctuary')).not.toBeInTheDocument();
        });

        it('should render sanctuary badge when creature is in sanctuary list', () => {
            sanctuaryMocks.naturesSanctuaryActive = { Druid: true };
            sanctuaryMocks.naturesSanctuaryCreatures = { Druid: ['Alice', 'Goblin'] };
            sanctuaryMocks.naturesSanctuaryResistance = { Druid: 'Fire' };

            const allCreatures = [
                { name: 'Druid', type: 'player' },
                { ...defaultPlayerCreature },
                { name: 'Goblin', type: 'npc' },
            ];

            render(<CreatureCard {...props} creature={allCreatures[1]} allCreatures={allCreatures} campaignName="test-campaign" />);
            expect(screen.getByText('Sanctuary')).toBeInTheDocument();
        });

        it('should not render sanctuary badge when creature is not in sanctuary list', () => {
            sanctuaryMocks.naturesSanctuaryActive = { Druid: true };
            sanctuaryMocks.naturesSanctuaryCreatures = { Druid: ['Goblin', 'Wolf'] };

            const allCreatures = [
                { name: 'Druid', type: 'player' },
                { ...defaultPlayerCreature },
                { name: 'Goblin', type: 'npc' },
            ];

            render(<CreatureCard {...props} creature={allCreatures[1]} allCreatures={allCreatures} campaignName="test-campaign" />);
            expect(screen.queryByText('Sanctuary')).not.toBeInTheDocument();
        });
    });

    describe('Starry Form badge rendering', () => {
        it('should render Starry Form badge with constellation when active', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key, _campaignName) => {
                if (key === 'activeBuffs' && target === 'Alice') {
                    return [{ name: 'Starry Form', constellation: 'Archer' }];
                }
                return undefined;
            });
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Starry Form - Archer')).toBeInTheDocument();
        });

        it.each([
            [{ name: 'Starry Form' }, 'Starry Form without constellation'],
            [[], 'empty activeBuffs array'],
            [null, 'null activeBuffs'],
        ])('should not render Starry Form badge when %s (%s)', (buffs, _description) => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'activeBuffs' && target === 'Alice') {
                    return buffs;
                }
                return undefined;
            });
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.queryByText(/Starry Form/)).not.toBeInTheDocument();
        });
    });

    describe('Death Ward badge rendering', () => {
        it('should render Death Ward badge when activeBuffs contains it', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'activeBuffs' && target === 'Alice') {
                    return [{ name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Bob' }];
                }
                return undefined;
            });
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Death Ward')).toBeInTheDocument();
        });

        it('should not render Death Ward badge when activeBuffs does not contain it', () => {
            runtimeState.getRuntimeValue.mockImplementation((_target, key) => {
                if (key === 'activeBuffs') return [{ name: 'Other Buff' }];
                return undefined;
            });
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.queryByText('Death Ward')).not.toBeInTheDocument();
        });
    });

    describe('Summoned badge rendering', () => {
        it.each([
            [{ target: 'Goblin', effect: 'summoned', source: 'Alice' }, 'Summoned (Alice)', [{ name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' }]],
            [{ target: 'Goblin', effect: 'summoned', source: null }, 'Summoned', [{ name: 'Goblin', type: 'npc' }]],
            [{ target: 'Goblin', effect: 'summoned', source: 'Orc' }, 'Summoned (Orc)', [{ name: 'Goblin', type: 'npc' }]],
        ])('should render %s when targetEffect has summoned effect with %s', (targetEffect, expectedLabel, allCreatures) => {
            runtimeState.useRuntimeValue.mockImplementation((_campaignName, key) => {
                if (key === 'targetEffects') return [targetEffect];
                return null;
            });
            const npcCreature = { ...defaultNpcCreature, name: 'Goblin' };
            render(<CreatureCard {...props} creature={npcCreature} allCreatures={allCreatures} campaignName="test-campaign" />);
            expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        });

        it('should not render summoned badge when no summoned targetEffects exist', () => {
            runtimeState.useRuntimeValue.mockImplementation((_campaignName, key) => {
                if (key === 'targetEffects') return [];
                return null;
            });
            render(<CreatureCard {...props} creature={defaultNpcCreature} campaignName="test-campaign" />);
            expect(screen.queryByText(/Summoned/)).not.toBeInTheDocument();
        });
    });

    describe('Resilient Sphere badge rendering', () => {
        it('should render Resilient Sphere badge when active', () => {
            vi.mocked(automationPassives.isResilientSphereActive).mockReturnValue(true);
            vi.mocked(automationPassives.getResilientSphereSource).mockReturnValue('Wizard');
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Resilient Sphere')).toBeInTheDocument();
            vi.mocked(automationPassives.isResilientSphereActive).mockReturnValue(false);
        });
    });
});
