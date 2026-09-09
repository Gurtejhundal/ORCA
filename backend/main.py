import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.core.config import Settings, settings
from backend.core.logging import configure_logging
from backend.core.exceptions import SourceUnavailable
from backend.database.session import Database
from backend.database.repository import Repository
from backend.cache.memory import MemoryCache
from backend.data_sources.base import SafeHTTP
from backend.data_sources.registry import SourceRegistry
from backend.data_sources.weather.open_meteo import OpenMeteo
from backend.data_sources.incois.osf import IncoisOSF
from backend.data_sources.incois.erddap import IncoisERDDAP
from backend.data_sources.incois.pfz_wfs import IncoisPFZWFS
from backend.services.marine import MarineService
from backend.api.routes.marine import router
from backend.llm.provider import get_llm_provider
from backend.voice.service import VoiceService
from backend.agents.orchestrator import MarineOrchestrator
from backend.api.routes.chat import router as chat_router
from backend.api.routes.voice import router as voice_router
from backend.api.routes.agents import router as agents_router
from backend.api.routes.safety import router as safety_router
from backend.api.routes.routes import router as routes_router
from backend.api.routes.geofence import router as geofence_router
from backend.api.routes.simulation import router as simulation_router
from backend.risk.service import MarineRiskService
from backend.routing.route_service import MarineRouteService
from backend.geofence.service import GeofenceService
from backend.simulation.manager import SimulationManager


def create_app(config: Settings | None = None) -> FastAPI:
    config = config or settings
    configure_logging()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = Database(config.database_url)
        cache = MemoryCache(config.cache_max_entries)
        async with httpx.AsyncClient(headers={'User-Agent': 'SamudraAI/1.0'}, trust_env=False,
                                     limits=httpx.Limits(max_connections=20)) as client:
            http = SafeHTTP(config, client)
            registry = SourceRegistry(cache)
            registry.register('ocean', IncoisOSF(http, cache), IncoisERDDAP(http), OpenMeteo(http, marine=True))
            registry.register('weather', OpenMeteo(http))
            repo = Repository(db)
            app.state.repository = repo
            marine_svc = MarineService(config, registry, repo, IncoisPFZWFS(http))
            app.state.service = marine_svc
            app.state.llm = get_llm_provider(config)
            app.state.voice_service = VoiceService(config)

            # Part 3 Deterministic Services
            risk_svc = MarineRiskService(marine_svc)
            app.state.risk_service = risk_svc
            route_svc = MarineRouteService(risk_svc)
            app.state.route_service = route_svc
            geofence_svc = GeofenceService(marine_svc)
            app.state.geofence_service = geofence_svc
            sim_manager = SimulationManager(route_svc, geofence_svc)
            app.state.simulation_manager = sim_manager

            app.state.orchestrator = MarineOrchestrator(
                config, marine_svc, repo, app.state.llm,
                risk_service=risk_svc, route_service=route_svc, geofence_service=geofence_svc
            )
            yield
            for task in list(cache.inflight.values()):
                task.cancel()
            await asyncio.gather(*cache.inflight.values(), return_exceptions=True)
        await db.close()

    app = FastAPI(title='SamudraAI Marine Intelligence Platform', version='3.0.0', lifespan=lifespan,
                  description='Part 3: Deterministic Marine Risk Engine, Safe PFZ Ranking, A* Route Optimization, Geofencing & Vessel Simulation.')
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list({config.frontend_url, 'http://localhost:3000', 'http://127.0.0.1:3000'}),
        allow_methods=['GET', 'POST', 'OPTIONS'],
        allow_headers=['Content-Type', 'Authorization'],
        expose_headers=['X-Request-ID'],
    )

    @app.middleware('http')
    async def limits(request: Request, call_next):
        request_id = str(uuid.uuid4())
        if len(request.scope.get('query_string', b'')) > 8192:
            return JSONResponse({'detail': 'Query string too large'}, 413)
        try:
            length = int(request.headers.get('content-length', '0'))
            is_voice = request.url.path.startswith('/api/v1/voice')
            max_limit = 10 * 1024 * 1024 if is_voice else 65536
            if length > max_limit or length < 0:
                return JSONResponse({'detail': 'Request body too large'}, 413)
            if not is_voice and request.headers.get('transfer-encoding'):
                return JSONResponse({'detail': 'Streaming request bodies are unsupported'}, 413)
            async with asyncio.timeout(config.request_timeout):
                response = await call_next(request)
        except ValueError:
            return JSONResponse({'detail': 'Invalid Content-Length'}, 400)
        except TimeoutError:
            return JSONResponse({'detail': 'Request deadline exceeded'}, 504)
        response.headers['X-Request-ID'] = request_id
        response.headers['Cache-Control'] = 'no-store'
        logging.getLogger('api').info('request id=%s method=%s path=%s status=%s', request_id, request.method, request.url.path, response.status_code)
        return response

    @app.exception_handler(SourceUnavailable)
    async def source_error(request: Request, exc: SourceUnavailable):
        return JSONResponse({'detail': str(exc)}, 503)

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):
        logging.getLogger('api').error('unhandled_error type=%s path=%s', type(exc).__name__, request.url.path)
        return JSONResponse({'detail': 'Internal service error'}, 500)

    @app.get('/health', response_model=dict[str, str], tags=['System'], description='Process liveness; use system/status for dependency readiness.')
    async def health():
        return {'status': 'ok'}

    app.include_router(router)
    app.include_router(chat_router)
    app.include_router(voice_router)
    app.include_router(agents_router)
    app.include_router(safety_router)
    app.include_router(routes_router)
    app.include_router(geofence_router)
    app.include_router(simulation_router)
    return app


app = create_app()
