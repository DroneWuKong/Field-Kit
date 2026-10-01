from pathlib import Path
import zipfile,hashlib,json,re
root=Path(__file__).resolve().parents[1]
old_path=root/'source/Prismo-Field-Kit-0.3.0-debug.apk'
new_path=root/'output/app/Prismo-Field-Kit-0.3.2-debug.apk'
asset_root=root/'source/assets'
sig=lambda name:name=='META-INF/MANIFEST.MF' or bool(re.match(r'^META-INF/[^/]+\.(RSA|DSA|EC|SF)$',name))
with zipfile.ZipFile(old_path) as old,zipfile.ZipFile(new_path) as new:
    checked=[]
    for name in old.namelist():
        if name.startswith('assets/') or name=='AndroidManifest.xml' or sig(name):continue
        assert old.read(name)==new.read(name),name
        checked.append(name)
    packaged={n for n in new.namelist() if n.startswith('assets/')}
    expected={'assets/'+p.relative_to(asset_root).as_posix() for p in asset_root.rglob('*') if p.is_file()}
    assert packaged==expected,packaged^expected
    for name in expected:assert new.read(name)==(asset_root/name.removeprefix('assets/')).read_bytes(),name
    assert 'assets/tools/forge_database.json' not in packaged
    assert len([n for n in checked if re.match('classes.*dex$',n)])>0
    assert b'LIVE_CONFIG_WRITE_GATE=false' in new.read('assets/tools/fieldkit-deployment.js')
    assert b'configuration-deploy' in new.read('assets/tools/fieldkit.js')
result={'version':'0.3.2','versionCode':5,'sha256':hashlib.sha256(new_path.read_bytes()).hexdigest(),'native_entries_unchanged':len(checked),'assets_verified':len(expected),'retired_catalog_absent':True,'live_config_gate':False,'model_tests_passed':35,'physical_hardware_tested':False}
(root/'output/configuration/Package-validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
