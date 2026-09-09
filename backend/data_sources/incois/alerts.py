"""Fail-closed authoritative warning boundary; no invented alert API URL."""
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import FeatureCollection


class IncoisAlerts:
    name = 'INCOIS/IMD marine alerts'
    reason = 'No verified automated warning feed configured; empty results do not mean safe'

    async def fetch(self) -> FeatureCollection:
        raise SourceUnavailable(self.name, self.reason)

    def normalize(self, raw: dict) -> FeatureCollection:
        return self.validate(FeatureCollection.model_validate(raw))

    def validate(self, collection: FeatureCollection) -> FeatureCollection:
        for feature in collection.features:
            if not {'source','valid_from','valid_until','severity','type'} <= feature.properties.keys():
                raise ValueError('Alert requires source, validity, type and severity')
        return collection

    async def health_check(self) -> dict[str, str]:
        return {'status':'unavailable','reason':self.reason}
