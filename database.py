import os
import sqlite3

PASTA_PROJETO = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DATABASE_PATH") or os.path.join(PASTA_PROJETO, "database.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ler_schema_idempotente():
    with open(os.path.join(PASTA_PROJETO, "database_schema.sql"), "r", encoding="utf-8") as f:
        schema = f.read()
    return (
        schema
        .replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
        .replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ")
    )


def iniciar_banco():
    conn = sqlite3.connect(DB_PATH)

    tem_usuarios = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
    ).fetchone()

    if tem_usuarios:
        colunas = [linha[1] for linha in conn.execute("PRAGMA table_info(usuarios)")]
        if "codigo_hash" not in colunas:
            conn.execute("ALTER TABLE usuarios ADD COLUMN codigo_hash TEXT")

    conn.executescript(ler_schema_idempotente())
    conn.commit()
    conn.close()
