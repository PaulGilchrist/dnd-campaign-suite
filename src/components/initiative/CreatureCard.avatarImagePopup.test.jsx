// @maintained-by-ai 2026-11-16
// Visitor (LAN) monster-avatar zoom (improvement 2026-11-16): a read-only tab
// cannot open the GM-private stat modal, so an imaged monster/NPC avatar click
// opens the shared full-size AvatarModal popup — same lane as the character
// sheet avatar. Owned here:
//   visitor click with row imagePath → popup, campaign-prefixed src, zero
//     onNpcClick dispatch (stat modal stays GM/summon-only)
//   visitor click with only the resolved remote npcImage → popup shows it verbatim
//   visitor click with no image at all → no-op (no popup, no dispatch)
//   popup Close button dismisses (mount-local state, no writes)
//   popup portals to document.body — never mounted inside the .creature-card
//     subtree (the card's transform/opacity make it a fixed-position
//     containing block + stacking context; bug 2026-11-16)
//   keyboard tier (visitor avatar zoom, backlog 2026-11-17): the real NpcAvatar
//     wrapper is a Tab-reachable role=button whose Enter/Space keydown opens the
//     same zoom, and every close lane restores focus to it (AvatarModal's opener
//     restore stands down on a body-focus opener — the focusable wrapper is what
//     re-arms that lane end-to-end)
//   localhost click still routes onNpcClick({allowNonLocalhost:true}) and never
//     mounts the popup (existing GM lane byte-unchanged)
// NOT owned here (do not duplicate):
//   wrapper keydown semantics (preventDefault, content-derived name, inert
//     no-onClick face) → NpcAvatar.test.jsx
//   AvatarModal focus-trap/restore internals → ../common/AvatarModal.test.jsx
//   NPC avatar click dispatch faces → CreatureCard.interactions.test.jsx
//   card wiring seam for summoned lanes → same file
import { render, screen, fireEvent, act } from '@testing-library/react';
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

