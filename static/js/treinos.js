let modeloAtualId = null;
let ordemAtual = 0;
let exercicioSelecionado = null;
let timeoutBusca = null;
let modelosDisponiveis = [];
let exerciciosPorModelo = {};
let idsNoModeloAtual = new Set();
let quantidadeMesesVisiveis = 1;
let semanaModeloAtual = [];

function carregarModelos() {
    return fetch("/api/modelos")
        .then(res => res.json())
        .then(modelos => {
            modelosDisponiveis = modelos;
            carregarSemanaModelo();
            const container = document.getElementById("lista-modelos");

            if (modelos.length === 0) {
                container.innerHTML = "<p style='color: var(--text-muted); font-size: 13px;'>Nenhum treino criado ainda.</p>";
                return;
            }

            container.innerHTML = modelos.map(m => `
                <div class="item-modelo" id="modelo-${m.id}">
                    <div class="item-modelo-info" onclick="selecionarModelo(${m.id}, '${m.nome_treino.replace(/'/g, "\\'")}')">
                        <p class="nome">${m.nome_treino}</p>
                        <p class="contagem">${m.total_exercicios} ${m.total_exercicios === 1 ? "exercício" : "exercícios"}</p>
                        ${miniaturasDoModelo(m)}
                    </div>
                    <button class="botao-icone" onclick="iniciarRenome(${m.id}, '${m.nome_treino.replace(/'/g, "\\'")}')" aria-label="Renomear">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="botao-icone" onclick="excluirModelo(${m.id})" aria-label="Excluir">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
                    </button>
                </div>
            `).join("");
        });
}

function miniaturasDoModelo(modelo) {
    if (!modelo.miniaturas || modelo.miniaturas.length === 0) return "";

    const imagens = modelo.miniaturas.map(url => url
        ? `<img src="${url}" alt="" loading="lazy">`
        : `<div class="miniatura-vazia"></div>`
    ).join("");
    const resto = modelo.total_exercicios - modelo.miniaturas.length;
    const mais = resto > 0 ? `<span class="miniatura-mais">+${resto}</span>` : "";

    return `<div class="miniaturas-dia">${imagens}${mais}</div>`;
}

function criarModelo() {
    const nome = document.getElementById("input-novo-modelo").value.trim();
    if (!nome) {
        alert("Digite um nome pro treino.");
        return;
    }

    fetch("/api/modelos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_treino: nome })
    })
        .then(res => res.json())
        .then(dados => {
            document.getElementById("input-novo-modelo").value = "";
            carregarModelos().then(() => selecionarModelo(dados.id, nome));
        });
}

function iniciarRenome(id, nomeAtual) {
    const item = document.getElementById(`modelo-${id}`);
    const infoDiv = item.querySelector(".item-modelo-info");

    infoDiv.innerHTML = `<input class="renomear" value="${nomeAtual.replace(/"/g, "&quot;")}" autofocus>`;
    const input = infoDiv.querySelector("input");
    input.focus();
    input.select();

    const salvar = () => {
        const novoNome = input.value.trim();
        if (novoNome && novoNome !== nomeAtual) {
            renomearModelo(id, novoNome);
        } else {
            carregarModelos();
        }
    };

    input.addEventListener("blur", salvar);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
    });
}

