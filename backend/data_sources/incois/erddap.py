"""Discover actual ERDDAP metadata; fail closed until a suitable grid is verified."""
from backend.data_sources.base import SourceAdapter, SafeHTTP
from backend.core.exceptions import SourceUnavailable


class IncoisERDDAP(SourceAdapter):
    name = 'INCOIS ERDDAP'
    url = 'https://erddap.incois.gov.in/erddap/info/index.json'

    def __init__(self, http: SafeHTTP):
        self.http = http

    async def fetch(self, location, time):
        # Dataset IDs, axes and units must be verified before scientific grid extraction.
        raise SourceUnavailable(self.name, 'No current SST/chlorophyll grid verified; catalog TLS verification failed during setup')

    def normalize(self, raw, location, time):
        raise SourceUnavailable(self.name, 'No verified dataset schema configured')

    async def health_check(self):
        if not self.http.settings.incois_erddap_enabled:
            return {'status': 'disabled'}
        try:
            response = await self.http.get(self.url, {'itemsPerPage': 1000})
            payload = response.json()
            if not isinstance(payload.get('table', {}).get('rows'), list):
                raise ValueError('Invalid catalog')
            return {'status': 'catalog_only', 'data_adapter': 'unavailable', 'datasets': len(payload['table']['rows'])}
        except (SourceUnavailable, ValueError):
            return {'status': 'unavailable', 'reason': 'Catalog inaccessible or invalid; TLS verification remains enabled'}
