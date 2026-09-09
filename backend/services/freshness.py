"""Readiness from actual returned records, never from assumed provider availability."""
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel

FreshnessStatus = Literal['current', 'aging', 'stale', 'unavailable', 'demo']
DataType = Literal['live', 'near_real_time', 'forecast', 'satellite_observation', 'demo']
FRESHNESS_POLICIES = {
    'weather': ('forecast', 60, 180), 'ocean': ('forecast', 180, 360),
    'pfz': ('near_real_time', 720, 1440), 'alerts': ('near_real_time', 360, 720),
    'sst': ('forecast', 180, 360), 'chlorophyll': ('satellite_observation', 720, 2160),
    'gps': ('live', 5, 15),
}

class DatasetFreshnessItem(BaseModel):
    dataset: str
    source: str
    data_type: DataType
    observation_time: str | None = None
    forecast_time: str | None = None
    fetched_at: str | None = None
    age_minutes: float | None = None
    is_stale: bool
    freshness_status: FreshnessStatus
    mode: Literal['live', 'demo']
    description: str

class DataFreshnessSummary(BaseModel):
    mode: Literal['live', 'demo', 'hybrid']
    system_time: str
    datasets: dict[str, DatasetFreshnessItem]
    overall_status: FreshnessStatus
    notice: str

def parse_time(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    dt = value if isinstance(value, datetime) else datetime.fromisoformat(value)
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

def evaluate_item_freshness(dataset, source, fetched_at, forecast_time=None,
                            observation_time=None, mode='live', is_demo=False,
                            expires_at=None, is_stale=False):
    kind, current, aging = FRESHNESS_POLICIES.get(dataset, ('near_real_time', 120, 360))
    now = datetime.now(timezone.utc)
    fetched, observed, forecast, expires = map(parse_time, (fetched_at, observation_time, forecast_time, expires_at))
    age = max(0, (now - fetched).total_seconds() / 60) if fetched else None
    stale = bool(is_stale or (expires and now >= expires) or (age is not None and age > aging))
    status = 'unavailable' if fetched is None else 'demo' if is_demo else 'stale' if stale else 'aging' if age > current else 'current'
    return DatasetFreshnessItem(
        dataset=dataset, source=source or 'unavailable', data_type='demo' if is_demo else kind,
        observation_time=observed.isoformat() if observed else None,
        forecast_time=forecast.isoformat() if forecast else None,
        fetched_at=fetched.isoformat() if fetched else None,
        age_minutes=round(age, 1) if age is not None else None,
        is_stale=stale or fetched is None, freshness_status=status,
        mode='demo' if is_demo else mode,
        description='No successful record retrieved in this process.' if fetched is None else
                    'Recorded demo data; original retrieval time retained.' if is_demo else
                    'Last returned record; retrieval age and provider expiry checked. Not a coverage guarantee.',
    )

class DataFreshnessService:
    def __init__(self, demo_mode: bool = False):
        self.demo_mode = demo_mode
        self.records = {}

    def record(self, dataset, records):
        # A failed/empty retrieval invalidates this dataset's readiness.
        self.records[dataset] = [r.model_dump() if hasattr(r, 'model_dump') else dict(r) for r in records]

    def get_summary(self) -> DataFreshnessSummary:
        mode = 'demo' if self.demo_mode else 'live'
        datasets = {}
        priority = {'current': 0, 'demo': 1, 'aging': 2, 'stale': 3, 'unavailable': 4}
        for name in FRESHNESS_POLICIES:
            records = self.records.get(name, [])
            items = [evaluate_item_freshness(
                name, r.get('source', 'unavailable'), r.get('fetched_at'),
                r.get('forecast_time'), r.get('observation_time'), mode,
                is_demo=r.get('mode') == 'demo', expires_at=r.get('expires_at') or r.get('valid_until'),
                is_stale=r.get('is_stale', False),
            ) for r in records]
            datasets[name] = max(items, key=lambda item: priority[item.freshness_status]) if items else evaluate_item_freshness(name, 'unavailable', None, mode=mode)
        overall = max((item.freshness_status for item in datasets.values()), key=lambda value: priority[value])
        return DataFreshnessSummary(mode=mode, system_time=datetime.now(timezone.utc).isoformat(),
            datasets=datasets, overall_status=overall,
            notice='Readiness reflects actual last returned records. Unqueried datasets and GPS without a received fix remain unavailable.')
