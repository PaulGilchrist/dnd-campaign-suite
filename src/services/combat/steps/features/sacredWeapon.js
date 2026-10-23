import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export const sacredWeapon = {
  name: 'sacredWeapon',
  condition: (ctx) => {
    const weaponOk = ctx.attack?.weaponType === 'melee' || ctx.attack?.weaponType === 'unarmed';
    return weaponOk && !!ctx.playerStats?.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    // #1056 guard-first (fix#124): the condition (:7) is the sole pipeline gate and
    // never admits null stats; a null playerStats reaching the handler is a caller
    // defect. Loud-decline with the family skip byte (see :18; mirrors grappler.js:77)
    // instead of TypeError-aborting the attack chain via actionPipeline.js:35.
    if (!ctx.playerStats) {
      console.error('[sacredWeapon] handler invoked without playerStats — declining');
      return null;
    }
    const sw = (ctx.playerStats.automation?.passives || []).find(p => p.name === 'Sacred Weapon' && p.effect === 'sacred_weapon');
    if (!sw) return null;

    const buffs = getRuntimeValue(ctx.playerStats.name, 'activeBuffs', ctx.campaignName) || [];
    const b = buffs.find(x => x.name === 'Sacred Weapon' && x.effect === 'sacred_weapon');
    if (b?.damageTypeChoice) ctx.attack.damageType = b.damageTypeChoice;
    return { data: prevData };
  },
};
