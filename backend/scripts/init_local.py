"""Create local-only credentials once. Never print secrets or overwrite .env."""
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / '.env'
if path.exists():
    raise SystemExit('.env already exists; left unchanged')
password = secrets.token_hex(24)
path.write_text(
    'POSTGRES_DB=samudra\nPOSTGRES_USER=samudra\n'
    f'POSTGRES_PASSWORD={password}\nPOSTGRES_PORT=5433\n'
    f'DATABASE_URL=postgresql+psycopg://samudra:{password}@127.0.0.1:5433/samudra\n'
    'DEMO_MODE=true\nFRONTEND_URL=http://127.0.0.1:3000\n', encoding='utf-8')
print('Created ignored .env with generated local credentials and explicit demo mode.')
