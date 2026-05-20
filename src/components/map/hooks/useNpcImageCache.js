import { useState, useEffect } from 'react';
import { getMonsterImageUrl } from '../../../services/monsterUtils.js';

function useNpcImageCache(placedItems) {
    const [npcImages, setNpcImages] = useState({});

    useEffect(() => {
        const npcItems = placedItems.filter(item => item.type === 'npc');
        const promises = npcItems.map(async (item) => {
            const url = await getMonsterImageUrl(item.name);
            return { id: item.id, url };
        });
        Promise.all(promises).then(results => {
            const newImages = {};
            results.forEach(({ id, url }) => { newImages[id] = url; });
            setNpcImages(newImages);
        });
    }, [placedItems]);

    return { npcImages, setNpcImages };
}

export default useNpcImageCache;
