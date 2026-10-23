"""Exercise the frozen executable on Windows; never describe a Linux run as Windows evidence."""
import argparse
import json
import math
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--exe', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if os.name != 'nt':
        raise SystemExit('This qualification must run on Windows.')
    exe = args.exe.resolve()
    log_path = args.output.resolve().parents[2] / 'package-test.log'
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    with tempfile.TemporaryDirectory(prefix='Prismo Windows test ') as temporary, log_path.open('w') as log:
        data = Path(temporary) / 'Données terrain'
        env = dict(os.environ, PROJ_NETWORK='OFF')
        env.pop('PYTHONPATH', None)
        env.pop('PYTHONHOME', None)

        def launch():
            return subprocess.Popen([str(exe), '--no-browser', '--port', str(port), '--data', str(data)],
                                    cwd=temporary, stdout=log, stderr=subprocess.STDOUT, env=env)

        def request(path, body=None, content_type='application/json'):
            payload = json.dumps(body).encode() if body is not None and not isinstance(body, bytes) else body
            req = urllib.request.Request(base + path, data=payload,
                                         headers={'Content-Type': content_type} if payload is not None else {})
            with urllib.request.urlopen(req, timeout=20) as response:
                value = response.read()
                return json.loads(value) if 'application/json' in response.headers.get('Content-Type', '') else value

        def ready(process):
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError(f'Executable exited: {process.returncode}. See {log_path}')
                try:
                    health = request('/api/v1/health')
                    assert Path(health['data_directory']).resolve() == data.resolve()
                    return health
                except OSError:
                    time.sleep(.5)
            raise RuntimeError('Executable did not become ready')

        process = launch()
        try:
            health = ready(process)
            assert b'<html' in request('/').lower()
            assert b'fieldkit-planning.js' in request('/field-kit/tools/tools_offline.html')
            assert b'PrismoExchange' in request('/field-kit/tools/prismo-contracts.js')
            assert len(list((data / 'grids').glob('*.tif'))) >= 3
            project = request('/api/v1/examples/demo', {})
            job = request('/api/v1/analyses', {'project': project, 'kind': 'route'})
            for _ in range(240):
                state = request('/api/v1/jobs/' + job['id'])
                if state['status'] in ('complete', 'failed', 'cancelled'):
                    break
                time.sleep(.5)
            assert state['status'] == 'complete', state
            result = request('/api/v1/jobs/' + job['id'] + '/result')
            assert len(result['samples']) > 0 and result['synthetic'] is True
            assert any(s['state'] != 'unknown' for s in result['samples'])
            # Exercise Windows file sharing for uploads, Rasterio DLLs and offline PROJ vertical grids.
            import numpy as np
            import rasterio
            from rasterio.transform import from_origin
            raster = Path(temporary) / 'terrain.tif'
            with rasterio.open(raster, 'w', driver='GTiff', width=20, height=20, count=1,
                               dtype='float32', crs='EPSG:4326', transform=from_origin(-87.99,42.27,.002,.002)) as ds:
                ds.write(np.full((20,20),200,dtype='float32'),1)
            boundary = 'PrismoWindowsUploadBoundary'
            payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="datum"\r\n\r\nNAVD88\r\n'
                       f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="terrain.tif"\r\n'
                       'Content-Type: image/tiff\r\n\r\n').encode() + raster.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
            terrain = request('/api/v1/terrain/import', payload, 'multipart/form-data; boundary=' + boundary)
            project['terrain_ids'] = [terrain['id']]
            point = request('/api/v1/terrain/point', {'project':project,'lon':-87.975,'lat':42.255})
            assert point['datum'] == 'EGM96' and math.isfinite(point['altitude_m'])
            assert not list((data / 'downloads').iterdir()), 'Temporary upload file leaked'
            plan = request('/api/v1/exchange/plan/export', project)
            assert plan['evidence'] == 'predicted'
            restored = request('/api/v1/exchange/plan/import', plan)
            assert restored['id'] != project['id']
            # Frozen workers must support cancellation as well as successful completion.
            job2 = request('/api/v1/analyses', {'project':project,'kind':'coverage','coverage':{
                'west':-88.00,'east':-87.97,'south':42.24,'north':42.27,'agl_m':60,'cell_m':20}})
            with urllib.request.urlopen(urllib.request.Request(base+'/api/v1/jobs/'+job2['id'],method='DELETE'),timeout=20) as response:
                cancelled=json.load(response)
            assert cancelled['status']=='cancelled',cancelled
            # A second invocation reuses the workspace and exits instead of spawning another service.
            second = subprocess.run([str(exe),'--no-browser','--port',str(port),'--data',str(data)],
                                    cwd=temporary, env=env, stdout=log, stderr=log, timeout=30)
            assert second.returncode == 0
            process.terminate(); process.wait(timeout=30)
            process = launch(); ready(process)
            assert any(p['id']==restored['id'] for p in request('/api/v1/projects'))
            receipt={'platform':'Windows','os':os.name,'exe':exe.name,'version':health['version'],
                     'native_executable_tested':True,'frontend_and_fieldkit':True,'frozen_worker_route_samples':len(result['samples']),
                     'raster_upload':True,'offline_vertical_transform_egm96_m':point['altitude_m'],
                     'worker_cancellation':True,'restart_preserves_projects':True,'duplicate_launch':True,
                     'data_path_with_spaces_and_unicode':True,'signature_verified':False,'physical_hardware_tested':False}
            args.output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
            print(json.dumps(receipt,indent=2))
        finally:
            if process.poll() is None:
                process.terminate(); process.wait(timeout=30)


if __name__ == '__main__':
    main()
