import os
import re
import sqlite3

PASTA_PROJETO = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DATABASE_PATH") or os.path.join(PASTA_PROJETO, "database.db")


def _url_postgres():
    url = os.environ.get("DATABASE_URL", "").strip()
    return url if url.startswith(("postgres://", "postgresql://")) else None


USA_POSTGRES = _url_postgres() is not None

if USA_POSTGRES:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool

    IntegrityError = psycopg2.IntegrityError
else:
    IntegrityError = sqlite3.IntegrityError

_pool = None


def _obter_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            1,
            int(os.environ.get("DB_POOL_MAX", "8")),
            _url_postgres(),
            cursor_factory=psycopg2.extras.DictCursor,
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5,
            connect_timeout=15,
        )
    return _pool


def _traduzir_sql(sql):
    sql = sql.replace("%", "%%").replace("?", "%s")
    return re.sub(r"\bLIKE\b", "ILIKE", sql)


class _Cursor:
    def __init__(self, cursor, lastrowid=None):
        self._cursor = cursor
        self.lastrowid = lastrowid

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def __iter__(self):
        return iter(self._cursor.fetchall())


class _ConexaoPostgres:
    def __init__(self, pool, conexao):
        self._pool = pool
        self._conexao = conexao

    def execute(self, sql, params=()):
        sql = _traduzir_sql(sql)
        insere = sql.lstrip().upper().startswith("INSERT")
        if insere and "RETURNING" not in sql.upper():
            sql = sql.rstrip().rstrip(";") + " RETURNING id"
        cursor = self._conexao.cursor()
        cursor.execute(sql, tuple(params))
        lastrowid = cursor.fetchone()[0] if insere else None
        return _Cursor(cursor, lastrowid)

    def executemany(self, sql, lote):
        lote = list(lote)
        if not lote:
            return
        cursor = self._conexao.cursor()
        cursor.executemany(_traduzir_sql(sql), lote)

    def commit(self):
        self._conexao.commit()

    def rollback(self):
        self._conexao.rollback()

    def close(self):
        if self._conexao is None:
            return
        try:
            if self._conexao.closed:
                self._pool.putconn(self._conexao, close=True)
            else:
                self._conexao.rollback()
                self._pool.putconn(self._conexao)
        finally:
            self._conexao = None


def _conectar_postgres():
    pool = _obter_pool()
    for _ in range(3):
        conexao = pool.getconn()
        try:
            cursor = conexao.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            conexao.rollback()
            return _ConexaoPostgres(pool, conexao)
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            pool.putconn(conexao, close=True)
    conexao = pool.getconn()
    return _ConexaoPostgres(pool, conexao)


def get_connection():
    if USA_POSTGRES:
        return _conectar_postgres()
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


def _schema_postgres():
    schema = ler_schema_idempotente()
    schema = re.sub(r"^\s*FOREIGN KEY.*$", "", schema, flags=re.MULTILINE)
    schema = re.sub(r",(\s*\n\s*\);)", r"\1", schema)
    schema = re.sub(r"\bINTEGER PRIMARY KEY\b", "SERIAL PRIMARY KEY", schema)
    schema = re.sub(r"\bDATE\b", "TEXT", schema)
    schema = re.sub(r"\bBOOLEAN\b", "INTEGER", schema)
    schema = re.sub(r"\bREAL\b", "DOUBLE PRECISION", schema)
    return schema


def _iniciar_banco_postgres():
    conexao = psycopg2.connect(_url_postgres(), connect_timeout=15)
    try:
        cursor = conexao.cursor()
        cursor.execute("SELECT pg_advisory_lock(20260101)")
        cursor.execute(_schema_postgres())
        cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_hash TEXT")
        cursor.execute("SELECT pg_advisory_unlock(20260101)")
        conexao.commit()
    finally:
        conexao.close()


def iniciar_banco():
    if USA_POSTGRES:
        _iniciar_banco_postgres()
        return

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
