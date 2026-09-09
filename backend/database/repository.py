import json
import uuid
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from backend.models.tables import MarineObservation, PFZZone, MarineZone, ConversationSession, AgentRun
from backend.schemas.marine import Observation, Zone, Location
from backend.database.session import Database


class Repository:
    def __init__(self, database: Database):
        self.db = database

    async def save_observations(self, values: list[Observation]) -> None:
        if not self.db.session:
            return
        async with self.db.session() as session:
            for item in values:
                if item.mode != 'live':
                    continue
                identifier = uuid.uuid5(uuid.NAMESPACE_URL, '|'.join([item.source, item.parameter,
                    str(item.location), str(item.forecast_time), str(item.observation_time), str(item.fetched_at)]))
                await session.execute(insert(MarineObservation.__table__).values(id=identifier,
                    parameter=item.parameter, value=item.value, unit=item.unit,
                    latitude=item.location.lat, longitude=item.location.lon,
                    forecast_time=item.forecast_time, observation_time=item.observation_time,
                    source=item.source, source_reference=item.source_reference, fetched_at=item.fetched_at,
                    quality=item.quality, metadata={**item.metadata, 'expires_at': item.expires_at.isoformat()}
                ).on_conflict_do_nothing(index_elements=['id']))
            await session.commit()

    async def save_pfz(self, zones: list[Zone]) -> None:
        if not self.db.session:
            return
        async with self.db.session() as session:
            for zone in zones:
                values = zone.model_dump(exclude={'mode', 'expires_at', 'is_stale', 'freshness_minutes', 'distance_km', 'metadata'})
                values['geometry'] = 'SRID=4326;' + __import__('shapely').geometry.shape(zone.geometry).wkt
                values['metadata'] = {**zone.metadata, 'expires_at': zone.expires_at.isoformat()}
                statement = insert(PFZZone.__table__).values(**values)
                await session.execute(statement.on_conflict_do_update(index_elements=['id'], set_={
                    key: getattr(statement.excluded, key) for key in values if key != 'id'}))
            await session.commit()

    async def pfz(self, time: datetime, location: Location | None = None, radius: float | None = None,
                  bounds: tuple | None = None, limit: int = 100) -> list[Zone]:
        if not self.db.session:
            return []
        # All coordinates, dates, radii and limits are bound parameters.
        query = '''SELECT id,name,ST_AsGeoJSON(geometry::geometry) AS geometry,valid_from,valid_until,
                    source,source_reference,fetched_at,metadata,
                    CASE WHEN CAST(:lat AS double precision) IS NULL THEN NULL ELSE ST_Distance(geometry,
                    ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography)/1000 END AS distance_km
                    FROM pfz_zones WHERE valid_from <= :time AND valid_until > :time
                    AND (metadata->>'expires_at')::timestamptz > now()
                    AND (CAST(:radius AS double precision) IS NULL OR ST_DWithin(geometry,
                    ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography,:radius*1000))
                    AND (CAST(:west AS double precision) IS NULL OR ST_Intersects(geometry::geometry,
                    ST_MakeEnvelope(:west,:south,:east,:north,4326)))
                    ORDER BY distance_km NULLS LAST, id LIMIT :limit'''
        params = {'time': time, 'lat': location.lat if location else None, 'lon': location.lon if location else None,
                  'radius': radius, 'limit': limit, **dict(zip(('west','south','east','north'), bounds or (None,)*4))}
        async with self.db.session() as session:
            rows = (await session.execute(text(query), params)).mappings().all()
        return [Zone(**{**dict(row), 'geometry': json.loads(row['geometry']),
                         'expires_at': row['metadata']['expires_at']}) for row in rows]

    async def zones(self, time: datetime, location: Location | None = None, radius: float = 100) -> list[dict]:
        if not self.db.session:
            return []
        async with self.db.session() as session:
            rows = (await session.execute(text('''SELECT id,name,type,severity,source,valid_from,valid_until,
                ST_AsGeoJSON(geometry::geometry) AS geometry,metadata FROM marine_zones
                WHERE valid_from <= :time AND valid_until > :time
                AND (metadata->>'expires_at')::timestamptz > now()
                AND (CAST(:lat AS double precision) IS NULL OR ST_DWithin(geometry,ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography,:radius))'''),
                {'time': time, 'lat': location.lat if location else None,
                 'lon': location.lon if location else None, 'radius': radius*1000})).mappings().all()
        return [{**dict(row), 'geometry': json.loads(row['geometry'])} for row in rows]

    async def get_session(self, session_id: str) -> dict | None:
        if not self.db.session:
            return None
        async with self.db.session() as session:
            result = await session.execute(
                text('SELECT session_id, language, selected_location, selected_pfz, context, created_at, updated_at '
                     'FROM conversation_sessions WHERE session_id = :sid'),
                {'sid': session_id}
            )
            row = result.mappings().first()
            return dict(row) if row else None

    async def save_session(self, session_id: str, language: str = 'en',
                           selected_location: dict | None = None, selected_pfz: str | None = None,
                           context: dict | None = None) -> None:
        if not self.db.session:
            return
        async with self.db.session() as session:
            stmt = insert(ConversationSession.__table__).values(
                session_id=session_id,
                language=language,
                selected_location=selected_location,
                selected_pfz=selected_pfz,
                context=context or {}
            )
            await session.execute(stmt.on_conflict_do_update(
                index_elements=['session_id'],
                set_={
                    'language': stmt.excluded.language,
                    'selected_location': stmt.excluded.selected_location,
                    'selected_pfz': stmt.excluded.selected_pfz,
                    'context': stmt.excluded.context,
                    'updated_at': text('now()')
                }
            ))
            await session.commit()

    async def save_agent_run(self, session_id: str, query: str, intent: str | None = None,
                             plan: dict | None = None, tool_calls: list | None = None,
                             evidence: list | None = None, final_result: dict | None = None,
                             run_id: uuid.UUID | None = None) -> uuid.UUID:
        identifier = run_id or uuid.uuid4()
        if not self.db.session:
            return identifier
        async with self.db.session() as session:
            await session.execute(insert(AgentRun.__table__).values(
                id=identifier,
                session_id=session_id,
                query=query,
                intent=intent,
                plan=plan,
                tool_calls=tool_calls,
                evidence=evidence,
                final_result=final_result
            ))
            await session.commit()
        return identifier

    async def get_agent_run(self, run_id: uuid.UUID) -> dict | None:
        if not self.db.session:
            return None
        async with self.db.session() as session:
            result = await session.execute(
                text('SELECT id, session_id, query, intent, plan, tool_calls, evidence, final_result, created_at '
                     'FROM agent_runs WHERE id = :rid'),
                {'rid': run_id}
            )
            row = result.mappings().first()
            return dict(row) if row else None

