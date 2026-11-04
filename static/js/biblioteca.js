const CORES_GRUPO = {
    "Peito": "#FF7A33", "Costas": "#4DA8FF", "Pernas": "#3ECFB8",
    "Ombro": "#A78BFA", "Braço": "#F472B6", "Core": "#FACC15",
    "Glúteo": "#FB923C", "Todos": "#8B92A1"
};

const POR_PAGINA = 60;

let grupoAtual = "";
let termoAtual = "";
let limiteAtual = POR_PAGINA;
let exerciciosVisiveis = {};
let timeoutBusca = null;
let intervaloAnimacao = null;
let quadros = { primeiro: null, segundo: null, mostrandoPrimeiro: true };

function carregarGrupos() {
    fetch("/api/biblioteca/grupos")
        .then(res => res.json())
        .then(grupos => {
            const container = document.getElementById("filtros");
            grupos.forEach(grupo => {
                const botao = document.createElement("button");
                botao.className = "filtro-btn";
                botao.dataset.cor = grupo;
                botao.textContent = grupo;
                botao.onclick = () => selecionarGrupo(grupo, botao);
                container.appendChild(botao);
            });
        });
}

function selecionarGrupo(grupo, botao) {
    grupoAtual = grupo;
    document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("ativo"));
    botao.classList.add("ativo");
    limiteAtual = POR_PAGINA;
    carregarExercicios();
}

function aoDigitarBusca() {
    const campo = document.getElementById("busca-biblioteca");
    document.getElementById("limpar-busca").style.display = campo.value ? "flex" : "none";

    clearTimeout(timeoutBusca);
    timeoutBusca = setTimeout(() => {
        termoAtual = campo.value.trim();
        limiteAtual = POR_PAGINA;
        carregarExercicios();
    }, 250);
}

function limparBusca() {
    const campo = document.getElementById("busca-biblioteca");
    campo.value = "";
    document.getElementById("limpar-busca").style.display = "none";
    termoAtual = "";
    limiteAtual = POR_PAGINA;
    carregarExercicios();
    campo.focus();
}

function mostrarMais() {
    limiteAtual += POR_PAGINA;
    carregarExercicios();
}

function carregarExercicios() {
    const params = new URLSearchParams({ q: termoAtual, limite: limiteAtual });
    if (grupoAtual) params.set("grupo_muscular", grupoAtual);

    fetch(`/api/biblioteca/pesquisar?${params}`)
        .then(res => res.json())
        .then(renderizar)
        .catch(erro => console.error("Erro ao buscar exercícios:", erro));
}

function renderizar(resposta) {
    const container = document.getElementById("grid-exercicios");
    const contagem = document.getElementById("contagem-resultados");
    const botaoMais = document.getElementById("btn-mostrar-mais");

    exerciciosVisiveis = {};
    resposta.exercicios.forEach(ex => { exerciciosVisiveis[ex.id] = ex; });

    if (resposta.total === 0) {
        container.innerHTML = "<p style='color: var(--text-muted); font-size: 14px;'>Nenhum exercício encontrado.</p>";
        contagem.textContent = "";
        botaoMais.style.display = "none";
        return;
    }

    const mostrando = resposta.exercicios.length;
    contagem.textContent = mostrando < resposta.total
        ? `Mostrando ${mostrando} de ${resposta.total} exercícios`
        : `${resposta.total} ${resposta.total === 1 ? "exercício" : "exercícios"}`;

    botaoMais.style.display = mostrando < resposta.total ? "block" : "none";

    container.innerHTML = resposta.exercicios.map(ex => {
        const cor = CORES_GRUPO[ex.grupo_muscular] || "#8B92A1";
        return `
            <div class="card-exercicio" onclick="abrirDetalhe(${ex.id})">
                ${ex.midia_arquivo
                    ? `<img src="${ex.midia_arquivo}" alt="${ex.nome}" loading="lazy">`
                    : `<div class="sem-imagem">sem imagem</div>`
                }
                <span class="tag-grupo-flutuante" style="background-color:${cor}22; color:${cor}; border:1px solid ${cor}44;">
                    ${ex.grupo_muscular}
                </span>
                <div class="info-exercicio">
                    <h3>${ex.nome}</h3>
                </div>
            </div>
        `;
    }).join("");
}

function segundoQuadro(url) {
    if (!url || !/\/0\.(jpg|jpeg|png)$/i.test(url)) return null;
    return url.replace(/\/0\.(jpg|jpeg|png)$/i, "/1.$1");
}

function abrirDetalhe(id) {
    const ex = exerciciosVisiveis[id];
    if (!ex) return;

    const img = document.getElementById("detalhe-imagem");
    const legenda = document.getElementById("detalhe-legenda");

    document.getElementById("detalhe-nome").textContent = ex.nome;
    document.getElementById("detalhe-grupo").textContent = ex.grupo_muscular;

    quadros.primeiro = ex.midia_arquivo;
    quadros.segundo = segundoQuadro(ex.midia_arquivo);
    quadros.mostrandoPrimeiro = true;

    img.onerror = () => {
        pararAnimacao();
        quadros.segundo = null;
        img.onerror = null;
        img.src = quadros.primeiro || "";
        legenda.textContent = "Este exercício tem só uma foto.";
    };

    img.src = quadros.primeiro || "";

    if (quadros.segundo) {
        new Image().src = quadros.segundo;
        legenda.textContent = "Alternando entre início e fim. Toque na imagem para pausar.";
        iniciarAnimacao();
    } else {
        legenda.textContent = "Este exercício tem só uma foto.";
    }

    document.getElementById("modal-detalhe").classList.remove("escondido");
}

function iniciarAnimacao() {
    pararAnimacao();
    if (!quadros.segundo) return;

    const img = document.getElementById("detalhe-imagem");
    intervaloAnimacao = setInterval(() => {
        quadros.mostrandoPrimeiro = !quadros.mostrandoPrimeiro;
        img.src = quadros.mostrandoPrimeiro ? quadros.primeiro : quadros.segundo;
    }, 800);
}

function pararAnimacao() {
    clearInterval(intervaloAnimacao);
    intervaloAnimacao = null;
}

function alternarAnimacao() {
    if (!quadros.segundo) return;
    if (intervaloAnimacao) pararAnimacao();
    else iniciarAnimacao();
}

function fecharDetalhe() {
    pararAnimacao();
    document.getElementById("detalhe-imagem").onerror = null;
    document.getElementById("modal-detalhe").classList.add("escondido");
}

function fecharDetalheFora(evento) {
    if (evento.target.id === "modal-detalhe") fecharDetalhe();
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharDetalhe();
});

document.addEventListener("DOMContentLoaded", () => {
    const botaoTodos = document.querySelector('.filtro-btn[data-grupo=""]');
    if (botaoTodos) {
        botaoTodos.dataset.cor = "Todos";
        botaoTodos.onclick = () => selecionarGrupo("", botaoTodos);
    }
    carregarGrupos();
    carregarExercicios();
});