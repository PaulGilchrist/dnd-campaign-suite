// @maintained-by-ai 2026-11-16
// MonsterCardModal header avatar (improvement 2026-11-16): the GM's stat-block
// modal carries the monster avatar like the character sheet, and clicking it
// zooms to the shared full-size AvatarModal popup. Owned here:
//   resolution precedence: live combatSummary row imagePath wins (campaign-
//     prefixed) > host-resolved imageUrl prop > initial face (inert)
//   avatar click opens the popup and never closes the stat modal (header-close
//     stopPropagation lane)
// NOT owned here (do not duplicate):
//   header arm mirror / close button → MonsterCardModal.test.jsx + XE lanes
//   visitor initiative-card popup → CreatureCard.avatarImagePopup.test.jsx
//   npcImages resolution lane → monsterUtils.test.js / Initiative host
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        rollAbilityCheck: vi.fn(),
        rollSavingThrow: vi.fn(),
        rollSkillCheck: vi.fn(),
        rollInitiative: vi.fn(),
        quickRollPlayerSave: vi.fn(),
    })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ')),
    getTargetFromAttacker: vi.fn(() => null),
    getCombatContext: vi.fn(() => Promise.resolve(null)),
    findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [] })),
    getResistanceNotice: vi.fn(() => null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
    getDistanceFeet: vi.fn(() => null),
    getNearestPlacedItem: vi.fn(() => null),
    rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 30)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_campaign, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'inspiringMovementNoOA') return false;
        if (key === 'remarkableAthleteNoOA') return false;
        return null;
    }),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));

function renderModal(props = {}) {
    return render(
        <MonsterCardModal
            monster={makeMonster()}
            onClose={vi.fn()}
            campaignName="test-campaign"
            creatures={[]}
            creatureName="Goblin 1"
            mapName={null}
            characters={[]}
            {...props}
        />
    );
}

describe('MonsterCardModal - header avatar', () => {
    it('live combatSummary row imagePath wins, campaign-prefixed', () => {
        const { container } = renderModal({
            creatures: [{ name: 'Goblin 1', type: 'npc', imagePath: 'images/gob.png' }],
        });
        const img = container.querySelector('.mc-header-avatar .avatar-image');
        expect(img).toHaveAttribute('src', 'campaigns/test-campaign/images/gob.png');
    });

    it('host-resolved imageUrl shows verbatim (remote/campaign-prefixed URL untouched)', () => {
        const { container } = renderModal({ imageUrl: 'https://cdn.example.com/goblin.jpg' });
        const img = container.querySelector('.mc-header-avatar .avatar-image');
        expect(img).toHaveAttribute('src', 'https://cdn.example.com/goblin.jpg');
    });

    it('row imagePath outranks the host imageUrl (NpcAvatar precedence parity)', () => {
        const { container } = renderModal({
            imageUrl: 'https://cdn.example.com/goblin.jpg',
            creatures: [{ name: 'Goblin 1', type: 'npc', imagePath: 'images/gob.png' }],
        });
        const img = container.querySelector('.mc-header-avatar .avatar-image');
        expect(img).toHaveAttribute('src', 'campaigns/test-campaign/images/gob.png');
    });

    it('avatar click opens the full-size popup and never closes the stat modal', () => {
        const onClose = vi.fn();
        const { container } = renderModal({ imageUrl: 'https://cdn.example.com/goblin.jpg', onClose });
        const avatar = container.querySelector('.mc-header-avatar .avatar-wrapper');
        fireEvent.click(avatar);
        const overlay = screen.getByTestId('avatar-modal-overlay');
        expect(overlay.querySelector('.avatar-modal-image')).toHaveAttribute('src', 'https://cdn.example.com/goblin.jpg');
        expect(onClose).not.toHaveBeenCalled();
        // Close button dismisses the zoom, stat modal stays. (.mc-close shares
        // the "Close" accessible name, so target the zoom panel's own button.)
        fireEvent.click(overlay.querySelector('.avatar-modal-close'));
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    // Keyboard tier (backlog 2026-11-16 YG): the header-zoom face must pull
    // focus INTO the panel on open and answer Escape there without tabbing —
    // the stat modal itself never listens for Escape, so it survives.
    it('header zoom pulls focus into the panel; Escape closes ONLY the zoom', () => {
        const onClose = vi.fn();
        const { container } = renderModal({ imageUrl: 'https://cdn.example.com/goblin.jpg', onClose });
        const avatar = container.querySelector('.mc-header-avatar .avatar-wrapper');
        avatar.focus();
        fireEvent.keyDown(avatar, { key: 'Enter' });

        const panel = screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal');
        expect(document.activeElement).toBe(panel);

        fireEvent.keyDown(panel, { key: 'Escape' });
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(avatar);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('no image at all → initial avatar; click is inert (no popup, no close)', () => {
        const onClose = vi.fn();
        const { container } = renderModal({ onClose });
        expect(container.querySelector('.mc-header-avatar .avatar-initial')).toBeInTheDocument();
        expect(container.querySelector('.mc-header-avatar .avatar-image')).not.toBeInTheDocument();
        fireEvent.click(container.querySelector('.mc-header-avatar .avatar-wrapper'));
        expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });
});
