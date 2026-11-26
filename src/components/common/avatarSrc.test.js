// @maintained-by-ai 2026-11-16
// Canonical avatar-src contract shared by AvatarImage, AvatarModal and the
// monster-avatar lanes (MonsterCardModal header + CreatureCard visitor popup).
// Pins the no-double-prefix rule that makes getMonsterImageUrl's already-
// campaign-prefixed output safe to feed back through the components.
import { describe, it, expect } from 'vitest';
import { resolveAvatarSrc } from './avatarSrc.js';

describe('resolveAvatarSrc', () => {
    it.each([
        ['null', null],
        ['undefined', undefined],
        ['empty string', ''],
    ])('%s stays untouched', (_label, imagePath) => {
        expect(resolveAvatarSrc(imagePath, 'my-campaign')).toBe(imagePath);
    });

    it.each([
        ['https URL', 'https://example.com/avatar.png'],
        ['http URL', 'http://example.com/avatar.png'],
    ])('%s stays untouched even with a campaign', (_label, imagePath) => {
        expect(resolveAvatarSrc(imagePath, 'my-campaign')).toBe(imagePath);
        expect(resolveAvatarSrc(imagePath)).toBe(imagePath);
    });

    it('relative path + campaign gets the campaign prefix', () => {
        expect(resolveAvatarSrc('avatar.png', 'my-campaign')).toBe('campaigns/my-campaign/avatar.png');
    });

    it('relative path without campaign stays untouched', () => {
        expect(resolveAvatarSrc('avatar.png')).toBe('avatar.png');
    });

    it('already campaign-prefixed path stays untouched (never double-prefix)', () => {
        expect(resolveAvatarSrc('campaigns/my-campaign/avatar.png', 'my-campaign'))
            .toBe('campaigns/my-campaign/avatar.png');
    });
});
