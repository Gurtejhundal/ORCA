"""Exact WFS URL published in INCOIS MFASPFZ/js/wms.js, verified 2026-09-08."""
import asyncio
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from backend.core.exceptions import SourceUnavailable
from backend.data_sources.base import SafeHTTP
from backend.schemas.marine import FeatureCollection, Zone, utcnow

WFS = 'https://incois.gov.in/geoserver/PFZ_Automation/ows'
ADVISORY = 'https://incois.gov.in/MarineFisheries/TextDataHome'
PARAMS = {'service':'WFS','version':'1.1.0','request':'GetFeature',
          'typeName':'PFZ_Automation:pfzlines','outputFormat':'application/json'}
IST = timezone(timedelta(hours=5, minutes=30))


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str):
        self.parts.append(data.strip())


class IncoisPFZWFS:
    name = 'INCOIS PFZ WFS'

    def __init__(self, http: SafeHTTP):
        self.http = http

    async def fetch(self) -> list[Zone]:
        response, advisory = await asyncio.gather(self.http.get(WFS, PARAMS),
            self.http.get(ADVISORY, {'mfid':1,'request_locale':'en'}))
        try:
            return self.validate(self.normalize(response.json(), advisory.text, utcnow()))
        except (ValueError, KeyError, TypeError) as exc:
            reason = str(exc) if type(exc) is ValueError else type(exc).__name__
            raise SourceUnavailable(self.name, f'Invalid WFS/advisory: {reason[:180]}') from exc

    def normalize(self, raw: dict, advisory: str, fetched: datetime) -> list[Zone]:
        collection = FeatureCollection.model_validate(raw)
        if raw.get('numberReturned') != raw.get('totalFeatures'):
            raise ValueError('Truncated WFS response')
        parser = Text(); parser.feed(advisory)
        text = ' '.join(parser.parts)
        dates = re.search(r'Forecast Date\s+Valid upto\s+(\d{1,2} [A-Z]{3} \d{4})\s+(\d{1,2} [A-Z]{3} \d{4})', text)
        if not dates:
            raise ValueError('No dated validity table')
        start, end = [datetime.strptime(d, '%d %b %Y').replace(tzinfo=IST) for d in dates.groups()]
        if end <= start:
            raise ValueError('Invalid date interval')
        zones = []
        for feature in collection.features:
            p = feature.properties
            product_date = datetime(int(p['Year']),1,1,tzinfo=IST)+timedelta(days=int(p['Julian_day'])-1)
            if product_date.date() != start.date():
                raise ValueError('WFS product day does not match current advisory')
            zones.append(Zone(id=f"incois-{p['Year']}-{p['Julian_day']}-{p['Sno']}",
                name=f"INCOIS PFZ {p['Sno']}", geometry=feature.geometry,
                valid_from=start, valid_until=end, source='INCOIS PFZ WFS',
                source_reference=WFS, fetched_at=fetched,
                expires_at=min(end, fetched+timedelta(seconds=self.http.settings.pfz_ttl)),
                metadata={'provider_properties':p,'advisory_reference':ADVISORY,
                    'forecast_date':dates[1], 'valid_upto_date':dates[2], 'validity_precision':'date',
                    'validity_policy':'Conservative expiry at start of valid-upto date in Asia/Kolkata; exact hour is unpublished',
                    'quality':'official_advisory'}))
        return zones

    def validate(self, zones: list[Zone]) -> list[Zone]:
        return [Zone.model_validate(z.model_dump()) for z in zones]

    async def health_check(self) -> dict:
        try:
            zones = await self.fetch()
            usable = [z for z in zones if z.valid_from <= utcnow() < z.valid_until]
            return {'status':'online' if usable else 'expired_product', 'features':len(zones),
                    'usable_features':len(usable), 'validity_policy':'conservative date boundary'}
        except SourceUnavailable as exc:
            return {'status':'unavailable','reason':exc.reason}
