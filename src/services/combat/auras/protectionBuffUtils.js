import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const PROTECTION_BUFF_KEY = 'protectionBuff';

export function hasProtectionBuff(targetName, campaignName) {
    const buff = getRuntimeValue(targetName, PROTECTION_BUFF_KEY, campaignName);
    if (!buff) return false;
    if (typeof buff === 'object' && buff.timestamp) {
        const elapsed = Date.now() - buff.timestamp;
        if (elapsed > 600000) return false;
    }
    return true;
}

export function getProtectionBuffSource(targetName, campaignName) {
    const buff = getRuntimeValue(targetName, PROTECTION_BUFF_KEY, campaignName);
    if (!buff) return null;
    if (typeof buff === 'object') {
        const elapsed = Date.now() - buff.timestamp;
        if (elapsed > 600000) return null;
    }
    return buff?.source || null;
}

export function clearProtectionBuff(targetName, campaignName) {
    setRuntimeValue(targetName, PROTECTION_BUFF_KEY, null, campaignName);
}
