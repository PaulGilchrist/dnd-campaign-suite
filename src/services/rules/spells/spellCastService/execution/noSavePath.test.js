// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn().mockReturnValue(false),
}));

vi.mock('./helpers.js', () => ({
  isMagicMissile: vi.fn().mockReturnValue(false),
  executeMagicMissile: vi.fn(),
}));

import { rollExpression } from '../../../../dice/diceRoller.js';
import { isInnateSorceryActive } from '../../../../combat/buffs/buffService.js';
import { isMagicMissile, executeMagicMissile } from './helpers.js';
import { handleNoSavePath } from './noSavePath.js';

function makeSpell(overrides = {}) {
  return {
    name: 'Acid Arrow',
    level: 1,
    school: 'evocation',
    attack_type: 'ranged',
    damage: { damage_type: 'Acid', damage_at_slot_level: { 1: '1d12' } },
    ...overrides,
  };
}

function makeDeps() {
  return {
    getTargetInfo: vi.fn().mockResolvedValue({ name: 'Orc' }),
    rollAttack: vi.fn(),
    spellToHit: 5,
  };
}

describe('handleNoSavePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMagicMissile).mockReturnValue(false);
    vi.mocked(isInnateSorceryActive).mockReturnValue(false);
    vi.mocked(rollExpression).mockReturnValue({ total: 8, rolls: [7, 1], modifier: 1 });
  });

  it('rolls the attack with the provided damageType in context', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    await handleNoSavePath({ spell: makeSpell(), metaCtx: { finalFormula: '1d12' }, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Acid' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({
      attackName: 'Acid Arrow',
      targetName: 'Orc',
      attackerName: 'Mage',
      damageType: 'Acid',
      autoDamageFormula: '1d12',
      autoDamageName: 'Acid Arrow',
      autoDamageSchool: 'evocation',
      isCantrip: false,
    }));
  });

  it('falls back to the spell data damage_type when the damageType parameter is empty', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    await handleNoSavePath({ spell: makeSpell(), metaCtx: {}, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: '' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({
      damageType: 'Acid',
    }));
  });

  it('applies the finalFormula from metaCtx and overchannel info to autoDamageFormula', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    const metaCtx = { finalFormula: '1d12 + 2', overchannelActive: true, overchannelUseCount: 1, slotLevel: 3 };
    await handleNoSavePath({ spell: makeSpell(), metaCtx: metaCtx, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Acid' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({
      autoDamageFormula: '1d12 + 2',
      overchannelActive: true,
      overchannelUseCount: 1,
      overchannelSpellLevel: 3,
    }));
  });

  it('marks the attack as a cantrip for level 0 spells', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    await handleNoSavePath({ spell: makeSpell({ level: 0, baseLevel: 0 }), metaCtx: {}, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Acid' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({ isCantrip: true }));
  });

  it('grants advantage when innate sorcery is active and not in forced mode', async () => {
    vi.mocked(isInnateSorceryActive).mockReturnValue(true);
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    await handleNoSavePath({ spell: makeSpell(), metaCtx: {}, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Acid' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({ forcedMode: 'advantage' }));
  });

  it('does not override an existing forcedMode from metaCtx', async () => {
    vi.mocked(isInnateSorceryActive).mockReturnValue(true);
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    await handleNoSavePath({ spell: makeSpell(), metaCtx: { forcedMode: 'disadvantage' }, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Acid' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({ forcedMode: 'disadvantage' }));
  });

  it('returns null without rolling when there is no attack_type and no damage', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    const result = await handleNoSavePath({ spell: makeSpell({ attack_type: undefined, damage: undefined }), metaCtx: {}, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Acid' });
    expect(result).toBeUndefined();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(getTargetInfo).not.toHaveBeenCalled();
  });

  it('delegates to executeMagicMissile for Magic Missile', async () => {
    vi.mocked(isMagicMissile).mockReturnValue(true);
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    await handleNoSavePath({ spell: makeSpell({ name: 'Magic Missile' }), metaCtx: {}, playerStats: { name: 'Mage' }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: 'Force' });
    expect(executeMagicMissile).toHaveBeenCalled();
    expect(rollAttack).not.toHaveBeenCalled();
  });

  it('resolves autoDamageFormula from damage_at_character_level when spell.damage.formula is absent (CLAUDE-122)', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    const fireBolt = makeSpell({
      name: 'Fire Bolt',
      level: 0,
      baseLevel: 0,
      damage: { damage_type: 'Fire', damage_at_character_level: { 1: '1d10', 5: '2d10' } },
    });
    await handleNoSavePath({ spell: fireBolt, metaCtx: {}, playerStats: { name: 'Mage', level: 6 }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: '' });
    expect(rollAttack).toHaveBeenCalledWith('Fire Bolt', 5, expect.objectContaining({
      autoDamageFormula: '2d10',
      damageType: 'Fire',
      isCantrip: true,
    }));
  });

  it('resolves autoDamageFormula from damage_at_slot_level when damage_at_character_level is absent', async () => {
    const { getTargetInfo, rollAttack, spellToHit } = makeDeps();
    const acidArrow = makeSpell({
      name: 'Acid Arrow',
      level: 1,
      damage: { damage_type: 'Acid', damage_at_slot_level: { 1: '1d12' } },
    });
    await handleNoSavePath({ spell: acidArrow, metaCtx: {}, playerStats: { name: 'Mage', level: 1 }, campaignName: 'campaign', mapName: null, characters: null, getTargetInfo: getTargetInfo, rollAttack: rollAttack, spellToHit: spellToHit, damageType: '' });
    expect(rollAttack).toHaveBeenCalledWith('Acid Arrow', 5, expect.objectContaining({
      autoDamageFormula: '1d12',
    }));
  });
});
