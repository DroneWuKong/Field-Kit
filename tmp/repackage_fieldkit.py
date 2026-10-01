"""Apply the recovered asset-only update; preserve native code and resources.

Input APK must be the saved 0.3.0 build. Signing and alignment are separate.
"""
from pathlib import Path
import struct
import zipfile
import hashlib

ROOT = Path(__file__).resolve().parent.parent
source = ROOT / 'source/Prismo-Field-Kit-0.3.0-debug.apk'
assets = ROOT / 'source/assets'
out = ROOT / 'build-private/fieldkit-unsigned.apk'
out.parent.mkdir(parents=True, exist_ok=True)
assert hashlib.sha256(source.read_bytes()).hexdigest() == 'ae37b54372cd92b93718bad678d71436a6a5a75c7516fffca0895a0f6ce24922'

def revise_manifest(original):
    b = bytearray(original)
    strings, positions = [], []
    pos = 8
    found_code = found_name = False
    while pos < len(b):
        kind, header, size = struct.unpack_from('<HHI', b, pos)
        assert size >= header and pos + size <= len(b)
        if kind == 1:
            count, _, flags, start = struct.unpack_from('<IIII', b, pos + 8)
            utf8 = bool(flags & 0x100)
            def length(at):
                if utf8:
                    n = b[at]
                    return (((n & 127) << 8) | b[at+1], at+2) if n & 128 else (n, at+1)
                n = struct.unpack_from('<H', b, at)[0]
                return (((n & 0x7fff) << 16) | struct.unpack_from('<H', b, at+2)[0], at+4) if n & 0x8000 else (n, at+2)
            for i in range(count):
                off = struct.unpack_from('<I', b, pos + header + 4*i)[0]
                n, at = length(pos + start + off)
                if utf8:
                    n, at = length(at)
                bytecount = n if utf8 else n*2
                enc = 'utf-8' if utf8 else 'utf-16-le'
                strings.append(bytes(b[at:at+bytecount]).decode(enc))
                positions.append((at, bytecount, enc))
        elif kind == 0x102:
            attr_start, attr_size, count = struct.unpack_from('<HHH', b, pos+24)
            element = strings[struct.unpack_from('<I', b, pos+20)[0]]
            if element == 'manifest':
                for i in range(count):
                    at = pos+16+attr_start+i*attr_size
                    name_index, raw = struct.unpack_from('<II', b, at+4)
                    name = strings[name_index]
                    if name == 'versionCode':
                        assert b[at+15] == 0x10 and struct.unpack_from('<I', b, at+16)[0] == 3
                        struct.pack_into('<I', b, at+16, 5)
                        found_code = True
                    if name == 'versionName':
                        assert b[at+15] == 3
                        index = struct.unpack_from('<I', b, at+16)[0]
                        assert strings[index] == '0.3.0'
                        location, length_bytes, encoding = positions[index]
                        value = '0.3.2'.encode(encoding)
                        assert len(value) == length_bytes
                        b[location:location+length_bytes] = value
                        found_name = True
        pos += size
    assert pos == len(b) and found_code and found_name
    return bytes(b)

with zipfile.ZipFile(source) as old, zipfile.ZipFile(out, 'w') as new:
    written = set()
    for info in old.infolist():
        name = info.filename
        if name.startswith('assets/'):
            file = assets / name.removeprefix('assets/')
            if not file.exists():
                assert name == 'assets/tools/forge_database.json'
                continue
            data = file.read_bytes()
        elif name.startswith('META-INF/') and (name.endswith(('.RSA','.DSA','.EC','.SF')) or name == 'META-INF/MANIFEST.MF'):
            continue
        elif name == 'AndroidManifest.xml':
            data = revise_manifest(old.read(name))
        else:
            data = old.read(name)
        new.writestr(info, data)
        written.add(name)
    for file in sorted(assets.rglob('*')):
        if file.is_file():
            name='assets/'+file.relative_to(assets).as_posix()
            if name not in written:
                new.writestr(name,file.read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
print('Prepared asset-only update with versionCode 5 / versionName 0.3.2')
