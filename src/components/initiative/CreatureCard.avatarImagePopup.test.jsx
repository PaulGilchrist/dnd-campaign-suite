// @maintained-by-ai
// Visitor (LAN) monster-avatar zoom (improvement 2026-11-16): a read-only tab
// cannot open the GM-private stat modal, so an imaged monster/NPC avatar click
// opens the shared full-size AvatarModal popup — same lane as the character
// sheet avatar. Owned here:
//   visitor click with row imagePath → popup, campaign-prefixed src, zero
//     onNpcClick dispatch (stat modal stays GM/summon-only)
//   visitor click with only the resolved remote npcImage → popup shows it verbatim
//   visitor click with no image at all → no-op (no popup, no dispatch)
//   popup Close button dismisses (mount-local state, no writes)
//   localhost click still routes onNpcClick({allowNonLocalhost:true}) and never
//     mounts the popup (existing GM lane byte-unchanged)
// NOT owned here (do not duplicate):
//   NPC avatar click dispatch faces → CreatureCard.interactions.test.jsx
//   card wiring seam for summoned lanes → same file
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureCard from './CreatureCard.jsx';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath }) => {
        return <div data-testid={`avatar-${name}`} className="avatar-wrapper">{imagePath ? <img src={imagePath} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}</div>;
    }),
}));

vi.mock('../common/MonsterNameAutocomplete.jsx', () => ({
    default: vi.fn(({ value }) => <div data-testid="monster-autocomplete">{value}</div>),
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

describe('CreatureCard - visitor monster-avatar image popup', () => {
    const goblin = {
        name: 'Goblin',
        type: 'npc',
        currentHp: 7,
        maxHp: 7,
        initiative: 10,
        targetName: '',
        conditions: [],
        concentration: null,
        imagePath: 'images/goblin.png',
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

    it('visitor click on an imaged monster avatar opens the full-size popup with the campaign-prefixed src', () => {
        render(<CreatureCard {...props} />);
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
        const overlay = screen.getByTestId('avatar-modal-overlay');
        expect(overlay.querySelector('.avatar-modal-image')).toHaveAttribute('src', 'campaigns/test-campaign/images/goblin.png');
        expect(props.onNpcClick).not.toHaveBeenCalled();
    });

    it('visitor click with only the resolved remote npcImage pops that URL verbatim (no campaign prefix)', () => {
        render(<CreatureCard {...props} creature={{ ...goblin, imagePath: undefined }} npcImage="https://cdn.example.com/goblin.jpg" />);
        fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
        expect(screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal-image')).toHaveAttribute('src', 'https://cdn.example.com/goblin.jpg');
    });

    it('visitor click on an imageless monster avatar is a no-op — no popup, no stat-modal dispatch', () => {
        render(<CreatureCard {...props} creature={{ ...goblin, imagePath: undefined }} />);
        fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        expect(props.onNpcClick).not.toHaveBeenCalled();
    });

    it('popup Close button dismisses the zoom (local state only, zero writes)', () => {
        render(<CreatureCard {...props} />);
        fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
        expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('localhost GM click still routes onNpcClick and never mounts the popup', () => {
        render(<CreatureCard {...props} isLocalhost={true} />);
        fireEvent.click(screen.getByTestId('npc-avatar-Goblin'));
        expect(props.onNpcClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), { allowNonLocalhost: true });
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });
});
