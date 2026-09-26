# MA-1290 — Performer Legend "Warding Charm" (reaction) — FAIL(b) / DATA

- **Monster**: Performer Legend (`public/data/monsters.json`, index `performer-legend`, AC 20 HP 162)
- **Category**: reactions[0] — Warding Charm
- **Trigger (authored)**: "A creature hits the performer with an attack roll"
- **Verdict**: FAIL(b) — DATA — unimplemented defender-reaction + missing numeric `save_dc` (§60/§114 fingerprint family: MA-1285/MA-1236/MA-1238)
- **Date**: 2026-09-26, live test-campaign (header + admin panel + dialog all verified `test-campaign`)

## Disk fingerprint (re-verified live this session)

Performer Legend `reactions[0]` keys = `name` / `trigger` / `description` / `save_type` / `save_effect` ONLY:

```json
{ "name": "Warding Charm",
  "trigger": "A creature hits the performer with an attack roll",
  "description": "Wisdom Saving Throw: DC 17, the triggering creature. Failure: The attack roll misses the performer, and the target has the <strong>Charmed</strong> condition until the end of the performer's next turn.",
  "save_type": "Wisdom",
  "save_effect": "Failure: The attack roll misses the performer, and the target has the Charmed condition until the end of the performer's next turn." }
```

- **NO `save_dc` field** — DC 17 exists ONLY in prose (§54 prose-DC fingerprint: prompt would print "DC Unknown"; prose fallback exists only for "+N to hit" attack bonuses).
- No `automation`, no `advisory`, no `usage` → §60: gated reactions key ONLY off `automation.effect` → row inert.

## Static evidence (own greps, line-cited)

- Gated-reaction registry `src/components/encounter/MonsterCardHelpers.js:981-1140` — 13 keys: feather_fall :982, counterspell :988, hellish_rebuke :996, parry :1007, shield :1026, jinx_negate :1039, split :1053, heal :1062, attack :1076, portent :1086, limited_foresight :1103, elemental_absorption :1123, redirect_attack :1140 — **NO `warding_charm` entry**.
- Arm condition `getGatedMonsterReaction` (MonsterCardHelpers.js:1714-1717): effect from `automation.effect` only → undefined ⇒ null. Renderer `GatedReactionSlot` (MonsterAction.jsx:165-168): `if (!def) return null` ⇒ zero chip.
- `rg "warding_charm|Warding Charm" src/ server/`: **zero app hits** (only `public/data/monsters.json:47024` — the data row itself). §190 (MA-0648): every chip lane keys off attack_bonus/dice/save_dc/Spellcasting-markup/automation.effect/legendaryGate/zone/advisory — the row matches none.

## Live census (test-campaign, localhost:5173, Playwright)

1. EB search "Performer" → native `cb.click()` exact-td **Performer Legend** (checked=true); search "Bandit" → exact-td native cb.click **Bandit** (checked=true) → explicit "Join Encounter" → board avatars exactly `["Performer Legend 1","Bandit 1"]`.
2. `img.avatar-image[alt="Performer Legend 1"].click()` → `.mc-overlay` "Performer Legend 1 — Medium Humanoid, Neutral".
3. **Warding Charm row DOM**: `<div class="mc-action "><strong>Warding Charm.</strong> <span>Wisdom Saving Throw: DC 17, …</span></div>` — diceLinks **0**, roleButtons **0**, buttons **0**, anchors **0**, inputs **0**. **Zero-DC-chip confirmed**: `DC 17` present as prose text only, `dcChip:false` — no affordance carries the DC (save_dc absent on disk). The overlay's only "DC 17 Wisdom" chip belongs to **Majestic Song** (MA-1288, verified PASS-subset) — not to this row.
4. **Center-click probe** (real pointer, fresh rect center 1015,750, ×2): popups **0**, log delta **0** (held at 3 = encounter + 2× initiative join noise), `warding`/`charm` log entries **0**, card stays open, console **0 errors**.

## Fix options

### Option A — interim advisory (zero-code, MA-1251 precedent, §1251 generic passthrough)
Add `advisory: "monster_warding_charm"` to the row. Advisory seam is generic passthrough (`isMonsterActionAdvisoryRow = !!row.advisory`, value never inspected — MonsterAction.jsx AdvisoryLink :335-343, resolver MonsterCardModal.jsx:2385): record-only popup + ability_use log, GM enforces "roll WIS save vs DC 17 yourself; on fail the attack misses and the attacker is Charmed".

### Option B — full fix (registry effect + miss-negation + charmed grant w/ DC stamp)
1. **DATA**: `save_dc: 17` + `automation:{type:"reaction", trigger:"attacked_by_hit", effect:"warding_charm", saveType:"WIS", saveDc:17, usage:"At Will", uses:999, maxUses:999}` (§60 sentinel, camelCase MA-0643/0681 byte-shape).
2. **CODE**: registry entry in `GATED_MONSTER_REACTIONS` (MonsterCardHelpers dict :981+) + gate/resolver arming a one-shot pending state stamping the miss onto the triggering attack (`lastAttack.wardingCharmResolved`, miss-negation te) + `saveDc:17` stamped so the `.sp-modal` WIS prompt rides the GM prompt seam (§239 hellish_rebuke timing: press AFTER damage/verdict stage; §233 press via DOM `link.click()` — popup overlays intercept pointer clicks) + te `charmed` grant on fail with expiry at performer's next-turn-end (§38 anchor-clock caveat) + round-latch refusal. Parry (:1007/:1308) / shield (:1026/:1416) / redirect_attack (:1140) are the defender-reaction precedents; register any new te in `targetEffectDefinitions.js` (§5).
- Note: "the attack roll misses the performer" is a **hit-negation leg** — no existing gated effect negates a committed hit (jinx_negate :1039 is miss-bait, shield is AC-bump); needs new consumer semantics.

## Cleanup evidence trail

Card closed × (overlays 0) → Admin (`Admin — test-campaign`) → Clear Campaign Log + Clear Change Data, confirms accepted (dialog text named test-campaign) → post-verify: `log.length = 0`, `change-data keys = 0`, overlays 0, console 0 errors. No encounter saved (direct join; consistent with MA-1285 sibling cleanup).
