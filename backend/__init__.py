import asyncio
import sys

# psycopg async requires a selector loop on Windows (Python 3.12+).
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
