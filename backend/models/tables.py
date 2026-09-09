import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, String, Float, CheckConstraint, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geography
from backend.database.base import Base


class MarineObservation(Base):
    __tablename__ = 'marine_observations'
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    parameter: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    observation_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    forecast_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String)
    source_reference: Mapped[str | None] = mapped_column(String)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    quality: Mapped[str] = mapped_column(String)
    details: Mapped[dict[str, Any]] = mapped_column('metadata', JSONB, default=dict)
    __table_args__ = (CheckConstraint('latitude BETWEEN -90 AND 90'),
                      CheckConstraint('longitude BETWEEN -180 AND 180'))


class PFZZone(Base):
    __tablename__ = 'pfz_zones'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    geometry: Mapped[Any] = mapped_column(Geography('GEOMETRY', srid=4326, spatial_index=True))
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String)
    source_reference: Mapped[str] = mapped_column(String)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    details: Mapped[dict] = mapped_column('metadata', JSONB, default=dict)
    __table_args__ = (CheckConstraint('valid_until > valid_from'),)


class MarineZone(Base):
    __tablename__ = 'marine_zones'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, index=True)
    geometry: Mapped[Any] = mapped_column(Geography('GEOMETRY', srid=4326, spatial_index=True))
    severity: Mapped[str | None] = mapped_column(String)
    source: Mapped[str] = mapped_column(String)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    details: Mapped[dict] = mapped_column('metadata', JSONB, default=dict)
    __table_args__ = (CheckConstraint('valid_until > valid_from'),)


class ConversationSession(Base):
    __tablename__ = 'conversation_sessions'
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(String, unique=True)
    language: Mapped[str] = mapped_column(String, default='en')
    selected_location: Mapped[dict | None] = mapped_column(JSONB)
    selected_pfz: Mapped[str | None] = mapped_column(String)
    context: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AgentRun(Base):
    __tablename__ = 'agent_runs'
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(ForeignKey('conversation_sessions.session_id'), index=True)
    query: Mapped[str] = mapped_column(String)
    intent: Mapped[str | None] = mapped_column(String)
    plan: Mapped[dict | None] = mapped_column(JSONB)
    tool_calls: Mapped[list | None] = mapped_column(JSONB)
    evidence: Mapped[list | None] = mapped_column(JSONB)
    final_result: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
