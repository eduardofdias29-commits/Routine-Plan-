from datetime import datetime
from database import get_connection


def registrar_agua(usuario_id, ml, horario=None):
    if horario is None:
        horario = datetime.now().strftime("%H:%M")

    data_hoje = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()
    conn.execute(
        "INSERT INTO hidratacao (usuario_id, data, ml_registrado, horario) VALUES (?, ?, ?, ?)",
        (usuario_id, data_hoje, ml, horario)
    )
    conn.commit()
    conn.close()

    return get_total_hoje(usuario_id)


def get_total_hoje(usuario_id, data=None):
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()
    resultado = conn.execute(
        "SELECT COALESCE(SUM(ml_registrado), 0) as total FROM hidratacao WHERE usuario_id = ? AND data = ?",
        (usuario_id, data)
    ).fetchone()
    conn.close()

    return resultado["total"]


def get_meta_agua(usuario_id):
    conn = get_connection()
    resultado = conn.execute("SELECT meta_agua_ml FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    conn.close()
    return resultado["meta_agua_ml"] if resultado else 4000


def criar_horario(usuario_id, hora_inicio, hora_fim, quantidade_ml):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO horarios_agua (usuario_id, hora_inicio, hora_fim, quantidade_ml) VALUES (?, ?, ?, ?)",
        (usuario_id, hora_inicio, hora_fim, quantidade_ml)
    )
    conn.commit()
    novo_id = cursor.lastrowid
    conn.close()
    return novo_id


def listar_horarios(usuario_id):
    conn = get_connection()
    linhas = conn.execute(
        "SELECT * FROM horarios_agua WHERE usuario_id = ? ORDER BY hora_inicio",
        (usuario_id,)
    ).fetchall()
    conn.close()
    return [dict(linha) for linha in linhas]


def remover_horario(horario_id):
    conn = get_connection()
    conn.execute("DELETE FROM horarios_agua WHERE id = ?", (horario_id,))
    conn.commit()
    conn.close()


def get_bloco_atual(usuario_id):
    agora = datetime.now().strftime("%H:%M")
    horarios = listar_horarios(usuario_id)

    bloco_ativo = None
    for bloco in horarios:
        if bloco["hora_inicio"] <= agora <= bloco["hora_fim"]:
            bloco_ativo = bloco
            break

    if not bloco_ativo:
        return None

    data_hoje = datetime.now().strftime("%Y-%m-%d")
    conn = get_connection()
    resultado = conn.execute(
        """
        SELECT COALESCE(SUM(ml_registrado), 0) as total
        FROM hidratacao
        WHERE usuario_id = ? AND data = ? AND horario BETWEEN ? AND ?
        """,
        (usuario_id, data_hoje, bloco_ativo["hora_inicio"], bloco_ativo["hora_fim"])
    ).fetchone()
    conn.close()

    return {
        "id": bloco_ativo["id"],
        "hora_inicio": bloco_ativo["hora_inicio"],
        "hora_fim": bloco_ativo["hora_fim"],
        "meta_ml": bloco_ativo["quantidade_ml"],
        "bebido_ml": resultado["total"]
    }


def horario_pertence(usuario_id, horario_id):
    conn = get_connection()
    linha = conn.execute(
        "SELECT 1 FROM horarios_agua WHERE id = ? AND usuario_id = ?",
        (horario_id, usuario_id)
    ).fetchone()
    conn.close()
    return linha is not None
