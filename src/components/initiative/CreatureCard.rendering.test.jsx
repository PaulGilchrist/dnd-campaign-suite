// @maintained-by-ai
// CreatureCard base render contract — card-hosted display bytes only.
// Owned here (render lane):
//   card skeleton section census + exact name byte (jsx:625-665)
//   state-class truth table: type / active / creature-unconscious (jsx:610, 626)
//   initiative display byte incl. unrolled fallback (jsx:150-168)
//   target-select option population: self-excluded, secondTurn-excluded,
//     no-target default, overlay optgroup + overlayLabel bytes (jsx:174-202)
//   NPC match badge gate on CardName's showBadge computation (jsx:129)
//   polymorphObject form-name + icon avatar (jsx:89-97, 122-123)
//   statless default hint gate + exact hint byte (jsx:630-634)
//   TempHpDisplay gate + byte (jsx:138-148) — card-hosted, not CreatureHp
// NOT owned here (do not duplicate):
//   all badge render faces → CreatureCard.badges.test.jsx (#849)
//   badge removal dispatch → CreatureCard.badgeRemoval.test.jsx (#848)
//   condition/concentration dispatch + add-button → CreatureCard.conditions.test.jsx (#850)
//   save prompt census → CreatureCard.prompts.test.jsx (#852)
//   click/change dispatch, disabled matrix, selected-value display →
//     CreatureCard.interactions.test.jsx (#851)
//   HP input internals → CreatureHp.test.jsx (forward-cited sibling)
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

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
    default: vi.fn(({ creature }) => {
        return <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>;
    }),
}));

vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ creatureName }) => <div data-testid={`condition-effects-${creatureName}`} />),
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
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(() => 0),
    clearUnbreakableMajesty: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
    getResilientSphereSource: vi.fn(() => null),
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

