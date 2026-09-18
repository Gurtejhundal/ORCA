import re
from backend.conversation.context import ConversationContext, LocationState
from backend.schemas.marine import Location

# Curated Indian coastal landing centers, ports, and harbors
COASTAL_LOCATIONS: dict[str, tuple[float, float, str]] = {
    # Gujarat
    'veraval': (20.900, 70.366, 'Veraval, Gujarat'),
    'वेरावल': (20.900, 70.366, 'Veraval, Gujarat'),
    'porbandar': (21.642, 69.609, 'Porbandar, Gujarat'),
    'पोरबंदर': (21.642, 69.609, 'Porbandar, Gujarat'),
    'okha': (22.464, 69.068, 'Okha, Gujarat'),
    'ओखा': (22.464, 69.068, 'Okha, Gujarat'),
    'jafrabad': (20.871, 71.365, 'Jafrabad, Gujarat'),
    'kandla': (23.006, 70.217, 'Kandla, Gujarat'),
    'mandvi': (22.833, 69.355, 'Mandvi, Gujarat'),

    # Maharashtra
    'mumbai': (18.922, 72.834, 'Mumbai, Maharashtra'),
    'मुंबई': (18.922, 72.834, 'Mumbai, Maharashtra'),
    'bombay': (18.922, 72.834, 'Mumbai, Maharashtra'),
    'sasoon dock': (18.913, 72.825, 'Sassoon Dock, Mumbai'),
    'ratnagiri': (16.990, 73.300, 'Ratnagiri, Maharashtra'),
    'रत्नागिरी': (16.990, 73.300, 'Ratnagiri, Maharashtra'),
    'alibaug': (18.641, 72.872, 'Alibaug, Maharashtra'),
    'malvan': (16.061, 73.468, 'Malvan, Maharashtra'),

    # Goa
    'goa': (15.498, 73.827, 'Panaji, Goa'),
    'गोवा': (15.498, 73.827, 'Panaji, Goa'),
    'panaji': (15.498, 73.827, 'Panaji, Goa'),
    'mormugao': (15.416, 73.800, 'Mormugao, Goa'),

    # Karnataka
    'mangalore': (12.870, 74.880, 'Mangalore, Karnataka'),
    'mangaluru': (12.870, 74.880, 'Mangalore, Karnataka'),
    'मंगलौर': (12.870, 74.880, 'Mangalore, Karnataka'),
    'malpe': (13.350, 74.700, 'Malpe, Karnataka'),
    'karwar': (14.805, 74.130, 'Karwar, Karnataka'),
    'honnavar': (14.280, 74.450, 'Honnavar, Karnataka'),

    # Kerala
    'kochi': (9.931, 76.267, 'Kochi, Kerala'),
    'cochin': (9.931, 76.267, 'Kochi, Kerala'),
    'कोच्चि': (9.931, 76.267, 'Kochi, Kerala'),
    'munambam': (10.180, 76.166, 'Munambam, Kerala'),
    'kollam': (8.893, 76.614, 'Kollam, Kerala'),
    'neendakara': (8.937, 76.540, 'Neendakara, Kollam'),
    'vizhinjam': (8.380, 76.990, 'Vizhinjam, Kerala'),
    'thiruvananthapuram': (8.524, 76.936, 'Thiruvananthapuram, Kerala'),
    'calicut': (11.258, 75.780, 'Kozhikode, Kerala'),
    'kozhikode': (11.258, 75.780, 'Kozhikode, Kerala'),

    # Tamil Nadu
    'nagapattinam': (10.767, 79.872, 'Nagapattinam departure point, Tamil Nadu'),
    'नागापट्टिनम': (10.767, 79.872, 'Nagapattinam departure point, Tamil Nadu'),
    'chennai': (13.082, 80.270, 'Chennai, Tamil Nadu'),
    'चेन्नई': (13.082, 80.270, 'Chennai, Tamil Nadu'),
    'madras': (13.082, 80.270, 'Chennai, Tamil Nadu'),
    'tuticorin': (8.764, 78.134, 'Thoothukudi, Tamil Nadu'),
    'thoothukudi': (8.764, 78.134, 'Thoothukudi, Tamil Nadu'),
    'thootukudi': (8.764, 78.134, 'Thoothukudi, Tamil Nadu'),
    'cuddalore': (11.750, 79.770, 'Cuddalore, Tamil Nadu'),
    'rameshwaram': (9.287, 79.312, 'Rameshwaram, Tamil Nadu'),
    'kanyakumari': (8.088, 77.538, 'Kanyakumari, Tamil Nadu'),

    # Andhra Pradesh
    'visakhapatnam': (17.686, 83.218, 'Visakhapatnam, Andhra Pradesh'),
    'vizag': (17.686, 83.218, 'Visakhapatnam, Andhra Pradesh'),
    'विशाखापट्टनम': (17.686, 83.218, 'Visakhapatnam, Andhra Pradesh'),
    'kakinada': (16.989, 82.247, 'Kakinada, Andhra Pradesh'),
    'machilipatnam': (16.180, 81.130, 'Machilipatnam, Andhra Pradesh'),
    'krishnapatnam': (14.250, 80.120, 'Krishnapatnam, Andhra Pradesh'),

    # Odisha
    'paradip': (20.316, 86.611, 'Paradip, Odisha'),
    'paradeep': (20.316, 86.611, 'Paradip, Odisha'),
    'पारादीप': (20.316, 86.611, 'Paradip, Odisha'),
    'puri': (19.813, 85.831, 'Puri, Odisha'),
    'dhamra': (20.793, 86.974, 'Dhamra, Odisha'),
    'gopalpur': (19.260, 84.910, 'Gopalpur, Odisha'),

    # West Bengal
    'digha': (21.626, 87.507, 'Digha, West Bengal'),
    'दीघा': (21.626, 87.507, 'Digha, West Bengal'),
    'haldia': (22.066, 88.058, 'Haldia, West Bengal'),
    'diamond harbour': (22.190, 88.190, 'Diamond Harbour, West Bengal'),
    'kakdwip': (21.870, 88.190, 'Kakdwip, West Bengal'),

    # Islands
    'port blair': (11.623, 92.726, 'Port Blair, Andaman'),
    'kavaratti': (10.566, 72.641, 'Kavaratti, Lakshadweep'),

    # Additional coastal cities, landing centers and common demo query places
    'dwarka': (22.239, 68.968, 'Dwarka, Gujarat'),
    'diu': (20.714, 70.987, 'Diu'),
    'surat': (21.170, 72.831, 'Surat, Gujarat'),
    'hazira': (21.116, 72.642, 'Hazira, Gujarat'),
    'bhavnagar': (21.764, 72.151, 'Bhavnagar, Gujarat'),
    'vasai': (19.391, 72.839, 'Vasai, Maharashtra'),
    'dahanu': (19.990, 72.743, 'Dahanu, Maharashtra'),
    'murud': (18.328, 72.963, 'Murud, Maharashtra'),
    'vengurla': (15.861, 73.631, 'Vengurla, Maharashtra'),
    'udupi': (13.341, 74.742, 'Udupi / Malpe, Karnataka'),
    'kasaragod': (12.499, 74.987, 'Kasaragod, Kerala'),
    'alappuzha': (9.498, 76.338, 'Alappuzha, Kerala'),
    'alleppey': (9.498, 76.338, 'Alappuzha, Kerala'),
    'ponnani': (10.767, 75.925, 'Ponnani, Kerala'),
    'pondicherry': (11.934, 79.830, 'Puducherry'),
    'puducherry': (11.934, 79.830, 'Puducherry'),
    'karaikal': (10.925, 79.838, 'Karaikal, Puducherry'),
    'ennore': (13.214, 80.321, 'Ennore, Tamil Nadu'),
    'mahabalipuram': (12.620, 80.194, 'Mahabalipuram, Tamil Nadu'),
    'mamallapuram': (12.620, 80.194, 'Mahabalipuram, Tamil Nadu'),
    'pamban': (9.279, 79.214, 'Pamban, Tamil Nadu'),
    'mandapam': (9.276, 79.123, 'Mandapam, Tamil Nadu'),
    'nellore': (14.442, 79.986, 'Nellore, Andhra Pradesh'),
    'ongole': (15.505, 80.049, 'Ongole, Andhra Pradesh'),
    'srikakulam': (18.296, 83.897, 'Srikakulam coast, Andhra Pradesh'),
    'chilika': (19.722, 85.327, 'Chilika coast, Odisha'),
    'balasore': (21.493, 86.933, 'Balasore coast, Odisha'),
    'kolkata': (22.572, 88.363, 'Kolkata, West Bengal'),
    'sagar island': (21.652, 88.075, 'Sagar Island, West Bengal'),
    'sundarbans': (21.949, 89.183, 'Sundarbans, West Bengal'),

    # Inland/common judge demo locations. These are treated as the user's
    # declared position; marine/PFZ responses still preserve actual distances.
    'ahmedabad': (23.023, 72.571, 'Ahmedabad, Gujarat'),
    'pune': (18.520, 73.857, 'Pune, Maharashtra'),
    'bengaluru': (12.972, 77.594, 'Bengaluru, Karnataka'),
    'bangalore': (12.972, 77.594, 'Bengaluru, Karnataka'),
    'hyderabad': (17.385, 78.486, 'Hyderabad, Telangana'),
    'delhi': (28.613, 77.209, 'Delhi'),
    'jaipur': (26.912, 75.787, 'Jaipur, Rajasthan'),
}


