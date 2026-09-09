"""Import reviewed local zones; no arbitrary remote paths or fetched URLs."""
import asyncio
import json
from pathlib import Path
from datetime import datetime
from sqlalchemy.dialects.postgresql import insert
from backend.core.config import settings
from backend.database.session import Database
from backend.models.tables import MarineZone
from backend.schemas.marine import FeatureCollection, Zone
from shapely.geometry import shape


async def main():
    if not settings.zones_import_file or not settings.database_url:
        raise SystemExit('Set ZONES_IMPORT_FILE and DATABASE_URL')
    path = Path(settings.zones_import_file)
    if path.stat().st_size > 10_000_000:
        raise SystemExit('Zone import exceeds 10 MB')
    collection = FeatureCollection.model_validate_json(path.read_text(encoding='utf-8'))
    rows = []
    for feature in collection.features:
        p = feature.properties
        zone = Zone.model_validate({**p,'geometry':feature.geometry})
        if zone.mode != 'live' or zone.valid_until <= zone.valid_from:
            raise ValueError('Live import requires valid provenance and timestamps')
        rows.append({'id':zone.id,'name':zone.name,'type':p['type'], 'severity':p.get('severity'),
            'geometry':'SRID=4326;'+shape(zone.geometry).wkt,'source':zone.source,
            'valid_from':zone.valid_from,'valid_until':zone.valid_until,
            'metadata':{**zone.metadata,'source_reference':zone.source_reference,
                        'fetched_at':zone.fetched_at.isoformat(),'expires_at':zone.expires_at.isoformat()}})
    db = Database(settings.database_url)
    try:
        async with db.session() as session:
            for row in rows:
                statement = insert(MarineZone.__table__).values(**row)
                await session.execute(statement.on_conflict_do_update(index_elements=['id'],
                    set_={k:getattr(statement.excluded,k) for k in row if k != 'id'}))
            await session.commit()
        print(f'Imported {len(rows)} reviewed zones.')
    finally:
        await db.close()


if __name__ == '__main__':
    asyncio.run(main())
