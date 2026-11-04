from datetime import date, timedelta
from database import get_connection
from services.treinos import get_exercicios

DIAS_ANTES_DE_HOJE = 5


def get_treino_do_dia_real(usuario_id, data_str=None):
    if data_str is None:
        data_str = date.today().isoformat()

    conn = get_connection()
    agendamento = conn.execute(
        "SELECT treino_planejado_id FROM agenda_treino WHERE usuario_id = ? AND data = ?",
        (usuario_id, data_str)
    ).fetchone()

    if not agendamento or agendamento["treino_planejado_id"] is None:
        conn.close()
        return None

    treino = conn.execute(
        "SELECT id, nome_treino FROM treinos_planejados WHERE id = ?",
        (agendamento["treino_planejado_id"],)
    ).fetchone()

    if not treino:
        conn.close()
        return None

    exercicios = get_exercicios(treino["id"], conn, data_str)
    conn.close()

    return {"id": treino["id"], "nome_treino": treino["nome_treino"], "exercicios": exercicios}


def definir_dia(usuario_id, data_str, treino_planejado_id):
    conn = get_connection()
    existente = conn.execute(
        "SELECT id FROM agenda_treino WHERE usuario_id = ? AND data = ?",
        (usuario_id, data_str)
    ).fetchone()

    if existente:
        conn.execute(
            "UPDATE agenda_treino SET treino_planejado_id = ? WHERE id = ?",
            (treino_planejado_id, existente["id"])
        )
    else:
        conn.execute(
            "INSERT INTO agenda_treino (usuario_id, data, treino_planejado_id) VALUES (?, ?, ?)",
            (usuario_id, data_str, treino_planejado_id)
        )

    conn.commit()
    conn.close()


def remover_agendamento(usuario_id, data_str):
    conn = get_connection()
    conn.execute("DELETE FROM agenda_treino WHERE usuario_id = ? AND data = ?", (usuario_id, data_str))
    conn.commit()
    conn.close()


def get_periodo(usuario_id, quantidade_meses=1):
    hoje = date.today()
    primeiro_dia_visivel = hoje - timedelta(days=DIAS_ANTES_DE_HOJE)

    conn = get_connection()

    agendamentos = conn.execute(
        "SELECT data, treino_planejado_id FROM agenda_treino WHERE usuario_id = ?",
        (usuario_id,)
    ).fetchall()
    mapa_agendamentos = {a["data"]: a["treino_planejado_id"] for a in agendamentos}

    modelos = conn.execute(
        "SELECT id, nome_treino FROM treinos_planejados WHERE usuario_id = ?",
        (usuario_id,)
    ).fetchall()
    mapa_modelos = {m["id"]: m["nome_treino"] for m in modelos}

    concluidos_geral = conn.execute(
        "SELECT data, treino_planejado_id FROM treinos_realizados WHERE usuario_id = ? AND concluido = 1",
        (usuario_id,)
    ).fetchall()
    set_concluidos_geral = {(c["data"], c["treino_planejado_id"]) for c in concluidos_geral}

    conn.close()

    nomes_dias_semana = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
    nomes_meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

    meses_resultado = []

    for i in range(-1, quantidade_meses):
        indice_mes_total = (hoje.month - 1) + i
        ano = hoje.year + indice_mes_total // 12
        mes = indice_mes_total % 12 + 1

        if mes == 12:
            proximo_mes = date(ano + 1, 1, 1)
        else:
            proximo_mes = date(ano, mes + 1, 1)
        ultimo_dia = (proximo_mes - timedelta(days=1)).day

        dias_do_mes = []

        for dia_num in range(1, ultimo_dia + 1):
            d = date(ano, mes, dia_num)
            if d < primeiro_dia_visivel:
                continue
            data_str = d.isoformat()
            treino_id = mapa_agendamentos.get(data_str, "nao_definido")

            if treino_id == "nao_definido":
                nome = None
                status = "indefinido"
                concluido = False
            elif treino_id is None:
                nome = "Descanso"
                status = "descanso"
                concluido = False
            else:
                nome = mapa_modelos.get(treino_id, "?")
                status = "agendado"
                concluido = (data_str, treino_id) in set_concluidos_geral

            dias_do_mes.append({
                "data": data_str,
                "dia_semana_nome": nomes_dias_semana[d.weekday()],
                "dia_mes": d.day,
                "treino_id": treino_id if treino_id != "nao_definido" else None,
                "treino_nome": nome,
                "status": status,
                "eh_hoje": d == hoje,
                "eh_passado": d < hoje,
                "concluido": concluido
            })

        if dias_do_mes:
            meses_resultado.append({
                "ano": ano,
                "mes": mes,
                "mes_nome": nomes_meses[mes - 1],
                "dias": dias_do_mes
            })

    return meses_resultado


def formatar_duracao(segundos):
    if not segundos:
        return None
    minutos = round(segundos / 60)
    horas, resto = divmod(minutos, 60)
    if horas:
        return f"{horas}h{resto:02d}"
    return f"{minutos}min"


def get_historico_consolidado(usuario_id, limite_dias=60):
    conn = get_connection()

    treinos_feitos = conn.execute(
        """
        SELECT tr.data, tp.nome_treino
        FROM treinos_realizados tr
        JOIN treinos_planejados tp ON tp.id = tr.treino_planejado_id
        WHERE tr.usuario_id = ? AND tr.concluido = 1
        ORDER BY tr.data DESC
        LIMIT ?
        """,
        (usuario_id, limite_dias)
    ).fetchall()

    corridas_feitas = conn.execute(
        """
        SELECT id, data, distancia_km, duracao_segundos, fonte
        FROM corridas
        WHERE usuario_id = ?
        ORDER BY data DESC
        LIMIT ?
        """,
        (usuario_id, limite_dias)
    ).fetchall()
    conn.close()

    mapa_por_data = {}

    for t in treinos_feitos:
        data = t["data"]
        mapa_por_data.setdefault(data, {"data": data, "treinos": [], "corridas": []})
        mapa_por_data[data]["treinos"].append(t["nome_treino"])

    for c in corridas_feitas:
        data = c["data"]
        mapa_por_data.setdefault(data, {"data": data, "treinos": [], "corridas": []})
        mapa_por_data[data]["corridas"].append({
            "id": c["id"],
            "km": c["distancia_km"],
            "duracao_min": formatar_duracao(c["duracao_segundos"]),
            "fonte": c["fonte"]
        })

    dias_ordenados = sorted(mapa_por_data.values(), key=lambda d: d["data"], reverse=True)
    return dias_ordenados
