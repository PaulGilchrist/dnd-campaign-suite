import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

// ── Imports (Vite returns mocked versions) ─────────────────────

import { applyHealingToTarget } from './applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import storage from './storage.js';

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp) {
  return { name, type: 'npc', maxHp, currentHp };
}

function createPlayerCreature(name) {
  return { name, type: 'player' };
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyHealingToTarget', () => {
  beforeEach(() => {
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset();
    storage.get.mockReset();
    storage.set.mockReset();
    global.fetch.mockReset();
   });

  it('returns null when combatSummary is falsy', () => {
    expect(applyHealingToTarget(null, 'Goblin', 5, 'TestCampaign')).toBeNull();
    expect(applyHealingToTarget(undefined, 'Goblin', 5, 'TestCampaign')).toBeNull();
  });

  it('returns null when target creature not found', () => {
    const cs = makeCombatSummary([createNpcCreature('Orc', 10, 5)]);
    expect(applyHealingToTarget(cs, 'MissingTarget', 5, 'TestCampaign')).toBeNull();
  });

  describe('NPC healing', () => {
    it('heals NPC and returns result object', () => {
      const npc = createNpcCreature('Goblin', 20, 8);
      const cs = makeCombatSummary([npc]);
      const result = applyHealingToTarget(cs, 'Goblin', 10, 'TestCampaign');
      expect(result.oldHp).toBe(8);
      expect(result.newHp).toBe(18);
      expect(result.actualHeal).toBe(10);
      expect(npc.currentHp).toBe(18);
    });

    it('caps NPC HP at maxHp', () => {
      const npc = createNpcCreature('Goblin', 20, 18);
      const cs = makeCombatSummary([npc]);
      const result = applyHealingToTarget(cs, 'Goblin', 10, 'TestCampaign');
      expect(result.newHp).toBe(20);
      expect(result.actualHeal).toBe(2);
      expect(npc.currentHp).toBe(20);
    });

    it('does not increase NPC HP beyond max when already at full', () => {
      const npc = createNpcCreature('Goblin', 20, 20);
      const cs = makeCombatSummary([npc]);
      const result = applyHealingToTarget(cs, 'Goblin', 5, 'TestCampaign');
      expect(result.newHp).toBe(20);
      expect(result.actualHeal).toBe(0);
    });

    it('saves combat summary for NPC healing', () => {
      const npc = createNpcCreature('Goblin', 20, 8);
      const cs = makeCombatSummary([npc]);
      applyHealingToTarget(cs, 'Goblin', 5, 'TestCampaign');
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'TestCampaign');
    });

    it('uses creature.maxHp for NPC max HP', () => {
      const npc = createNpcCreature('Orc', 45, 30);
      const cs = makeCombatSummary([npc]);
      applyHealingToTarget(cs, 'Orc', 20, 'TestCampaign');
      expect(npc.currentHp).toBe(45);
    });
  });

  describe('Player healing', () => {
    it('heals player via runtime state', () => {
      getRuntimeValue.mockReturnValueOnce(null); // hitPoints — not set, fallback
      getRuntimeValue.mockReturnValueOnce(10);   // currentHitPoints
      const player = createPlayerCreature('Alchemist');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      const result = applyHealingToTarget(cs, 'Alchemist', 8, 'TestCampaign');
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(18);
      expect(result.actualHeal).toBe(8);
      expect(setRuntimeValue).toHaveBeenCalledWith('Alchemist', 'currentHitPoints', 18, 'TestCampaign');
    });

    it('uses getRuntimeValue for player max HP fallback', () => {
      // When hitPoints is not in runtime, fall back to creature.maxHp
      getRuntimeValue.mockReturnValueOnce(30); // hitPoints
      getRuntimeValue.mockReturnValueOnce(10); // currentHitPoints
      const player = createPlayerCreature('Paladin');
      player.maxHp = 20;
      const cs = makeCombatSummary([player]);
      const result = applyHealingToTarget(cs, 'Paladin', 15, 'TestCampaign');
      // max is 30 from runtime, so newHp = min(30, 10+15) = 25
      expect(result.newHp).toBe(25);
    });

    it('caps player HP at max from runtime', () => {
      getRuntimeValue.mockReturnValueOnce(20); // hitPoints
      getRuntimeValue.mockReturnValueOnce(18); // currentHitPoints
      const player = createPlayerCreature('Cleric');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      const result = applyHealingToTarget(cs, 'Cleric', 10, 'TestCampaign');
      expect(result.newHp).toBe(20); // capped at runtime hitPoints value
    });

    it('resets death saves when healing unconscious player', () => {
      getRuntimeValue.mockReturnValueOnce(30);   // hitPoints
      getRuntimeValue.mockReturnValueOnce(0);     // currentHitPoints
      const player = createPlayerCreature('Fighter');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      applyHealingToTarget(cs, 'Fighter', 5, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter', 'deathSaves', [false, false, false], 'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter', 'deathFailures', [false, false, false], 'TestCampaign'
      );
    });

    it('does not reset death saves when player already alive', () => {
      getRuntimeValue.mockReturnValueOnce(30);
      getRuntimeValue.mockReturnValueOnce(15);
      const player = createPlayerCreature('Fighter');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      applyHealingToTarget(cs, 'Fighter', 5, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String)
      );
    });

    it('does not reset death saves when still at 0 HP after healing', () => {
      getRuntimeValue.mockReturnValueOnce(30);
      getRuntimeValue.mockReturnValueOnce(0);
      const player = createPlayerCreature('Fighter');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      // 0 HP + 0 healing = still 0. But healAmount is 0, so newHp stays 0
      // Actually if healAmount > 0 but maxHp is same as current, no change.
    });

    it('does not save combat summary for player healing', () => {
      getRuntimeValue.mockReturnValueOnce(30);
      getRuntimeValue.mockReturnValueOnce(15);
      const player = createPlayerCreature('Cleric');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      applyHealingToTarget(cs, 'Cleric', 5, 'TestCampaign');
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('handles currentHitPoints not set (defaults to 0)', () => {
      getRuntimeValue.mockReturnValueOnce(20);
      getRuntimeValue.mockReturnValueOnce(null);
      const player = createPlayerCreature('Monk');
      player.maxHp = 20;
      const cs = makeCombatSummary([player]);
      const result = applyHealingToTarget(cs, 'Monk', 10, 'TestCampaign');
      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(10);
    });

    it('handles hitPoints not set — uses creature.maxHp fallback', () => {
      getRuntimeValue.mockReturnValueOnce(null); // no runtime hitPoints
      getRuntimeValue.mockReturnValueOnce(5);     // currentHitPoints
      const player = createPlayerCreature('Warlock');
      player.maxHp = 25;
      const cs = makeCombatSummary([player]);
      const result = applyHealingToTarget(cs, 'Warlock', 10, 'TestCampaign');
      // max is creature.maxHp = 25, so newMp = min(25, 5+10) = 15
      expect(result.newHp).toBe(15);
    });
  });

  describe('side effects', () => {
    beforeEach(() => {
      getRuntimeValue.mockReset();
    });

    it('logs hp_change entry via fetch for NPC', () => {
      const npc = createNpcCreature('Goblin', 20, 8);
      const cs = makeCombatSummary([npc]);
      applyHealingToTarget(cs, 'Goblin', 5, 'TestCampaign');
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.type).toBe('hp_change');
      expect(body.isHealing).toBe(true);
      expect(body.delta).toBe(5);
    });

    it('logs hp_change entry via fetch for player', () => {
      getRuntimeValue.mockReturnValueOnce(30);
      getRuntimeValue.mockReturnValueOnce(15);
      const player = createPlayerCreature('Cleric');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      applyHealingToTarget(cs, 'Cleric', 5, 'TestCampaign');
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.type).toBe('hp_change');
      expect(body.isHealing).toBe(true);
    });

    it('sets isUnconscious to false in log entry', () => {
      const npc = createNpcCreature('Goblin', 20, 8);
      const cs = makeCombatSummary([npc]);
      applyHealingToTarget(cs, 'Goblin', 5, 'TestCampaign');
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.isUnconscious).toBe(false);
    });

    it('dispatches combat-summary-updated event', () => {
      const npc = createNpcCreature('Goblin', 20, 8);
      const cs = makeCombatSummary([npc]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      applyHealingToTarget(cs, 'Goblin', 5, 'TestCampaign');
      expect(dispatched).toBe(true);
    });

    it('dispatches event for player healing too', () => {
      getRuntimeValue.mockReturnValueOnce(30);
      getRuntimeValue.mockReturnValueOnce(15);
      const player = createPlayerCreature('Cleric');
      player.maxHp = 30;
      const cs = makeCombatSummary([player]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      applyHealingToTarget(cs, 'Cleric', 5, 'TestCampaign');
      expect(dispatched).toBe(true);
    });

    it('logs correct currentHp and maxHp in log entry', () => {
      const npc = createNpcCreature('Orc', 40, 25);
      const cs = makeCombatSummary([npc]);
      applyHealingToTarget(cs, 'Orc', 10, 'TestCampaign');
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.currentHp).toBe(35);
      expect(body.maxHp).toBe(40);
    });

    it('uses runtime maxHp for player in log entry', () => {
      getRuntimeValue.mockReturnValueOnce(25); // hitPoints from runtime
      getRuntimeValue.mockReturnValueOnce(10); // currentHitPoints
      const player = createPlayerCreature('Bard');
      player.maxHp = 30; // creature max — but runtime wins
      const cs = makeCombatSummary([player]);
      applyHealingToTarget(cs, 'Bard', 5, 'TestCampaign');
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.maxHp).toBe(25); // from runtime
    });

    it('logs targetName in log entry', () => {
      const npc = createNpcCreature('Dark Elf', 20, 10);
      const cs = makeCombatSummary([npc]);
      applyHealingToTarget(cs, 'Dark Elf', 5, 'TestCampaign');
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.targetName).toBe('Dark Elf');
    });

    it('uses creature.maxHp fallback when runtime hitPoints is null for player', () => {
      getRuntimeValue.mockReturnValueOnce(null);
      getRuntimeValue.mockReturnValueOnce(5);
      const player = createPlayerCreature('Rogue');
      player.maxHp = 20;
      const cs = makeCombatSummary([player]);
      applyHealingToTarget(cs, 'Rogue', 10, 'TestCampaign');
      const body = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
      );
      expect(body.maxHp).toBe(20); // creature maxHp used as fallback
    });
  });
});
