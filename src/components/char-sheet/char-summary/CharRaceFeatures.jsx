import React from 'react';
import TrackedResourceInput from './TrackedResourceInput.jsx';

/* ─── Dragonborn ─── */
const DragonbornFeatures = function DragonbornFeatures({ playerStats, campaignName }) {
    const rawUses = playerStats.race?.traits?.[0]?.automation?.uses;
    const maxUses = rawUses === 'proficiency_bonus'
        ? (playerStats.proficiency || 0)
        : (rawUses || 1);

    return (
        <div className="race-features">
            <TrackedResourceInput
                label="Breath Weapon"
                resourceKey="breathweaponUses"
                playerName={playerStats.name}
                getMax={() => maxUses}
                deps={[playerStats.level]}
                campaignName={campaignName}
                playerStats={playerStats}
            />
        </div>
    );
};

/* ─── Goliath ─── */
const GIANT_ANCESTRY_MAP = {
    "Cloud Giant": { label: "Cloud's Jaunt", resourceKey: 'cloudsJauntUses' },
    "Fire Giant": { label: "Fire's Burn", resourceKey: 'firesBurnUses' },
    "Frost Giant": { label: "Frost's Chill", resourceKey: 'frostsChillUses' },
    "Hill Giant": { label: "Hill's Tumble", resourceKey: 'hillsTumbleUses' },
    "Stone Giant": { label: "Stone's Endurance", resourceKey: 'stonesEnduranceUses' },
    "Storm Giant": { label: "Storm's Thunder", resourceKey: 'stormsThunderUses' },
};

const GoliathFeatures = function GoliathFeatures({ playerStats, campaignName }) {
    const prof = playerStats.proficiency || 0;
    const subraceName = playerStats.race?.subrace?.name;
    const config = subraceName ? GIANT_ANCESTRY_MAP[subraceName] : null;

    if (!config) return null;

    return (
        <div className="race-features">
            <TrackedResourceInput
                label={config.label}
                resourceKey={config.resourceKey}
                playerName={playerStats.name}
                getMax={() => prof}
                deps={[playerStats]}
                campaignName={campaignName}
                playerStats={playerStats}
            />
        </div>
    );
};

/* ─── Registry (maps race name → component) ─── */
const RACE_COMPONENTS = {
    Dragonborn: DragonbornFeatures,
    Goliath: GoliathFeatures,
};

/* ─── Entry point ─── */
function CharRaceFeatures({ playerStats, campaignName }) {
    const raceName = playerStats?.race?.name;
    const Cmp = RACE_COMPONENTS[raceName];

    if (!Cmp) return null;

    return <Cmp playerStats={playerStats} campaignName={campaignName} />;
}

export default CharRaceFeatures;