describe('CreatureCard - rendering', () => {
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
        runtimeState.useRuntimeValue.mockReset().mockReturnValue(null);
        runtimeState.getRuntimeValue.mockReset().mockReturnValue(null);
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

    it('renders the card skeleton once: avatar, exact name byte, HP, initiative, target select, conditions section', () => {
        const { container } = render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, imagePath: '/img/alice.png' }} />);
        expect(container.querySelectorAll('.creature-card')).toHaveLength(1);
        expect(container.querySelectorAll('.creature-name span')).toHaveLength(1);
        expect(container.querySelector('.creature-name span').textContent).toBe('Alice');
        expect(screen.getByTestId('avatar-Alice')).toBeInTheDocument();
        expect(screen.getByTestId('avatar-Alice').querySelector('img')).toHaveAttribute('src', '/img/alice.png');
        expect(screen.getByTestId('creature-hp-Alice')).toBeInTheDocument();
        expect(screen.getByTestId('initiative-input')).toBeInTheDocument();
        expect(screen.getByTestId('target-select')).toBeInTheDocument();
        expect(container.querySelector('.creature-conditions')).toBeInTheDocument();
    });

    it('tracks card state classes: type, active, creature-unconscious', () => {
        const alive = render(<CreatureCard {...props} />).container.querySelector('.creature-card');
        expect(alive).toHaveClass('creature-card', 'player');
        expect(alive).not.toHaveClass('npc', 'active', 'creature-unconscious');

        const dead = render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, currentHp: 1 }} isActive={false} />).container.querySelector('.creature-card');
        expect(dead).toHaveClass('npc');
        expect(dead).not.toHaveClass('creature-unconscious', 'active');

        const fallen = render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, currentHp: 0 }} isActive={true} />).container.querySelector('.creature-card');
        expect(fallen).toHaveClass('creature-card', 'npc', 'active', 'creature-unconscious');
    });

    it('shows the rolled initiative number and an empty Init placeholder when unrolled', () => {
        render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
        expect(screen.getByTestId('initiative-input')).toHaveValue(14);

        render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, name: 'Bob', initiative: null }} />);
        const unrolled = screen.getAllByTestId('initiative-input')[1];
        expect(unrolled).toHaveValue(null);
        expect(unrolled).toHaveAttribute('placeholder', 'Init');

        render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, name: 'Cara', initiative: undefined }} />);
        expect(screen.getAllByTestId('initiative-input')[2]).toHaveValue(null);
    });

    it('populates target options: self-excluded, secondTurn-excluded, no-target default, overlay optgroup only when overlays exist', () => {
        const allCreatures = [
            defaultPlayerCreature,
            { name: 'Bob', type: 'player' },
            { name: 'Shadow', type: 'npc', secondTurn: true },
        ];
        const overlays = [
            { id: 'ov1', shape: 'sphere', radiusFt: 15, label: 'Fireball' },
            { id: 'ov2', shape: 'cone', radiusFt: 30 },
        ];
        const { container } = render(<CreatureCard {...props} allCreatures={allCreatures} overlays={overlays} />);
        const select = screen.getByTestId('target-select');
        const values = [...select.querySelectorAll('option')].map(o => o.value);
        expect(values).toEqual(['', 'Bob', 'overlay-ov1', 'overlay-ov2']);
        expect(select.querySelector('option[value=""]').textContent).toBe('— No Target —');
        expect(select.querySelector('option[value="overlay-ov1"]').textContent).toBe('Fireball');
        expect(select.querySelector('option[value="overlay-ov2"]').textContent).toBe('Cone (30ft)');
        expect(container.querySelector('optgroup[label="─── Overlays ───"]')).toBeInTheDocument();

        const quiet = render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, name: 'Bob' }} allCreatures={[defaultPlayerCreature]} overlays={[]} />);
        expect(quiet.container.querySelector('optgroup')).not.toBeInTheDocument();
        expect([...quiet.container.querySelectorAll('option')].every(o => !o.value.startsWith('overlay-'))).toBe(true);
    });

    it('shows the NPC match badge only when a campaign NPC name matches case-insensitively', () => {
        render(<CreatureCard {...props} creature={defaultNpcCreature} campaignNpcs={[{ name: 'goblin' }]} />);
        expect(screen.getByTestId('npc-match-badge')).toBeInTheDocument();

        render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, name: 'Owlbear' }} campaignNpcs={[{ name: 'Goblin' }]} />);
        expect(screen.getAllByTestId('npc-match-badge')).toHaveLength(1);
    });

    it('renders a polymorphObject as its formatted form name with an icon avatar, bypassing NpcAvatar', () => {
        const creature = { ...defaultNpcCreature, polymorphObject: { type: 'giant_toad', icon: 'fa-toad' } };
        const { container } = render(<CreatureCard {...props} creature={creature} />);
        expect(screen.getByText('Giant Toad')).toBeInTheDocument();
        expect(container.querySelector('.creature-avatar i')).toHaveClass('fa-solid', 'fa-toad');
        expect(screen.queryByTestId('npc-avatar-Goblin')).not.toBeInTheDocument();
    });

    it('shows the statless default hint only on auto-named 10/10 HP NPC cards', () => {
        const statlessNpc = {
            name: 'NPC 1',
            type: 'npc',
            currentHp: 10,
            maxHp: 10,
            ac: 10,
            initiative: '',
            targetName: null,
            conditions: [],
            concentration: null,
        };
        const { container } = render(<CreatureCard {...props} creature={statlessNpc} allCreatures={[statlessNpc]} />);
        expect(container.querySelectorAll('.npc-statless-hint')).toHaveLength(1);
        expect(container.querySelector('.npc-statless-hint').textContent).toContain('Statless default · 10 HP (AC 10)');

        const negatives = [
            { ...statlessNpc, currentHp: 7 },               // hp moved off default
            { ...statlessNpc, name: 'Goblin' },             // renamed = monster-backed
            { ...statlessNpc, type: 'player' },             // never on player cards
        ];
        negatives.forEach((creature) => {
            const neg = render(<CreatureCard {...props} creature={creature} allCreatures={[creature]} />);
            expect(neg.container.querySelectorAll('.npc-statless-hint')).toHaveLength(0);
            expect(neg.container.querySelector(`.creature-card.${creature.type}`)).toBeInTheDocument();
        });
    });

    it('shows card-hosted temp HP only for form-linked creatures with positive temp HP', () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) => (key === 'tempHp' ? 5 : null));

        const npc = render(<CreatureCard {...props} creature={defaultNpcCreature} />);
        expect(npc.container.querySelectorAll('.temp-hp-display')).toHaveLength(1);
        expect(npc.container.querySelector('.temp-hp-display').textContent).toContain('Temp HP: 5');

        const native = render(<CreatureCard {...props} creature={defaultPlayerCreature} />);
        expect(native.container.querySelectorAll('.temp-hp-display')).toHaveLength(0);

        runtimeState.getRuntimeValue.mockImplementation((_name, key) => (key === 'tempHp' ? 0 : null));
        const zero = render(<CreatureCard {...props} creature={{ ...defaultNpcCreature, name: 'Orc' }} />);
        expect(zero.container.querySelectorAll('.temp-hp-display')).toHaveLength(0);
    });

    it('survives an empty-name card with a targetless select', () => {
        const { container } = render(<CreatureCard {...props} creature={{ ...defaultPlayerCreature, name: '', targetName: '' }} allCreatures={[]} />);
        expect(container.querySelectorAll('.creature-card')).toHaveLength(1);
        const options = screen.getByTestId('target-select').querySelectorAll('option');
        expect(options).toHaveLength(1);
        expect(options[0].value).toBe('');
    });
});
