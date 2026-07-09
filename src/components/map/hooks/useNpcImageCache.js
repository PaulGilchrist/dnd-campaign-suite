import { useState, useEffect } from 'react';
import { getMonsterImageUrl } from '../../../services/npcs/monsterUtils.js';

function useNpcImageCache(placedItems, campaignName) {
    const [npcImages, setNpcImages] = useState({});

    useEffect(() => {
        const npcItems = placedItems.filter(item => item.type === 'npc');
        const promises = npcItems.map(async (item) => {
            const url = await getMonsterImageUrl(item.name, null, campaignName);
            return { name: item.name, url };
        });
        Promise.all(promises).then(results => {
            const newImages = {};
            results.forEach(({ name, url }) => { newImages[name] = url; });
            setNpcImages(newImages);
        });
    }, [placedItems, campaignName]);

    return { npcImages, setNpcImages };
}

export default useNpcImageCache;
