let percurso = [];
let watchId = null;
let inicioTimestamp = null;
let intervaloCronometro = null;
let distanciaTotalKm = 0;

function calcularDistanciaKm(p1, p2) {
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatarTempo(segundosTotais) {
    const min = Math.floor(segundosTotais / 60).toString().padStart(2, "0");
    const seg = (segundosTotais % 60).toString().padStart(2, "0");
    return `${min}:${seg}`;
}

function iniciarCorrida() {
    if (!navigator.geolocation) {
        alert("Seu navegador não suporta geolocalização.");
        return;
    }

    percurso = [];
    distanciaTotalKm = 0;
    inicioTimestamp = Date.now();

    document.getElementById("status-corrida").textContent = "Rastreando...";
    document.getElementById("distancia-km").textContent = "0.00";
    document.getElementById("tempo-decorrido").textContent = "00:00";

    document.getElementById("painel-cronometro").classList.add("ativo");
    document.getElementById("badge-ao-vivo").style.display = "block";
    document.getElementById("btn-iniciar").style.display = "none";
    document.getElementById("btn-finalizar").style.display = "flex";
    document.getElementById("btn-finalizar").disabled = false;
    document.getElementById("tempo-decorrido").classList.remove("neutro");
    document.getElementById("distancia-km").classList.remove("neutro");
    document.getElementById("distancia-km").classList.add("destaque");

    intervaloCronometro = setInterval(() => {
        const segundos = Math.floor((Date.now() - inicioTimestamp) / 1000);
        document.getElementById("tempo-decorrido").textContent = formatarTempo(segundos);
    }, 1000);

    watchId = navigator.geolocation.watchPosition(
        (posicao) => {
            const novoPonto = {
                lat: posicao.coords.latitude,
                lng: posicao.coords.longitude,
                timestamp: Date.now()
            };

            if (percurso.length > 0) {
                const ultimoPonto = percurso[percurso.length - 1];
                distanciaTotalKm += calcularDistanciaKm(ultimoPonto, novoPonto);
                document.getElementById("distancia-km").textContent = distanciaTotalKm.toFixed(2);
            }

            percurso.push(novoPonto);
        },
        (erro) => {
            console.error("Erro no GPS:", erro);
            document.getElementById("status-corrida").textContent = "Erro ao acessar GPS";
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

function finalizarCorrida() {
    navigator.geolocation.clearWatch(watchId);
    clearInterval(intervaloCronometro);

    const duracaoSegundos = Math.floor((Date.now() - inicioTimestamp) / 1000);

    document.getElementById("status-corrida").textContent = "Salvando...";
    document.getElementById("btn-finalizar").disabled = true;

    fetch("/api/corridas/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            km: distanciaTotalKm,
            duracao_segundos: duracaoSegundos,
            percurso: percurso
        })
    })
    .then(res => res.json())
    .then(() => {
        document.getElementById("status-corrida").textContent = "Corrida salva!";

        document.getElementById("painel-cronometro").classList.remove("ativo");
        document.getElementById("badge-ao-vivo").style.display = "none";
        document.getElementById("btn-iniciar").style.display = "flex";
        document.getElementById("btn-finalizar").style.display = "none";
        document.getElementById("tempo-decorrido").classList.add("neutro");
        document.getElementById("distancia-km").classList.remove("destaque");
        document.getElementById("distancia-km").classList.add("neutro");

        mostrarMapa(percurso);
    })
    .catch(erro => {
        console.error("Erro ao salvar:", erro);
        document.getElementById("status-corrida").textContent = "Erro ao salvar";
    });
}

function mostrarMapa(pontos) {
    if (pontos.length === 0) return;

    const divMapa = document.getElementById("mapa");
    divMapa.style.display = "block";

    const mapa = L.map("mapa").setView([pontos[0].lat, pontos[0].lng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapa);

    const linha = pontos.map(p => [p.lat, p.lng]);
    L.polyline(linha, { color: "#3ECFB8", weight: 4 }).addTo(mapa);

    L.marker(linha[0]).addTo(mapa).bindPopup("Início");
    L.marker(linha[linha.length - 1]).addTo(mapa).bindPopup("Fim");

    mapa.fitBounds(linha);
}