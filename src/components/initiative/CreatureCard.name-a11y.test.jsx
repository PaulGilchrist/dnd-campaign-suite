// @maintained-by-ai
// CreatureCard name accessible-name census (backlog 2026-11-08 EQ): one stable
// probe must resolve the creature name on EVERY initiative card type. The
// rename lane on GM npc rows is a live feature (handleNameChange → renameNpc
// rewrites the combatSummary row and swaps stats when the new name matches the
// bestiary), so the editable MonsterNameAutocomplete input STAYS — it just
// carries aria-label "<Name> name", mirroring the "<Name> current HP" input
// convention. Combined census selector:
//   `.creature-name span, .creature-name input[aria-label$=" name"]`
// Owned here (name-a11y lane):
//   PC row → static .creature-name span
//   bestiary-joined monster row (GM) → input[aria-label="<Name> name"]
//   bare +NPC placeholder row (GM) → input[aria-label="NPC 1 name"] (keeps editing)
//   visitor (non-localhost) npc row → static span (read-only lane)
//   polymorphObject row → static span with form-type label
// NOT owned here: rename dispatch internals (interactions test), autocomplete
//   suggestion behaviour (MonsterNameAutocomplete.test.jsx).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`} className="avatar-wrapper">{name?.charAt(0).toUpperCase()}</div>),
}));

// Pass-through mock: forwards value/onChange/ariaLabel exactly like the real
// component's input so the card-level wiring (CardName → ariaLabel) is pinned.
vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value, onChange, ariaLabel }) => (
        <div className="monster-autocomplete" data-testid="monster-autocomplete">
            <input
                className="monster-autocomplete-input"
                aria-label={ariaLabel}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`npc-avatar-${name}`} className="npc-avatar">{name?.charAt(0).toUpperCase()}</div>),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => <div data-testid={`creature-hp-${creature.name}`} className="creature-hp"><span>{creature.currentHp ?? 0}/{creature.maxHp ?? 1}</span></div>),
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

describe('CreatureCard - name accessible-name census', () => {
    const baseProps = {
        isActive: false,
        isLocalhost: true,
        campaignNpcs: [],
        overlays: [],
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

    const player = {
        name: 'Alice', type: 'player', currentHp: 20, maxHp: 20,
        initiative: 14, targetName: '', conditions: [], concentration: null,
    };
    const goblin = {
        name: 'Goblin', type: 'npc', monsterIndex: 'goblin', currentHp: 7, maxHp: 7,
        initiative: 10, initiativeBonus: 2, targetName: '', conditions: [], concentration: null,
    };
    const bareNpc = {
        name: 'NPC 1', type: 'npc', currentHp: 10, maxHp: 10,
        initiative: '', targetName: '', conditions: [], concentration: null,
    };

    beforeEach(() => {
        runtimeState.useRuntimeValue.mockReset().mockReturnValue(null);
        runtimeState.getRuntimeValue.mockReset().mockReturnValue(null);
    });

    const cardProps = (creature, allCreatures, overrides = {}) => ({
        ...baseProps,
        creature,
        allCreatures: allCreatures || [creature],
        ...overrides,
    });

    it('PC card renders the name as a static .creature-name span', () => {
        const { container } = render(<CreatureCard {...cardProps(player)} />);
        const span = container.querySelector('.creature-name span');
        expect(span).toBeInTheDocument();
        expect(span.textContent).toBe('Alice');
        expect(container.querySelector('.creature-name input')).not.toBeInTheDocument();
    });

    it('GM bestiary-joined monster card keeps the editable input with aria-label "<Name> name"', () => {
        render(<CreatureCard {...cardProps(goblin)} />);
        const input = screen.getByRole('textbox', { name: 'Goblin name' });
        expect(input).toHaveClass('monster-autocomplete-input');
        expect(input).toHaveValue('Goblin');
    });

    it('GM bare +NPC placeholder card keeps editing AND carries aria-label "NPC 1 name"', () => {
        render(<CreatureCard {...cardProps(bareNpc)} />);
        expect(screen.getByRole('textbox', { name: 'NPC 1 name' })).toHaveValue('NPC 1');
    });

    it('visitor (non-localhost) npc card renders the read-only span lane', () => {
        const { container } = render(<CreatureCard {...cardProps(goblin, null, { isLocalhost: false })} />);
        expect(container.querySelector('.creature-name span').textContent).toBe('Goblin');
        expect(screen.queryByRole('textbox', { name: 'Goblin name' })).not.toBeInTheDocument();
    });

    it('polymorph form card renders a static span (no rename lane)', () => {
        const { container } = render(
            <CreatureCard {...cardProps({ ...player, polymorphObject: { type: 'bear_form', icon: 'fa-paw' } })} />
        );
        expect(container.querySelector('.creature-name span').textContent).toBe('Bear Form');
    });

    it('ONE combined census selector resolves the name on every card type', () => {
        const all = [player, goblin, bareNpc];
        render(<CreatureCard {...cardProps(player, all)} />);
        render(<CreatureCard {...cardProps(goblin, all)} />);
        render(<CreatureCard {...cardProps(bareNpc, all)} />);
        const names = [...document.querySelectorAll('.creature-name span, .creature-name input[aria-label$=" name"]')]
            .map(el => (el.tagName === 'INPUT' ? el.value : el.textContent));
        expect(names).toEqual(['Alice', 'Goblin', 'NPC 1']);
    });
});
