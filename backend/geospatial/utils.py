from math import asin, cos, radians, sin, sqrt
from typing import Iterable
from pyproj import CRS, Transformer
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import nearest_points, transform
from backend.schemas.marine import Location, FeatureCollection


def haversine(a: Location, b: Location) -> float:
    x = sin(radians(b.lat-a.lat)/2)**2 + cos(radians(a.lat))*cos(radians(b.lat))*sin(radians(b.lon-a.lon)/2)**2
    return 6371.0088 * 2 * asin(min(1, sqrt(x)))


def distance_to_geometry(location: Location, geometry: dict) -> float:
    """WGS84 azimuthal equidistant projection centered on query point (km)."""
    local = CRS.from_proj4(f'+proj=aeqd +lat_0={location.lat} +lon_0={location.lon} +datum=WGS84 +units=m')
    project = Transformer.from_crs(4326, local, always_xy=True).transform
    return transform(project, shape(geometry)).distance(Point(0, 0)) / 1000


def point_in_polygon(location: Location, geometry: dict) -> bool:
    return shape(geometry).covers(Point(location.lon, location.lat))


def intersects(a: dict, b: dict) -> bool:
    return shape(a).intersects(shape(b))


def nearest_geometry(location: Location, geometries: Iterable[dict]) -> dict | None:
    return min(geometries, key=lambda g: distance_to_geometry(location, g), default=None)


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    values = tuple(float(v) for v in value.split(','))
    if len(values) != 4:
        raise ValueError('bbox requires west,south,east,north')
    west, south, east, north = values
    Location(lat=south, lon=west)
    Location(lat=north, lon=east)
    if west >= east or south >= north:
        raise ValueError('bbox must be ordered; split antimeridian boxes')
    return values


def in_bbox(geometry: dict, bounds: tuple) -> bool:
    return shape(geometry).intersects(box(*bounds))


def to_wgs84(geometry: dict, source_crs: str) -> dict:
    return mapping(transform(Transformer.from_crs(source_crs, 4326, always_xy=True).transform, shape(geometry)))


def validate_geojson(value: dict) -> FeatureCollection:
    return FeatureCollection.model_validate(value)
