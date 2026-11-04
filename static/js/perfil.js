let intervaloNotificacao = null;

function carregarPerfil() {
    fetch("/api/perfil")
        .then(res => res.json())
        .then(usuario => {
            document.getElementById("input-nome").value = usuario.convidado ? "" : usuario.nome;
            document.getElementById("input-nome").placeholder = usuario.convidado ? "Seu nick" : "";
            document.getElementById("input-meta-agua").value = usuario.meta_agua_ml;
            document.getElementById("input-meta-km").value = usuario.meta_km_semanal;
            configurarBotaoSessao(usuario.convidado);
        });
}

function configurarBotaoSessao(convidado) {
    const botao = document.getElementById("botao-sessao");
    document.getElementById("card-codigo").style.display = convidado ? "none" : "block";

    if (convidado) {
        botao.textContent = "Entrar com código";
        botao.onclick = () => Sessao.abrirEntradaPorCodigo();
    } else {
        botao.textContent = "Sair";
        botao.onclick = () => Sessao.sair();
    }
}

function gerarNovoCodigo() {
    if (!confirm("Gerar um novo código? O código anterior deixa de funcionar.")) return;

    fetch("/api/codigo/novo", { method: "POST" })
        .then(res => res.json())
        .then(dados => Sessao.mostrarCodigo(dados.codigo));
}

function salvarPerfil() {
    const dados = {
        nome: document.getElementById("input-nome").value,
        meta_agua_ml: parseInt(document.getElementById("input-meta-agua").value),
        meta_km_semanal: parseFloat(document.getElementById("input-meta-km").value)
    };

    fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    }).then(() => {
        const botao = document.getElementById("botao-salvar-perfil");
        botao.textContent = "✓ Salvo!";
        botao.classList.add("salvo");
        setTimeout(() => {
            botao.textContent = "Salvar";
            botao.classList.remove("salvo");
        }, 2000);
    });
}

function carregarHorarios() {
    fetch("/api/hidratacao/horarios")
        .then(res => res.json())
        .then(horarios => {
            const container = document.getElementById("lista-horarios");

            if (horarios.length === 0) {
                container.innerHTML = "<p class='texto-vazio'>Nenhum bloco cadastrado</p>";
                return;
            }

            container.innerHTML = horarios.map(h => `
                <div class="pilula-agua-azul">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s7 8 7 13a7 7 0 01-14 0c0-5 7-13 7-13z"/></svg>
                    <span>${h.hora_inicio}–${h.hora_fim}: ${h.quantidade_ml}ml</span>
                    <button onclick="removerHorario(${h.id})" aria-label="Remover">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `).join("");
        });
}

function adicionarHorario() {
    const hora_inicio = document.getElementById("input-hora-inicio").value;
    const hora_fim = document.getElementById("input-hora-fim").value;
    const quantidade_ml = parseInt(document.getElementById("input-qtd-ml").value);

    if (!hora_inicio || !hora_fim || !quantidade_ml) {
        alert("Preenche hora de início, fim e quantidade.");
        return;
    }

    fetch("/api/hidratacao/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hora_inicio, hora_fim, quantidade_ml })
    }).then(() => {
        document.getElementById("input-hora-inicio").value = "";
        document.getElementById("input-hora-fim").value = "";
        document.getElementById("input-qtd-ml").value = "";
        carregarHorarios();
    });
}

function removerHorario(id) {
    fetch(`/api/hidratacao/horarios/${id}`, { method: "DELETE" })
        .then(() => carregarHorarios());
}

function alternarNotificacaoToggle() {
    const toggle = document.getElementById("toggle-notificacao");
    const vaiAtivar = !toggle.classList.contains("ativo");

    if (!vaiAtivar) {
        toggle.classList.remove("ativo");
        clearInterval(intervaloNotificacao);
        document.getElementById("status-notificacao").textContent = "Lembretes desativados.";
        return;
    }

    if (!("Notification" in window)) {
        document.getElementById("status-notificacao").textContent = "Seu navegador não suporta notificações.";
        return;
    }

    Notification.requestPermission().then(permissao => {
        if (permissao !== "granted") {
            document.getElementById("status-notificacao").textContent = "Permissão negada. Ative nas configurações do navegador.";
            return;
        }

        toggle.classList.add("ativo");
        document.getElementById("status-notificacao").textContent = "Lembretes ativos enquanto o app estiver aberto.";
        iniciarChecagemPeriodica();
    });
}

function iniciarChecagemPeriodica() {
    clearInterval(intervaloNotificacao);
    intervaloNotificacao = setInterval(verificarBlocoENotificar, 5 * 60 * 1000);
    verificarBlocoENotificar();
}

function verificarBlocoENotificar() {
    fetch("/api/hidratacao/bloco-atual")
        .then(res => res.json())
        .then(bloco => {
            if (!bloco) return;

            const faltam = bloco.meta_ml - bloco.bebido_ml;
            if (faltam > 0) {
                new Notification("Hora de beber água 💧", {
                    body: `Faltam ${faltam}ml até ${bloco.hora_fim} (meta: ${bloco.meta_ml}ml nesse período).`
                });
            }
        });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarPerfil();
    carregarHorarios();
});