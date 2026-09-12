
import React from 'react';
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function hasChefFeat(playerStats) {
    return (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    );
}

function hasReplenishingMealFeat(playerStats) {
    return (playerStats.automation?.passives ?? []).some(
        p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
    );
}

function hasLuckyFeat(playerStats) {
    return (playerStats.feats || []).some(f =>
        f?.toLowerCase?.().includes('lucky')
    );
}

function hasPoisonerFeat(playerStats) {
    return (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'brew_poison' && p.name === 'Brew Poison'
    );
}

function hasAnyResources({ replenishingMeals, hasChef, chefBolsteringTreats, bolsteringTreat, hasLucky, lpMax, hasPoisoner }) {
    return (replenishingMeals > 0) || (hasChef && chefBolsteringTreats > 0) || bolsteringTreat > 0 || (hasLucky && lpMax > 0) || hasPoisoner;
}

function CharFeatFeatures({ playerStats, campaignName }) {
    const replenishingMeals = useRuntimeValue(playerStats.name, 'replenishingMeals', campaignName);
    const chefBolsteringTreats = useRuntimeValue(playerStats.name, 'chefBolsteringTreats', campaignName);
    const bolsteringTreat = useRuntimeValue(playerStats.name, 'bolsteringTreat', campaignName);
    const luckyPoints = useRuntimeValue(playerStats.name, 'luckyPoints', campaignName);
    const poisonDoses = useRuntimeValue(playerStats.name, 'poisonDoses', campaignName);
    const poisonedWeaponsActive = useRuntimeValue(playerStats.name, 'poisonedWeaponsActive', campaignName);

    const flags = {
        replenishingMeals,
        hasChef: hasChefFeat(playerStats),
        chefBolsteringTreats,
        bolsteringTreat,
        hasLucky: hasLuckyFeat(playerStats),
        lpMax: playerStats.proficiency || 0,
        hasPoisoner: hasPoisonerFeat(playerStats)
    };

    if (!hasAnyResources(flags)) {
        return null;
    }

    const sections = [
        {
            key: 'lucky',
            when: () => flags.hasLucky && flags.lpMax > 0,
            render: () => (
                <TrackedResourceInput
                    label="Luck Points"
                    resourceKey="luckyPoints"
                    playerName={playerStats.name}
                    getMax={() => flags.lpMax}
                    deps={[playerStats, luckyPoints]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )
        },
        {
            key: 'poisoner',
            when: () => flags.hasPoisoner,
            render: () => (
                <div>
                    <TrackedResourceInput
                        label="Poison Doses"
                        resourceKey="poisonDoses"
                        playerName={playerStats.name}
                        getMax={() => playerStats.proficiency || 0}
                        deps={[playerStats, poisonDoses]}
                        campaignName={campaignName}
                        playerStats={playerStats}
                        defaultValue={0}
                    />
                    {poisonedWeaponsActive && (
                        <span className="automation-badge"><i className="fa-solid fa-vial"></i> Poisoned Weapons active</span>
                    )}
                </div>
            )
        },
        {
            key: 'replenishing',
            when: () => replenishingMeals > 0,
            render: () => (
                <TrackedResourceInput
                    label="Replenishing Meals"
                    resourceKey="replenishingMeals"
                    playerName={playerStats.name}
                    getMax={() => hasReplenishingMealFeat(playerStats) ? Math.max(replenishingMeals, 4 + (playerStats.proficiency || 0)) : 1}
                    deps={[playerStats, replenishingMeals]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )
        },
        {
            key: 'chefTreats',
            when: () => flags.hasChef && chefBolsteringTreats > 0,
            render: () => (
                <TrackedResourceInput
                    label="Bolstering Treats"
                    resourceKey="chefBolsteringTreats"
                    playerName={playerStats.name}
                    getMax={() => Math.max(chefBolsteringTreats, playerStats.proficiency || 1)}
                    deps={[playerStats, chefBolsteringTreats]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )
        },
        {
            key: 'bolsteringTreat',
            when: () => bolsteringTreat > 0,
            render: () => (
                <TrackedResourceInput
                    label="Bolstering Treat"
                    resourceKey="bolsteringTreat"
                    playerName={playerStats.name}
                    getMax={() => 1}
                    deps={[playerStats, bolsteringTreat]}
                    campaignName={campaignName}
                    playerStats={playerStats}
                />
            )
        }
    ];

    return (
        <div data-testid="char-feat-features">
            {sections.filter(s => s.when()).map(s => <React.Fragment key={s.key}>{s.render()}</React.Fragment>)}
        </div>
    );
}

export default CharFeatFeatures;
