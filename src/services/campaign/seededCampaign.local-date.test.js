// @maintained-by-ai
// localDateStamp — the YYYYMMDD quick-create default must be sourced from the
// LOCAL date, not the UTC ISO slice (2026-11-04 backlog: `Arena-20261105`
// offered at 19:01 EST on 2026-11-04).
import { describe, it, expect } from 'vitest';
import { localDateStamp } from './seededCampaign.js';

function withTz(tz, fn) {
  const realTz = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = realTz;
  }
}

describe('localDateStamp', () => {
  it('uses the local date when UTC is ahead (19:30 EST = 00:30Z next day)', () => {
    withTz('America/New_York', () => {
      expect(localDateStamp(new Date('2026-11-05T00:30:00Z'))).toBe('20261104');
    });
  });

  it('uses the local date when UTC is behind (05:00Z = 14:00 JST next day)', () => {
    withTz('Asia/Tokyo', () => {
      expect(localDateStamp(new Date('2026-11-04T20:00:00Z'))).toBe('20261105');
    });
  });

  it('matches the UTC ISO slice when both calendars agree', () => {
    const date = new Date('2026-11-04T12:00:00Z');
    withTz('America/New_York', () => {
      expect(localDateStamp(date)).toBe('20261104');
    });
  });

  it('zero-pads month and day parts', () => {
    withTz('UTC', () => {
      expect(localDateStamp(new Date('2027-01-05T12:00:00Z'))).toBe('20270105');
    });
  });
});
