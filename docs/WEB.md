# Browser Field Kit

The browser workspace is built for `/FieldKit/`, with an apps landing page at `/`.
It includes radio tools, equipment profiles, practice checks and imported records.
Data stays in the current browser; export files to move it between devices.
Detailed Horizon terrain analysis runs in the desktop app. The Plan screen links
to the published Windows preview. Physical configuration writes remain disabled.

Build and check locally from the repository root:

```sh
python3 scripts/build-web.py
python3 -m http.server 18767 --bind 127.0.0.1 --directory build-private/web
# In another terminal:
node tests/web-ui.cjs
```

The build copies existing app assets and applies the browser bootstrap only to
the generated files. Native Android and desktop assets are unchanged. The build
fails if the expected standalone checks change and need review. `web-build.json`
records the source commit; publish from a committed, clean checkout.

Hosting uses the Prismo Apps Sites project
`appgprj_6adb7d1795c481919baf4cd5885e5560`, with generated files in its `dist/`
directory. The requested custom address is `https://app.prismoprime.com/FieldKit`.
Domain activation depends on the DNS records returned by Sites being added to
the Squarespace DNS zone. Do not change the existing `dev.prismoprime.com` site.

Use the Sites workflow to synchronize and package the generated output, then
publish the exact source commit and archive. Preserve the site's access policy.
The hosted browser app does not include a terrain backend or shared account data.
