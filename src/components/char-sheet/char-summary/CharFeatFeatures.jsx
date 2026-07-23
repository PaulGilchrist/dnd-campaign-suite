
import React from 'react';
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function CharFeatFeatures({ playerStats, campaignName }) {
    const replenishingMeals = useRuntimeValue(playerStats.name, 'replenishingMeals', campaignName);

    if (!(replenishingMeals > 0)) {
        return null;
    }

    const displayMax = Math.max(replenishingMeals, 1);

    return (
        <div data-testid="char-feat-features">
            <TrackedResourceInput
                label="Replenishing Meals"
                resourceKey="replenishingMeals"
                playerName={playerStats.name}
                getMax={() => displayMax}
                deps={[playerStats, replenishingMeals]}
                campaignName={campaignName}
                playerStats={playerStats}
            />
        </div>
    );
}

export default CharFeatFeatures;
