// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';

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

// Only the exports CreatureCard (and its unmocked child TurnEconomyStrip) import from this module.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_characterKey, key) => key === 'targetEffects' ? [] : null),
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
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
    });

    describe('condition badges', () => {
        it('should call onRollConditionSave exactly once when a player clicks their condition badge', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            fireEvent.click(screen.getByText('Blinded DC 12'));
            expect(props.onRollConditionSave).toHaveBeenCalledTimes(1);
            expect(props.onRollConditionSave).toHaveBeenCalledWith('Alice', conditions[0]);
        });

        it('should render a non-clickable, non-removable condition badge for non-localhost NPCs', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, conditions }} isLocalhost={false} />);
            fireEvent.click(screen.getByText('Blinded DC 12'));
            expect(props.onRollConditionSave).not.toHaveBeenCalled();
            expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
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

        // condition-badge-saveless-dc-noise (2026-10-29-Y) label-build rule:
        // the " DC n" suffix rides ONLY on a stored dc. EffectAdder dispatches
        // dc: undefined for a saveless condition left at its (empty) default →
        // buildRuntimeConditions lands dc 0 here → bare badge + bare tooltip.
        it('omits the DC suffix from badge and tooltip when the stored dc is absent (saveless default)', () => {
            const conditions = [{ id: 'c1', key: 'poisoned', label: 'Poisoned', dc: 0, ability: 'con' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            const badge = screen.getByText('Poisoned', { selector: 'button.creature-badge' });
            expect(badge).toBeInTheDocument();
            expect(screen.queryByText(/Poisoned DC/)).not.toBeInTheDocument();
            // Tooltip lane: bare CONDITION_DESCRIPTIONS copy — no fabricated save line.
            expect(badge.getAttribute('title')).not.toMatch(/DC/);
        });

        it.each([
            { label: 'declared save with default DC', cond: { id: 'c1', key: 'paralyzed', label: 'Paralyzed', dc: 10, ability: 'con' }, text: 'Paralyzed DC 10' },
            { label: 'GM-typed DC on a saveless condition', cond: { id: 'c1', key: 'blinded', label: 'Blinded', dc: 15, ability: 'dex' }, text: 'Blinded DC 15' },
        ])('keeps the DC suffix + tooltip save line — $label', ({ cond, text }) => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions: [cond] }} />);
            const badge = screen.getByText(text);
            expect(badge).toBeInTheDocument();
            expect(badge.getAttribute('title')).toContain(`DC ${cond.dc}`);
        });
    });

    describe('concentration badges', () => {
        it('should call onRollConcentrationSave when concentration badge is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByText('Fireball DC 15'));
            expect(props.onRollConcentrationSave).toHaveBeenCalledTimes(1);
            expect(props.onRollConcentrationSave).toHaveBeenCalledWith('Alice');
        });

        it('should call onBreakConcentration when break button is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByTitle('Remove effect'));
            expect(props.onBreakConcentration).toHaveBeenCalledWith('Alice');
        });

        it('should render concentration as fully inert for non-localhost clients', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} isLocalhost={false} />);
            fireEvent.click(screen.getByText('Fireball DC 15'));
            expect(props.onRollConcentrationSave).not.toHaveBeenCalled();
            expect(props.onBreakConcentration).not.toHaveBeenCalled();
            expect(screen.queryByTitle('Remove effect')).not.toBeInTheDocument();
        });
    });

    describe('effect add button', () => {
        it('opens the effect adder with the creature and target lane for localhost, and is absent for players', () => {
            const { rerender } = render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.click(screen.getByTitle('Add condition, effect, or concentration to Alice'));
            expect(props.onOpenEffectAdder).toHaveBeenCalledTimes(1);
            expect(props.onOpenEffectAdder).toHaveBeenCalledWith(defaultPlayerCreature, 'conditions');

            rerender(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Add condition, effect, or concentration to Alice')).not.toBeInTheDocument();
        });
    });
});
