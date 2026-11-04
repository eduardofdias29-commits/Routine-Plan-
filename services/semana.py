from datetime import date, timedelta

from database import get_connection

GRUPOS_IGNORADOS = {"Abdômen", "Pescoço", "Outros"}
PARTICIPACAO_MINIMA = 0.3
DIAS_POR_QUANTIDADE = {
    1: [2],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5]
}

NOMES_DIAS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
MAX_SEMANAS = 26


def get_semana(usuario_id):
    conn = get_connection()
    linhas = conn.execute(
        "SELECT dia_semana, treino_planejado_id FROM semana_modelo WHERE usuario_id = ?",
        (usuario_id,)
    ).fetchall()
    conn.close()

    definidos = {linha["dia_semana"]: linha["treino_planejado_id"] for linha in linhas}

    return [
        {
            "dia_semana": dia,
            "nome": NOMES_DIAS[dia],
            "definido": dia in definidos,
            "treino_id": definidos.get(dia)
        }
        for dia in range(7)
    ]


def definir_dia_semana(usuario_id, dia_semana, treino_planejado_id):
    conn = get_connection()
    existente = conn.execute(
        "SELECT id FROM semana_modelo WHERE usuario_id = ? AND dia_semana = ?",
        (usuario_id, dia_semana)
    ).fetchone()

    if existente:
        conn.execute(
            "UPDATE semana_modelo SET treino_planejado_id = ? WHERE id = ?",
            (treino_planejado_id, existente["id"])
        )
    else:
        conn.execute(
            "INSERT INTO semana_modelo (usuario_id, dia_semana, treino_planejado_id) VALUES (?, ?, ?)",
            (usuario_id, dia_semana, treino_planejado_id)
        )

    conn.commit()
    conn.close()


def limpar_dia_semana(usuario_id, dia_semana):
    conn = get_connection()
    conn.execute(
        "DELETE FROM semana_modelo WHERE usuario_id = ? AND dia_semana = ?",
        (usuario_id, dia_semana)
    )
    conn.commit()
    conn.close()


def aplicar_no_calendario(usuario_id, semanas):
    semanas = max(1, min(int(semanas), MAX_SEMANAS))
    hoje = date.today()

    conn = get_connection()

    modelo = {
        linha["dia_semana"]: linha["treino_planejado_id"]
        for linha in conn.execute(
            "SELECT dia_semana, treino_planejado_id FROM semana_modelo WHERE usuario_id = ?",
            (usuario_id,)
        )
    }

    ja_decididos = {
        linha["data"]
        for linha in conn.execute(
            "SELECT data FROM agenda_treino WHERE usuario_id = ?",
            (usuario_id,)
        )
    }

    novos = []
    for deslocamento in range(7 * semanas):
        dia = hoje + timedelta(days=deslocamento)
        data_str = dia.isoformat()
        if dia.weekday() in modelo and data_str not in ja_decididos:
            novos.append((usuario_id, data_str, modelo[dia.weekday()]))

    conn.executemany(
        "INSERT INTO agenda_treino (usuario_id, data, treino_planejado_id) VALUES (?, ?, ?)",
        novos
    )
    conn.commit()
    conn.close()

    return len(novos)


def _grupos_principais_por_treino(conn, usuario_id):
    ids = [
        linha["id"]
        for linha in conn.execute(
            "SELECT id FROM treinos_planejados WHERE usuario_id = ? ORDER BY id",
            (usuario_id,)
        )
    ]

    contagem = {treino_id: {} for treino_id in ids}
    linhas = conn.execute(
        """
        SELECT e.treino_planejado_id AS treino_id, b.grupo_muscular AS grupo
        FROM exercicios e
        JOIN biblioteca_exercicios b ON b.id = e.biblioteca_exercicio_id
        JOIN treinos_planejados t ON t.id = e.treino_planejado_id
        WHERE t.usuario_id = ?
        """,
        (usuario_id,)
    ).fetchall()

    for linha in linhas:
        if linha["grupo"] in GRUPOS_IGNORADOS:
            continue
        grupos = contagem[linha["treino_id"]]
        grupos[linha["grupo"]] = grupos.get(linha["grupo"], 0) + 1

    principais = {}
    for treino_id, grupos in contagem.items():
        total = sum(grupos.values())
        principais[treino_id] = {
            grupo for grupo, quantidade in grupos.items()
            if total and quantidade / total >= PARTICIPACAO_MINIMA
        }

    return ids, principais


def sugerir(usuario_id, dias_por_semana):
    dias_por_semana = max(1, min(int(dias_por_semana), 6))

    conn = get_connection()
    ids, grupos = _grupos_principais_por_treino(conn, usuario_id)
    conn.close()

    if not ids:
        return None

    usos = {treino_id: 0 for treino_id in ids}
    escolhidos = {}
    anterior = None
    conflitos = 0

    for dia in DIAS_POR_QUANTIDADE[dias_por_semana]:
        minimo = min(usos.values())
        melhor = None

        for ordem, treino_id in enumerate(ids):
            seguido = anterior is not None and dia - anterior[0] == 1
            repete_grupo = seguido and bool(grupos[treino_id] & grupos[anterior[1]])
            pontuacao = (2 if repete_grupo else 0) + (usos[treino_id] - minimo)

            if melhor is None or (pontuacao, ordem) < (melhor[0], melhor[1]):
                melhor = (pontuacao, ordem, treino_id, repete_grupo)

        _, _, escolhido, repetiu = melhor
        escolhidos[dia] = escolhido
        usos[escolhido] += 1
        anterior = (dia, escolhido)
        if repetiu:
            conflitos += 1

    for dia in range(7):
        definir_dia_semana(usuario_id, dia, escolhidos.get(dia))

    return {"dias_por_semana": dias_por_semana, "conflitos": conflitos}

