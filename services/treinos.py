from datetime import datetime
from database import get_connection


def get_exercicios(treino_planejado_id, conn=None, data=None):
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")

    fechar_no_final = conn is None
    if conn is None:
        conn = get_connection()

    linhas = conn.execute(
        """
        SELECT e.id, e.series, e.repeticoes, e.carga_kg, e.ordem,
               b.id AS biblioteca_exercicio_id, b.nome, b.grupo_muscular, b.descricao, b.midia_arquivo,
               COALESCE(er.concluido, 0) AS concluido
        FROM exercicios e
        JOIN biblioteca_exercicios b ON b.id = e.biblioteca_exercicio_id
        LEFT JOIN exercicios_realizados er ON er.exercicio_id = e.id AND er.data = ?
        WHERE e.treino_planejado_id = ?
        ORDER BY e.ordem
        """,
        (data, treino_planejado_id)
    ).fetchall()

    if fechar_no_final:
        conn.close()

    return [dict(linha) for linha in linhas]


def marcar_exercicio(usuario_id, exercicio_id, concluido, data=None):
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()
    existente = conn.execute(
        "SELECT id FROM exercicios_realizados WHERE exercicio_id = ? AND data = ?",
        (exercicio_id, data)
    ).fetchone()

    if existente:
        conn.execute(
            "UPDATE exercicios_realizados SET concluido = ? WHERE id = ?",
            (1 if concluido else 0, existente["id"])
        )
    else:
        conn.execute(
            "INSERT INTO exercicios_realizados (usuario_id, exercicio_id, data, concluido) VALUES (?, ?, ?, ?)",
            (usuario_id, exercicio_id, data, 1 if concluido else 0)
        )

    conn.commit()
    conn.close()


def adicionar_exercicio(treino_planejado_id, biblioteca_exercicio_id, series, repeticoes, carga_kg, ordem):
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO exercicios (treino_planejado_id, biblioteca_exercicio_id, series, repeticoes, carga_kg, ordem)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (treino_planejado_id, biblioteca_exercicio_id, series, repeticoes, carga_kg, ordem)
    )
    conn.commit()
    conn.close()


def remover_exercicio(exercicio_id):
    conn = get_connection()
    conn.execute("DELETE FROM exercicios WHERE id = ?", (exercicio_id,))
    conn.commit()
    conn.close()


def marcar_treino_concluido(usuario_id, treino_planejado_id, data=None):
    if data is None:
        data = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()
    existente = conn.execute(
        "SELECT id FROM treinos_realizados WHERE usuario_id = ? AND treino_planejado_id = ? AND data = ?",
        (usuario_id, treino_planejado_id, data)
    ).fetchone()

    if existente:
        conn.execute("UPDATE treinos_realizados SET concluido = 1 WHERE id = ?", (existente["id"],))
    else:
        conn.execute(
            "INSERT INTO treinos_realizados (usuario_id, treino_planejado_id, data, concluido) VALUES (?, ?, ?, 1)",
            (usuario_id, treino_planejado_id, data)
        )

    conn.commit()
    conn.close()


def listar_modelos(usuario_id, quantidade_miniaturas=3):
    conn = get_connection()
    modelos = conn.execute(
        "SELECT id, nome_treino FROM treinos_planejados WHERE usuario_id = ? ORDER BY nome_treino",
        (usuario_id,)
    ).fetchall()

    resultado = []
    for modelo in modelos:
        imagens = conn.execute(
            """
            SELECT b.midia_arquivo
            FROM exercicios e
            JOIN biblioteca_exercicios b ON b.id = e.biblioteca_exercicio_id
            WHERE e.treino_planejado_id = ?
            ORDER BY e.ordem
            """,
            (modelo["id"],)
        ).fetchall()

        item = dict(modelo)
        item["total_exercicios"] = len(imagens)
        item["miniaturas"] = [linha["midia_arquivo"] for linha in imagens[:quantidade_miniaturas]]
        resultado.append(item)

    conn.close()
    return resultado


def criar_modelo(usuario_id, nome_treino):
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO treinos_planejados (usuario_id, dia_semana, nome_treino) VALUES (?, -1, ?)",
        (usuario_id, nome_treino)
    )
    conn.commit()
    modelo_id = cursor.lastrowid
    conn.close()
    return modelo_id


def renomear_modelo(modelo_id, novo_nome):
    conn = get_connection()
    conn.execute("UPDATE treinos_planejados SET nome_treino = ? WHERE id = ?", (novo_nome, modelo_id))
    conn.commit()
    conn.close()


def excluir_modelo(modelo_id):
    conn = get_connection()
    conn.execute("DELETE FROM semana_modelo WHERE treino_planejado_id = ?", (modelo_id,))
    conn.execute("DELETE FROM exercicios WHERE treino_planejado_id = ?", (modelo_id,))
    conn.execute("DELETE FROM treinos_planejados WHERE id = ?", (modelo_id,))
    conn.commit()
    conn.close()


def modelo_pertence(usuario_id, modelo_id):
    conn = get_connection()
    linha = conn.execute(
        "SELECT 1 FROM treinos_planejados WHERE id = ? AND usuario_id = ?",
        (modelo_id, usuario_id)
    ).fetchone()
    conn.close()
    return linha is not None


def exercicio_pertence(usuario_id, exercicio_id):
    conn = get_connection()
    linha = conn.execute(
        """
        SELECT 1
        FROM exercicios e
        JOIN treinos_planejados t ON t.id = e.treino_planejado_id
        WHERE e.id = ? AND t.usuario_id = ?
        """,
        (exercicio_id, usuario_id)
    ).fetchone()
    conn.close()
    return linha is not None
