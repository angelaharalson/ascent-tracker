# Ascent Tracker

A Progressive Web App for live-tracking a 17-ascent, 29,029 ft endurance event
(1.4 mi and 1,750 ft per ascent, 36-hour limit, 6:00 AM start).

## Run it locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 in a browser.

## Install on your phone

Service workers (offline support and "Add to Home Screen") only work over HTTPS
or on localhost, so to use it on the mountain the folder has to be hosted
somewhere with HTTPS. Any static host works — GitHub Pages, Netlify Drop, Cloudflare
Pages, Vercel — just upload this folder as-is.

This app is hosted on GitHub Pages at **https://angelaharalson.github.io/ascent-tracker/**
(source: https://github.com/angelaharalson/ascent-tracker). Open that URL on your phone, then:

- **iPhone (Safari):** open the URL, tap Share, then "Add to Home Screen".
- **Android (Chrome):** open the URL, tap the menu, then "Install app" / "Add to Home screen".

Once installed it works offline. All times are stored on the device
(localStorage). Use Settings → Export backup now and then during the event.

## Using it

- **Big red button** records the start or finish of the current ascent with the current time.
- **Undo last tap** removes the most recent recorded time.
- **Enter time manually** / tap any row in the log to type or edit start and end times.
- **Goal Scenario** switches the plan the live data is compared against
  (Red Hat, Main, Stretch). Gray italic values in the log are the plan for ascents
  that have not happened yet.
- **Settings** sets the event start date/time (the goal schedules count from it),
  and offers export/import of a JSON backup and a full reset.
- **Projected finish** uses the average of the previous two ascents for the
  remaining ascents and the average of the previous two breaks for the remaining
  breaks; where there is no data yet it falls back to the selected goal.
- Summit popups fire after the ascent whose cumulative elevation first reaches
  each of the Seven Summits.

## Updating a deployed copy

The service worker caches the app shell for offline use. After changing any
file, bump the `CACHE` name in `sw.js` (e.g. `ascent-tracker-v2`) so installed
copies pick up the new version on their next launch.

## Files

- `index.html`, `styles.css`, `app.js` — the app (no build step, no dependencies)
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA install + offline support
