"""Reviewed local advisory export boundary. No fabricated public PFZ API."""
import asyncio
import json
from pathlib import Path
from backend.core.exceptions import SourceUnavailable
from backend.schemas.marine import Zone


class IncoisPFZ:
    name = 'INCOIS PFZ export'

    def __init__(self, path: str):
        self.path = path

    async def fetch(self) -> list[Zone]:
        if not self.path:
            raise SourceUnavailable(self.name, 'No reliable public vector endpoint verified; reviewed export not configured')
        try:
            if Path(self.path).stat().st_size > 10_000_000:
                raise ValueError('PFZ import exceeds 10 MB')
            raw = await asyncio.to_thread(Path(self.path).read_text, encoding='utf-8')
            return self.validate(self.normalize(json.loads(raw)))
        except (OSError, ValueError, TypeError, KeyError) as exc:
            raise SourceUnavailable(self.name, 'Invalid or unreadable normalized PFZ export') from exc

    def normalize(self, raw) -> list[Zone]:
        return [Zone.model_validate({**f['properties'], 'geometry': f['geometry']}) for f in raw['features']]

    def validate(self, zones: list[Zone]) -> list[Zone]:
        for zone in zones:
            if zone.mode != 'live' or zone.valid_until <= zone.valid_from or zone.expires_at <= zone.fetched_at:
                raise ValueError('Export must contain live provenance and ordered timestamps')
            if 'synthetic' in zone.source.lower() or 'demo' in zone.source.lower():
                raise ValueError('Synthetic exports cannot enter live storage')
        return zones

    async def health_check(self):
        try:
            zones = await self.fetch()
            return {'status': 'configured_export', 'count': len(zones)}
        except SourceUnavailable as exc:
            return {'status': 'unavailable', 'reason': exc.reason}
