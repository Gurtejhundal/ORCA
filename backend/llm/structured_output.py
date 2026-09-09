import json
import re
from typing import TypeVar, Type, Any
from pydantic import BaseModel, ValidationError

T = TypeVar('T', bound=BaseModel)


def extract_json_str(text: str) -> str:
    """Extract a JSON string from markdown codeblocks or raw text."""
    text = text.strip()
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    
    # Try finding first { and matching last }
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace:last_brace + 1].strip()
    
    # Try finding first [ and matching last ]
    first_bracket = text.find('[')
    last_bracket = text.rfind(']')
    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        return text[first_bracket:last_bracket + 1].strip()
        
    return text


def repair_json(raw: str) -> dict | list | None:
    """Attempt basic repairs on malformed LLM JSON string."""
    cleaned = extract_json_str(raw)
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Replace python None, True, False if any
    repaired = re.sub(r'\bNone\b', 'null', cleaned)
    repaired = re.sub(r'\bTrue\b', 'true', repaired)
    repaired = re.sub(r'\bFalse\b', 'false', repaired)
    # Remove trailing commas before } or ]
    repaired = re.sub(r',\s*([}\]])', r'\1', repaired)

    try:
        return json.loads(repaired)
    except Exception:
        return None


def parse_structured_output(raw_text: str, schema: Type[T]) -> T:
    """Parse and validate LLM output into a Pydantic model with repair fallback."""
    data = repair_json(raw_text)
    if data is None:
        raise ValueError(f"Could not extract or repair valid JSON from LLM output: {raw_text[:200]}")
    
    if isinstance(data, dict):
        return schema.model_validate(data)
    elif isinstance(data, list) and hasattr(schema, '__root__'):
        return schema.model_validate(data)
    else:
        return schema.model_validate(data)
