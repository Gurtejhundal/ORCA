from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncEngine
from sqlalchemy import text


class Database:
    def __init__(self, url: str):
        self.engine: AsyncEngine | None = create_async_engine(
            url, pool_pre_ping=True, connect_args={'connect_timeout': 3},
        ) if url else None
        self.session = async_sessionmaker(self.engine, expire_on_commit=False) if self.engine else None

    async def health(self) -> dict[str, str]:
        if not self.engine:
            return {'database': 'unconfigured', 'postgis': 'unconfigured'}
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text('SELECT 1'))
                try:
                    await connection.execute(text('SELECT PostGIS_Version()'))
                    return {'database': 'online', 'postgis': 'online'}
                except Exception:
                    return {'database': 'online', 'postgis': 'unavailable'}
        except Exception:
            return {'database': 'offline', 'postgis': 'unknown'}

    async def close(self) -> None:
        if self.engine:
            await self.engine.dispose()
