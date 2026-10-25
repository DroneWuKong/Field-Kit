"""Verify the rebuilt preview independently of the historical asset repackager."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("apk", type=Path)
parser.add_argument("--build-tools", type=Path, required=True)
parser.add_argument("--certificate", required=True, help="Expected signer SHA-256")
args = parser.parse_args()
certificate = args.certificate.lower().replace(":", "")
if not re.fullmatch(r"[a-f0-9]{64}", certificate):
    raise SystemExit("Expected a SHA-256 certificate fingerprint")

def tool(name, *arguments):
    return subprocess.check_output(
        [str(args.build_tools / name), *map(str, arguments)], text=True
    )

signature = tool("apksigner", "verify", "--verbose", "--print-certs", args.apk)
signers = re.findall(r"Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)", signature)
assert signers == [certificate], f"Unexpected signing certificate(s): {signers}"
assert "Verified using v2 scheme (APK Signature Scheme v2): true" in signature
tool("zipalign", "-c", "-p", "4", args.apk)
badging = tool("aapt", "dump", "badging", args.apk)
assert "package: name='com.dronewukong.fieldtools.preview' versionCode='6' versionName='0.3.3-preview.1'" in badging
assert "sdkVersion:'26'" in badging
assert "targetSdkVersion:'35'" in badging
assert "application-label:'Field Kit Preview'" in badging
assert "launchable-activity: name='com.dronewukong.fieldtools.FieldToolsActivity'" in badging
assert "application-debuggable" not in badging

asset_root = ROOT / "source/assets"
expected = {
    "assets/" + path.relative_to(asset_root).as_posix(): path
    for path in asset_root.rglob("*") if path.is_file()
}
with zipfile.ZipFile(args.apk) as apk:
    assert apk.testzip() is None, "Corrupt ZIP entry"
    names = apk.namelist()
    assert len(names) == len(set(names)), "Duplicate ZIP entries"
    assets = {name for name in names if name.startswith("assets/") and not name.endswith("/")}
    assert assets == expected.keys(), f"Asset set mismatch: {assets ^ expected.keys()}"
    for name, path in expected.items():
        assert apk.read(name) == path.read_bytes(), f"Asset differs: {name}"
    assert b"LIVE_CONFIG_WRITE_GATE=false" in apk.read("assets/tools/fieldkit-deployment.js")
    assert "assets/tools/forge_database.json" not in assets
    assert any(re.fullmatch(r"classes\d*\.dex", name) for name in names)

print(json.dumps({
    "apk": args.apk.name,
    "sha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
    "bytes": args.apk.stat().st_size,
    "package": "com.dronewukong.fieldtools.preview",
    "version": "0.3.3-preview.1",
    "versionCode": 6,
    "certificate_sha256": certificate,
    "signature_verified": True,
    "alignment_verified": True,
    "debuggable": False,
    "assets_verified": len(expected),
    "physical_configuration_writes": False,
    "device_installation_tested": False,
}, indent=2))