// NpcAvatar is NOT mocked here: the keyboard tier lives on its .npc-avatar
// wrapper, so the card-level Tab/Enter/Space + focus-restore lanes must ride
// the real component (its own semantics are pinned in NpcAvatar.test.jsx).

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

    // The real NpcAvatar wrapper is the activation surface — locate it scoped
    // to the card (the zoom portals to body, the card owns one .npc-avatar).
    const renderCard = (override = {}) => {
        const { container } = render(<CreatureCard {...props} {...override} />);
        return { container, avatar: container.querySelector('.npc-avatar') };
    };
    // Flush the unmount's passive cleanup + focus restore (AvatarModal.test idiom).
    const flush = () => act(async () => {});
    const panelOf = () => screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal');

    it('visitor click on an imaged monster avatar opens the full-size popup with the campaign-prefixed src', () => {
        const { avatar } = renderCard();
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        fireEvent.click(avatar);
        const overlay = screen.getByTestId('avatar-modal-overlay');
        expect(overlay.querySelector('.avatar-modal-image')).toHaveAttribute('src', 'campaigns/test-campaign/images/goblin.png');
        expect(props.onNpcClick).not.toHaveBeenCalled();
    });

    it('visitor click with only the resolved remote npcImage pops that URL verbatim (no campaign prefix)', () => {
        const { avatar } = renderCard({ creature: { ...goblin, imagePath: undefined }, npcImage: 'https://cdn.example.com/goblin.jpg' });
        fireEvent.click(avatar);
        expect(screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal-image')).toHaveAttribute('src', 'https://cdn.example.com/goblin.jpg');
    });

    it('visitor click on an imageless monster avatar is a no-op — no popup, no stat-modal dispatch', () => {
        const { avatar } = renderCard({ creature: { ...goblin, imagePath: undefined } });
        fireEvent.click(avatar);
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        expect(props.onNpcClick).not.toHaveBeenCalled();
    });

    it('popup Close button dismisses the zoom (local state only, zero writes)', () => {
        const { avatar } = renderCard();
        fireEvent.click(avatar);
        expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    // Regression pin (bug 2026-11-16): .initiative .creature-card carries
    // transform: scale(1.0) + opacity 0.9, which makes the card a containing
    // block AND stacking context for position:fixed descendants — an
    // in-subtree overlay anchored to the CARD box, painted its × under
    // neighbouring cards, and a mouse-only visitor could not close the zoom.
    // The popup must portal onto document.body instead.
    it('visitor popup portals onto document.body — outside the .creature-card subtree', () => {
        const { container, avatar } = renderCard();
        fireEvent.click(avatar);
        const overlay = screen.getByTestId('avatar-modal-overlay');
        expect(overlay.parentElement).toBe(document.body);
        expect(container.querySelector('[data-testid="avatar-modal-overlay"]')).toBeNull();
        expect(overlay.closest('.creature-card')).toBeNull();
    });

    it('backdrop click on the portalled popup closes it (no trapped zoom)', () => {
        const { avatar } = renderCard();
        fireEvent.click(avatar);
        const overlay = screen.getByTestId('avatar-modal-overlay');
        fireEvent.mouseDown(overlay);
        fireEvent.click(overlay);
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('localhost GM click still routes onNpcClick and never mounts the popup', () => {
        const { avatar } = renderCard({ isLocalhost: true });
        fireEvent.click(avatar);
        expect(props.onNpcClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), { allowNonLocalhost: true });
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    // Keyboard tier (visitor avatar zoom, backlog 2026-11-17): the .npc-avatar
    // wrapper used to be a plain div — the zoom was keyboard-unreachable and
    // AvatarModal's opener focus-restore could capture nothing (body-focus
    // stand-down), so close dropped focus on document.body.
    describe('keyboard open + focus restore (real NpcAvatar → real AvatarModal)', () => {
        it('the uncontrolled monster avatar is a Tab-reachable button named after the creature', () => {
            const { avatar } = renderCard();
            expect(avatar).toHaveAttribute('role', 'button');
            expect(avatar).toHaveAttribute('tabindex', '0');
            // Accessible name mirrors the GM header avatar pattern: derived
            // from content (the img alt), no invented aria-label convention.
            expect(screen.getByRole('button', { name: 'Goblin' })).toBe(avatar);
        });

        it('Enter on the focused avatar opens the same zoom, pulls focus into the panel, fires no other card behavior', () => {
            const { avatar } = renderCard();
            avatar.focus();
            fireEvent.keyDown(avatar, { key: 'Enter' });
            const overlay = screen.getByTestId('avatar-modal-overlay');
            expect(overlay.querySelector('.avatar-modal-image')).toHaveAttribute('src', 'campaigns/test-campaign/images/goblin.png');
            expect(document.activeElement).toBe(panelOf());
            expect(props.onNpcClick).not.toHaveBeenCalled();
        });

        it('Space on the focused avatar opens the zoom and is prevented (no page scroll)', () => {
            const { avatar } = renderCard();
            avatar.focus();
            expect(fireEvent.keyDown(avatar, { key: ' ' })).toBe(false);
            expect(screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal-image')).toHaveAttribute('src', 'campaigns/test-campaign/images/goblin.png');
            expect(props.onNpcClick).not.toHaveBeenCalled();
        });

        it('Escape closes the Enter-opened zoom and restores focus to the avatar (not body)', async () => {
            const { avatar } = renderCard();
            avatar.focus();
            fireEvent.keyDown(avatar, { key: 'Enter' });
            fireEvent.keyDown(panelOf(), { key: 'Escape' });
            await flush();
            expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
            expect(document.activeElement).toBe(avatar);
        });

        it('the × click after a keyboard open restores focus to the avatar too', async () => {
            const { avatar } = renderCard();
            avatar.focus();
            fireEvent.keyDown(avatar, { key: 'Enter' });
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            await flush();
            expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
            expect(document.activeElement).toBe(avatar);
        });

        it('a pure backdrop click after a keyboard open closes and restores focus to the avatar', async () => {
            const { avatar } = renderCard();
            avatar.focus();
            fireEvent.keyDown(avatar, { key: 'Enter' });
            const overlay = screen.getByTestId('avatar-modal-overlay');
            fireEvent.mouseDown(overlay);
            fireEvent.click(overlay);
            await flush();
            expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
            expect(document.activeElement).toBe(avatar);
        });

        it('localhost keyboard Enter routes onNpcClick (GM lane) and never mounts the popup', () => {
            const { avatar } = renderCard({ isLocalhost: true });
            avatar.focus();
            fireEvent.keyDown(avatar, { key: 'Enter' });
            expect(props.onNpcClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Goblin' }), { allowNonLocalhost: true });
            expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        });
    });
});
