import hashlib
import secrets

from database import get_connection, IntegrityError

ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TAMANHO_CODIGO = 10


def _gerar_codigo():
    return "".join(secrets.choice(ALFABETO) for _ in range(TAMANHO_CODIGO))


def formatar_codigo(codigo):
    return f"{codigo[:5]}-{codigo[5:]}"


def _hash_codigo(codigo):
    normalizado = (codigo or "").upper().replace("-", "").replace(" ", "")
    return hashlib.sha256(normalizado.encode("utf-8")).hexdigest()


def get_usuario(usuario_id):
    conn = get_connection()
    usuario = conn.execute(
        "SELECT id, nome, meta_agua_ml, meta_km_semanal FROM usuarios WHERE id = ?",
        (usuario_id,)
    ).fetchone()
    conn.close()
    return dict(usuario) if usuario else None


def criar_usuario_com_codigo(nome, meta_agua_ml=4000, meta_km_semanal=10):
    while True:
        codigo = _gerar_codigo()
        conn = get_connection()
        try:
            cursor = conn.execute(
                "INSERT INTO usuarios (nome, meta_agua_ml, meta_km_semanal, codigo_hash) VALUES (?, ?, ?, ?)",
                (nome, meta_agua_ml, meta_km_semanal, _hash_codigo(codigo))
            )
            conn.commit()
            return cursor.lastrowid, formatar_codigo(codigo)
        except IntegrityError:
            continue
        finally:
            conn.close()


def entrar_com_codigo(codigo):
    conn = get_connection()
    linha = conn.execute(
        "SELECT id FROM usuarios WHERE codigo_hash = ?",
        (_hash_codigo(codigo),)
    ).fetchone()
    conn.close()
    return linha["id"] if linha else None


def gerar_novo_codigo(usuario_id):
    while True:
        codigo = _gerar_codigo()
        conn = get_connection()
        try:
            conn.execute(
                "UPDATE usuarios SET codigo_hash = ? WHERE id = ?",
                (_hash_codigo(codigo), usuario_id)
            )
            conn.commit()
            return formatar_codigo(codigo)
        except IntegrityError:
            continue
        finally:
            conn.close()


def listar_sem_codigo():
    conn = get_connection()
    linhas = conn.execute(
        "SELECT id, nome FROM usuarios WHERE codigo_hash IS NULL ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(linha) for linha in linhas]


def atualizar_perfil(usuario_id, nome, meta_agua_ml, meta_km_semanal):
    conn = get_connection()
    conn.execute(
        "UPDATE usuarios SET nome = ?, meta_agua_ml = ?, meta_km_semanal = ? WHERE id = ?",
        (nome, meta_agua_ml, meta_km_semanal, usuario_id)
    )
    conn.commit()
    conn.close()
