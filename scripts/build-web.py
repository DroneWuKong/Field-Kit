"""Build the browser-only Field Kit workspace at /FieldKit from the existing app assets."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root/'build-private/web')
parser.add_argument('--apk', type=Path, help='Verified signed 0.5.1 APK to host on the site')
args = parser.parse_args()
out = args.output.resolve()
app = out/'FieldKit'
app.mkdir(parents=True, exist_ok=True)
apk_url = 'https://github.com/DroneWuKong/Field-Kit/releases/download/android-v0.5.1/Prismo-Field-Kit-0.5.1.apk'
if args.apk:
    downloads = out/'downloads'
    downloads.mkdir(parents=True, exist_ok=True)
    apk_name = 'Prismo-Field-Kit-0.5.1.apk'
    shutil.copyfile(args.apk, downloads/apk_name)
    (downloads/'SHA256SUMS').write_text(hashlib.sha256(args.apk.read_bytes()).hexdigest()+'  '+apk_name+'\n')
    apk_url = '/downloads/'+apk_name
shutil.copytree(root/'source/assets/tools', app, dirs_exist_ok=True)
# The HTML marker selects standalone mode without putting an implementation query
# parameter in the public application URL. This transform affects the hosted copy only.
pattern = re.compile(r"new URLSearchParams\(location.search\)\.get\('mode'\)\s*(!==|===)\s*'standalone'")
changed = []
for path in app.glob('*.js'):
    source = path.read_text()
    def mode(match):
        expression = "(document.documentElement.dataset.fieldkitMode === 'standalone' || new URLSearchParams(location.search).get('mode') === 'standalone')"
        return ('!' if match[1] == '!==' else '') + expression
    value, count = pattern.subn(mode, source)
    if count:
        changed.append(path.name)
        path.write_text(value)
expected = {'fieldkit-planning.js','fieldkit-deployment-ui.js','fieldkit-design.js','tools-ui.js','fieldkit-workbench.js','fieldkit.js'}
if set(changed) != expected:
    raise SystemExit('Standalone bootstrap changed; review the hosted adapter before publishing.')
html = (app/'tools_offline.html').read_text()
html = html.replace('<html', '<html data-fieldkit-mode="standalone"', 1)
html = html.replace('<head>', '<head>\n<base href="/FieldKit/">', 1)
html = html.replace('</head>', '<style>.kit-horizon-link{display:inline-block;padding:13px 17px;background:#a9dfc4;border-radius:10px;color:#132e27;font-weight:650;text-decoration:none;margin:8px 0}</style><script src="web-host.js" defer></script>\n</head>')
(app/'index.html').write_text(html)
(app/'web-host.js').write_text('''
'use strict';
window.addEventListener('fieldkit-ready', () => {
  const plan = document.querySelector('#kit-plan');
  const android = document.createElement('a'); android.className = 'kit-horizon-link';
  android.textContent = 'Download Android planner · 0.5.1';
  android.href = '__ANDROID_APK_URL__';
  const androidNote = document.createElement('p'); androidNote.className = 'result-note';
  androidNote.textContent = 'Map, saved routes, offline areas and reusable radio setups. Android 8.0+. Installs beside the original Field Kit; keep your old app and export records to transfer them.';
  plan.prepend(android, androidNote);
  const card = plan.querySelectorAll('.kit-plan-card')[1];
  card.replaceChildren();
  const title = document.createElement('h3'); title.textContent = '2. Plan with Horizon on your computer';
  const text = document.createElement('p'); text.textContent = 'Download the Windows planner for detailed terrain, radio-horizon and mission analysis. Your equipment files work in both apps.';
  const link = document.createElement('a'); link.className = 'kit-horizon-link'; link.textContent = 'Download for Windows · 80 MB';
  link.href = 'https://github.com/DroneWuKong/Field-Kit/releases/download/horizon-v0.2.0-windows/Prismo-Field-Kit-Horizon-0.2.0-windows-x64.zip';
  const help = document.createElement('p'); help.className = 'result-note'; help.textContent = 'Extract the full ZIP and open PrismoFieldKit.exe. Keep its window open while planning. This Windows preview is unsigned.';
  const web = document.createElement('p'); web.className = 'result-note'; web.textContent = 'Quick radio tools, equipment, practice checks and imported records work here in your browser. Detailed Horizon terrain analysis runs in the desktop app.';
  card.append(title,text,link,help,web);
  const note = document.querySelector('#kit-storage-status');
  note.textContent = 'Equipment and records stay in this browser. Export files to move them to another device.';
  for (const button of document.querySelectorAll('#kit-connection-choices [data-adapter]')) {
    if (button.dataset.adapter !== 'simulation') button.hidden = true;
  }
});
'''.replace('__ANDROID_APK_URL__', apk_url))
# Plain entry point for the apps hostname, with room for future applications.
(out/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prismo Apps</title><style>body{margin:0;background:#101f2b;color:#e3edf0;font:18px system-ui;display:grid;place-content:center;min-height:100vh;padding:24px;box-sizing:border-box}main{max-width:620px}small{color:#66d1bd;letter-spacing:.15em}h1{font-size:48px;margin-bottom:12px}p{line-height:1.6;color:#bdcdd5}a{display:inline-block;padding:15px 24px;border-radius:12px;background:#b5e3cb;color:#122a23;text-decoration:none;font-weight:650;margin-top:16px}</style><main><small>PRISMO APPS</small><h1>Your field workspace.</h1><p>Equipment, radio planning, setup and records—together in Field Kit.</p><a href="/FieldKit/">Open Field Kit →</a></main></html>''')
(out/'_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n')
landing = (out/'index.html').read_text()
landing = landing.replace('<a href="/FieldKit/">Open Field Kit →</a>',
    '<a href="'+apk_url+'" download>Download Android APK · 0.5.1</a>'
    '<p style="font-size:15px">Map planning, saved routes, reusable radio setups and offline maps. Android 8.0 or later.</p>'
    '<p style="font-size:15px">Installs as Field Kit Planner beside the original app, or updates the earlier separate preview. Keep the old app and export any records you want to transfer.</p>'
    '<p style="font-size:14px">Reconstructed planner · development-signed · phone installation not yet tested.</p>'
    '<a href="/FieldKit/" style="background:transparent;border:1px solid #66d1bd;color:#b5e3cb">Open browser tools →</a>')
(out/'index.html').write_text(landing)
commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
(out/'web-build.json').write_text(json.dumps({'source_repository':'DroneWuKong/Field-Kit','source_commit':commit,'entry':'/FieldKit/','terrain_engine':'desktop-only','records':'browser-local'},indent=2)+'\n')
print(f'Built browser Field Kit in {out}')
