import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import { useRuntimeValue } from '../../hooks/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath, size: _size }) => {
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
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><input data-testid={`hp-input-${creature.name}`} type="number" value={creature.currentHp ?? 0} onChange={(e) => onChange(creature.name, parseInt(e.target.value) || 0)} disabled={!isLocalhost && creature.type === 'player'} /><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
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

vi.mock('../../services/combat/conditionUtils.js', () => ({
    getAbilityLabel: (ability) => ability?.toUpperCase() || '',
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((campaignName, key) => {
        if (key === 'targetEffects') return [];
        return null;
    }),
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
        vi.clearAllMocks();
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
            onRollNpcInitiative: vi.fn(),
            onTargetChange: vi.fn(),
            onRollConditionSave: vi.fn(),
            onBreakCondition: vi.fn(),
            onOpenConditionPicker: vi.fn(),
            onRollConcentrationSave: vi.fn(),
            onBreakConcentration: vi.fn(),
            onOpenConcentrationPicker: vi.fn(),
        };
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('rendering - player creatures', () => {
        it('should render the creature card container with correct classes', () => {
            render(<CreatureCard {...props} />);
            const card = document.querySelector('.creature-card');
            expect(card).toBeInTheDocument();
            expect(card).toHaveClass('player');
        });

        it('should render with active class when isActive is true', () => {
            render(<CreatureCard {...props} isActive={true} />);
            const card = document.querySelector('.creature-card');
            expect(card).toHaveClass('active');
        });

        it('should not render active class when isActive is false', () => {
            render(<CreatureCard {...props} isActive={false} />);
            const card = document.querySelector('.creature-card');
            expect(card).not.toHaveClass('active');
        });

        it('should render unconscious class when currentHp <= 0', () => {
            const unconsciousCreature = { ...defaultPlayerCreature, currentHp: 0 };
            render(<CreatureCard {...props} creature={unconsciousCreature} />);
            const card = document.querySelector('.creature-card');
            expect(card).toHaveClass('creature-unconscious');
        });

        it('should render unconscious class when currentHp < 0', () => {
            const unconsciousCreature = { ...defaultPlayerCreature, currentHp: -5 };
            render(<CreatureCard {...props} creature={unconsciousCreature} />);
            const card = document.querySelector('.creature-card');
            expect(card).toHaveClass('creature-unconscious');
        });

        it('should not render unconscious class when currentHp > 0', () => {
            const consciousCreature = { ...defaultPlayerCreature, currentHp: 1 };
            render(<CreatureCard {...props} creature={consciousCreature} />);
            const card = document.querySelector('.creature-card');
            expect(card).not.toHaveClass('creature-unconscious');
        });

        it('should render AvatarImage for player creatures', () => {
            render(<CreatureCard {...props} />);
            expect(screen.getByTestId('avatar-Alice')).toBeInTheDocument();
        });

        it('should render player name as a span', () => {
            render(<CreatureCard {...props} />);
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        it('should render HP component for player creatures', () => {
            render(<CreatureCard {...props} />);
            expect(screen.getByTestId('creature-hp-Alice')).toBeInTheDocument();
        });

        it('should render initiative input for player creatures', () => {
            render(<CreatureCard {...props} />);
            const initiativeInput = document.querySelector('.creature-initiative input[type="number"]');
            expect(initiativeInput).toBeInTheDocument();
            expect(initiativeInput).toHaveValue(14);
        });

        it('should render target select for player creatures', () => {
            render(<CreatureCard {...props} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect).toBeInTheDocument();
        });

        it('should show "— No Target —" option in target select', () => {
            render(<CreatureCard {...props} />);
            expect(screen.getByText('— No Target —')).toBeInTheDocument();
        });

        it('should populate target select options from allCreatures excluding self', () => {
            const allCreatures = [
                defaultPlayerCreature,
                { name: 'Bob', type: 'player' },
                { name: 'Charlie', type: 'player' },
            ];
            render(<CreatureCard {...props} allCreatures={allCreatures} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect.querySelector('option[value="Bob"]')).toBeInTheDocument();
            expect(targetSelect.querySelector('option[value="Charlie"]')).toBeInTheDocument();
            expect(targetSelect.querySelector('option[value="Alice"]')).not.toBeInTheDocument();
        });

        it('should include overlay options in target select when overlays exist', () => {
            const overlays = [
                { id: 'overlay1', shape: 'sphere', radiusFt: 15, label: 'Fireball' },
            ];
            render(<CreatureCard {...props} overlays={overlays} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect.querySelector('option[value="overlay-overlay1"]')).toBeInTheDocument();
        });

        it('should include overlay options with distanceFt fallback', () => {
            const overlays = [
                { id: 'overlay1', shape: 'cone', distanceFt: 30 },
            ];
            render(<CreatureCard {...props} overlays={overlays} />);
            expect(screen.getByText('Cone (30ft)')).toBeInTheDocument();
        });

        it('should include overlay options with sizeFt fallback', () => {
            const overlays = [
                { id: 'overlay1', shape: 'cube', sizeFt: 10 },
            ];
            render(<CreatureCard {...props} overlays={overlays} />);
            expect(screen.getByText('Cube (10ft)')).toBeInTheDocument();
        });

        it('should group overlays under "─── Overlays ───" optgroup', () => {
            const overlays = [{ id: 'overlay1', shape: 'sphere', radiusFt: 10 }];
            render(<CreatureCard {...props} overlays={overlays} />);
            const optgroup = document.querySelector('.creature-target optgroup');
            expect(optgroup).toHaveAttribute('label', '─── Overlays ───');
        });
    });

    describe('rendering - NPC creatures', () => {
        it('should render NpcAvatar for NPC creatures', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            expect(screen.getByTestId('npc-avatar-Goblin')).toBeInTheDocument();
        });

        it('should render MonsterNameAutocomplete for NPC creatures', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            expect(screen.getByTestId('monster-autocomplete')).toBeInTheDocument();
        });

        it('should pass campaignNpcs to MonsterNameAutocomplete', () => {
            const campaignNpcs = [{ name: 'Goblin' }, { name: 'Orc' }];
            render(<CreatureCard {...props} creature={defaultNpcCreature} campaignNpcs={campaignNpcs} />);
            expect(screen.getByTestId('monster-autocomplete')).toBeInTheDocument();
        });

        it('should show NPC match badge when NPC name matches campaignNpcs', () => {
            const campaignNpcs = [{ name: 'Goblin' }];
            render(<CreatureCard {...props} creature={defaultNpcCreature} campaignNpcs={campaignNpcs} />);
            expect(screen.getByTestId('npc-match-badge')).toBeInTheDocument();
        });

        it('should not show NPC match badge when name does not match', () => {
            const campaignNpcs = [{ name: 'Orc' }];
            render(<CreatureCard {...props} creature={defaultNpcCreature} campaignNpcs={campaignNpcs} />);
            expect(screen.queryByTestId('npc-match-badge')).not.toBeInTheDocument();
        });

        it('should do case-insensitive NPC name matching', () => {
            const campaignNpcs = [{ name: 'goblin' }];
            render(<CreatureCard {...props} creature={defaultNpcCreature} campaignNpcs={campaignNpcs} />);
            expect(screen.getByTestId('npc-match-badge')).toBeInTheDocument();
        });
    });

    describe('NPC remove button', () => {
        it('should render remove button for NPC when isLocalhost is true', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const removeBtn = screen.getByTitle('Remove NPC');
            expect(removeBtn).toBeInTheDocument();
        });

        it('should call onRemoveNpc when remove button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            fireEvent.click(screen.getByTitle('Remove NPC'));
            expect(props.onRemoveNpc).toHaveBeenCalledWith('Goblin');
        });

        it('should not render remove button when isLocalhost is false', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();
        });

        it('should not render remove button for player creatures', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();
        });
    });

    describe('initiative display', () => {
        it('should show initiative value for player creatures', () => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, initiative: 18 }} />);
            const initiativeInput = document.querySelector('.creature-initiative input[type="number"]');
            expect(initiativeInput).toHaveValue(18);
        });

        it('should call onInitiativeChange when initiative input changes for player', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const initiativeInput = document.querySelector('.creature-initiative input[type="number"]');
            fireEvent.change(initiativeInput, { target: { value: '20' } });
            expect(props.onInitiativeChange).toHaveBeenCalledWith('Alice', '20');
        });

        it('should show roll link for NPC with initiativeBonus', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const rollLink = document.querySelector('.initiative-roll-link');
            expect(rollLink).toBeInTheDocument();
        });

        it('should show dice icon when NPC has no initiative value', () => {
            const npcNoInit = { ...defaultNpcCreature, initiative: null, initiativeBonus: 2 };
            render(<CreatureCard {...props} creature={npcNoInit} />);
            expect(screen.queryByTitle('Roll initiative (d20 + 2)')).toBeInTheDocument();
        });

        it('should show initiative value when NPC has one', () => {
            const npcWithInit = { ...defaultNpcCreature, initiative: 12, initiativeBonus: 2 };
            render(<CreatureCard {...props} creature={npcWithInit} />);
            expect(screen.getByText('12')).toBeInTheDocument();
        });

        it('should call onRollNpcInitiative when roll link is clicked', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const rollLink = document.querySelector('.initiative-roll-link');
            fireEvent.click(rollLink);
            expect(props.onRollNpcInitiative).toHaveBeenCalledWith('Goblin');
        });

        it('should show roll link tooltip with initiative bonus', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const rollLink = document.querySelector('.initiative-roll-link');
            expect(rollLink.getAttribute('title')).toBe('Roll initiative (d20 + 2)');
        });

        it('should not show roll link when initiativeBonus is null', () => {
            const npcNullBonus = { ...defaultNpcCreature, initiativeBonus: null };
            render(<CreatureCard {...props} creature={npcNullBonus} />);
            expect(document.querySelector('.initiative-roll-link')).not.toBeInTheDocument();
        });

        it('should not show roll link when initiativeBonus is 0', () => {
            const npcZeroBonus = { ...defaultNpcCreature, initiativeBonus: 0 };
            render(<CreatureCard {...props} creature={npcZeroBonus} />);
            expect(document.querySelector('.initiative-roll-link')).not.toBeInTheDocument();
        });

        it('should not show roll link when initiativeBonus is empty string', () => {
            const npcEmptyBonus = { ...defaultNpcCreature, initiativeBonus: '' };
            render(<CreatureCard {...props} creature={npcEmptyBonus} />);
            expect(document.querySelector('.initiative-roll-link')).not.toBeInTheDocument();
        });

        it('should show initiative input for NPC when initiativeBonus is null', () => {
            const npcNullBonus = { ...defaultNpcCreature, initiativeBonus: null };
            render(<CreatureCard {...props} creature={npcNullBonus} />);
            const initiativeInput = document.querySelector('.creature-initiative input[type="number"]');
            expect(initiativeInput).toBeInTheDocument();
        });
    });

    describe('target select', () => {
        it('should call onTargetChange when target select changes for player', () => {
            const allCreatures = [defaultPlayerCreature, { name: 'Bob', type: 'player' }];
            render(<CreatureCard {...props} creature={defaultPlayerCreature} allCreatures={allCreatures} />);
            const targetSelect = document.querySelector('.creature-target select');
            fireEvent.change(targetSelect, { target: { value: 'Bob' } });
            expect(props.onTargetChange).toHaveBeenCalledWith('Alice', 'Bob');
        });

        it('should disable target select for NPC when not localhost', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect).toBeDisabled();
        });

        it('should enable target select for NPC when localhost', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect).not.toBeDisabled();
        });

        it('should set selected value to creature.targetName', () => {
            const creature = { ...defaultPlayerCreature, targetName: 'Bob' };
            const allCreatures = [creature, { name: 'Bob', type: 'player' }];
            render(<CreatureCard {...props} creature={creature} allCreatures={allCreatures} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect).toHaveValue('Bob');
        });

        it('should default to empty string when targetName is null', () => {
            const creature = { ...defaultPlayerCreature, targetName: null };
            render(<CreatureCard {...props} creature={creature} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect).toHaveValue('');
        });
    });

    describe('conditions', () => {
        it('should render condition badges when creature has conditions', () => {
            const conditions = [
                { id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' },
            ];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            expect(screen.getByText('Blinded DC 12')).toBeInTheDocument();
        });

        it('should render condition label without DC when dc is null', () => {
            const conditions = [
                { id: 'c1', label: 'Prone', dc: null, ability: null },
            ];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            const conditionBtn = document.querySelector('.condition-badge');
            expect(conditionBtn).toHaveTextContent('Prone');
        });

        it('should call onRollConditionSave when condition badge is clicked for player', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            fireEvent.click(screen.getByText('Blinded DC 12'));
            expect(props.onRollConditionSave).toHaveBeenCalledWith('Alice', conditions[0]);
        });

        it('should call onRollConditionSave when condition badge is clicked for localhost NPC', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, conditions }} isLocalhost={true} />);
            fireEvent.click(screen.getByText('Blinded DC 12'));
            expect(props.onRollConditionSave).toHaveBeenCalledWith('Goblin', conditions[0]);
        });

        it('should disable condition save button for non-localhost NPC', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, conditions }} isLocalhost={false} />);
            const conditionBtn = screen.getByText('Blinded DC 12');
            expect(conditionBtn).toBeDisabled();
        });

        it('should render condition break button for localhost', () => {
            const conditions = [{ id: 'c1', label: 'Blinded' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            expect(screen.getByTitle('Automatically break condition')).toBeInTheDocument();
        });

        it('should call onBreakCondition when break button is clicked', () => {
            const conditions = [{ id: 'c1', label: 'Blinded' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            fireEvent.click(screen.getByTitle('Automatically break condition'));
            expect(props.onBreakCondition).toHaveBeenCalledWith('Alice', conditions[0]);
        });

        it('should not render condition break button for non-localhost', () => {
            const conditions = [{ id: 'c1', label: 'Blinded' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} isLocalhost={false} />);
            expect(screen.queryByTitle('Automatically break condition')).not.toBeInTheDocument();
        });

        it('should render ConditionEffectBadges component', () => {
            const conditions = [{ id: 'c1', label: 'Blinded' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            expect(screen.getByTestId('condition-effects-Alice')).toBeInTheDocument();
        });

        it('should render condition add button for localhost', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            expect(screen.getByTitle('Add condition')).toBeInTheDocument();
        });

        it('should call onOpenConditionPicker when add condition button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.click(screen.getByTitle('Add condition'));
            expect(props.onOpenConditionPicker).toHaveBeenCalledWith(defaultPlayerCreature);
        });

        it('should not render condition add button for non-localhost', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Add condition')).not.toBeInTheDocument();
        });

        it('should pass conditions to ConditionEffectBadges', () => {
            const conditions = [{ id: 'c1', label: 'Blinded' }, { id: 'c2', label: 'Prone' }];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            expect(screen.getByTestId('effect-condition-c1')).toBeInTheDocument();
            expect(screen.getByTestId('effect-condition-c2')).toBeInTheDocument();
        });
    });

    describe('concentration', () => {
        it('should render concentration badge when creature has concentration', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            expect(screen.getByText(/Fireball DC 15/)).toBeInTheDocument();
        });

        it('should call onRollConcentrationSave when concentration badge is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByText(/Fireball DC 15/));
            expect(props.onRollConcentrationSave).toHaveBeenCalledWith('Alice');
        });

        it('should render concentration break button when creature has concentration', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            expect(screen.getByTitle('Break concentration')).toBeInTheDocument();
        });

        it('should call onBreakConcentration when break button is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByTitle('Break concentration'));
            expect(props.onBreakConcentration).toHaveBeenCalledWith('Alice');
        });

        it('should render concentration add button for localhost when no concentration', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            expect(screen.getByTitle('Add concentration')).toBeInTheDocument();
        });

        it('should call onOpenConcentrationPicker when add concentration button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.click(screen.getByTitle('Add concentration'));
            expect(props.onOpenConcentrationPicker).toHaveBeenCalledWith(defaultPlayerCreature);
        });

        it('should not render concentration add button for non-localhost when no concentration', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Add concentration')).not.toBeInTheDocument();
        });

        it('should render spinner icon on concentration badge', () => {
            const concentration = { spell: 'Shield', dc: 10 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            const concentrationBadge = document.querySelector('.initiative-concentration-badge');
            expect(concentrationBadge.querySelector('.fa-solid.fa-spinner')).toBeInTheDocument();
        });

        it('should render spinner icon on concentration add button', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const addBtn = document.querySelector('.concentration-add-btn');
            expect(addBtn.querySelector('.fa-solid.fa-spinner')).toBeInTheDocument();
        });

        it('should show concentration tooltip with spell and DC', () => {
            const concentration = { spell: 'Shield', dc: 10 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            const badge = document.querySelector('.initiative-concentration-badge');
            expect(badge.getAttribute('title')).toBe('Concentration: Shield (DC 10 Constitution)');
        });
    });

    describe('avatar rendering', () => {
        it('should pass imagePath to AvatarImage for player creatures', () => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, imagePath: '/images/alice.png' }} />);
            const avatar = screen.getByTestId('avatar-Alice');
            expect(avatar.querySelector('img')).toHaveAttribute('src', '/images/alice.png');
        });

        it('should pass imagePath to NpcAvatar for NPC creatures', () => {
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, imagePath: '/images/goblin.png' }} />);
            const npcAvatar = screen.getByTestId('npc-avatar-Goblin');
            expect(npcAvatar.querySelector('img')).toHaveAttribute('src', '/images/goblin.png');
        });

        it('should use imageUrl fallback for NPC avatar', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} npcImage="https://example.com/goblin.jpg" />);
            const npcAvatar = screen.getByTestId('npc-avatar-Goblin');
            expect(npcAvatar.querySelector('img')).toHaveAttribute('src', 'https://example.com/goblin.jpg');
        });

        it('should render initial letter when no image available for player', () => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, imagePath: null }} />);
            const avatar = screen.getByTestId('avatar-Alice');
            expect(avatar.querySelector('span')).toHaveTextContent('A');
        });

        it('should render initial letter when no image available for NPC', () => {
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, imagePath: null, imageUrl: null }} />);
            const npcAvatar = screen.getByTestId('npc-avatar-Goblin');
            expect(npcAvatar.querySelector('span')).toHaveTextContent('G');
        });
    });

    describe('NPC avatar click', () => {
        it('should call onNpcClick when NPC avatar is clicked', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const npcAvatar = screen.getByTestId('npc-avatar-Goblin');
            fireEvent.click(npcAvatar);
            expect(props.onNpcClick).toHaveBeenCalledWith(defaultNpcCreature);
        });
    });

    describe('name change', () => {
        it('should call onNameChange with old name and new value', () => {
            render(<CreatureCard {...props} creature={defaultNpcCreature} />);
            const input = screen.getByTestId('monster-name-input');
            fireEvent.change(input, { target: { value: 'Kobold' } });
            expect(props.onNameChange).toHaveBeenCalledWith('Goblin', 'Kobold');
        });
    });

    describe('HP change', () => {
        it('should call onHpChange when HP input changes for player', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const hpInput = screen.getByTestId('hp-input-Alice');
            fireEvent.change(hpInput, { target: { value: '15' } });
            expect(props.onHpChange).toHaveBeenCalledWith('Alice', 15);
        });

        it('should show current/max HP values', () => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, currentHp: 12, maxHp: 20 }} />);
            expect(screen.getByText('12/20')).toBeInTheDocument();
        });
    });

    describe('target effects from runtime state', () => {
        it('should render target effects in ConditionEffectBadges', () => {
            useRuntimeValue.mockImplementation((campaignName, key) => {
                if (key === 'targetEffects') return [{ id: 'te1', target: 'Alice', effect: 'vulnerable' }];
                return null;
            });
            const conditions = [];
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, conditions }} />);
            expect(screen.getByTestId('effect-target-te1')).toBeInTheDocument();
            useRuntimeValue.mockRestore();
        });
    });

    describe('edge cases', () => {
        it('should handle creature with undefined conditions', () => {
            const creature = { ...defaultPlayerCreature, conditions: undefined };
            render(<CreatureCard {...props} creature={creature} />);
            expect(screen.getByTestId('condition-effects-Alice')).toBeInTheDocument();
        });

        it('should handle creature with empty conditions array', () => {
            const creature = { ...defaultPlayerCreature, conditions: [] };
            render(<CreatureCard {...props} creature={creature} />);
            expect(screen.getByTestId('condition-effects-Alice')).toBeInTheDocument();
        });

        it('should handle creature with undefined name', () => {
            const creature = { ...defaultPlayerCreature, name: undefined };
            render(<CreatureCard {...props} creature={creature} />);
            expect(screen.getByTestId('condition-effects-undefined')).toBeInTheDocument();
        });

        it('should handle creature with null currentHp', () => {
            const creature = { ...defaultPlayerCreature, currentHp: null };
            render(<CreatureCard {...props} creature={creature} />);
            expect(screen.getByTestId('hp-input-Alice')).toHaveValue(0);
        });

        it('should handle creature with null maxHp', () => {
            const creature = { ...defaultPlayerCreature, maxHp: null };
            render(<CreatureCard {...props} creature={creature} />);
            expect(screen.getByTestId('hp-input-Alice')).toBeInTheDocument();
        });

        it('should handle overlay without label using shape and sizeFt', () => {
            const overlays = [{ id: 'overlay1', shape: 'line', sizeFt: 50 }];
            render(<CreatureCard {...props} overlays={overlays} />);
            expect(screen.getByText('Line (50ft)')).toBeInTheDocument();
        });

        it('should handle overlay with unknown shape', () => {
            const overlays = [{ id: 'overlay1', shape: 'pyramid', radiusFt: 20 }];
            render(<CreatureCard {...props} overlays={overlays} />);
            expect(screen.getByText('pyramid (20ft)')).toBeInTheDocument();
        });
    });
});
