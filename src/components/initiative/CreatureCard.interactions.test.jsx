import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as buffToggle from '../../services/automation/common/buffToggle.js';

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
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
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
        buffToggle.isBuffActive.mockReturnValue(false);
    });

    describe('NPC remove button', () => {
        it('should render remove button for NPC when isLocalhost is true', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            expect(screen.getByTitle('Remove NPC')).toBeInTheDocument();
        });

        it('should call onRemoveNpc when remove button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            fireEvent.click(screen.getByTitle('Remove NPC'));
            expect(props.onRemoveNpc).toHaveBeenCalledWith('Goblin');
        });

        it('should not render remove button for non-localhost', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();
        });

        it('should not render remove button for player creatures', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={true} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();
        });
    });

    describe('initiative input', () => {
        it('should call onInitiativeChange when initiative input blurs for both player and NPC', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const initiativeInput = screen.getByTestId('initiative-input');
            fireEvent.blur(initiativeInput, { target: { value: '20' } });
            expect(props.onInitiativeChange).toHaveBeenCalledWith('Alice', '20');
        });

        it('should call onInitiativeChange when initiative input blurs for NPC', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const initiativeInput = screen.getByTestId('initiative-input');
            fireEvent.blur(initiativeInput, { target: { value: '15' } });
            expect(props.onInitiativeChange).toHaveBeenCalledWith('Goblin', '15');
        });
    });

    describe('target select', () => {
        it('should call onTargetChange when target select changes for player', () => {
            const allCreatures = [defaultPlayerCreature, { name: 'Bob', type: 'player' }];
            render(<CreatureCard {...props} creature={defaultPlayerCreature} allCreatures={allCreatures} />);
            const targetSelect = screen.getByTestId('target-select');
            fireEvent.change(targetSelect, { target: { value: 'Bob' } });
            expect(props.onTargetChange).toHaveBeenCalledWith('Alice', 'Bob');
        });

        it('should disable target select for non-localhost NPC creatures', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            const targetSelect = screen.getByTestId('target-select');
            expect(targetSelect).toBeDisabled();
        });

        it('should set selected value to creature.targetName', () => {
            const creature = { ...defaultPlayerCreature, targetName: 'Bob' };
            const allCreatures = [creature, { name: 'Bob', type: 'player' }];
            render(<CreatureCard {...props} creature={creature} allCreatures={allCreatures} />);
            const targetSelect = screen.getByTestId('target-select');
            expect(targetSelect).toHaveValue('Bob');
        });
    });

    describe('NPC avatar click', () => {
        it('should call onNpcClick when NPC avatar is clicked', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const npcAvatar = screen.getByTestId('npc-avatar-Goblin');
            fireEvent.click(npcAvatar);
            expect(props.onNpcClick).toHaveBeenCalledWith(defaultNpcCreature, { allowNonLocalhost: true });
        });
    });

    describe('name change', () => {
        it('should call onNameChange with old name and new value for NPC', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const input = screen.getByTestId('monster-name-input');
            fireEvent.change(input, { target: { value: 'Kobold' } });
            expect(props.onNameChange).toHaveBeenCalledWith('Goblin', 'Kobold');
        });

        it('should not render a name input for player creatures (rendered as span)', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            expect(screen.queryByTestId('monster-name-input')).not.toBeInTheDocument();
        });
    });

    describe('HP change', () => {
        it('should call onHpChange when HP input blurs for both player and NPC', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const hpInput = screen.getByTestId('hp-input-Alice');
            fireEvent.blur(hpInput, { target: { value: '15' } });
            expect(props.onHpChange).toHaveBeenCalledWith('Alice', 15);
        });

        it('should call onHpChange when HP input blurs for NPC', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const hpInput = screen.getByTestId('hp-input-Goblin');
            fireEvent.blur(hpInput, { target: { value: '3' } });
            expect(props.onHpChange).toHaveBeenCalledWith('Goblin', 3);
        });
    });
});
