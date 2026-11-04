import json
from datetime import datetime, timedelta
from database import get_connection


def registrar_corrida_manual(usuario_id, data, km, duracao_segundos=None):

    conn = get_connection()
    conn.execute(
        """
        INSERT INTO corridas (usuario_id, data, distancia_km, duracao_segundos, fonte)
        VALUES (?, ?, ?, ?, 'manual')
        """,
        (usuario_id, data, km, duracao_segundos)
    )
    conn.commit()
    conn.close()


def registrar_corrida_app(usuario_id, km, duracao_segundos, percurso):

    data = datetime.now().strftime("%Y-%m-%d")
    percurso_json = json.dumps(percurso)

    conn = get_connection()
    conn.execute(
        """
        INSERT INTO corridas (usuario_id, data, distancia_km, duracao_segundos, fonte, percurso_gps)
        VALUES (?, ?, ?, ?, 'app', ?)
        """,
        (usuario_id, data, km, duracao_segundos, percurso_json)
    )
    conn.commit()
    conn.close()


def get_corrida_detalhe(corrida_id, usuario_id):

    conn = get_connection()
    linha = conn.execute(
        """
        SELECT id, data, distancia_km, duracao_segundos, fonte, percurso_gps
        FROM corridas
        WHERE id = ? AND usuario_id = ?
        """,
        (corrida_id, usuario_id)
    ).fetchone()
    conn.close()

    if not linha:
        return None

    resultado = dict(linha)
    resultado["percurso"] = json.loads(resultado["percurso_gps"]) if resultado["percurso_gps"] else []
    del resultado["percurso_gps"]
    return resultado


def get_total_semana(usuario_id):

    hoje = datetime.now()
    data_inicio = (hoje - timedelta(days=6)).strftime("%Y-%m-%d")
    data_fim = hoje.strftime("%Y-%m-%d")

    conn = get_connection()
    resultado = conn.execute(
        """
        SELECT COALESCE(SUM(distancia_km), 0) as total
        FROM corridas
        WHERE usuario_id = ? AND data BETWEEN ? AND ?
        """,
        (usuario_id, data_inicio, data_fim)
    ).fetchone()
    conn.close()

    return round(resultado["total"], 2)
