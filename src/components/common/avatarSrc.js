/**
 * Canonical avatar-src resolution shared by AvatarImage, AvatarModal and the
 * monster-avatar lanes. Mirrors getMonsterImageUrl's own contract (services/
 * npcs/monsterUtils.js): remote URLs stay untouched, already-campaign-prefixed
 * paths stay untouched (never double-prefix), and a bare relative path gets
 * the campaign folder prefix when a campaign is known.
 */
export function resolveAvatarSrc(imagePath, campaignName) {
    if (!imagePath) return imagePath;
    if (imagePath.startsWith('http')) return imagePath;
    if (!campaignName) return imagePath;
    if (imagePath.includes('campaigns/')) return imagePath;
    return `campaigns/${campaignName}/${imagePath}`;
}
