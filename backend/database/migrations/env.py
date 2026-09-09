import asyncio
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from backend.core.config import settings
from backend.database.base import Base
from backend.models import tables  # noqa: F401


def run(connection):
    context.configure(connection=connection, target_metadata=Base.metadata,
        include_object=lambda obj, name, type_, reflected, compare_to:
            not (type_ == 'table' and reflected and name not in Base.metadata.tables))
    with context.begin_transaction():
        context.run_migrations()


async def online():
    if not settings.database_url:
        raise RuntimeError('DATABASE_URL is required for migrations')
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as connection:
        await connection.run_sync(run)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=settings.database_url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(online())
