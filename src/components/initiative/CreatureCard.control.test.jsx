// @maintained-by-ai
// Lane: CreatureCard control-delegation presentation (Phase 2).
// Owned here: the GM-only control picker (NPC rows only, player options, dispatch
// of assign/release), the auto-note for derived summon control, the LAN card-opening
// gate driven by the controller resolver (explicit AND derived lanes), and the
// device-side "Your turn!" cue. Write + audit contract: createCreatureHandlers.control.test.js;
// precedence table: creatureControl.test.js.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`}>{name?.[0]}</div>),
}));
vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value, onChange }) => <input data-testid="monster-name-input" value={value} onChange={(e) => onChange(e.target.value)} />),
}));
vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name, onClick }) => <div data-testid={`npc-avatar-${name}`} className="npc-avatar" onClick={onClick}>{name?.[0]}</div>),
}));
vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => <div data-testid={`creature-hp-${creature.name}`} />),
}));
vi.mock('./HpFeedback.jsx', () => ({
    default: vi.fn(({ creatureName }) => <span data-testid={`hp-feedback-${creatureName}`} />),
}));
vi.mock('./TurnEconomyStrip.jsx', () => ({ default: vi.fn(() => null) }));
vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(({ creatureName }) => <div data-testid={`condition-effects-${creatureName}`} />),
}));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({ getAbilityLabel: (a) => a }));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ isBuffActive: vi.fn(() => false) }));
vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false), getResilientSphereSource: vi.fn(() => null),
}));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false), getUnbreakableMajestySaveDc: vi.fn(() => 0), clearUnbreakableMajesty: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendFleshToStoneResult: vi.fn(), sendPrismaticSprayIndigoResult: vi.fn(), sendPrismaticSprayVioletResult: vi.fn(),
}));
vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({ cleanupWildShape: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({ revertPolymorph: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({ revertAnimalShapes: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({ revertShapechange: vi.fn() }));
vi.mock('../../services/combat/conditions/effectDescriptions.js', () => ({ CONDITION_DESCRIPTIONS: {} }));
vi.mock('../common/CreatureBadge.jsx', () => ({
    default: vi.fn(({ label }) => <span className="creature-badge">{label}</span>),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
}));

const alice = { name: 'Alice', type: 'player', currentHp: 20, maxHp: 20, conditions: [], concentration: null };
const bob = { name: 'Bob', type: 'player', currentHp: 15, maxHp: 15, conditions: [], concentration: null };
const uncontrolledZombie = { name: 'Zombie', type: 'npc', currentHp: 10, maxHp: 10, initiative: 8, targetName: '', conditions: [], concentration: null };

function renderCard(overrides = {}) {
    const props = {
        creature: overrides.creature || uncontrolledZombie,
        isActive: false,
        isLocalhost: true,
        campaignNpcs: [],
        overlays: [],
        allCreatures: overrides.allCreatures || [alice, bob, overrides.creature || uncontrolledZombie],
        campaignName: 'test-campaign',
        characters: [],
        onRemoveNpc: vi.fn(), onNpcClick: vi.fn(), onNameChange: vi.fn(), onHpChange: vi.fn(),
        onInitiativeChange: vi.fn(), onTargetChange: vi.fn(), onRollConditionSave: vi.fn(),
        onBreakCondition: vi.fn(), onOpenEffectAdder: vi.fn(), onRollConcentrationSave: vi.fn(),
        onBreakConcentration: vi.fn(), mapName: 'test-map',
        onControllerChange: vi.fn(),
        ...overrides,
    };
    render(<CreatureCard {...props} />);
    return props;
}

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockReturnValue(null);
});

describe('GM control picker (ControlRow)', () => {
    it('localhost NPC card offers the picker with GM default and player options', () => {
        renderCard();
        const select = screen.getByTestId('control-select');
        expect(select).toHaveValue('');
        expect(select).toHaveDisplayValue('— GM —');
        const options = [...select.querySelectorAll('option')].map(o => o.value);
        expect(options).toEqual(['', 'Alice', 'Bob']);
    });

    it('assigning dispatches (name, player); choosing GM dispatches null (release)', () => {
        const { onControllerChange } = renderCard();
        const select = screen.getByTestId('control-select');
        fireEvent.change(select, { target: { value: 'Alice' } });
        expect(onControllerChange).toHaveBeenCalledWith('Zombie', 'Alice');
        fireEvent.change(select, { target: { value: '' } });
        expect(onControllerChange).toHaveBeenLastCalledWith('Zombie', null);
    });

    it('explicit assignment pre-selects the controlling player', () => {
        renderCard({ creature: { ...uncontrolledZombie, controller: 'Bob' } });
        expect(screen.getByTestId('control-select')).toHaveValue('Bob');
    });

    it('derived summon control shows the auto-note without stealing the select value', () => {
        runtimeState.useRuntimeValue.mockImplementation((key, prop) =>
            prop === 'targetEffects' ? [{ effect: 'summoned', source: 'Alice', target: 'Zombie' }] : null);
        renderCard();
        expect(screen.getByTestId('control-select')).toHaveValue('');
        expect(screen.getByText('auto: Alice')).toBeInTheDocument();
    });

    it('LAN devices and player rows never render the picker', () => {
        renderCard({ isLocalhost: false });
        expect(screen.queryByTestId('control-select')).not.toBeInTheDocument();

        renderCard({ isLocalhost: true, creature: alice, allCreatures: [alice, bob] });
        expect(screen.queryByTestId('control-select')).not.toBeInTheDocument();
    });
});

describe('LAN card opening via controller resolution', () => {
    it('explicit controller opens the stat card on the controlling device', () => {
        const props = renderCard({
            isLocalhost: false,
            creature: { ...uncontrolledZombie, controller: 'Alice' },
        });
        fireEvent.click(screen.getByTestId('npc-avatar-Zombie'));
        expect(props.onNpcClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Zombie' }), { allowNonLocalhost: true });
    });

    it('derived summoned te control keeps opening the card (historical lane)', () => {
        runtimeState.useRuntimeValue.mockImplementation((key, prop) =>
            prop === 'targetEffects' ? [{ effect: 'summoned', source: 'Alice', target: 'Zombie' }] : null);
        const props = renderCard({ isLocalhost: false });
        fireEvent.click(screen.getByTestId('npc-avatar-Zombie'));
        expect(props.onNpcClick).toHaveBeenCalled();
    });

    it('uncontrolled NPCs stay closed on LAN devices', () => {
        const props = renderCard({ isLocalhost: false });
        fireEvent.click(screen.getByTestId('npc-avatar-Zombie'));
        expect(props.onNpcClick).not.toHaveBeenCalled();
    });

    it('the controlling device sees a turn cue when its creature is active', () => {
        renderCard({ isLocalhost: false, isActive: true, creature: { ...uncontrolledZombie, controller: 'Alice' } });
        expect(screen.getByText('Your turn!')).toBeInTheDocument();
    });

    it('no turn cue for the GM view, inactive cards, or uncontrolled creatures', () => {
        renderCard({ isActive: true, creature: { ...uncontrolledZombie, controller: 'Alice' } });
        expect(screen.queryByText('Your turn!')).not.toBeInTheDocument();
    });
});
