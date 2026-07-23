
import React from 'react';
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function CharFeatFeatures({ playerStats, campaignName }) {
    const replenishingMeals = useRuntimeValue(playerStats.name, 'replenishingMeals', campaignName);
    const chefBolsteringTreats = useRuntimeValue(playerStats.name, 'chefBolsteringTreats', campaignName);
    const bolsteringTreat = useRuntimeValue(playerStats.name, 'bolsteringTreat', campaignName);

    const hasChefFeat = (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    );

    const hasReplenishingMealFeat = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
    );

    const hasAnyResources = (replenishingMeals > 0) || (hasChefFeat && chefBolsteringTreats > 0) || bolsteringTreat > 0;
    if (!hasAnyResources) {
        return null;
    }

    return (
        <div data-testid="char-feat-features">
            {replenishingMeals > 0 && (
                <TrackedResourceInput
                    label="Replenishing Meals"
                    resourceKey="replenishingMeals"
                    playerName={playerStats.name}
                    getMax={() => hasReplenishingMealFeat ? Math.max(replenishingMeals, 4 + (playerStats.proficiency || 0)) : 1}
                    deps={[playerStats, replenishingMeals]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )}
            {hasChefFeat && chefBolsteringTreats > 0 && (
                <TrackedResourceInput
                    label="Bolstering Treats"
                    resourceKey="chefBolsteringTreats"
                    playerName={playerStats.name}
                    getMax={() => Math.max(chefBolsteringTreats, playerStats.proficiency || 1)}
                    deps={[playerStats, chefBolsteringTreats]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )}
            {bolsteringTreat > 0 && (
                <TrackedResourceInput
                    label="Bolstering Treat"
                    resourceKey="bolsteringTreat"
                    playerName={playerStats.name}
                    getMax={() => 1}
                    deps={[playerStats, bolsteringTreat]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )}
        </div>
    );
}

export default CharFeatFeatures;
