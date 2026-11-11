// @maintained-by-ai
// Initiative cell visitor face (backlog 2026-11-11 LZ): a read-only (LAN) tab
// must NEVER mount the permanently-disabled `initiative-input` shell — the
// cell renders a plain text value instead, mirroring CardName's visitor span.
// Owned here:
//   visitor non-away: zero [data-testid="initiative-input"], "Initiative"
//     label kept, plain span shows the rolled value (jsx InitiativeControl)
//   visitor unrolled: honest em-dash placeholder face
//   visitor live adoption: a changed creature.initiative re-renders the span
//     (the combatSummary SSE echo path — GM edit lands on mounted visitor cards)
//   localhost present: editable input still renders enabled (GM behavior
//     byte-unchanged)
// NOT owned here (do not duplicate):
//   away disabled-input faces + rejoin tooltip → CreatureCard.away.test.jsx
//   blur/Enter commit dispatch → CreatureCard.interactions.test.jsx
//   GM rolled/unrolled input values → CreatureCard.rendering.test.jsx
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

describe('CreatureCard - initiative visitor face', () => {
    const goblin = {
        name: 'Goblin',
        type: 'npc',
        currentHp: 7,
        maxHp: 7,
        initiative: 18,
        initiativeBonus: 2,
        targetName: '',
        conditions: [],
        concentration: null,
    };

    let props;
    beforeEach(() => {
        runtimeState.useRuntimeValue.mockReset().mockReturnValue(null);
        runtimeState.getRuntimeValue.mockReset().mockReturnValue(null);
        props = {
            creature: goblin,
            isActive: false,
            isLocalhost: false,
            campaignNpcs: [],
            overlays: [],
            allCreatures: [goblin],
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

    it('visitor monster card mounts NO initiative input — plain text value with the Initiative label', () => {
        const { container } = render(<CreatureCard {...props} />);
        expect(container.querySelector('[data-testid="initiative-input"]')).not.toBeInTheDocument();
        const cell = container.querySelector('.creature-initiative');
        expect(cell).toBeInTheDocument();
        expect(cell.textContent).toContain('Initiative');
        const face = screen.getByTestId('initiative-value');
        expect(face.tagName).toBe('SPAN');
        expect(face.textContent).toBe('18');
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty string', ''],
    ])('visitor unrolled initiative (%s) renders the em-dash placeholder', (_label, initiative) => {
        render(<CreatureCard {...props} creature={{ ...goblin, initiative }} />);
        expect(screen.getByTestId('initiative-value').textContent).toBe('—');
    });

    it('visitor span adopts a changed initiative value on re-render (SSE echo path)', () => {
        const { rerender } = render(<CreatureCard {...props} />);
        expect(screen.getByTestId('initiative-value').textContent).toBe('18');
        rerender(<CreatureCard {...props} creature={{ ...goblin, initiative: 5 }} />);
        expect(screen.getByTestId('initiative-value').textContent).toBe('5');
    });

    it('localhost GM present row still renders the editable enabled input (unchanged)', () => {
        const { container } = render(<CreatureCard {...props} isLocalhost={true} />);
        expect(screen.queryByTestId('initiative-value')).not.toBeInTheDocument();
        const input = screen.getByTestId('initiative-input');
        expect(container.contains(input)).toBe(true);
        expect(input.disabled).toBe(false);
        expect(input).toHaveValue(18);
    });

    it('localhost away row keeps the disabled input face with the rejoin hint (no regression)', () => {
        render(<CreatureCard {...props} isLocalhost={true} creature={{ ...goblin, type: 'player', away: true, initiative: '' }} />);
        const input = screen.getByTestId('initiative-input');
        expect(input.disabled).toBe(true);
        expect(input.title).toContain('away from the party');
    });

    it('visitor away row also keeps the disabled input face (plain-text face is !isLocalhost && !isAway)', () => {
        render(<CreatureCard {...props} creature={{ ...goblin, type: 'player', away: true, initiative: '' }} />);
        expect(screen.queryByTestId('initiative-value')).not.toBeInTheDocument();
        const input = screen.getByTestId('initiative-input');
        expect(input.disabled).toBe(true);
        expect(input.title).toContain('away from the party');
    });
});
