import { useCallback, useEffect, useState } from 'react';

/**
 * Monster-card avatar lane (improvement 2026-11-16): resolves the header
 * avatar src and holds the per-client full-size zoom flag — same precedence
 * as the Initiative card's NpcAvatar: the live combatSummary row's own
 * imagePath wins (custom-NPC avatars are stamped onto the row at join/rename
 * — initiativeService), else the host's resolved imageUrl (Initiative's
 * npcImages lane: bestiary / campaign-NPC / form image). Form rows (Wild
 * Shape, Polymorph, Shapechange) skip the host-row image so the form's own
 * resolved image surfaces. Lives outside MonsterCardModal/MonsterCardBody to
 * keep both under their lint statement/complexity caps.
 */
export function useMonsterAvatarZoom(monsterName, creatures, imageUrl) {
    const [avatarImageUrl, setAvatarImageUrl] = useState(imageUrl);
    const [showZoom, setShowZoom] = useState(false);
    useEffect(() => {
        const row = (creatures || []).find(c => c.name === monsterName) || null;
        const isForm = !!(row && (row.wildShapeSource || row.polymorphSource || row.animalShapesSource || row.shapechangeSource));
        setAvatarImageUrl(row?.imagePath && !isForm ? row.imagePath : imageUrl);
    }, [monsterName, creatures, imageUrl]);
    const openZoom = useCallback(() => setShowZoom(true), []);
    const closeZoom = useCallback(() => setShowZoom(false), []);
    return { avatarImageUrl, showZoom, openZoom, closeZoom };
}
