# BUG MA-0765 — Gazer "Eye Rays" launcher row: rays[] ABSENT → zero affordance, random-two-ray adjudication impossible (FAIL(b)/DATA, §88/§154 class)

**Row:** MA-0765 · gazer · actions[1] · "Eye Rays" · category actions · type other
**Date:** 2026-09-21 · test-campaign ONLY (header verified every step, location.href self-checked)

## Disk truth (decisive)
`public/data/monsters.json` gazer `actions[1]` FULL block:

```json
{"name": "Eye Rays", "description": "The gazer shoots two of the following magical eye rays at random (reroll duplicates), choosing one or two targets it can see within 60 feet of it:"}
```

- Keys: `name`, `description` ONLY. **rays[] ABSENT.** No save_dc, no save_type, no dice, no automation, no range field.
- Description truncated at the colon — the canonical 4-ray table is not even carried in prose on this row.
- The four rays live on sibling ACTION rows actions[2..5]: `1. Dazing Ray` (save_dc 12 Wisdom, charmed+speed-half+disadv), `2. Fear Ray` (12 Wisdom, frightened), `3. Frost Ray` (save_dc 12, damage_dice_primary 3d6 Cold), `4. Telekinetic Ray` (save_dc 12) — each renders its own manual chip, but NONE of them is the random launcher.

## Code fingerprints (grep, disk)
- `MonsterCardHelpers.js` `parseEyeRays` :2037-2047 — `const rays = action?.rays; if (!Array.isArray(rays) || rays.length < 2) return null;` → gazer row returns null.
- `MonsterCardModal.jsx` :1889 fire gate — `if (Array.isArray(stageAction.rays) && stageAction.rays.length > 0) resolveEyeRayFire(...)`; with no rays[] the branch never opens; even if reached, `resolveEyeRayFire` :419-420 `parseEyeRays(action); if (!rays) return;` = silent no-op.
- `MonsterAction.jsx` chip arms: save chip :91 `if (action.save_dc == null) return null;`; damage links :44 return null without dice/attack_bonus; **grep `rays|Eye` in MonsterAction.jsx + MonsterCardBody.jsx = ZERO.** Nothing arms a chip on a name+description-only other-row.

## Live proof (Playwright, dev :5173)
- EB joins exact td-text: `Gazer` → cs "Gazer 1" AC13; `Bandit` → "Bandit 1" AC12; `Knight` → "Knight 1" AC18 (late-join idx0 re-dump §237). Victims maxHp/currentHp 999 via full-store cs POST (re-read 999/999).
- Armed on attacker OWN card: `img.avatar-image[alt="Gazer 1"]` → closest `.creature-card` → `[data-testid="target-select"]` = Bandit 1.
- Card opened via avatar; Eye Rays row located via `strong.startsWith("Eye Rays")`; row-scoped `.mc-dice-link,[role=button]` query = **[]** (zero affordance).
- ×2 fresh-boundingClientRect clicks on the row text (738,488): popups 0, `.mc-overlay` stays open, **log delta ZERO** (tail still 6 join-noise entries), victim hp untouched 999/999, console 0 errors.
- Whole-card chip census shows what DOES arm: Bite "+5" (MA-0764 PASS), "DC 12 Wisdom" ×2, "DC 12 Dexterity", "DC 12 Strength", "3d6" — all owned by sibling rows [0],[2],[3],[4],[5]; none rides the launcher row [1].

## RAW gap
"Shoots TWO rays at random (reroll duplicates), choosing one or two targets within 60 ft" is unadjudicable: no len(rays)-inferred d4 (§88), no `eyeRaysUsed` per-round reroll-if-used latch, no two-target selection, no 60-ft range token (row authors none; gridless-lenient moot with zero chip). Manual per-ray sibling chips are single-fire, manual-choice, unlimited — not the launcher.

## Fix (DATA, §88/§225 MA-0673 precedent)
Author on actions[1]: `rays:[...]` four single-leg dicts (key/name/save ability/`save_dc:12`/`damage_dice` where relevant — Frost 3d6 cold/`conditions` e.g. charmed/frightened + speed_half+disadv rider note) byte-shape of beholder-zombie rays:4 (d4 len-inferred), row-level `save_dc:12` (picker stamps row DC onto chosen ray, :441 `pickerDc = action.save_dc`), `range:"60 ft."` token. Drop misleading fields (none to drop — row is empty). Generic picker chrome `mc-eye-ray-chooser` + `eyeRaysUsed` latch + two-target legs then engage app-wide unchanged.

## Accepted residuals note
Two-target selection + 60-ft band honors existing §62/§42 leniency; charmed-rider speed-half/disadv te twins exist (§68 speed_half; disadvantage channel §69) — adjudication depth is the ticket author's scope, this bug file pins the affordance gap only.
