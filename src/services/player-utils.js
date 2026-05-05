export const getCurrentClassLevel = (playerStats) => {
    return playerStats?.class?.class_levels?.[(playerStats?.level || 0) - 1];
};