// @maintained-by-ai
// NpcAvatar leaf lane — props-in/DOM-out render contract of the initiative NPC avatar.
// Zero module mocks: AvatarImage is pure presentational and its own contract (src
// resolution incl. campaign prefix, initial fallback, sizing, interactivity) is pinned
// in ../common/AvatarImage.test.jsx — cited, not duplicated. Here we pin only what is
// NpcAvatar's own: the `imagePath || imageUrl` precedence, its own initials branch, and
// passthrough of name/campaignName/size=150.
// NOT owned here: card-level avatar click gate + onNpcClick(creature, {allowNonLocalhost})
// wiring → CreatureCard.interactions.test.jsx (#851); click dispatch targets →
// createNpcClickHandler-* (#841/#842); polymorph icon-avatar bypassing NpcAvatar at the
// card → CreatureCard.rendering.test.jsx (#853).
// Old->new map: image-render 1 -> precedence + passthrough 1 (mock deleted, real bytes);
// initials 2 -> 1 four-row table (+ no-broken-img honesty); click 1 -> both-branch table.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NpcAvatar from './NpcAvatar.jsx';

describe('NpcAvatar', () => {
    describe('image branch (a portrait src exists)', () => {
        it('prefers imagePath over imageUrl and forwards name, campaignName and size 150 to AvatarImage', () => {
            const { rerender, container } = render(<NpcAvatar name="Goblin" imageUrl="https://example.com/goblin.png" />);
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/goblin.png');

            rerender(<NpcAvatar name="Goblin" imageUrl="https://example.com/old.png" imagePath="portraits/goblin.png" campaignName="test-campaign" />);
            // imagePath wins; relative paths gain the campaign prefix only because
            // NpcAvatar forwarded campaignName (prefix mechanism owned by AvatarImage tests).
            expect(screen.getByRole('img')).toHaveAttribute('src', 'campaigns/test-campaign/portraits/goblin.png');
            expect(screen.getByRole('img')).toHaveAttribute('alt', 'Goblin');
            expect(container.querySelector('.npc-avatar')).toBeInTheDocument();
            expect(container.querySelector('.avatar-wrapper')).toHaveStyle({ width: '150px', height: '150px' });
        });
    });

    describe('initials fallback (no portrait src)', () => {
        it.each([
            ['Goblin', 'G'],
            ['goblin', 'G'],
            ['', '?'],
            [null, '?'],
        ])('name %s renders initial %s with no broken-image byte', (name, initial) => {
            const { container } = render(<NpcAvatar name={name} />);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
            expect(screen.getByText(initial)).toBeInTheDocument();
            expect(container.querySelector('.npc-avatar')).toBeInTheDocument();
        });
    });

    // onClick is duplicated across both render branches, so pin the seam on both.
    const variants = [
        ['image avatar', { name: 'Goblin', imageUrl: 'https://example.com/goblin.png' }],
        ['initial avatar', { name: 'Goblin' }],
    ];
    describe.each(variants)('click seam — %s', (_label, props) => {
        it('calls onClick exactly once when the .npc-avatar wrapper is clicked', () => {
            const onClick = vi.fn();
            const { container } = render(<NpcAvatar {...props} onClick={onClick} />);
            fireEvent.click(container.querySelector('.npc-avatar'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });
});
