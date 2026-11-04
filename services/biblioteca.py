import unicodedata
from database import get_connection


def listar_todos(grupo_muscular=None):

    conn = get_connection()

    if grupo_muscular:
        linhas = conn.execute(
            "SELECT * FROM biblioteca_exercicios WHERE grupo_muscular = ? ORDER BY nome",
            (grupo_muscular,)
        ).fetchall()
    else:
        linhas = conn.execute(
            "SELECT * FROM biblioteca_exercicios ORDER BY grupo_muscular, nome"
        ).fetchall()

    conn.close()
    return [dict(linha) for linha in linhas]


def buscar_por_nome(termo):

    conn = get_connection()
    linhas = conn.execute(
        "SELECT * FROM biblioteca_exercicios WHERE nome LIKE ? ORDER BY nome LIMIT 50",
        (f"%{termo}%",)
    ).fetchall()
    conn.close()
    return [dict(linha) for linha in linhas]


def criar_exercicio(nome, grupo_muscular, descricao, midia_arquivo):

    conn = get_connection()
    cursor = conn.execute(
        """
        INSERT INTO biblioteca_exercicios (nome, grupo_muscular, descricao, midia_arquivo)
        VALUES (?, ?, ?, ?)
        """,
        (nome, grupo_muscular, descricao, midia_arquivo)
    )
    conn.commit()
    novo_id = cursor.lastrowid
    conn.close()
    return novo_id


def listar_grupos_musculares():

    conn = get_connection()
    linhas = conn.execute(
        "SELECT DISTINCT grupo_muscular FROM biblioteca_exercicios ORDER BY grupo_muscular"
    ).fetchall()
    conn.close()
    return [linha["grupo_muscular"] for linha in linhas]


def atualizar_nome(exercicio_id, novo_nome):
    conn = get_connection()
    conn.execute(
        "UPDATE biblioteca_exercicios SET nome = ? WHERE id = ?",
        (novo_nome, exercicio_id)
    )
    conn.commit()
    conn.close()


def buscar_por_nome_exato(nome):
    conn = get_connection()
    linha = conn.execute(
        "SELECT * FROM biblioteca_exercicios WHERE nome = ?",
        (nome,)
    ).fetchone()
    conn.close()
    return dict(linha) if linha else None


def _normalizar(texto):
    texto = unicodedata.normalize("NFD", texto or "")
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto.lower()


def pesquisar(termo="", grupo_muscular=None, limite=60):
    conn = get_connection()

    if grupo_muscular:
        linhas = conn.execute(
            "SELECT * FROM biblioteca_exercicios WHERE grupo_muscular = ?",
            (grupo_muscular,)
        ).fetchall()
    else:
        linhas = conn.execute("SELECT * FROM biblioteca_exercicios").fetchall()

    conn.close()

    termo_norm = _normalizar(termo.strip())
    palavras = termo_norm.split()

    achados = []
    for linha in linhas:
        nome_norm = _normalizar(linha["nome"])
        if all(p in nome_norm for p in palavras):
            achados.append((
                nome_norm.startswith(termo_norm),
                _normalizar(linha["grupo_muscular"]),
                nome_norm,
                dict(linha)
            ))

    achados.sort(key=lambda t: (not t[0], t[1], t[2]))
    exercicios = [t[3] for t in achados]

    return {"total": len(exercicios), "exercicios": exercicios[:limite]}
