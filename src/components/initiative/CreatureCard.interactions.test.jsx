// @maintained-by-ai
// CreatureCard interactions lane — card-owned click/commit dispatches only.
// Cut, with owners: badge removal dispatches → CreatureCard.badgeRemoval.test.jsx (#848);
// badge render census → CreatureCard.badges.test.jsx (#849); condition/concentration breaks
// + Add-effect button → CreatureCard.conditions.test.jsx (#850); onNpcClick handler obey-half
// of allowNonLocalhost → createNpcClickHandler-* (#840); target option population and
// initiative value display → CreatureCard.rendering.test.jsx.
// Old→new map: NPC-remove 4→2 (render+click folded into dispatch test; negatives table);
// initiative blur 2→1 (type-agnostic path) + Enter-commit NEW; target select 3→2
// (dispatch kept; gating+value table adds player-flip and summoned-allow rows);
// avatar click 1→3 (kept: flag-PASSED wiring seam, distinct from #840 obey-half)
// + non-localhost-inert gate NEW + player-summoned allow NEW; name change 2→2 kept;
// HP blur 2→1 (identical onChange wiring path).
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
    default: vi.fn(({ creature, onChange }) => {
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><input data-testid={`hp-input-${creature.name}`} type="number" defaultValue={creature.currentHp ?? 0} onBlur={(e) => onChange(creature.name, parseInt(e.target.value) || 0)} /><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
    }),
}));

vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ creatureName }) => {
        return <div data-testid={`condition-effects-${creatureName}`}></div>;
    }),
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
    });

    describe('NPC remove button', () => {
        it('offers remove for localhost NPCs and dispatches onRemoveNpc with the exact name exactly once', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            fireEvent.click(screen.getByTitle('Remove NPC'));
            expect(props.onRemoveNpc).toHaveBeenCalledTimes(1);
            expect(props.onRemoveNpc).toHaveBeenCalledWith('Goblin');
        });

        it.each([
            ['non-localhost NPC', defaultNpcCreature, false],
            ['player (even on localhost)', defaultPlayerCreature, true],
        ])('is absent for %s', (_label, creature, isLocalhost) => {
            render(<CreatureCard {...props} creature={creature} isLocalhost={isLocalhost} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();
        });
    });

    describe('initiative commit', () => {
        it('dispatches onInitiativeChange(name, raw input string) on blur', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.blur(screen.getByTestId('initiative-input'), { target: { value: '20' } });
            expect(props.onInitiativeChange).toHaveBeenCalledWith('Alice', '20');
        });

        it('commits on Enter without requiring blur', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const input = screen.getByTestId('initiative-input');
            input.focus(); // native focus so blur()/focusout can fire
            fireEvent.change(input, { target: { value: '18' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            expect(props.onInitiativeChange).toHaveBeenCalledWith('Alice', '18');
        });
    });

    describe('target select', () => {
        it('dispatches onTargetChange(creature.name, new value) on change', () => {
            const allCreatures = [defaultPlayerCreature, { name: 'Bob', type: 'player' }];
            render(<CreatureCard {...props} creature={defaultPlayerCreature} allCreatures={allCreatures} />);
            fireEvent.change(screen.getByTestId('target-select'), { target: { value: 'Bob' } });
            expect(props.onTargetChange).toHaveBeenCalledWith('Alice', 'Bob');
        });

        it.each([
            {
                label: 'player on localhost stays enabled',
                creature: { ...defaultPlayerCreature, targetName: 'Bob' },
                isLocalhost: true,
                expectDisabled: false,
            },
            {
                label: 'player on non-localhost stays enabled',
                creature: { ...defaultPlayerCreature, targetName: 'Bob' },
                isLocalhost: false,
                expectDisabled: false,
            },
            {
                label: 'NPC on localhost stays enabled',
                creature: { ...defaultNpcCreature, targetName: 'Bob' },
                isLocalhost: true,
                expectDisabled: false,
            },
            {
                label: 'NPC on non-localhost is disabled',
                creature: { ...defaultNpcCreature, targetName: 'Bob' },
                isLocalhost: false,
                expectDisabled: true,
            },
            {
                label: 'player-summoned creature on non-localhost is re-enabled',
                creature: { ...defaultNpcCreature, targetName: 'Bob', wildShapeSource: 'Alice' },
                isLocalhost: false,
                expectDisabled: false,
            },
        ])('target select: $label and shows creature.targetName', ({ creature, isLocalhost, expectDisabled }) => {
            const allCreatures = [defaultPlayerCreature, { name: 'Bob', type: 'player' }];
            render(<CreatureCard {...props} creature={creature} isLocalhost={isLocalhost} allCreatures={allCreatures} />);
            const targetSelect = screen.getByTestId('target-select');
            if (expectDisabled) {
                expect(targetSelect).toBeDisabled();
            } else {
                expect(targetSelect).toBeEnabled();
            }
            expect(targetSelect).toHaveValue('Bob');
        });
    });

    describe('NPC avatar click', () => {
        it('dispatches onNpcClick(creature, { allowNonLocalhost: true }) — card wiring seam (handler obey-half owned by createNpcClickHandler tests, #840)', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
            expect(props.onNpcClick).toHaveBeenCalledTimes(1);
            expect(props.onNpcClick).toHaveBeenCalledWith(defaultNpcCreature, { allowNonLocalhost: true });
        });

        it('is inert on non-localhost for non-summoned creatures', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
            expect(props.onNpcClick).not.toHaveBeenCalled();
        });

        it('is allowed on non-localhost when player-summoned', () => {
            const summoned = { ...defaultNpcCreature, wildShapeSource: 'Alice' };
            render(<CreatureCard {...props} creature={summoned} isLocalhost={false} allCreatures={[defaultPlayerCreature, summoned]} />);
            fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
            expect(props.onNpcClick).toHaveBeenCalledWith(summoned, { allowNonLocalhost: true });
        });
    });

    describe('name change', () => {
        it('dispatches onNameChange(oldName, newName) for NPC autocomplete edits', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            fireEvent.change(screen.getByTestId('monster-name-input'), { target: { value: 'Kobold' } });
            expect(props.onNameChange).toHaveBeenCalledWith('Goblin', 'Kobold');
        });

        it('renders player names as static text (no editable input)', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            expect(screen.queryByTestId('monster-name-input')).not.toBeInTheDocument();
        });
    });

    describe('HP change', () => {
        it('wires CreatureHp onChange to onHpChange(name, hp) on blur', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.blur(screen.getByTestId('hp-input-Alice'), { target: { value: '15' } });
            expect(props.onHpChange).toHaveBeenCalledWith('Alice', 15);
        });
    });
});
