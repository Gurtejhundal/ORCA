"""Cross-platform entry point: imports Windows selector policy before Uvicorn."""
import uvicorn
import asyncio


async def serve() -> None:
    # Recent Uvicorn versions choose a Proactor loop on Windows even when a
    # selector policy is installed. Run Server.serve in an explicit loop.
    server = uvicorn.Server(uvicorn.Config('backend.main:app', host='127.0.0.1', port=8000))
    await server.serve()

if __name__ == '__main__':
    with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
        runner.run(serve())
