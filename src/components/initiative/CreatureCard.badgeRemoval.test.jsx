import { render, screen, fireEvent } from '@testing-library/react';
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
        if (key === 'targetEffects') return [];
        return null;
    }),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
    getResilientSphereSource: vi.fn(() => null),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({
    cleanupWildShape: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
    revertPolymorph: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
    revertAnimalShapes: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
    revertShapechange: vi.fn(),
}));

describe('CreatureCard - badge removal actions', () => {
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
        runtimeState.getRuntimeValue.mockImplementation((_target, _key) => null);
        runtimeState.setRuntimeValue.mockClear();
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
        buffToggle.isBuffActive.mockReturnValue(false);
    });

    function getRemoveButtons() {
        return Array.from(document.querySelectorAll('.creature-badge-remove'));
    }

    describe('Hunter\'s Mark concentration removal', () => {
        it('should clear concentration on the marking creature when remove clicked', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'concentration' && target === 'Ranger') {
                    return { spell: "Hunter's Mark", target: 'Alice' };
                }
                return null;
            });
            const allCreatures = [
                { name: 'Ranger', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Alice' } },
                { ...defaultPlayerCreature },
            ];
            render(<CreatureCard {...props} creature={allCreatures[1]} allCreatures={allCreatures} campaignName="test-campaign" />);
            const removeBtns = getRemoveButtons();
            expect(removeBtns.length).toBe(1);
            fireEvent.click(removeBtns[0]);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ranger', 'concentration', null, 'test-campaign');
        });

        it('should not render remove button for non-localhost', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'concentration' && target === 'Ranger') {
                    return { spell: "Hunter's Mark", target: 'Alice' };
                }
                return null;
            });
            const allCreatures = [
                { name: 'Ranger', type: 'player', concentration: { spell: "Hunter's Mark", target: 'Alice' } },
                { ...defaultPlayerCreature },
            ];
            render(<CreatureCard {...props} creature={allCreatures[1]} allCreatures={allCreatures} campaignName="test-campaign" isLocalhost={false} />);
            expect(screen.getByText("Hunter's Mark")).toBeInTheDocument();
            expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
        });
    });

    describe('Transformation spell removal', () => {
        const transformationSpells = [
            { effect: 'polymorph', label: 'Polymorph' },
            { effect: 'animal_shapes', label: 'Animal Shapes' },
            { effect: 'shapechange', label: 'Shapechange' },
        ];

        it.each(transformationSpells)(
            'should revert %s when badge remove clicked',
            ({ effect, label }) => {
                runtimeState.useRuntimeValue.mockImplementation((_campaignName, key) => {
                    if (key === 'targetEffects') return [{ target: 'Alice', effect }];
                    return null;
                });
                runtimeState.getRuntimeValue.mockImplementation((_target, _key) => null);
                render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
                expect(screen.getByText(label)).toBeInTheDocument();
                const removeBtns = getRemoveButtons();
                expect(removeBtns.length).toBe(1);
                fireEvent.click(removeBtns[0]);
                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            }
        );
    });

    describe('Wild Shape removal', () => {
        it('should cleanup wild shape when badge remove clicked', () => {
            vi.mocked(buffToggle.isBuffActive).mockReturnValue(true);
            runtimeState.getRuntimeValue.mockImplementation((_target, _key) => null);
            runtimeState.setRuntimeValue.mockClear();
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Wild Shape')).toBeInTheDocument();
            const wsBadge = screen.getByText('Wild Shape').closest('[class*="creature-badge"]');
            const removeBtn = wsBadge?.parentElement?.querySelector('.creature-badge-remove') || wsBadge?.querySelector('.creature-badge-remove');
            expect(removeBtn).toBeInTheDocument();
            fireEvent.click(removeBtn);
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('Wrath of the Sea removal', () => {
        it('should set wrathOfTheSeaActive to false when remove clicked', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'wrathOfTheSeaActive' && target === 'Alice') return true;
                return null;
            });
            runtimeState.setRuntimeValue.mockClear();
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Wrath of the Sea')).toBeInTheDocument();
            const wsBadge = screen.getByText('Wrath of the Sea').closest('[class*="creature-badge"]');
            const removeBtn = wsBadge?.parentElement?.querySelector('.creature-badge-remove') || wsBadge?.querySelector('.creature-badge-remove');
            expect(removeBtn).toBeInTheDocument();
            fireEvent.click(removeBtn);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'wrathOfTheSeaActive', false, 'test-campaign');
        });
    });

    describe("Nature's Sanctuary removal", () => {
        it('should remove creature from sanctuary list when remove clicked', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'naturesSanctuaryActive' && target === 'Druid') return true;
                if (key === 'naturesSanctuaryCreatures' && target === 'Druid') return ['Alice', 'Bob'];
                if (key === 'naturesSanctuaryResistance' && target === 'Druid') return 'Fire';
                return null;
            });
            runtimeState.setRuntimeValue.mockClear();
            const allCreatures = [
                { name: 'Druid', type: 'player' },
                { ...defaultPlayerCreature },
            ];
            render(<CreatureCard {...props} creature={allCreatures[1]} allCreatures={allCreatures} campaignName="test-campaign" />);
            expect(screen.getByText('Sanctuary')).toBeInTheDocument();
            const sanctuaryBadge = screen.getByText('Sanctuary').closest('[class*="creature-badge"]');
            const removeBtn = sanctuaryBadge?.parentElement?.querySelector('.creature-badge-remove') || sanctuaryBadge?.querySelector('.creature-badge-remove');
            expect(removeBtn).toBeInTheDocument();
            fireEvent.click(removeBtn);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Druid', 'naturesSanctuaryCreatures', ['Bob'], 'test-campaign');
        });
    });

    describe('Reckless Attack removal', () => {
        it('should filter out the reckless_attack targetEffect when remove clicked', () => {
            runtimeState.useRuntimeValue.mockImplementation((_campaignName, key) => {
                if (key === 'targetEffects') return [{ target: 'Alice', effect: 'reckless_attack' }];
                return null;
            });
            runtimeState.getRuntimeValue.mockImplementation((_target, _key) => null);
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Reckless Attack')).toBeInTheDocument();
            const removeBtns = getRemoveButtons();
            expect(removeBtns.length).toBe(1);
            fireEvent.click(removeBtns[0]);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        });
    });

    describe('Summoned badge removal', () => {
        it('should remove only the clicked summoner\'s effect when multiple summons present', () => {
            runtimeState.useRuntimeValue.mockImplementation((_campaignName, key) => {
                if (key === 'targetEffects') return [
                    { target: 'Goblin', effect: 'summoned', source: 'Alice' },
                    { target: 'Goblin', effect: 'summoned', source: 'Bob' },
                ];
                return null;
            });
            runtimeState.getRuntimeValue.mockImplementation((_target, _key) => null);
            const allCreatures = [
                { name: 'Alice', type: 'player' },
                { name: 'Bob', type: 'player' },
                { ...defaultNpcCreature },
            ];
            render(<CreatureCard {...props} creature={allCreatures[2]} allCreatures={allCreatures} campaignName="test-campaign" />);
            const removeBtns = getRemoveButtons();
            expect(removeBtns.length).toBe(2);
            fireEvent.click(removeBtns[0]);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'test-campaign');
        });
    });

    describe('Resilient Sphere removal', () => {
        it('should filter out resilient_sphere targetEffect when remove clicked', () => {
            vi.mocked(automationPassives.isResilientSphereActive).mockReturnValue(true);
            vi.mocked(automationPassives.getResilientSphereSource).mockReturnValue('Wizard');
            runtimeState.getRuntimeValue.mockImplementation((_target, _key) => null);
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Resilient Sphere')).toBeInTheDocument();
            const removeBtns = getRemoveButtons();
            expect(removeBtns.length).toBe(1);
            fireEvent.click(removeBtns[0]);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        });
    });

    describe('Starry Form removal', () => {
        it('should remove Starry Form buff and targetEffect when remove clicked', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'activeBuffs' && target === 'Alice') return [{ name: 'Starry Form', constellation: 'Chalice' }];
                if (key === 'targetEffects') return [{ effect: 'starry_form', source: 'Alice' }];
                return null;
            });
            runtimeState.setRuntimeValue.mockClear();
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Starry Form - Chalice')).toBeInTheDocument();
            const starryBadge = screen.getByText('Starry Form - Chalice').closest('[class*="creature-badge"]');
            const removeBtn = starryBadge?.parentElement?.querySelector('.creature-badge-remove') || starryBadge?.querySelector('.creature-badge-remove');
            expect(removeBtn).toBeInTheDocument();
            fireEvent.click(removeBtn);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeBuffs', [], 'test-campaign');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign', true);
        });
    });

    describe('Death Ward removal', () => {
        it('should filter out Death Ward buff when remove clicked', () => {
            runtimeState.getRuntimeValue.mockImplementation((target, key) => {
                if (key === 'activeBuffs' && target === 'Alice') return [{ name: 'Death Ward', effect: 'death_ward', sourceCharacter: 'Bob' }];
                return null;
            });
            runtimeState.setRuntimeValue.mockClear();
            render(<CreatureCard {...props} creature={defaultPlayerCreature} campaignName="test-campaign" />);
            expect(screen.getByText('Death Ward')).toBeInTheDocument();
            const dwBadge = screen.getByText('Death Ward').closest('[class*="creature-badge"]');
            const removeBtn = dwBadge?.parentElement?.querySelector('.creature-badge-remove') || dwBadge?.querySelector('.creature-badge-remove');
            expect(removeBtn).toBeInTheDocument();
            fireEvent.click(removeBtn);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeBuffs', [], 'test-campaign');
        });
    });

});
