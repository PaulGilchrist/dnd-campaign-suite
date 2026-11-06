// @maintained-by-ai
// CreatureCard overlay-target option suppression (backlog aoe-overlay-dead-lane).
// Owned here (target-select overlay lane):
//   overlay-<id> options render ONLY on player cards — the overlay area
//   adjudication lane (CharSpells getTargetInfo SP-097 fallback →
//   useLoggedDiceRollDamage 'overlay-' branch → handleAoeDamage) is PC-cast
//   live, while MonsterCardModal.getTarget()'s name lookup can never match
//   `overlay-<id>` (monster chips with an armed overlay roll plain untargeted
//   damage) — so monster cards must not offer the inert options.
// NOT owned here (do not duplicate):
//   overlay optgroup presence + overlayLabel bytes on player cards →
//     CreatureCard.rendering.test.jsx (target-select option population)
//   arming dispatch/handler lane → createCreatureHandlers tests
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`avatar-${name}`} />),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value }) => <div data-testid="monster-autocomplete"><input data-testid="monster-name-input" value={value} onChange={() => {}} /></div>),
}));

vi.mock('./NpcAvatar.jsx', () => ({
    default: vi.fn(({ name }) => <div data-testid={`npc-avatar-${name}`} />),
}));

vi.mock('./CreatureHp.jsx', () => ({
    default: vi.fn(({ creature }) => <div data-testid={`creature-hp-${creature.name}`} />),
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

describe('CreatureCard - overlay target options', () => {
    const player = {
        name: 'Alice',
        type: 'player',
        currentHp: 20,
        maxHp: 20,
        initiative: 14,
        targetName: '',
        conditions: [],
        concentration: null,
    };

    // EB-joined bestiary monster (sanctioned initiative path — monsterIndex stamp).
    const ebMonster = {
        name: 'Winged Kobold',
        type: 'npc',
        monsterIndex: 3,
        currentHp: 10,
        maxHp: 10,
        initiative: 17,
        targetName: '',
        conditions: [],
        concentration: null,
    };

    // Bare "+ NPC" placeholder card — same MonsterCardModal.getTarget() name-lookup
    // trap applies, so overlays are inert there too.
    const bareNpc = {
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

    const overlays = [
        { id: 'ov1', shape: 'sphere', radiusFt: 15, label: 'Fireball' },
        { id: 'ov2', shape: 'cone', radiusFt: 30 },
    ];

    let props;
    beforeEach(() => {
        runtimeState.useRuntimeValue.mockReset().mockReturnValue(null);
        runtimeState.getRuntimeValue.mockReset().mockReturnValue(null);
        props = {
            creature: player,
            isActive: false,
            isLocalhost: true,
            campaignNpcs: [],
            overlays,
            allCreatures: [player, ebMonster, bareNpc],
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

    const overlayValues = (container) =>
        [...container.querySelectorAll('[data-testid="target-select"] option')].map(o => o.value).filter(v => v.startsWith('overlay-'));

    it('lists overlay-<id> options on a PC card (live SP-097 lane — do not regress)', () => {
        render(<CreatureCard {...props} />);
        const select = screen.getByTestId('target-select');
        expect(overlayValues(select)).toEqual(['overlay-ov1', 'overlay-ov2']);
        expect(select.querySelector('optgroup[label="─── Overlays ───"]')).toBeInTheDocument();
    });

    it('suppresses overlay options on an EB-joined monster card while creature targets remain', () => {
        render(<CreatureCard {...props} creature={ebMonster} />);
        const select = screen.getByTestId('target-select');
        expect(overlayValues(select)).toEqual([]);
        expect(select.querySelector('optgroup')).not.toBeInTheDocument();
        // All creature targets still populate normally (self excluded).
        const values = [...select.querySelectorAll('option')].map(o => o.value);
        expect(values).toEqual(['', 'Alice', 'NPC 1']);
    });

    it('suppresses overlay options on a bare + NPC placeholder card too', () => {
        render(<CreatureCard {...props} creature={bareNpc} />);
        const select = screen.getByTestId('target-select');
        expect(overlayValues(select)).toEqual([]);
        expect([...select.querySelectorAll('option')].map(o => o.value)).toEqual(['', 'Alice', 'Winged Kobold']);
    });

    it('renders two side-by-side cards with per-type option sets (PC keeps, monster drops)', () => {
        const { container } = render(
            <>
                <CreatureCard {...props} creature={player} />
                <CreatureCard {...props} creature={ebMonster} />
            </>
        );
        const [pcSelect, monsterSelect] = container.querySelectorAll('[data-testid="target-select"]');
        expect(pcSelect.querySelectorAll('option[value^="overlay-"]')).toHaveLength(2);
        expect(monsterSelect.querySelectorAll('option[value^="overlay-"]')).toHaveLength(0);
    });
});
