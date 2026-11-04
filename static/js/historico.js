const ICONE_TREINO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7v10M18 7v10M2 10v4M22 10v4M6 12h12"/></svg>`;
const ICONE_CORRIDA = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 4l-3 6 4 2-2 8M9 10L5 8m10 12l3-4-3-2"/></svg>`;
const ICONE_MAPA = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`;

function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function carregarHistoricoConsolidado() {
    fetch("/api/historico")
        .then(res => res.json())
        .then(dias => {
            const container = document.getElementById("lista-historico");

            if (dias.length === 0) {
                container.innerHTML = "<p style='color: var(--text-muted); font-size: 13px;'>Nada registrado ainda.</p>";
                return;
            }

            container.innerHTML = dias.map(dia => {
                const linhasTreino = dia.treinos.map(nome => `
                    <div class="linha-atividade">
                        <span class="icone-atividade cor-treino">${ICONE_TREINO}</span>
                        <span>Treino ${nome}</span>
                    </div>
                `).join("");

                const linhasCorrida = dia.corridas.map(c => `
                    <div class="linha-atividade">
                        <span class="icone-atividade cor-corrida">${ICONE_CORRIDA}</span>
                        <span>${c.km}km realizados</span>
                        ${c.duracao_min ? `<span class="duracao-atividade">· ${c.duracao_min}</span>` : ""}
                        ${c.fonte === "app" ? `<a href="/corrida/${c.id}" class="link-ver-mapa">${ICONE_MAPA}ver mapa</a>` : ""}
                    </div>
                `).join("");

                return `
                    <div class="card-dia-historico">
                        <p class="data-dia-historico">${formatarDataBR(dia.data)}</p>
                        ${linhasTreino}
                        ${linhasCorrida}
                    </div>
                `;
            }).join("");
        });
}

function registrarCorridaManual() {
    const data = document.getElementById("input-data-corrida-manual").value;
    const km = parseFloat(document.getElementById("input-km-corrida-manual").value);
    const minutos = parseInt(document.getElementById("input-duracao-corrida-manual").value);

    if (!data || !km) {
        alert("Preenche pelo menos a data e a distância.");
        return;
    }

    fetch("/api/corridas/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            data: data,
            km: km,
            duracao_segundos: minutos ? minutos * 60 : null
        })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("input-data-corrida-manual").value = "";
            document.getElementById("input-km-corrida-manual").value = "";
            document.getElementById("input-duracao-corrida-manual").value = "";
            carregarHistoricoConsolidado();
        });
}

function carregarModelosParaSelect() {
    fetch("/api/modelos")
        .then(res => res.json())
        .then(modelos => {
            const select = document.getElementById("select-modelo-treino-manual");
            select.innerHTML = `<option value="">Qual treino?</option>` +
                modelos.map(m => `<option value="${m.id}">${m.nome_treino}</option>`).join("");
        });
}

function registrarTreinoManual() {
    const data = document.getElementById("input-data-treino-manual").value;
    const treinoId = document.getElementById("select-modelo-treino-manual").value;

    if (!data || !treinoId) {
        alert("Escolhe a data e o treino.");
        return;
    }

    fetch(`/api/treinos/${treinoId}/concluir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: data })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("input-data-treino-manual").value = "";
            carregarHistoricoConsolidado();
        });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarHistoricoConsolidado();
    carregarModelosParaSelect();
});