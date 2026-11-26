// @maintained-by-ai 2026-11-23
// Initiative creature-card INPUT accessible-name census (backlog XY 2026-11-23):
// every `<input>` rendered inside a `.creature-card` must carry a descriptive
// aria-label following the existing "<Name> <field>" convention (e.g.
// "<Name> initiative"). Previously only `<Name> current HP` (+ `<Name> max HP`
// and the NPC rename `<Name> name`) were labeled — the per-card INITIATIVE
// input rendered with NO aria-label (live census `INPUT:null`), so tests keyed
// off a positional null. This pin locks that gap shut.
//
// The card-level census rides the REAL CreatureHp (its hooks run against the
// module mock), so it exercises EVERY input lane a GM card actually mounts —
// initiative, current HP, max HP, and the NPC rename input (faithful
// pass-through mock). Owned here:
//   GM PC row: initiative + current HP inputs both carry non-empty labels
//   GM monster row: initiative + current HP + max HP + name all labeled
//   visitor monster row: NO new editable inputs mount (read-only spans only)
//   census selector resolves zero unlabeled inputs across all card types
// NOT owned here: blur/Enter commit dispatch (interactions test), the real
//   MaxHpInput/CurrentHpInput onBlur commit logic (createCreatureHandlers lanes).
import { render } from '@testing-library/react';
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

// CreatureHp is the REAL component here — the whole point of the census is to
// pin the actual input set a card mounts (current HP, and max HP on monster
// rows), not a stand-in's contract. Its runtime hooks ride the module mock.

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

describe('CreatureCard - input accessible-name census', () => {
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

    const censusUnlabeled = (container) =>
        [...container.querySelectorAll('.creature-card input')]
            .filter(el => !el.getAttribute('aria-label') || !el.getAttribute('aria-label').trim());

    it('INITIATIVE (the previously-unlabeled field) now carries "<Name> initiative"', () => {
        const { container } = render(<CreatureCard {...cardProps(player)} />);
        const init = container.querySelector('[data-testid="initiative-input"]');
        expect(init).toBeInTheDocument();
        expect(init.getAttribute('aria-label')).toBe('Alice initiative');
    });

    it('GM PC card mounts NO unlabeled input', () => {
        const { container } = render(<CreatureCard {...cardProps(player)} />);
        // Sanity: this card does mount inputs (initiative + current HP).
        expect(container.querySelectorAll('.creature-card input').length).toBeGreaterThan(0);
        expect(censusUnlabeled(container)).toHaveLength(0);
    });

    it('GM monster card mounts NO unlabeled input (initiative + current HP + max HP + name)', () => {
        const { container } = render(<CreatureCard {...cardProps(goblin)} />);
        expect(container.querySelectorAll('.creature-card input').length).toBeGreaterThanOrEqual(4);
        expect(censusUnlabeled(container)).toHaveLength(0);
    });

    it('visitor monster card does NOT gain new editable inputs (read-only spans preserved)', () => {
        const { container } = render(<CreatureCard {...cardProps(goblin, null, { isLocalhost: false })} />);
        // Read-only lane: the visitor monster card mounts zero inputs at all.
        expect(container.querySelectorAll('.creature-card input')).toHaveLength(0);
    });

    it('ONE census finds zero unlabeled inputs across every GM card type', () => {
        const all = [player, goblin];
        const { container } = render(
            <>
                <CreatureCard {...cardProps(player, all)} />
                <CreatureCard {...cardProps(goblin, all)} />
            </>
        );
        const inputs = [...container.querySelectorAll('.creature-card input')];
        expect(inputs.length).toBeGreaterThan(0);
        expect(inputs.every(el => !!el.getAttribute('aria-label')?.trim())).toBe(true);
    });
});
