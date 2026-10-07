# WM-003 Nick (Weapon Mastery) — FAIL (live-fire 2026-10-07)

Canonical: `public/data/2024/weapon-mastery.json` — "When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn."
Nick weapons (equipment.json): Scimitar, Dagger, Light hammer. Host: EvasiveFighter lv18 2024 Battle Master (Fighter lv9 Tactical Master passive = the live offer seam, classes.json[4] class_levels[8]).

## PASSES (live, test-campaign, EB Bandit 1 AC12 HP11)
- Kind bucket armed `_Weapon_Kind_Mastery_chosenWeapons=['Scimitar','Shortsword','Dagger']`.
- Scimitar hit → TacticalMasterModal renders, Nick default-checked, canonical Nick text verbatim in modal.
- Apply Nick → `_Nick_UsedRound=1` + log `ability_use | EvasiveFighter used Nick on Bandit 1 — Light weapon extra attack is now part of the Attack action.`
- Once-per-turn latch: 2nd same-turn Nick confirm → zero Nick log, latch stays 1. (Round-wrap re-arm consumer exists: Initiative.jsx:63, navigationHandlers.js:35.)
- Main-hand numerics: att1 d20(14)+8=22 HIT AC12, dmg 1d6+2=3+2=5? popup showed 5+2=7 (Bandit 11→4); att2 d20(15)+8=23 HIT, dmg 3+2=5 (→0).

## FAILS
1. **In-Attack-action extra attack never produced.** With Dagger (Nick/Light) equipped + latched, live playerStats.attacks computes Dagger row type **'Bonus Action'** (React-fiber probe) although a direct `getAttacks2024` in-page call with the same stats returns 'Action' (attackCalc2024.js:141-146 works standalone). Live compute evidently runs pre-kind-arm/pre-latch and never re-computes on equip/latch (server-first mirror staleness family).
2. **CharBonusActions.jsx:854-860 over-hides**: when `_Nick_UsedRound===round`, EVERY Light bonus row is hidden regardless of whether that off-hand weapon has Nick — non-Nick Shortsword (Vex) control row also vanished. Net UI: post-Nick, Light extra attack exists in NO grid (neither Action nor Bonus) → extra attack never clicked, **zero second damage roll numeric** all session.
3. Cosmetic: refusal of 2nd Nick returns popup payload that TacticalMasterModal never surfaces; modal instead shows "Mastery applied successfully." (mislabel).

## RECIPE (proven)
EB join Bandit → hard reload → init-card `[data-testid=target-select]` per-card (Bandit card's select has different option list; PC selects index-shifted) → Special Actions "Weapon Mastery:" row tick+Select (arm kinds; popup "Weapon kinds set to…") → sheet `.attacks .left.clickable` Scimitar → popup Done → flush Charge rider (Cancel) + Shield-Bash ghost (Roll Save→Done→Skip) → Tactical Master modal → Nick Apply. Inventory edits need trusted keystrokes; native-setter+input does NOT persist wizard save (contradicts FS-009 note). Shield-equipped suppresses playability of the off-hand lane.

## STATE
Disk equipped RESTORED baseline ['Scimitar','Shortbow','Shortsword','Chain Mail','Shield']; change-data {} / log [] admin-cleared GET-verified. Kind bucket wiped with wipe (re-arm on retest). Retest here post-fix: fix (1) recomputed attacks on latch/equip change; fix (2) gate BA filter on off-hand Nick availability.
