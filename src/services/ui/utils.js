const utils = {
    getAbilityLongName: (shortName) => {
        switch (shortName) {
            case 'STR': return 'Strength';
            case 'DEX': return 'Dexterity';
            case 'CON': return 'Constitution';
            case 'INT': return 'Intelligence';
            case 'WIS': return 'Wisdom';
            case 'CHA': return 'Charisma';
        }
    },
    getName: (fullName) => {
        if (!fullName || typeof fullName !== 'string') {
            return 'Unknown';
        }
        return fullName;
    },

    guid: () => {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            
			const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	},
    // WARNING: Do NOT use guid() or crypto.randomUUID() to identify NPCs or characters.
    // Use their name as the unique identifier everywhere. GUIDs are only for internal
    // sub-objects (conditions, concentration, log entries, non-NPC map items).

    // crypto.randomUUID() only exists in secure contexts (HTTPS or localhost), so
    // LAN players on http://<ip> get undefined and bare calls crash. Prefer it when
    // available; otherwise fall back to the guid() above (same guard idiom as
    // concentrationService.js). Use this for ALL client-generated ids.
    safeUuid: () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : utils.guid()),
}

export const DEBUG_FORCE_CRIT = false;

export default utils