function renomearModelo(id, novoNome) {
    fetch(`/api/modelos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_treino: novoNome })
    })
        .then(() => {
            if (modeloAtualId === id) {
                document.getElementById("nome-modelo-atual").textContent = novoNome;
            }
            carregarModelos();
        })
        .catch(erro => console.error("Erro ao renomear:", erro));
}

function excluirModelo(id) {
    if (!confirm("Excluir esse treino? Os exercícios dele serão removidos.")) return;

    fetch(`/api/modelos/${id}`, { method: "DELETE" })
        .then(() => {
            if (modeloAtualId === id) {
                modeloAtualId = null;
                document.getElementById("secao-exercicios-modelo").style.display = "none";
            }
            carregarModelos();
            carregarCalendario();
        })
        .catch(erro => console.error("Erro ao excluir:", erro));
}

function selecionarModelo(id, nome) {
    modeloAtualId = id;
    document.getElementById("nome-modelo-atual").textContent = nome;
    document.getElementById("secao-exercicios-modelo").style.display = "block";
    carregarExerciciosDoModelo();
}

function carregarExerciciosDoModelo() {
    fetch(`/api/modelos/${modeloAtualId}/exercicios`)
        .then(res => res.json())
        .then(exercicios => {
            ordemAtual = exercicios.length;
            exerciciosPorModelo[modeloAtualId] = exercicios;
            idsNoModeloAtual = new Set(exercicios.map(e => e.biblioteca_exercicio_id));

            const container = document.getElementById("exercicios-do-treino");

            if (exercicios.length === 0) {
                container.innerHTML = "<p style='color: var(--text-muted); font-size: 13px;'>Nenhum exercício adicionado ainda.</p>";
            } else {
                container.innerHTML = exercicios.map(ex => `
                    <div class="item-lista">
                        <span class="item-exercicio-info">
                            ${ex.midia_arquivo ? `<img src="${ex.midia_arquivo}" alt="" loading="lazy">` : `<div class="miniatura-vazia"></div>`}
                            <span>${ex.nome} — ${ex.series}x${ex.repeticoes} (${ex.carga_kg}kg)</span>
                        </span>
                        <button class="botao-icone" onclick="removerExercicio(${ex.id})" aria-label="Remover">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
                        </button>
                    </div>
                `).join("");
            }

            carregarBiblioteca();
        });
}

function removerExercicio(exercicioId) {
    fetch(`/api/exercicios/${exercicioId}`, { method: "DELETE" })
        .then(() => {
            carregarExerciciosDoModelo();
            carregarModelos();
            carregarCalendario();
        });
}

function carregarBiblioteca(grupo = "") {
    const url = grupo ? `/api/biblioteca?grupo_muscular=${encodeURIComponent(grupo)}` : "/api/biblioteca";
    fetch(url).then(res => res.json()).then(renderizarGrid);
}

function buscarExercicios() {
    const termo = document.getElementById("busca-exercicio").value.trim();
    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
        if (termo.length === 0) {
            carregarBiblioteca();
            return;
        }
        fetch(`/api/biblioteca/buscar?q=${encodeURIComponent(termo)}`)
            .then(res => res.json())
            .then(renderizarGrid);
    }, 300);
}

function renderizarGrid(exercicios) {
    const container = document.getElementById("grid-biblioteca");

    if (exercicios.length === 0) {
        container.innerHTML = "<p>Nenhum exercício encontrado.</p>";
        return;
    }

    container.innerHTML = exercicios.map(ex => {
        const jaAdicionado = idsNoModeloAtual.has(ex.id);
        return `
            <div class="card-exercicio ${jaAdicionado ? "selecionado" : ""}" ${jaAdicionado ? "" : `onclick='abrirModal(${JSON.stringify(ex)})'`}>
                ${ex.midia_arquivo ? `<img src="${ex.midia_arquivo}" alt="${ex.nome}" loading="lazy">` : `<div class="sem-imagem">sem imagem</div>`}
                ${jaAdicionado ? `<div class="selo-selecionado"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D0F14" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ""}
                <div class="info-exercicio">
                    <h3>${ex.nome}</h3>
                    <span class="tag-grupo">${ex.grupo_muscular}</span>
                </div>
            </div>
        `;
    }).join("");
}

function abrirModal(exercicio) {
    if (!modeloAtualId) {
        alert("Escolhe ou cria um treino primeiro, lá em cima.");
        return;
    }
    exercicioSelecionado = exercicio;
    document.getElementById("modal-nome-exercicio").textContent = exercicio.nome;
    document.getElementById("modal-adicionar").classList.remove("escondido");
}

function fecharModal() {
    document.getElementById("modal-adicionar").classList.add("escondido");
}

