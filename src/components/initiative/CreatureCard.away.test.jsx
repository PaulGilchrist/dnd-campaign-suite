// @maintained-by-ai
// CreatureCard split-party render faces (plan initiative-split-party):
// away card chrome (creature-away class + Away badge), the GM-only
// away/rejoin toggle button (absent for LAN clients and NPC cards), and the
// TargetSelect exclusion of away creatures. Badge census / interactions /
// removal lanes stay in their sibling files.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`}>{name?.charAt(0)}</div>),
}));
vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value }) => <div data-testid="monster-autocomplete"><input data-testid="monster-name-input" value={value} readOnly /></div>),
}));
vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`npc-avatar-${name}`}>{name?.charAt(0)}</div>),
}));
vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => <div data-testid={`creature-hp-${creature.name}`}>{creature.currentHp ?? 0}</div>),
}));
vi.mock('./ConditionEffectBadges.jsx', () => ({
    default: vi.fn(() => <div data-testid="condition-effects" />),
}));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilityLabel: (a) => a?.toUpperCase() || '',
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ isBuffActive: vi.fn(() => false) }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    useRuntimeValue: vi.fn(() => null),
    getRuntimeValue: vi.fn(() => null),
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
vi.mock('../../services/automation/handlers/class-druid/wildShapeCreatureBuilder.js', () => ({ cleanupWildShape: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({ revertPolymorph: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({ revertAnimalShapes: vi.fn() }));
vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({ revertShapechange: vi.fn() }));

const base = (over = {}) => ({
    name: 'Alice', type: 'player', currentHp: 20, maxHp: 20,
    initiative: 14, targetName: '', conditions: [], concentration: null, ...over,
});

let props;
beforeEach(() => {
    vi.clearAllMocks();
    props = {
        creature: base(),
        isActive: false,
        isLocalhost: true,
        campaignNpcs: [],
        overlays: [],
        allCreatures: [],
        campaignName: 'test-campaign',
        characters: [],
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
        onViewCharacter: vi.fn(),
        onControllerChange: vi.fn(),
        onEditAllies: vi.fn(),
        onToggleAway: vi.fn(),
    };
});

describe('away card chrome', () => {
    it('away player: creature-away class + Away badge, no unconscious class bleed', () => {
        props.creature = base({ away: true });
        const { container } = render(<CreatureCard {...props} />);
        const card = container.querySelector('.creature-card');
        expect(card.className).toContain('creature-away');
        expect(card.className).not.toContain('creature-unconscious');
        expect(screen.getByText('Away')).toBeTruthy();
    });
    it('present player: no away chrome', () => {
        const { container } = render(<CreatureCard {...props} />);
        expect(container.querySelector('.creature-card').className).not.toContain('creature-away');
        expect(screen.queryByText('Away')).toBeNull();
    });
});

describe('away toggle button', () => {
    it('localhost player card renders the toggle and dispatches by name', () => {
        render(<CreatureCard {...props} />);
        const btn = screen.getByLabelText('Mark Alice away from initiative');
        btn.click && null; // fireEvent alternative: click via dispatchEvent below
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(props.onToggleAway).toHaveBeenCalledWith('Alice');
    });
    it('away row flips the affordance to Rejoin', () => {
        props.creature = base({ away: true });
        render(<CreatureCard {...props} />);
        expect(screen.getByLabelText('Rejoin Alice to initiative')).toBeTruthy();
    });
    it('LAN clients and NPC cards get no toggle (tracker authorship is GM-only)', () => {
        props.isLocalhost = false;
        const { container: lan } = render(<CreatureCard {...props} />);
        expect(lan.querySelector('.away-toggle-btn')).toBeNull();
        props.isLocalhost = true;
        props.creature = { ...base(), name: 'Goblin', type: 'npc' };
        const { container: npc } = render(<CreatureCard {...props} />);
        expect(npc.querySelector('.away-toggle-btn')).toBeNull();
    });
});

describe('TargetSelect excludes away creatures', () => {
    it('present attacker options hide away PCs but keep NPCs', () => {
        const alice = base();
        const bob = base({ name: 'Bob', away: true });
        const goblin = { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 5 };
        props.allCreatures = [alice, bob, goblin];
        render(<CreatureCard {...props} />);
        const select = screen.getByTestId('target-select');
        const options = Array.from(select.querySelectorAll('option')).map(o => o.value).filter(Boolean);
        expect(options).toEqual(['Goblin']);
    });
});

describe('rejoin button title faces', () => {
    // FV 2026-11-09 backlog: since 09ff6ef97 second-turn twins rejoin by
    // re-anchoring to the holder's second-turn slot (holder initiative − 10,
    // secondTurnAnchorInitiative in creaturePresence.js), so the Rejoin
    // tooltip must NOT claim the end-of-round slot for them — matching the
    // honest audit copy in createCreatureHandlers.js.
    it('second-turn twin: title names the holder re-anchor, no end-of-round claim', () => {
        props.creature = base({
            name: 'EvasiveFighter (Second Turn)',
            away: true,
            initiative: '',
            secondTurn: true,
            holderName: 'EvasiveFighter',
        });
        render(<CreatureCard {...props} />);
        const btn = screen.getByLabelText('Rejoin EvasiveFighter (Second Turn) to initiative');
        expect(btn.title).not.toContain('end of the round');
        expect(btn.title).toBe(
            "Rejoin EvasiveFighter (Second Turn) to the encounter (initiative re-anchors to EvasiveFighter's second-turn slot)"
        );
    });

    it('normal away row: title byte-identical to the end-of-round copy', () => {
        props.creature = base({ away: true, initiative: '' });
        render(<CreatureCard {...props} />);
        expect(screen.getByLabelText('Rejoin Alice to initiative').title)
            .toBe('Rejoin Alice to the encounter (initiative lands at the end of the round)');
    });

    it('twin without holderName: anchor unresolvable, end-of-round copy stays', () => {
        props.creature = base({
            name: 'Ghost (Second Turn)',
            away: true,
            initiative: '',
            secondTurn: true,
        });
        render(<CreatureCard {...props} />);
        expect(screen.getByLabelText('Rejoin Ghost (Second Turn) to initiative').title)
            .toBe('Rejoin Ghost (Second Turn) to the encounter (initiative lands at the end of the round)');
    });
});

// bug-away-card-initiative-input-resurrects-slot: an away row holds NO
// initiative slot — its card's initiative input is read-only even for the GM,
// and the presence-keyed input REMOUNTS on presence flips so the uncontrolled
// defaultValue re-syncs to the store value (wiped '' on split, landed slot on
// rejoin) instead of displaying a stale roll until a page reload.
describe('initiative input presence faces', () => {
    const input = (container) => container.querySelector('[data-testid="initiative-input"]');

    it('away player: disabled for the localhost GM with a rejoin hint', () => {
        props.creature = base({ away: true, initiative: '' });
        const { container } = render(<CreatureCard {...props} />);
        const inp = input(container);
        expect(inp.disabled).toBe(true);
        expect(inp.title).toContain('away from the party');
    });

    it('present player: input stays enabled for the GM', () => {
        const { container } = render(<CreatureCard {...props} />);
        expect(input(container).disabled).toBe(false);
    });

    it('split re-syncs the displayed value to the wiped store value', () => {
        props.creature = base({ initiative: '10' });
        const { container, rerender } = render(<CreatureCard {...props} />);
        expect(input(container).value).toBe('10');
        props.creature = base({ initiative: '', away: true }); // applyPresenceChanges wiped it
        rerender(<CreatureCard {...props} />);
        expect(input(container).value).toBe('');
    });

    it('rejoin re-syncs the displayed value to the landed end-of-round slot', () => {
        props.creature = base({ initiative: '10', away: true }); // stale display face
        const { container, rerender } = render(<CreatureCard {...props} />);
        props.creature = base({ initiative: '15' });
        rerender(<CreatureCard {...props} />);
        expect(input(container).value).toBe('15');
        expect(input(container).disabled).toBe(false);
    });
});
