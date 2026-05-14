# Read Frog Thunderbird Build

This fork adds a Thunderbird 150+ MailExtension target for mail reading translation. The first version intentionally supports opened message translation, restore, selected-text translate/explain, and the existing provider configuration surface. It does not migrate webpage auto-translation, YouTube subtitles, side panel, offscreen/TTS playback, or compose-window assistance.

## Build

```sh
pnpm install
pnpm type-check
pnpm test
pnpm build:thunderbird
pnpm zip:thunderbird
```

The XPI is written to `.output/read-frog-thunderbird-<version>.xpi`.

## Manifest Checks

`pnpm build:thunderbird` runs `scripts/finalize-thunderbird-build.mjs` and `scripts/validate-thunderbird-build.mjs`. The finalize step rewrites WXT's generated `background.service_worker` into Thunderbird-compatible `background.scripts` with `type: "module"`. The validation fails if the Thunderbird build includes browser-only manifest surfaces such as `content_scripts`, `action`, `side_panel`, `offscreen`, `background.service_worker`, broad host permissions, or browser-only permissions.

## Privacy Defaults

Mail content is only sent after the user explicitly approves mail content sharing in the Thunderbird popup and triggers translation. HTTPS providers and local HTTP providers (`localhost`, `127.0.0.1`, `[::1]`) are allowed for mail content; arbitrary HTTP provider URLs are rejected.
