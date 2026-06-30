import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

export async function handleRestoreRage(playerStats, campaignName, actionName, auto, setPopupHtml) {
    const rageKey = auto.resourceKey || (actionName.toLowerCase().replace(/\s+/g, '') + 'Uses');
    const currentRage = Number(getRuntimeValue(playerStats.name, 'ragePoints', campaignName) ?? 0);
    if (currentRage <= 0) {
        setPopupHtml(`<b>${actionName}</b><br/>No Rage remaining to restore this feature.`);
        return false;
    }
    await setRuntimeValue(playerStats.name, 'ragePoints', currentRage - 1, campaignName);
    await setRuntimeValue(playerStats.name, rageKey, 0, campaignName);
    setPopupHtml(`<b>${actionName}</b><br/>Expended 1 Rage to restore use.`);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    return true;
}
