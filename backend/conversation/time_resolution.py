import re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from backend.data_sources import demo

IST = ZoneInfo("Asia/Kolkata")


def resolve_time_expression(
    expr: str | None,
    demo_mode: bool = False,
    reference_time: datetime | None = None
) -> datetime:
    """Deterministically resolve natural language time expressions to a timezone-aware UTC datetime.

    Supported expressions:
    - today, आज
    - tonight, आज रात
    - tomorrow, कल
    - tomorrow morning, कल सुबह
    - tomorrow evening, कल शाम
    - 6 AM, सुबह 6 बजे
    - next 6 hours, अगले 6 घंटे
    - next 24 hours, अगले 24 घंटे
    """
    # Baseline clock
    if reference_time:
        base_dt = reference_time.astimezone(IST)
    elif demo_mode:
        # Replay clock baseline as documented: 6 Sep 2026, 12:00 IST so 'tomorrow' is 7 Sep 2026
        base_dt = datetime(2026, 9, 6, 12, 0, tzinfo=IST)
    else:
        base_dt = datetime.now(IST)

    if not expr or not expr.strip():
        return base_dt.astimezone(timezone.utc)

    expr_clean = expr.lower().strip()

    # Relative hours: "next X hours" or "अगले X घंटे"
    hour_match = re.search(r'(?:next|अगले)\s*(\d+)\s*(?:hours|घंटे|hr)', expr_clean)
    if hour_match:
        hours = int(hour_match.group(1))
        target = base_dt + timedelta(hours=hours)
        return target.astimezone(timezone.utc)

    # Relative days: tomorrow / kal
    is_tomorrow = any(k in expr_clean for k in ['tomorrow', 'कल'])
    is_tonight = any(k in expr_clean for k in ['tonight', 'आज रात'])
    is_morning = any(k in expr_clean for k in ['morning', 'सुबह', 'dawn'])
    is_evening = any(k in expr_clean for k in ['evening', 'शाम', 'dusk'])

    # Explicit hour extraction, e.g. "6 am", "6 baje", "सुबह 6", "14:00"
    hour_spec = None
    explicit_hour_match = re.search(r'(\d{1,2})\s*(?:am|pm|बजे|:00)', expr_clean)
    if explicit_hour_match:
        val = int(explicit_hour_match.group(1))
        if 'pm' in expr_clean and val < 12:
            val += 12
        hour_spec = val

    target_day = base_dt
    if is_tomorrow:
        target_day = base_dt + timedelta(days=1)

    # Determine hour
    if hour_spec is not None:
        target_hour = hour_spec
    elif is_morning:
        target_hour = 6
    elif is_evening:
        target_hour = 18
    elif is_tonight:
        target_hour = 21
    else:
        target_hour = base_dt.hour

    resolved = target_day.replace(hour=target_hour % 24, minute=0, second=0, microsecond=0)
    return resolved.astimezone(timezone.utc)
