# bug-mon-MA-0042 — Adult Black Dragon lair action 2 "insect cloud": fully inert row, zero zone consumers

## Verdict
FAIL (as expected per MV-21/MV-24 — lair rows never clickable)

## Data shape (checked first)
- `public/data/monsters.json` adult-black-dragon `lair_actions[1]` (row "Unnamed lair actions 2") = **plain string**, no `name`, no `save_dc`, no `save_type`, no `damage_dice_primary` (structured object at `[0]` only — MV-21 shape inconsistency).
- Text carries all mechanics unstructured: 20-ft-radius sphere zone, lightly obscured, DC 15 Constitution save, 10 (3d6) piercing, half on success, **repeat 3d6 on turn end**, duration "until dismissed/used again/dies". None of it machine-readable.

## Live probe (localhost:5173, header "test-campaign", MV-18 OK)
- Joined Adult Black Dragon via Encounters → checkbox → Join Encounter; initiative card 195/195, init 9.
- Opened `.mc-overlay` from initiative card; lair row = `DIV.mc-action` index 11 (insect-cloud text).
- Affordance enumeration (MV-23): `mc-dice-link`=0, `button/input/select/[role=button]`=0, pointer-cursor descendants=0, row cursor=auto → **no affordance**; DC 15 / 3d6 text not clickable (MonsterLairAction ignores nothing here — plain-string branch is `dangerouslySetInnerHTML` text only, MonsterCardBody.jsx:306-318).
- Forced pointerdown/mousedown/mouseup/click/dblclick: save prompts=0, no CON save adjudication, no full/half damage roll, HP unchanged (dragon 195/195). Zero-delta — no arm needed, no path exists (MV-24).
- Change-data delta: only `combat-ui-viewingMonster*` echo keys from opening the card. Log: 2→2, zero lair/insect/cloud/save/damage entries.

## Consumers
- `lair_actions` referenced app-wide only in `MonsterCardBody.jsx` (text render) and `npcStatBlockUtils.js:80` (nulled). No automation keyed on lair actions.
- Zone-like consumers exist only for spells (`stinkingCloudHandler.js`, `webAreaSaveHandler.js`, `silenceService.js`) — unreachable from lair rows; zero insect-cloud/zone/duration/turn-end-repeat consumers for this row. `targetEffectDefinitions.js` has no lair/insect-cloud key.

## Cleanup
- Admin `clear-change-data` + `clear-log` POSTs with Host: localhost; browser closed. No manifest/playbook edits.
