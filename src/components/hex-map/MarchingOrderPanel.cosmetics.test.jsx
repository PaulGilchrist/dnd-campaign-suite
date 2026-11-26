// @maintained-by-ai
// ─── Lane: MarchingOrderPanel — Item 5 cosmetics on the hex 2D face ───────────
// OWNED here: the marching-order avatar is a character's TOKEN FACE on the
// hex surface (the board carries one shared party marker — see the component
// header) and must honor all three Item 5 cosmetics from the SAME canonical
// character-bucket row as the indoor board: palette ring class on the avatar
// (CSS class, never inline styles), hideLabel suppressing the name element,
// and the uniform dashed condition ring via the ONE shared predicate
// (conditions or campaign targetEffects aimed at the character). Ordering /
// ranks / images stay in MarchingOrderPanel.test.jsx (unmodified — the
// default row renders byte-identical markup).
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MarchingOrderPanel from './MarchingOrderPanel.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import { TOKEN_COSMETICS_KEY } from '../../config/tokenCosmetics.js';

const CAMPAIGN = 'test-campaign';
const characters = [
    { name: 'Alice', imagePath: '/alice.png' },
    { name: 'Bob', imagePath: null },
];

const renderPanel = (props = {}) => render(
    <MarchingOrderPanel
        marchingOrder={['Alice', 'Bob']}
        setMarchingOrder={vi.fn()}
        characters={characters}
        onClose={vi.fn()}
        campaignName={CAMPAIGN}
        {...props}
    />
);

describe('hex token face honors the canonical cosmetics row', () => {
    beforeEach(() => {
        getStore('Alice').clear();
        getStore('Bob').clear();
        getStore('campaign').clear();
    });

    it('unset avatars keep the pre-Item-5 bytes (plain class, labels shown)', () => {
        const { container } = renderPanel();
        const avatar = container.querySelector('.marching-order-avatar');
        expect(avatar.className).toBe('marching-order-avatar');
        expect([...container.querySelectorAll('.marching-order-name')].map(n => n.textContent))
            .toEqual(['Alice', 'Bob']);
    });

    it('a stored ring color classes the avatar (CSS-driven, no inline style)', () => {
        setRuntimeObject('Alice', { [TOKEN_COSMETICS_KEY]: { ringColor: 'violet', hideLabel: false } }, CAMPAIGN, true);
        const { container } = renderPanel();
        const avatar = container.querySelector('.marching-order-row .marching-order-avatar');
        expect(avatar).toHaveClass('token-ring-violet');
        expect(avatar).not.toHaveAttribute('style');
    });

    it('hideLabel removes the name element but keeps the avatar', () => {
        setRuntimeObject('Bob', { [TOKEN_COSMETICS_KEY]: { ringColor: null, hideLabel: true } }, CAMPAIGN, true);
        const { container } = renderPanel();
        const names = [...container.querySelectorAll('.marching-order-name')].map(n => n.textContent);
        expect(names).toEqual(['Alice']);
        expect(container.querySelector('.marching-order-initial')).toHaveTextContent('B');
    });

    it('conditions wear the dashed condition ring on the avatar (shared predicate)', () => {
        setRuntimeObject('Alice', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
        const { container } = renderPanel();
        expect(container.querySelector('.marching-order-avatar')).toHaveClass('token-condition-ring');
    });

    it('campaign targetEffects aimed at the character also wear the ring', () => {
        setRuntimeObject('campaign', {
            targetEffects: [{ target: 'Bob', effect: 'sanctuary', source: 'Cleric' }],
        }, CAMPAIGN, true);
        const { container } = renderPanel();
        const rows = container.querySelectorAll('.marching-order-row');
        expect(rows[1].querySelector('.marching-order-avatar')).toHaveClass('token-condition-ring');
        expect(rows[0].querySelector('.marching-order-avatar')).not.toHaveClass('token-condition-ring');
    });

    it('ring color + condition ring compose on the same avatar', () => {
        setRuntimeObject('Alice', {
            [TOKEN_COSMETICS_KEY]: { ringColor: 'gold', hideLabel: false },
            activeConditions: ['prone'],
        }, CAMPAIGN, true);
        const { container } = renderPanel();
        const avatar = container.querySelector('.marching-order-avatar');
        expect(avatar).toHaveClass('token-ring-gold');
        expect(avatar).toHaveClass('token-condition-ring');
    });
});