function confirmarAdicionar() {
    const series = parseInt(document.getElementById("input-series").value);
    const repeticoes = parseInt(document.getElementById("input-repeticoes").value);
    const carga = parseFloat(document.getElementById("input-carga").value);

    fetch(`/api/treinos/${modeloAtualId}/exercicios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            biblioteca_exercicio_id: exercicioSelecionado.id,
            series: series,
            repeticoes: repeticoes,
            carga_kg: carga,
            ordem: ordemAtual++
        })
    }).then(() => {
        fecharModal();
        carregarExerciciosDoModelo();
        carregarModelos();
        carregarCalendario();
    });
}

function carregarGruposFiltro() {
    fetch("/api/biblioteca/grupos")
        .then(res => res.json())
        .then(grupos => {
            const container = document.getElementById("filtros");
            grupos.forEach(grupo => {
                const botao = document.createElement("button");
                botao.className = "filtro-btn";
                botao.dataset.cor = grupo;
                botao.textContent = grupo;
                botao.onclick = () => {
                    document.querySelectorAll("#filtros .filtro-btn").forEach(b => b.classList.remove("ativo"));
                    botao.classList.add("ativo");
                    document.getElementById("busca-exercicio").value = "";
                    carregarBiblioteca(grupo);
                };
                container.appendChild(botao);
            });
        });
}

function opcoesSelect(treinoIdAtual) {
    let html = `<option value="">Não decidido</option>`;
    html += `<option value="descanso" ${treinoIdAtual === null ? "selected" : ""}>Descanso</option>`;
    modelosDisponiveis.forEach(m => {
        html += `<option value="${m.id}" ${m.id === treinoIdAtual ? "selected" : ""}>${m.nome_treino}</option>`;
    });
    return html;
}

function miniaturasHtml(treinoId) {
    if (treinoId === null || treinoId === undefined) return "";
    const exercicios = exerciciosPorModelo[treinoId];
    if (!exercicios || exercicios.length === 0) return "";

    const primeiros = exercicios.slice(0, 4);
    return `
        <div class="miniaturas-dia">
            ${primeiros.map(ex => ex.midia_arquivo
                ? `<img src="${ex.midia_arquivo}" alt="${ex.nome}">`
                : `<div class="miniatura-vazia"></div>`
            ).join("")}
            ${exercicios.length > 4 ? `<span class="miniatura-mais">+${exercicios.length - 4}</span>` : ""}
        </div>
    `;
}

function garantirExerciciosCarregados(meses) {
    const todosOsDias = meses.flatMap(m => m.dias);
    const ids = [...new Set(todosOsDias.map(d => d.treino_id).filter(id => id !== null && id !== undefined))];
    const faltando = ids.filter(id => !exerciciosPorModelo[id]);

    if (faltando.length === 0) return Promise.resolve();

    return Promise.all(faltando.map(id =>
        fetch(`/api/modelos/${id}/exercicios`)
            .then(res => res.json())
            .then(exercicios => { exerciciosPorModelo[id] = exercicios; })
    ));
}

function carregarCalendario() {
    fetch(`/api/agenda?meses=${quantidadeMesesVisiveis}`)
        .then(res => res.json())
        .then(meses => {
            if (!Array.isArray(meses)) {
                console.error("Resposta inesperada da agenda:", meses);
                return;
            }
            return garantirExerciciosCarregados(meses).then(() => renderizarCalendario(meses));
        })
        .catch(erro => console.error("Erro ao carregar calendário:", erro));
}

function renderizarCalendario(meses) {
    const partes = [];

    meses.forEach(mes => {
        partes.push(`<h3 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px;">${mes.mes_nome} ${mes.ano}</h3>`);

        mes.dias.forEach(dia => {
            const temTreino = dia.treino_id !== null && dia.treino_id !== undefined;

            partes.push(`
                <div class="item-lista-agenda ${dia.eh_hoje ? "dia-atual" : ""} ${dia.eh_passado ? "dia-passado" : ""}">
                    <div class="linha-topo-dia">
                        <span>
                            ${dia.dia_semana_nome}, ${dia.dia_mes.toString().padStart(2, "0")}
                            ${dia.eh_hoje ? `<span class="badge-hoje">HOJE</span>` : ""}
                            ${dia.concluido ? `<span class="badge-concluido">✓ feito</span>` : ""}
                            ${dia.eh_passado && !dia.concluido && dia.status !== "descanso" ? `<span class="badge-nao-marcado">não marcado</span>` : ""}
                        </span>
                        <select class="${temTreino ? "tem-treino" : ""}" onchange="definirDia('${dia.data}', this.value)">
                            ${opcoesSelect(dia.treino_id)}
                        </select>
                    </div>
                    ${miniaturasHtml(dia.treino_id)}
                </div>
            `);
        });
    });

    document.getElementById("lista-agenda").innerHTML = partes.join("");
}

