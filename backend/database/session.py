from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncEngine
from sqlalchemy import text


class Database:
    def __init__(self, url: str):
        self.engine: AsyncEngine | None = create_async_engine(
            url, pool_pre_ping=True, connect_args={'connect_timeout': 3},
        ) if url else None
        self._session = async_sessionmaker(self.engine, expire_on_commit=False) if self.engine else None
        self._disabled_until: datetime | None = None
        self._disabled_reason = ''

    @property
    def session(self):
        if self._disabled_until and datetime.now(timezone.utc) < self._disabled_until:
            return None
        return self._session

    @session.setter
    def session(self, value):
        self._session = value
        self._disabled_until = None
        self._disabled_reason = ''

    def mark_unavailable(self, reason: str, seconds: int = 60) -> None:
        self._disabled_reason = reason
        self._disabled_until = datetime.now(timezone.utc) + timedelta(seconds=seconds)

    async def health(self) -> dict[str, str]:
        if not self.engine:
            status = 'offline' if self._disabled_reason else 'unconfigured'
            return {'database': status, 'postgis': 'unknown' if self._disabled_reason else 'unconfigured'}
        if self._disabled_until and datetime.now(timezone.utc) < self._disabled_until:
            return {'database': 'offline', 'postgis': 'unknown'}
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text('SELECT 1'))
                try:
                    await connection.execute(text('SELECT PostGIS_Version()'))
                    return {'database': 'online', 'postgis': 'online'}
                except Exception:
                    return {'database': 'online', 'postgis': 'unavailable'}
        except Exception:
            self.mark_unavailable('connection failed')
            return {'database': 'offline', 'postgis': 'unknown'}

    async def close(self) -> None:
        if self.engine:
            await self.engine.dispose()
