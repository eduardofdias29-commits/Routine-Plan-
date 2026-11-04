import os
import secrets
import time
from datetime import timedelta
from functools import wraps

from flask import Flask, render_template, request, jsonify, session

from configurar import preparar_ambiente
from database import PASTA_PROJETO
from services import treinos, hidratacao, corridas, biblioteca, usuarios, agenda, semana

NICK_MAX = 30
TENTATIVAS_MAX = 10
JANELA_SEGUNDOS = 600


def carregar_chave_secreta():
    chave = os.environ.get("SECRET_KEY")
    if chave:
        return chave

    caminho = os.path.join(PASTA_PROJETO, ".secret_key")
    if not os.path.exists(caminho):
        with open(caminho, "w") as f:
            f.write(secrets.token_hex(32))
    with open(caminho) as f:
        return f.read().strip()


preparar_ambiente()

app = Flask(__name__)
app.secret_key = carregar_chave_secreta()
app.permanent_session_lifetime = timedelta(days=365)
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True

tentativas_codigo = {}


def usuario_atual_id():
    uid = session.get("usuario_id")
    if uid is None:
        return None
    if usuarios.get_usuario(uid) is None:
        session.pop("usuario_id", None)
        return None
    return uid


def id_para_leitura():
    return usuario_atual_id() or 0


def login_obrigatorio(funcao):
    @wraps(funcao)
    def embrulho(*args, **kwargs):
        uid = usuario_atual_id()
        if uid is None:
            return jsonify({"erro": "login_necessario"}), 401
        return funcao(uid, *args, **kwargs)
    return embrulho


def nao_encontrado():
    return jsonify({"erro": "não encontrado"}), 404


def limpar_nick(texto):
    return (texto or "").strip()[:NICK_MAX]


def excedeu_tentativas(ip):
    agora = time.time()
    recentes = [t for t in tentativas_codigo.get(ip, []) if agora - t < JANELA_SEGUNDOS]
    tentativas_codigo[ip] = recentes
    return len(recentes) >= TENTATIVAS_MAX


def registrar_tentativa(ip):
    tentativas_codigo.setdefault(ip, []).append(time.time())


def iniciar_sessao(usuario_id):
    session.clear()
    session["usuario_id"] = usuario_id
    session.permanent = True


@app.route("/")
def dashboard():
    return render_template("index.html")


@app.route("/treinos")
def pagina_treinos():
    return render_template("treinos.html")


@app.route("/historico")
def pagina_historico():
    return render_template("historico.html")


@app.route("/corrida")
def pagina_corrida():
    return render_template("corrida.html")


@app.route("/corrida/<int:corrida_id>")
def pagina_detalhe_corrida(corrida_id):
    return render_template("corrida_detalhe.html", corrida_id=corrida_id)


@app.route("/biblioteca")
def pagina_biblioteca():
    return render_template("biblioteca.html")


@app.route("/perfil")
def pagina_perfil():
    return render_template("perfil.html")


@app.route("/api/entrar", methods=["POST"])
def api_entrar():
    dados = request.get_json(silent=True) or {}
    nome = limpar_nick(dados.get("nome"))
    if not nome:
        return jsonify({"erro": "nick_vazio"}), 400

    usuario_id, codigo = usuarios.criar_usuario_com_codigo(nome)
    iniciar_sessao(usuario_id)
    return jsonify({"status": "ok", "id": usuario_id, "nome": nome, "codigo": codigo})


@app.route("/api/entrar-codigo", methods=["POST"])
def api_entrar_com_codigo():
    ip = request.remote_addr or "desconhecido"
    if excedeu_tentativas(ip):
        return jsonify({"erro": "muitas_tentativas"}), 429

    dados = request.get_json(silent=True) or {}
    usuario_id = usuarios.entrar_com_codigo(dados.get("codigo"))
    if usuario_id is None:
        registrar_tentativa(ip)
        return jsonify({"erro": "codigo_invalido"}), 404

    iniciar_sessao(usuario_id)
    usuario = usuarios.get_usuario(usuario_id)
    return jsonify({"status": "ok", "id": usuario_id, "nome": usuario["nome"]})


@app.route("/api/sair", methods=["POST"])
def api_sair():
    session.clear()
    return jsonify({"status": "ok"})


@app.route("/api/codigo/novo", methods=["POST"])
@login_obrigatorio
def api_novo_codigo(uid):
    return jsonify({"status": "ok", "codigo": usuarios.gerar_novo_codigo(uid)})


@app.route("/api/perfil")
def api_get_perfil():
    uid = usuario_atual_id()
    if uid is None:
        return jsonify({
            "id": None,
            "nome": "Visitante",
            "meta_agua_ml": 4000,
            "meta_km_semanal": 10,
            "convidado": True
        })
    usuario = usuarios.get_usuario(uid)
    usuario["convidado"] = False
    return jsonify(usuario)


