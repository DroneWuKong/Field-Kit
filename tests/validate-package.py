from pathlib import Path
import zipfile,hashlib,json,re,argparse,subprocess,struct
parser=argparse.ArgumentParser()
parser.add_argument("--apk", default="output/app/Prismo-Field-Kit-0.3.3-debug.apk")
parser.add_argument("--unsigned", action="store_true")
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
old_path=root/'source/Prismo-Field-Kit-0.3.0-debug.apk'
new_path=root/args.apk
if not args.unsigned:
    signature = subprocess.check_output(['apksigner','verify','--verbose','--print-certs',str(new_path)],text=True)
    assert '2e127ebcae2cfa8e81e529327b98ea2758050120ce692001136413f0437413c9' in signature.lower(), 'Unexpected signing certificate'
asset_root=root/'source/assets'
sig=lambda name:name=='META-INF/MANIFEST.MF' or bool(re.match(r'^META-INF/[^/]+\.(RSA|DSA|EC|SF)$',name))
def manifest_attributes(b):
    strings, attrs = [], {}
    pos = 8
    while pos < len(b):
        kind, header, size = struct.unpack_from('<HHI', b, pos)
        assert size >= header and pos + size <= len(b)
        if kind == 1:
            count, _, flags, start = struct.unpack_from('<IIII', b, pos + 8)
            utf8 = bool(flags & 0x100)
            def length(at):
                if utf8:
                    n=b[at]
                    return (((n & 127)<<8)|b[at+1],at+2) if n&128 else (n,at+1)
                n=struct.unpack_from('<H',b,at)[0]
                return (((n&0x7fff)<<16)|struct.unpack_from('<H',b,at+2)[0],at+4) if n&0x8000 else (n,at+2)
            for i in range(count):
                off=struct.unpack_from('<I',b,pos+header+4*i)[0]
                n,at=length(pos+start+off)
                if utf8:n,at=length(at)
                strings.append(b[at:at+n*(1 if utf8 else 2)].decode('utf-8' if utf8 else 'utf-16-le'))
        elif kind == 0x102 and strings[struct.unpack_from('<I',b,pos+20)[0]] == 'manifest':
            start, stride, count=struct.unpack_from('<HHH',b,pos+24)
            for i in range(count):
                at=pos+16+start+i*stride
                name=strings[struct.unpack_from('<I',b,at+4)[0]]
                data=struct.unpack_from('<I',b,at+16)[0]
                attrs[name]=strings[data] if b[at+15]==3 else data
        pos+=size
    return attrs

with zipfile.ZipFile(old_path) as old,zipfile.ZipFile(new_path) as new:
    manifest=manifest_attributes(new.read('AndroidManifest.xml'))
    assert manifest['versionName']=='0.3.3',manifest
    assert manifest['versionCode']==6,manifest
    assert manifest['package']=='com.dronewukong.fieldtools',manifest
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
    assert 'assets/tools/fieldkit-planning.js' in packaged
    assert 'assets/tools/prismo-contracts.js' in packaged
    assert b'configuration-deploy' in new.read('assets/tools/fieldkit.js')
result={'version':'0.3.3','versionCode':6,'signature_checked':not args.unsigned,'sha256':hashlib.sha256(new_path.read_bytes()).hexdigest(),'native_entries_unchanged':len(checked),'assets_verified':len(expected),'retired_catalog_absent':True,'live_config_gate':False,'physical_hardware_tested':False}
(root/'build-private').mkdir(exist_ok=True)
(root/'build-private/Package-validation-0.3.3.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
