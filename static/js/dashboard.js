function definirSaudacao() {
    const hora = new Date().getHours();
    let saudacao = "Boa noite";
    if (hora >= 5 && hora < 12) saudacao = "Bom dia";
    else if (hora >= 12 && hora < 18) saudacao = "Boa tarde";

    document.getElementById("texto-saudacao").innerHTML = `${saudacao},<br><span class="nome-destaque" id="texto-nome"></span>`;

    const dataFormatada = new Date().toLocaleDateString("pt-BR", {
        weekday: "long", day: "numeric", month: "long"
    });
    document.getElementById("texto-data").textContent = dataFormatada;

    fetch("/api/perfil")
        .then(res => res.json())
        .then(usuario => {
            document.getElementById("texto-nome").textContent = usuario.nome;
        });
}

function miniaturasHtml(exercicios) {
    const imagens = exercicios.map(ex => ex.midia_arquivo
        ? `<img src="${ex.midia_arquivo}" alt="${ex.nome}" title="${ex.nome}" loading="lazy">`
        : `<div class="miniatura-vazia"></div>`
    ).join("");
    return `<div class="miniaturas-dia">${imagens}</div>`;
}

function carregarTreinoHoje() {
    fetch(`/api/treinos/hoje`)
        .then(res => res.json())
        .then(treino => {
            const container = document.getElementById("treino-hoje");
            const secao = document.getElementById("secao-treino");

            if (!treino) {
                secao.classList.remove("concluida");
                container.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Dia de descanso — aproveite para recuperar!</p>";
                return;
            }

            const total = treino.exercicios.length;
            const feitos = treino.exercicios.filter(ex => ex.concluido).length;
            const tudoFeito = total > 0 && feitos === total;

            if (tudoFeito) {
                secao.classList.add("concluida");
                container.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:var(--sucesso);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D0F14" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                        <div>
                            <p style="color:var(--sucesso); font-weight:700; font-size:14px;">Treino de hoje finalizado</p>
                            <p style="color:var(--text-muted); font-size:12px;">${treino.nome_treino} — ${total} exercícios</p>
                        </div>
                    </div>
                    ${miniaturasHtml(treino.exercicios)}
                `;
                return;
            }

            secao.classList.remove("concluida");
            let html = `<p style="font-weight:700; font-size:14px;">${treino.nome_treino}</p>`;
            html += miniaturasHtml(treino.exercicios);
            html += `<ul class="lista-exercicios-dashboard" style="margin-top: 12px;">`;
            treino.exercicios.slice(0, 4).forEach(ex => {
                html += `<li><span>${ex.nome}</span><span class="carga">${ex.series}x${ex.repeticoes}</span></li>`;
            });
            if (treino.exercicios.length > 4) {
                html += `<li style="border:none;"><span style="color:var(--text-muted); font-size:12px;">+${treino.exercicios.length - 4} exercícios</span></li>`;
            }
            html += "</ul>";
            html += `<button onclick="concluirTreino(${treino.id})" style="width: 100%; margin-top: 12px;">Marcar como feito</button>`;

            container.innerHTML = html;
        });
}

function concluirTreino(treinoPlanejadoId) {
    fetch(`/api/treinos/hoje`)
        .then(res => res.json())
        .then(treino => {
            const idsExercicios = treino.exercicios.map(e => e.id);
            const promessas = idsExercicios.map(id =>
                fetch(`/api/exercicios/${id}/concluir`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ concluido: true })
                })
            );
            return Promise.all(promessas);
        })
        .then(() => fetch(`/api/treinos/${treinoPlanejadoId}/concluir`, { method: "POST" }))
        .then(() => carregarTreinoHoje());
}

function carregarHidratacao() {
    fetch("/api/hidratacao/hoje")
        .then(res => res.json())
        .then(dados => {
            document.getElementById("agua-total").textContent = dados.total_ml;
            document.getElementById("agua-meta").textContent = dados.meta_ml;
            document.getElementById("litros-agua").textContent = (dados.total_ml / 1000).toFixed(1) + "L";

            const percentual = Math.min((dados.total_ml / dados.meta_ml) * 100, 100);
            document.getElementById("percentual-agua").textContent = `${Math.round(percentual)}%`;

            const circulo = document.getElementById("circulo-progresso");
            const circunferencia = 251;
            const offset = circunferencia - (percentual / 100) * circunferencia;
            circulo.style.strokeDashoffset = offset;
        });
}

function registrarAgua(ml) {
    fetch("/api/hidratacao/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ml: ml })
    }).then(() => carregarHidratacao());
}

function carregarKmSemana() {
    Promise.all([
        fetch("/api/corridas/semana").then(res => res.json()),
        fetch("/api/perfil").then(res => res.json())
    ]).then(([corrida, perfil]) => {
        document.getElementById("km-semana").textContent = corrida.total_km;
        document.getElementById("km-meta").textContent = perfil.meta_km_semanal;

        const pct = perfil.meta_km_semanal > 0
            ? Math.min((corrida.total_km / perfil.meta_km_semanal) * 100, 100)
            : 0;
        document.getElementById("barra-corrida").style.width = `${pct}%`;
    });
}

function verificarBlocoAgua() {
    fetch("/api/hidratacao/bloco-atual")
        .then(res => res.json())
        .then(bloco => {
            const alerta = document.getElementById("alerta-agua");

            if (!bloco) {
                alerta.classList.add("escondido");
                return;
            }

            const faltam = bloco.meta_ml - bloco.bebido_ml;

            if (faltam <= 0) {
                alerta.classList.add("escondido");
                return;
            }

            alerta.classList.remove("escondido");
            alerta.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4DA8FF" stroke-width="2"><path d="M12 2s7 8 7 13a7 7 0 01-14 0c0-5 7-13 7-13z"/></svg>
                <p>Faltam <strong>${faltam}ml</strong> até ${bloco.hora_fim}</p>
                <button onclick="registrarAguaRapido(${faltam})">Beber agora</button>
            `;
        });
}

function registrarAguaRapido(ml) {
    registrarAgua(ml);
    verificarBlocoAgua();
}

document.addEventListener("DOMContentLoaded", () => {
    definirSaudacao();
    carregarTreinoHoje();
    carregarHidratacao();
    carregarKmSemana();
    verificarBlocoAgua();
});