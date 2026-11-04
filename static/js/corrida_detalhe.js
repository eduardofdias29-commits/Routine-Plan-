function formatarTempo(segundosTotais) {
    const min = Math.floor(segundosTotais / 60);
    const seg = segundosTotais % 60;
    return `${min}min ${seg.toString().padStart(2, "0")}s`;
}

function carregarDetalhe() {
    fetch(`/api/corridas/${CORRIDA_ID}`)
        .then(res => {
            if (!res.ok) throw new Error("Corrida não encontrada");
            return res.json();
        })
        .then(corrida => {
            document.getElementById("resumo-corrida").innerHTML = `
                <h2>${corrida.data}</h2>
                <p><strong>${corrida.distancia_km} km</strong> em ${formatarTempo(corrida.duracao_segundos)}</p>
                <p>Fonte: ${corrida.fonte === "app" ? "Rastreado pelo app" : "Manual"}</p>
            `;

            if (corrida.percurso && corrida.percurso.length > 0) {
                desenharMapa(corrida.percurso);
            } else {
                document.getElementById("mapa").innerHTML =
                    "<p style='padding: 16px;'>Essa corrida não tem percurso de GPS registrado.</p>";
            }
        })
        .catch(erro => {
            document.getElementById("resumo-corrida").innerHTML = "<p>Erro ao carregar essa corrida.</p>";
            console.error(erro);
        });
}

function desenharMapa(pontos) {
    const mapa = L.map("mapa").setView([pontos[0].lat, pontos[0].lng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapa);

    const linha = pontos.map(p => [p.lat, p.lng]);
    L.polyline(linha, { color: "blue", weight: 4 }).addTo(mapa);

    L.marker(linha[0]).addTo(mapa).bindPopup("Início");
    L.marker(linha[linha.length - 1]).addTo(mapa).bindPopup("Fim");

    mapa.fitBounds(linha);
}

document.addEventListener("DOMContentLoaded", carregarDetalhe);