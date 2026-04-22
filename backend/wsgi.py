"""WSGI entrypoint: ``flask --app wsgi:app run --host 127.0.0.1 --port 8001`` from the ``backend/`` directory."""

from dotenv import load_dotenv

load_dotenv()

from app.main import create_app

app = create_app()