@app.route("/api/perfil", methods=["POST"])
@login_obrigatorio
def api_atualizar_perfil(uid):
    dados = request.json
    nome = limpar_nick(dados["nome"]) or usuarios.get_usuario(uid)["nome"]
    usuarios.atualizar_perfil(uid, nome, dados["meta_agua_ml"], dados["meta_km_semanal"])
    return jsonify({"status": "ok"})


@app.route("/api/treinos/hoje")
def api_treino_hoje():
    return jsonify(agenda.get_treino_do_dia_real(id_para_leitura()))


@app.route("/api/agenda")
def api_get_agenda():
    quantidade = request.args.get("meses", default=1, type=int)
    return jsonify(agenda.get_periodo(id_para_leitura(), quantidade))


@app.route("/api/agenda/dia", methods=["POST"])
@login_obrigatorio
def api_definir_dia(uid):
    dados = request.json
    treino_id = dados.get("treino_planejado_id")
    if treino_id is not None and not treinos.modelo_pertence(uid, treino_id):
        return nao_encontrado()
    agenda.definir_dia(uid, dados["data"], treino_id)
    return jsonify({"status": "ok"})


@app.route("/api/agenda/dia/<data>", methods=["DELETE"])
@login_obrigatorio
def api_remover_dia(uid, data):
    agenda.remover_agendamento(uid, data)
    return jsonify({"status": "ok"})


@app.route("/api/semana-modelo")
def api_get_semana_modelo():
    return jsonify(semana.get_semana(id_para_leitura()))


@app.route("/api/semana-modelo/<int:dia_semana>", methods=["POST"])
@login_obrigatorio
def api_definir_dia_semana(uid, dia_semana):
    if dia_semana < 0 or dia_semana > 6:
        return nao_encontrado()

    dados = request.get_json(silent=True) or {}
    treino_id = dados.get("treino_planejado_id")

    if treino_id is not None and not treinos.modelo_pertence(uid, treino_id):
        return nao_encontrado()

    semana.definir_dia_semana(uid, dia_semana, treino_id)
    return jsonify({"status": "ok"})


@app.route("/api/semana-modelo/<int:dia_semana>", methods=["DELETE"])
@login_obrigatorio
def api_limpar_dia_semana(uid, dia_semana):
    semana.limpar_dia_semana(uid, dia_semana)
    return jsonify({"status": "ok"})


@app.route("/api/semana-modelo/sugerir", methods=["POST"])
@login_obrigatorio
def api_sugerir_semana_modelo(uid):
    dados = request.get_json(silent=True) or {}
    resultado = semana.sugerir(uid, dados.get("dias", 4))
    if resultado is None:
        return jsonify({"erro": "sem_treinos"}), 400
    return jsonify({"status": "ok", **resultado})


@app.route("/api/semana-modelo/aplicar", methods=["POST"])
@login_obrigatorio
def api_aplicar_semana_modelo(uid):
    dados = request.get_json(silent=True) or {}
    aplicados = semana.aplicar_no_calendario(uid, dados.get("semanas", 4))
    return jsonify({"status": "ok", "aplicados": aplicados})


@app.route("/api/historico")
def api_historico_consolidado():
    return jsonify(agenda.get_historico_consolidado(id_para_leitura()))


@app.route("/api/modelos")
def api_listar_modelos():
    return jsonify(treinos.listar_modelos(id_para_leitura()))


@app.route("/api/modelos", methods=["POST"])
@login_obrigatorio
def api_criar_modelo(uid):
    nome = request.json.get("nome_treino")
    modelo_id = treinos.criar_modelo(uid, nome)
    return jsonify({"status": "ok", "id": modelo_id})


@app.route("/api/modelos/<int:modelo_id>/exercicios")
def api_exercicios_do_modelo(modelo_id):
    if not treinos.modelo_pertence(id_para_leitura(), modelo_id):
        return jsonify([])
    return jsonify(treinos.get_exercicios(modelo_id))


@app.route("/api/modelos/<int:modelo_id>", methods=["PATCH"])
@login_obrigatorio
def api_renomear_modelo(uid, modelo_id):
    if not treinos.modelo_pertence(uid, modelo_id):
        return nao_encontrado()
    nome = request.json.get("nome_treino")
    treinos.renomear_modelo(modelo_id, nome)
    return jsonify({"status": "ok"})


@app.route("/api/modelos/<int:modelo_id>", methods=["DELETE"])
@login_obrigatorio
def api_excluir_modelo(uid, modelo_id):
    if not treinos.modelo_pertence(uid, modelo_id):
        return nao_encontrado()
    treinos.excluir_modelo(modelo_id)
    return jsonify({"status": "ok"})


@app.route("/api/treinos/<int:treino_planejado_id>/concluir", methods=["POST"])
@login_obrigatorio
def api_concluir_treino(uid, treino_planejado_id):
    if not treinos.modelo_pertence(uid, treino_planejado_id):
        return nao_encontrado()
    dados = request.get_json(silent=True) or {}
    treinos.marcar_treino_concluido(uid, treino_planejado_id, dados.get("data"))
    return jsonify({"status": "ok"})


