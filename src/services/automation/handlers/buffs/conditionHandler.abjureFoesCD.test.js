// @maintained-by-ai
// CLA-002 data ground-truth: Abjure Foes (2024 Paladin lv9) in public/data/2024/classes.json
// must keep the automation shape that feeds conditionHandler's Channel Divinity seam.
// The original defect was in the DATA (missing resourceCost:'channel_divinity', which left
// the modal on the WIS default with channelDivinityCharges:null). Handler behaviour for
// resourceCost:'channel_divinity' (CHA DC default, charge passthrough, 0-charge refusal,
// activation log) is covered by synthetic fixtures in conditionHandler.test.js (CLA-238 /
// CLA-303 suites) and is intentionally not repeated here — this file guards only the data
// half that those fixtures cannot catch: a future edit stripping resourceCost, condition,
// duration, or range from the real classes.json entry.
import { describe, it, expect } from 'vitest';
import classes2024 from '../../../../../public/data/2024/classes.json';

function findAbjureFoesFeature() {
  const paladin = classes2024.find(c => c.name === 'Paladin');
  const level9 = (paladin.class_levels || []).find(l => l.level === 9);
  return (level9.features || []).find(f => f.name === 'Abjure Foes');
}

describe('CLA-002 Abjure Foes classes.json ground truth', () => {
  it('feeds the Channel Divinity seam: set_condition frightened, resourceCost channel_divinity, 1_minute, 60 ft', () => {
    const feature = findAbjureFoesFeature();

    expect(feature).toBeTruthy();
    expect(feature.level).toBe(9);
    expect(feature.automation).toMatchObject({
      type: 'set_condition',
      condition: 'frightened',
      resourceCost: 'channel_divinity',
      duration: '1_minute',
      range: '60 ft',
    });
  });
});
