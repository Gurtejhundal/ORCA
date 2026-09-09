import re

# Supported regional languages
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'hi': 'Hindi',
    'ta': 'Tamil',
    'te': 'Telugu',
    'ml': 'Malayalam',
    'kn': 'Kannada',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'bn': 'Bengali',
    'or': 'Odia',
}

# Common romanized Hindi (Hinglish) trigger words
HINGLISH_KEYWORDS = {
    'kal', 'subah', 'shaam', 'raat', 'baje', 'samundar', 'samudra', 'machli',
    'kya', 'safe', 'surakshit', 'rahega', 'hoga', 'jana', 'chahiye', 'kahan',
    'bataye', 'batado', 'kitna', 'lahr', 'hawa', 'toofan', 'pani'
}


def detect_language(text: str, hint: str | None = None) -> str:
    """Detect language code from text using script ranges, Hinglish heuristic, and hints."""
    if hint and hint in SUPPORTED_LANGUAGES:
        return hint

    if not text or not text.strip():
        return 'en'

    # Check Indic scripts via Unicode ranges
    for char in text:
        cp = ord(char)
        if 0x0900 <= cp <= 0x097F:
            return 'hi'  # Devanagari (Hindi)
        elif 0x0B80 <= cp <= 0x0BFF:
            return 'ta'  # Tamil
        elif 0x0C00 <= cp <= 0x0C7F:
            return 'te'  # Telugu
        elif 0x0C80 <= cp <= 0x0CFF:
            return 'kn'  # Kannada
        elif 0x0D00 <= cp <= 0x0D7F:
            return 'ml'  # Malayalam
        elif 0x0A80 <= cp <= 0x0AFF:
            return 'gu'  # Gujarati
        elif 0x0980 <= cp <= 0x09FF:
            return 'bn'  # Bengali
        elif 0x0B00 <= cp <= 0x0B7F:
            return 'or'  # Odia

    # Check for Romanized Hindi (Hinglish)
    words = re.findall(r'\b\w+\b', text.lower())
    if words:
        matches = sum(1 for w in words if w in HINGLISH_KEYWORDS)
        if matches >= 2 or (matches == 1 and len(words) <= 4):
            return 'hi'

    return 'en'


def get_language_name(code: str) -> str:
    return SUPPORTED_LANGUAGES.get(code, 'English')
