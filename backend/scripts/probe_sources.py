"""Read-only verification of documented public endpoints; save responses locally."""
import concurrent.futures
import argparse
import json
from pathlib import Path
from urllib.request import urlopen, Request

URLS = {
    'pfz_wfs': 'https://incois.gov.in/geoserver/PFZ_Automation/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json',
    'pfz_map_data_js': 'https://incois.gov.in/DataInfo/MFASPFZ/js/jsondata.js',
    'pfz_wms_js': 'https://incois.gov.in/DataInfo/MFASPFZ/js/wms.js',
    'pfz_map': 'https://incois.gov.in/DataInfo/MFASPFZ/index.html',
    'pfz_webgis': 'https://incois.gov.in/MarineFisheries/PfzWebGis',
    'pfz_tamilnadu': 'https://incois.gov.in/MarineFisheries/TextData?secid=SEC007',
    'pfz_advisories': 'https://incois.gov.in/MarineFisheries/TextDataHome?mfid=1&request_locale=en',
    'osf_wave_csv': 'https://incois.gov.in/thredds/wms/osf/ww3/rsmc_combined_ww3_20260907.nc?REQUEST=GetTimeseries&LAYERS=HS&QUERY_LAYERS=HS&BBOX=80.1,10.77,80.1,10.77&SRS=CRS:84&HEIGHT=1&WIDTH=1&X=0&Y=0&ELEVATION=0&VERSION=1.1.1&INFO_FORMAT=text/csv&TIME=2026-09-08T00:00:00Z/2026-09-09T00:00:00Z',
    'erddap': 'https://erddap.incois.gov.in/erddap/info/index.json?itemsPerPage=1000',
    'pfz': 'https://incois.gov.in/MarineFisheries/PfzAdvisory.action',
    'osf': 'https://incois.gov.in/oceanservices/osfforecast.jsp',
    'marine': 'https://marine-api.open-meteo.com/v1/marine?latitude=10.77&longitude=80.1&hourly=wave_height,sea_surface_temperature,ocean_current_velocity&forecast_days=1',
    'weather': 'https://api.open-meteo.com/v1/forecast?latitude=10.77&longitude=80.1&hourly=wind_speed_10m,weather_code&forecast_days=1',
}


def probe(item):
    name, url = item
    try:
        with urlopen(Request(url, headers={'User-Agent': 'SamudraAI-research/1.0'}), timeout=20) as response:
            body = response.read(2_000_000)
            output = Path('output/source-probes')
            output.mkdir(parents=True, exist_ok=True)
            (output / f'{name}.txt').write_bytes(body)
            return {'source': name, 'url': url, 'http_status': response.status, 'bytes': len(body)}
    except Exception as exc:
        return {'source': name, 'url': url, 'error': str(exc)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='+', choices=URLS)
    args = parser.parse_args()
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        print(json.dumps(list(pool.map(probe, [(k,v) for k,v in URLS.items() if not args.only or k in args.only])), indent=2))