@app.route("/api/treinos/<int:treino_planejado_id>/exercicios", methods=["POST"])
@login_obrigatorio
def api_adicionar_exercicio(uid, treino_planejado_id):
    if not treinos.modelo_pertence(uid, treino_planejado_id):
        return nao_encontrado()
    dados = request.json
    treinos.adicionar_exercicio(
        treino_planejado_id,
        dados["biblioteca_exercicio_id"],
        dados["series"],
        dados["repeticoes"],
        dados["carga_kg"],
        dados["ordem"]
    )
    return jsonify({"status": "ok"})


@app.route("/api/exercicios/<int:exercicio_id>", methods=["DELETE"])
@login_obrigatorio
def api_remover_exercicio(uid, exercicio_id):
    if not treinos.exercicio_pertence(uid, exercicio_id):
        return nao_encontrado()
    treinos.remover_exercicio(exercicio_id)
    return jsonify({"status": "ok"})


@app.route("/api/exercicios/<int:exercicio_id>/concluir", methods=["POST"])
@login_obrigatorio
def api_marcar_exercicio(uid, exercicio_id):
    if not treinos.exercicio_pertence(uid, exercicio_id):
        return nao_encontrado()
    concluido = request.json.get("concluido", True)
    treinos.marcar_exercicio(uid, exercicio_id, concluido)
    return jsonify({"status": "ok"})


@app.route("/api/biblioteca")
def api_listar_biblioteca():
    grupo = request.args.get("grupo_muscular")
    return jsonify(biblioteca.listar_todos(grupo))


@app.route("/api/biblioteca/buscar")
def api_buscar_biblioteca():
    termo = request.args.get("q", "")
    return jsonify(biblioteca.buscar_por_nome(termo))


@app.route("/api/biblioteca/grupos")
def api_grupos_musculares():
    return jsonify(biblioteca.listar_grupos_musculares())


@app.route("/api/biblioteca/pesquisar")
def api_pesquisar_biblioteca():
    termo = request.args.get("q", "")
    grupo = request.args.get("grupo_muscular") or None
    limite = request.args.get("limite", default=60, type=int)
    return jsonify(biblioteca.pesquisar(termo, grupo, limite))


@app.route("/api/hidratacao/registrar", methods=["POST"])
@login_obrigatorio
def api_registrar_agua(uid):
    ml = request.json.get("ml")
    total = hidratacao.registrar_agua(uid, ml)
    return jsonify({"status": "ok", "total_ml_hoje": total})


@app.route("/api/hidratacao/hoje")
def api_agua_hoje():
    uid = id_para_leitura()
    return jsonify({
        "total_ml": hidratacao.get_total_hoje(uid),
        "meta_ml": hidratacao.get_meta_agua(uid)
    })


@app.route("/api/hidratacao/horarios")
def api_listar_horarios():
    return jsonify(hidratacao.listar_horarios(id_para_leitura()))


@app.route("/api/hidratacao/horarios", methods=["POST"])
@login_obrigatorio
def api_criar_horario(uid):
    dados = request.json
    novo_id = hidratacao.criar_horario(
        uid, dados["hora_inicio"], dados["hora_fim"], dados["quantidade_ml"]
    )
    return jsonify({"status": "ok", "id": novo_id})


@app.route("/api/hidratacao/horarios/<int:horario_id>", methods=["DELETE"])
@login_obrigatorio
def api_remover_horario(uid, horario_id):
    if not hidratacao.horario_pertence(uid, horario_id):
        return nao_encontrado()
    hidratacao.remover_horario(horario_id)
    return jsonify({"status": "ok"})


@app.route("/api/hidratacao/bloco-atual")
def api_bloco_atual():
    return jsonify(hidratacao.get_bloco_atual(id_para_leitura()))


@app.route("/api/corridas/manual", methods=["POST"])
@login_obrigatorio
def api_registrar_corrida_manual(uid):
    dados = request.json
    corridas.registrar_corrida_manual(uid, dados["data"], dados["km"], dados.get("duracao_segundos"))
    return jsonify({"status": "ok"})


@app.route("/api/corridas/app", methods=["POST"])
@login_obrigatorio
def api_registrar_corrida_app(uid):
    dados = request.json
    corridas.registrar_corrida_app(uid, dados["km"], dados["duracao_segundos"], dados["percurso"])
    return jsonify({"status": "ok"})


@app.route("/api/corridas/semana")
def api_corridas_semana():
    return jsonify({"total_km": corridas.get_total_semana(id_para_leitura())})


@app.route("/api/corridas/<int:corrida_id>")
def api_detalhe_corrida(corrida_id):
    corrida = corridas.get_corrida_detalhe(corrida_id, id_para_leitura())
    if not corrida:
        return nao_encontrado()
    return jsonify(corrida)


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", host="127.0.0.1", port=5000)
