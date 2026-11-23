// @maintained-by-ai
// TV-mode GM card census (ZA 2026-11-23 backlog, owner decision 2026-11-23):
// a GM tab in TV presentation mode is a table-mounted screen shared with
// players, so its initiative cards must read EXACTLY like a LAN visitor's.
// The gating threads `tvMode` into the existing isLocalhost edit doors
// (NpcRemoveButton, AwayToggle, CardName, InitiativeControl, TargetSelect,
// ControlRow) so the GM-in-TV tier rides the visitor render path verbatim —
// no new faces. Owned here:
//   GM + tvMode card census: ZERO inputs, ZERO selects, no .npc-remove-btn,
//     no .away-toggle-btn — name/HP/initiative ride the visitor span faces
//     (name span, hp-max-val spans + status badge, initiative-value span)
//   GM + tvMode armed monster: TvTargetChip readout, no target select
//   GM + tvMode PC row EVEN for the sidebar-selected character: no target
//     select — the display tier plays no character (target-readonly span)
//   GM + TV OFF census byte-unchanged: monster 4 inputs (name/current HP/
//     max HP/initiative) + target + control selects + remove button; PC
//     2 inputs (current HP/initiative) — the inputs-a11y pin restated as an
//     explicit TV-off control
//   visitor tabs unchanged in BOTH modes, including the device-played PC's
//     own live target-select lane
//   shared away law: a TV-mode GM away row keeps the visitor disabled-input
//     face verbatim (bug-away-card-initiative-input-resurrects-slot)
// NOT owned here: the toolbar Next/Prev/Clear + TV music transport (out of
//   this bullet's scope), the visitor-ownership law itself (TargetSelect.
//   visitor-ownership.test.jsx), HP commit logic (createCreatureHandlers).
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`} className="avatar-wrapper">{name?.charAt(0).toUpperCase()}</div>),
}));

// Pass-through mock: the real component renders an <input> for the GM rename
// lane, so a TV-mode census that finds zero inputs genuinely proves the
// CardName door closed (not a stub swallowing the face).
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

// CreatureHp is the REAL component: the census must prove the actual input
// set a card mounts (its hooks ride the module mock below).

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

describe('CreatureCard - TV display tier (GM tabs read like visitor tabs)', () => {
    const baseProps = {
        isActive: false,
        isLocalhost: true,
        campaignNpcs: [{ name: 'Goblin' }],
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
        // Provided (not omitted) so the TV-mode census proves the GATE, not
        // a missing callback: these authoring lanes are live when TV is off.
        onControllerChange: vi.fn(),
        onEditAllies: vi.fn(),
        onToggleAway: vi.fn(),
    };

    const player = {
        name: 'Alice', type: 'player', currentHp: 20, maxHp: 20,
        initiative: 14, targetName: '', conditions: [], concentration: null,
    };
    const goblin = {
        name: 'Goblin', type: 'npc', monsterIndex: 'goblin', currentHp: 7, maxHp: 7,
        initiative: 18, initiativeBonus: 2, targetName: '', conditions: [], concentration: null,
    };
    const all = [player, goblin];

    beforeEach(() => {
        runtimeState.useRuntimeValue.mockReset().mockReturnValue(null);
        runtimeState.getRuntimeValue.mockReset().mockReturnValue(null);
    });

    const cardProps = (creature, overrides = {}) => ({
        ...baseProps,
        creature,
        allCreatures: all,
        ...overrides,
    });

    describe('GM + TV ON — display-only census', () => {
        it('monster card: ZERO inputs, ZERO selects, no remove/away affordances', () => {
            const { container } = render(<CreatureCard {...cardProps(goblin, { tvMode: true })} />);
            expect(container.querySelectorAll('.creature-card input')).toHaveLength(0);
            expect(container.querySelectorAll('.creature-card select')).toHaveLength(0);
            expect(container.querySelector('[data-testid="target-select"]')).toBeNull();
            expect(container.querySelector('[data-testid="control-select"]')).toBeNull();
            expect(container.querySelector('.npc-remove-btn')).toBeNull();
            expect(container.querySelector('.away-toggle-btn')).toBeNull();
        });

        it('monster card rides the visitor span faces verbatim (name span, HP spans + badge, initiative-value)', () => {
            const { container } = render(<CreatureCard {...cardProps(goblin, { tvMode: true })} />);
            const name = container.querySelector('.creature-name');
            expect(name.querySelector('span').textContent).toBe('Goblin');
            expect(screen.getByTestId('initiative-value').tagName).toBe('SPAN');
            expect(screen.getByTestId('initiative-value').textContent).toBe('18');
            // TV HP row (already the visitor idiom): HP n/m spans + status badge
            expect(container.querySelector('.hp-max-val').textContent).toBe('7/7');
            expect(container.querySelector('.status-badge')).toBeInTheDocument();
        });

        it('armed monster row shows the TvTargetChip readout, no select', () => {
            const { container } = render(
                <CreatureCard {...cardProps({ ...goblin, targetName: 'Alice' }, { tvMode: true })} />
            );
            expect(container.querySelector('.tv-target-chip').textContent).toContain('Alice');
            expect(container.querySelector('[data-testid="target-select"]')).toBeNull();
        });

        it('PC card: no target select even on the sidebar-selected row (the TV tier plays no character)', () => {
            const { container } = render(
                <CreatureCard {...cardProps(player, { tvMode: true, localCharacterName: 'Alice' })} />
            );
            expect(container.querySelectorAll('.creature-card input')).toHaveLength(0);
            expect(container.querySelector('[data-testid="target-select"]')).toBeNull();
            const readonly = container.querySelector('[data-testid="target-readonly"]');
            expect(readonly.tagName).toBe('SPAN');
            expect(readonly.textContent).toBe('—');
        });

        it('away row keeps the shared visitor disabled-input face (no editable box on the TV)', () => {
            render(<CreatureCard {...cardProps({ ...player, away: true, initiative: '' }, { tvMode: true })} />);
            const input = screen.getByTestId('initiative-input');
            expect(input.disabled).toBe(true);
            expect(input.title).toContain('away from the party');
            // The away AUTHORING lane is gone — only the read-only slot face stays.
        });
    });

    describe('GM + TV OFF — full edit lane byte-unchanged', () => {
        it('monster card keeps 4 labeled inputs + target/control selects + remove button', () => {
            const { container } = render(<CreatureCard {...cardProps(goblin)} />);
            const labels = [...container.querySelectorAll('.creature-card input')]
                .map(el => el.getAttribute('aria-label'));
            expect(labels.sort()).toEqual([
                'Goblin current HP', 'Goblin initiative', 'Goblin max HP', 'Goblin name',
            ]);
            expect(container.querySelector('[data-testid="target-select"]')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="control-select"]')).toBeInTheDocument();
            expect(container.querySelector('.npc-remove-btn')).toBeInTheDocument();
        });

        it('PC card keeps 2 inputs (current HP + initiative) + target select + away toggle', () => {
            const { container } = render(<CreatureCard {...cardProps(player)} />);
            const labels = [...container.querySelectorAll('.creature-card input')]
                .map(el => el.getAttribute('aria-label')).sort();
            expect(labels).toEqual(['Alice current HP', 'Alice initiative']);
            expect(container.querySelector('[data-testid="target-select"]')).toBeInTheDocument();
            expect(container.querySelector('.away-toggle-btn')).toBeInTheDocument();
        });
    });

    describe('visitor tabs — unchanged in both modes', () => {
        it('monster card: zero inputs/selects TV OFF and ON', () => {
            for (const tvMode of [false, true]) {
                const { container: c } = render(
                    <CreatureCard {...cardProps(goblin, { isLocalhost: false, tvMode })} />
                );
                expect(c.querySelectorAll('.creature-card input')).toHaveLength(0);
                expect(c.querySelectorAll('.creature-card select')).toHaveLength(0);
            }
        });

        it('device-played PC row keeps its LIVE target select in both modes (criterion: unchanged lane)', () => {
            for (const tvMode of [false, true]) {
                const { container } = render(
                    <CreatureCard {...cardProps(player, { isLocalhost: false, tvMode, localCharacterName: 'Alice' })} />
                );
                expect(container.querySelector('[data-testid="target-select"]')).toBeInTheDocument();
            }
        });

        it('foreign PC row keeps the read-only span in both modes', () => {
            for (const tvMode of [false, true]) {
                const { container } = render(
                    <CreatureCard {...cardProps(player, { isLocalhost: false, tvMode, localCharacterName: undefined })} />
                );
                expect(container.querySelector('[data-testid="target-select"]')).toBeNull();
                expect(container.querySelector('[data-testid="target-readonly"]')).toBeInTheDocument();
            }
        });
    });
});