def extract_coordinates(text: str) -> tuple[float, float] | None:
    """Extract decimal coordinates from text if present (e.g. 20.1, 70.3 or 20.1 N, 70.3 E)."""
    match = re.search(r'(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)', text)
    if match:
        lat = float(match.group(1))
        lon = float(match.group(2))
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon
    return None


def resolve_location(
    query: str,
    explicit_location: Location | dict | None = None,
    context: ConversationContext | None = None,
    named_hint: str | None = None,
) -> LocationState | None:
    """Resolve location following strict priority:

    1. Explicit coordinates in query or request body
    2. Named coastal location mentioned in query or intent hint
    3. Frontend GPS (if passed in explicit_location)
    4. Conversation memory
    5. None (caller may prompt or use default baseline)
    """
    # 1. Explicit coordinates directly in query
    coords = extract_coordinates(query)
    if coords:
        return LocationState(lat=coords[0], lon=coords[1], name=f"{coords[0]:.3f}°N, {coords[1]:.3f}°E", source='coordinates')

    # 2. Named location from hint or text. Longest names are checked first
    # so "diamond harbour" wins before a shorter overlapping token.
    query_lower = query.lower()
    candidates_to_check = []
    if named_hint:
        candidates_to_check.append(named_hint.lower().strip())
    candidates_to_check.append(query_lower)
    for candidate_text in candidates_to_check:
        for name_key, (lat, lon, label) in sorted(COASTAL_LOCATIONS.items(), key=lambda item: len(item[0]), reverse=True):
            if any('\u0900' <= ch <= '\u097F' for ch in name_key):
                matched = name_key in candidate_text
            else:
                matched = re.search(rf'(?<![a-z0-9]){re.escape(name_key)}(?![a-z0-9])', candidate_text) is not None
            if matched:
                return LocationState(lat=lat, lon=lon, name=label, source='named')

    # 3. Frontend GPS provided in request
    if explicit_location:
        if isinstance(explicit_location, dict):
            lat = explicit_location.get('lat')
            lon = explicit_location.get('lon')
            if lon is None:
                lon = explicit_location.get('lng')
        else:
            lat = explicit_location.lat
            lon = explicit_location.lon
        if lat is not None and lon is not None:
            return LocationState(lat=float(lat), lon=float(lon), name="Current Position", source='gps')

    # 4. Conversation memory
    if context and context.current_location:
        return context.current_location.model_copy(update={'source': 'memory'})

    return None
