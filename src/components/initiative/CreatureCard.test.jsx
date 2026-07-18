// @improved-by-ai
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: vi.fn((campaignName, key) => {
      if (key === 'targetEffects') return [];
      return null;
  }),
  getRuntimeValue: vi.fn((target, key) => {
      if (key === 'naturesSanctuaryActive') return sanctuaryMocks.naturesSanctuaryActive?.[target];
      if (key === 'naturesSanctuaryCreatures') return sanctuaryMocks.naturesSanctuaryCreatures?.[target];
      if (key === 'naturesSanctuaryResistance') return sanctuaryMocks.naturesSanctuaryResistance?.[target];
      return undefined;
  }),
  setRuntimeValue: vi.fn(),
  listeners: new Map(),
}));

let sanctuaryMocks = {};

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
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
            onOpenConditionPicker: vi.fn(),
            onRollConcentrationSave: vi.fn(),
            onBreakConcentration: vi.fn(),
            onOpenConcentrationPicker: vi.fn(),
        };
    });

    describe('rendering - player creatures', () => {
        it.each`
            currentHp | expectUnconscious
            ${0}      | ${true}
            ${-5}     | ${true}
            ${1}      | ${false}
        `('should $expectUnconscious class when currentHp is $currentHp', ({ currentHp, expectUnconscious }) => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, currentHp }} />);
            const card = document.querySelector('.creature-card');
            if (expectUnconscious) {
                expect(card).toHaveClass('creature-unconscious');
            } else {
                expect(card).not.toHaveClass('creature-unconscious');
            }
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
    });

    describe('rendering - NPC creatures', () => {
        it.each`
            npcName     | campaignNpcName | expectBadge
            ${'Goblin'} | ${'Goblin'}     | ${true}
            ${'Goblin'} | ${'goblin'}     | ${true}
            ${'Goblin'} | ${'Orc'}        | ${false}
        `('should $expectBadge NPC match badge when NPC name is "$npcName" and campaignNpcName is "$campaignNpcName"', ({ npcName, campaignNpcName, expectBadge }) => {
            const creature = { ...defaultNpcCreature, name: npcName };
            const campaignNpcs = [{ name: campaignNpcName }];
            render(<CreatureCard {...props} creature={creature} campaignNpcs={campaignNpcs} />);
            if (expectBadge) {
                expect(screen.getByTestId('npc-match-badge')).toBeInTheDocument();
            } else {
                expect(screen.queryByTestId('npc-match-badge')).not.toBeInTheDocument();
            }
        });
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

        it('should not render remove button for non-localhost or player creatures', () => {
            const npcCreature = { ...defaultNpcCreature };
            render(<CreatureCard {...props} creature={npcCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();

            render(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={true} />);
            expect(screen.queryByTitle('Remove NPC')).not.toBeInTheDocument();
        });
    });

    describe('initiative display', () => {
        it('should show initiative value for player creatures', () => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, initiative: 18 }} />);
            const initiativeInput = document.querySelector('.creature-initiative input[type="number"]');
            expect(initiativeInput).toHaveValue(18);
        });

        it('should call onInitiativeChange when initiative input blurs for player', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const initiativeInput = document.querySelector('.creature-initiative input[type="number"]');
            fireEvent.blur(initiativeInput, { target: { value: '20' } });
            expect(props.onInitiativeChange).toHaveBeenCalledWith('Alice', '20');
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

        it('should set selected value to creature.targetName', () => {
            const creature = { ...defaultPlayerCreature, targetName: 'Bob' };
            const allCreatures = [creature, { name: 'Bob', type: 'player' } ];
            render(<CreatureCard {...props} creature={creature} allCreatures={allCreatures} />);
            const targetSelect = document.querySelector('.creature-target select');
            expect(targetSelect).toHaveValue('Bob');
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

        it('should disable condition save button for non-localhost NPC', () => {
            const conditions = [{ id: 'c1', label: 'Blinded', dc: 12, ability: 'Wisdom' }];
            render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, conditions }} isLocalhost={false} />);
            const conditionBtn = screen.getByText('Blinded DC 12');
            expect(conditionBtn).toBeDisabled();
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

        it('should call onOpenConditionPicker when add condition button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.click(screen.getByTitle('Add condition'));
            expect(props.onOpenConditionPicker).toHaveBeenCalledWith(defaultPlayerCreature);
        });

        it('should not render condition add button for non-localhost', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.queryByTitle('Add condition')).not.toBeInTheDocument();
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

        it('should call onBreakConcentration when break button is clicked', () => {
            const concentration = { spell: 'Fireball', dc: 15 };
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, concentration }} />);
            fireEvent.click(screen.getByTitle('Break concentration'));
            expect(props.onBreakConcentration).toHaveBeenCalledWith('Alice');
        });

        it('should call onOpenConcentrationPicker when add concentration button is clicked', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            fireEvent.click(screen.getByTitle('Add concentration'));
            expect(props.onOpenConcentrationPicker).toHaveBeenCalledWith(defaultPlayerCreature);
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
        it('should call onHpChange when HP input blurs for player', () => {
            render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
            const hpInput = screen.getByTestId('hp-input-Alice');
            fireEvent.blur(hpInput, { target: { value: '15' } });
            expect(props.onHpChange).toHaveBeenCalledWith('Alice', 15);
        });

        it('should show current/max HP values', () => {
            render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, currentHp: 12, maxHp: 20 }} />);
            expect(screen.getByText('12/20')).toBeInTheDocument();
        });
    });

    describe('edge cases', () => {
        it('should handle creature with null currentHp', () => {
            const creature = { ...defaultPlayerCreature, currentHp: null };
            render(<CreatureCard {...props} creature={creature} />);
            expect(screen.getByTestId('hp-input-Alice')).toHaveValue(0);
        });
    });

    describe('Nature\'s Sanctuary badge', () => {
        beforeEach(() => {
            sanctuaryMocks = {};
        });

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

        it('should not render sanctuary badge when sanctuary is not active', () => {
            sanctuaryMocks.naturesSanctuaryActive = { Druid: false };
            sanctuaryMocks.naturesSanctuaryCreatures = { Druid: ['Alice'] };

            const allCreatures = [
                { name: 'Druid', type: 'player' },
                { ...defaultPlayerCreature },
            ];

            render(<CreatureCard {...props} creature={allCreatures[1]} allCreatures={allCreatures} campaignName="test-campaign" />);
            expect(screen.queryByText('Sanctuary')).not.toBeInTheDocument();
        });
    });
});
