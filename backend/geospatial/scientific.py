"""Local scientific-data helpers; callers supply verified datasets and metadata."""
import geopandas as gpd
import numpy as np
import xarray as xr
from backend.schemas.marine import FeatureCollection, Location


def reproject_features(collection: FeatureCollection, crs: str = 'EPSG:4326') -> gpd.GeoDataFrame:
    frame = (gpd.GeoDataFrame.from_features(collection.model_dump()['features'], crs='EPSG:4326')
             if collection.features else gpd.GeoDataFrame(geometry=[], crs='EPSG:4326'))
    return frame.to_crs(crs)


def sample_grid(grid: xr.DataArray, location: Location, tolerance_degrees: float = 0.1) -> float | None:
    """Sample a reviewed latitude/longitude grid without filling missing values.

    Time/depth must already be selected by the adapter; axes must be WGS84.
    """
    if set(grid.dims) != {'latitude','longitude'}:
        raise ValueError('Select time/depth before sampling a latitude/longitude grid')
    try:
        sample = grid.sel(latitude=location.lat, longitude=location.lon, method='nearest', tolerance=tolerance_degrees)
    except KeyError:
        return None
    value = float(sample.item())
    return value if np.isfinite(value) else None
