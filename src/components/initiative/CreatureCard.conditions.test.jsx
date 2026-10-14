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
    useRuntimeValue: vi.fn((_campaignName, key) => {
        if (key === 'targetEffects') return [];
        return null;
    }),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

describe('CreatureCard - conditions', () => {
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

    describe('condition badges', () => {
        it('should call onRollConditionSave when condition badge is clicked for player', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            fireEvent.click(screen.getByText('Blinded DC 12'));
            expect(props.onRollConditionSave).toHaveBeenCalledWith('Alice', conditions[0]);
        });

        it('should not trigger onRollConditionSave when condition badge is clicked for non-localhost NPC', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, conditions }} isLocalhost={false} />);
            const conditionBadge = screen.getByText('Blinded DC 12');
            fireEvent.click(conditionBadge);
            expect(props.onRollConditionSave).not.toHaveBeenCalled();
        });

        it('should call onBreakCondition when break button is clicked', () => {
            const conditions = [{ id: 'c1', label: 'Blinded' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            fireEvent.click(screen.getByTitle('Remove effect'));
            expect(props.onBreakCondition).toHaveBeenCalledWith('Alice', conditions[0]);
        });

        it('should skip invalid conditions in the conditions map', () => {
            const conditions = [
                null,
                'invalid',
                { id: 'c1', label: 'Blinded', dc: 12 },
            ];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            expect(screen.getByText('Blinded DC 12')).toBeInTheDocument();
            expect(screen.queryAllByText(/Blinded/).length).toBe(1);
        });
    });

    describe('concentration badges', () => {
        it('should call onRollConcentrationSave when concentration badge is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByText(/Fireball DC 15/));
            expect(props.onRollConcentrationSave).toHaveBeenCalledWith('Alice');
        });

        it('should call onBreakConcentration when break button is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByTitle('Remove effect'));
            expect(props.onBreakConcentration).toHaveBeenCalledWith('Alice');
        });
    });

    describe('effect add button', () => {
        it('should call onOpenEffectAdder when add effect button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.click(screen.getByTitle('Add condition, effect, or concentration to Alice'));
            expect(props.onOpenEffectAdder).toHaveBeenCalledWith(defaultPlayerCreature, 'conditions');
        });

        it('should not render add button for non-localhost', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Add condition, effect, or concentration to Alice')).not.toBeInTheDocument();
        });
    });
});