function mostrarMaisMeses() {
    quantidadeMesesVisiveis++;
    carregarCalendario();
}

function opcoesSemanaModelo(dia) {
    let html = `<option value="">Não definido</option>`;
    html += `<option value="descanso" ${dia.definido && dia.treino_id === null ? "selected" : ""}>Descanso</option>`;
    modelosDisponiveis.forEach(m => {
        html += `<option value="${m.id}" ${dia.treino_id === m.id ? "selected" : ""}>${m.nome_treino}</option>`;
    });
    return html;
}

function carregarSemanaModelo() {
    fetch("/api/semana-modelo")
        .then(res => res.json())
        .then(semana => {
            semanaModeloAtual = semana;
            document.getElementById("lista-semana-modelo").innerHTML = semana.map(dia => `
                <div class="item-lista-agenda">
                    <div class="linha-topo-dia">
                        <span>${dia.nome}</span>
                        <select class="${dia.treino_id !== null ? "tem-treino" : ""}" onchange="definirDiaSemana(${dia.dia_semana}, this.value)">
                            ${opcoesSemanaModelo(dia)}
                        </select>
                    </div>
                </div>
            `).join("");
        })
        .catch(erro => console.error("Erro ao carregar a semana-modelo:", erro));
}

function definirDiaSemana(diaSemana, valor) {
    const acao = valor === ""
        ? fetch(`/api/semana-modelo/${diaSemana}`, { method: "DELETE" })
        : fetch(`/api/semana-modelo/${diaSemana}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ treino_planejado_id: valor === "descanso" ? null : parseInt(valor) })
        });

    acao.then(() => carregarSemanaModelo()).catch(erro => console.error("Erro ao salvar a semana-modelo:", erro));
}

function sugerirSemanaModelo() {
    const dias = parseInt(document.getElementById("select-dias-semana").value);
    const status = document.getElementById("status-semana-modelo");

    if (semanaModeloAtual.some(d => d.definido) && !confirm("Substituir a semana-modelo atual pela sugestão?")) return;

    fetch("/api/semana-modelo/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias })
    })
        .then(res => res.json())
        .then(dados => {
            if (dados.erro === "sem_treinos") {
                status.textContent = "Crie pelo menos um treino antes de pedir uma sugestão.";
                return;
            }

            status.textContent = dados.conflitos > 0
                ? "Sugestão criada. Com esses treinos, alguns dias seguidos repetem o mesmo grupo muscular. Ajuste se quiser e clique em Aplicar."
                : "Sugestão criada com descanso entre os grupos musculares. Ajuste se quiser e clique em Aplicar.";
            carregarSemanaModelo();
        })
        .catch(erro => console.error("Erro ao sugerir a semana:", erro));
}

function aplicarSemanaModelo() {
    const semanas = parseInt(document.getElementById("select-semanas").value);
    const status = document.getElementById("status-semana-modelo");

    fetch("/api/semana-modelo/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semanas })
    })
        .then(res => res.json())
        .then(dados => {
            status.textContent = dados.aplicados === 0
                ? "Nenhum dia novo para preencher."
                : `${dados.aplicados} ${dados.aplicados === 1 ? "dia preenchido" : "dias preenchidos"} no calendário.`;
            carregarCalendario();
        })
        .catch(erro => console.error("Erro ao aplicar a semana-modelo:", erro));
}

function definirDia(data, valor) {
    const acao = valor === ""
        ? fetch(`/api/agenda/dia/${data}`, { method: "DELETE" })
        : fetch("/api/agenda/dia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data, treino_planejado_id: valor === "descanso" ? null : parseInt(valor) })
        });

    acao.then(() => carregarCalendario()).catch(erro => console.error("Erro ao salvar dia:", erro));
}

document.addEventListener("DOMContentLoaded", () => {
    const botaoTodos = document.querySelector('#filtros .filtro-btn[data-grupo=""]');
    if (botaoTodos) {
        botaoTodos.dataset.cor = "Todos";
        botaoTodos.onclick = () => {
            document.querySelectorAll("#filtros .filtro-btn").forEach(b => b.classList.remove("ativo"));
            botaoTodos.classList.add("ativo");
            document.getElementById("busca-exercicio").value = "";
            carregarBiblioteca();
        };
    }

    carregarModelos().then(() => carregarCalendario());
    carregarGruposFiltro();
});