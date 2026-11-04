(function () {
    const fetchOriginal = window.fetch.bind(window);
    let loginEmAndamento = null;
    let modal = null;
    let aoFinalizar = null;

    function criar(tag, atributos, filhos) {
        const el = document.createElement(tag);
        Object.entries(atributos || {}).forEach(([k, v]) => {
            if (k === "texto") el.textContent = v;
            else if (k === "estilo") el.style.cssText = v;
            else el.setAttribute(k, v);
        });
        (filhos || []).forEach(f => el.appendChild(f));
        return el;
    }

    function recarregarPagina() {
        if (location.pathname.startsWith("/corrida")) return;
        setTimeout(() => location.reload(), 300);
    }

    function montarModal() {
        if (modal) return;

        const erro = criar("p", { id: "sessao-erro", estilo: "color: var(--treino); font-size: 12px; margin-top: 8px; min-height: 16px;" });

        const telaNick = criar("div", { id: "sessao-tela-nick" }, [
            criar("h3", { texto: "Salvar seu progresso" }),
            criar("p", { texto: "Escolha um nick para guardar seus treinos, água e corridas. Não precisa de senha.", estilo: "color: var(--text-muted); font-size: 13px; margin-bottom: 14px;" }),
            criar("label", { for: "sessao-nick", texto: "Nick" }),
            criar("input", { id: "sessao-nick", type: "text", maxlength: "30", placeholder: "Como quer ser chamado?", autocomplete: "off" }),
            criar("div", { class: "linha-botoes-modal" }, [
                criar("button", { id: "sessao-continuar", class: "botao-primario", type: "button", texto: "Continuar" }),
                criar("button", { id: "sessao-cancelar", type: "button", texto: "Agora não" })
            ]),
            criar("button", { id: "sessao-tenho-codigo", type: "button", texto: "Já tenho um código", estilo: "background:none; border:none; color: var(--text-muted); width:100%; margin-top: 10px; font-size: 13px; text-decoration: underline;" })
        ]);

        const telaCodigoEntrada = criar("div", { id: "sessao-tela-codigo-entrada", estilo: "display:none;" }, [
            criar("h3", { texto: "Entrar com código" }),
            criar("p", { texto: "Digite o código que apareceu quando você criou o nick.", estilo: "color: var(--text-muted); font-size: 13px; margin-bottom: 14px;" }),
            criar("label", { for: "sessao-codigo", texto: "Código" }),
            criar("input", { id: "sessao-codigo", type: "text", maxlength: "12", placeholder: "XXXXX-XXXXX", autocomplete: "off", estilo: "text-transform: uppercase; letter-spacing: 0.08em;" }),
            criar("div", { class: "linha-botoes-modal" }, [
                criar("button", { id: "sessao-entrar", class: "botao-primario", type: "button", texto: "Entrar" }),
                criar("button", { id: "sessao-voltar", type: "button", texto: "Voltar" })
            ])
        ]);

        const telaCodigoMostra = criar("div", { id: "sessao-tela-codigo-mostra", estilo: "display:none;" }, [
            criar("h3", { id: "sessao-titulo-mostra", texto: "Seu código de acesso" }),
            criar("p", { texto: "Anote este código. Ele aparece só agora e serve para entrar em outro aparelho ou depois de limpar o navegador.", estilo: "color: var(--text-muted); font-size: 13px; margin-bottom: 14px;" }),
            criar("p", { id: "sessao-codigo-valor", estilo: "font-family: 'Big Shoulders Display', sans-serif; font-weight: 900; font-size: 2rem; letter-spacing: 0.08em; text-align: center; padding: 14px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 12px;" }),
            criar("div", { class: "linha-botoes-modal" }, [
                criar("button", { id: "sessao-copiar", type: "button", texto: "Copiar" }),
                criar("button", { id: "sessao-anotei", class: "botao-primario", type: "button", texto: "Anotei" })
            ])
        ]);

        const conteudo = criar("div", { class: "modal-conteudo" }, [telaNick, telaCodigoEntrada, telaCodigoMostra, erro]);
        modal = criar("div", { id: "sessao-modal", class: "modal escondido", estilo: "z-index: 1000;" }, [conteudo]);
        document.body.appendChild(modal);

        document.getElementById("sessao-continuar").onclick = criarConta;
        document.getElementById("sessao-cancelar").onclick = () => finalizar(false);
        document.getElementById("sessao-tenho-codigo").onclick = () => mostrarTela("codigo-entrada");
        document.getElementById("sessao-entrar").onclick = entrarComCodigo;
        document.getElementById("sessao-voltar").onclick = () => mostrarTela("nick");
        document.getElementById("sessao-anotei").onclick = () => finalizar(true);
        document.getElementById("sessao-copiar").onclick = copiarCodigo;

        document.getElementById("sessao-nick").addEventListener("keydown", e => { if (e.key === "Enter") criarConta(); });
        document.getElementById("sessao-codigo").addEventListener("keydown", e => { if (e.key === "Enter") entrarComCodigo(); });
    }

    function mostrarTela(nome) {
        ["nick", "codigo-entrada", "codigo-mostra"].forEach(t => {
            document.getElementById(`sessao-tela-${t}`).style.display = t === nome ? "block" : "none";
        });
        definirErro("");
        const foco = { "nick": "sessao-nick", "codigo-entrada": "sessao-codigo" }[nome];
        if (foco) setTimeout(() => document.getElementById(foco).focus(), 50);
    }

    function definirErro(texto) {
        const el = document.getElementById("sessao-erro");
        if (el) el.textContent = texto;
    }

    function abrir(tela, callback) {
        montarModal();
        aoFinalizar = callback;
        mostrarTela(tela);
        modal.classList.remove("escondido");
    }

    function finalizar(sucesso) {
        modal.classList.add("escondido");
        const callback = aoFinalizar;
        aoFinalizar = null;
        if (callback) callback(sucesso);
    }

    function postJson(url, corpo) {
        return fetchOriginal(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo || {})
        });
    }

    function criarConta() {
        const nome = document.getElementById("sessao-nick").value.trim();
        if (!nome) {
            definirErro("Digite um nick.");
            return;
        }

        postJson("/api/entrar", { nome })
            .then(res => res.json())
            .then(dados => {
                if (!dados.codigo) {
                    definirErro("Não foi possível criar. Tente de novo.");
                    return;
                }
                exibirCodigo(dados.codigo);
            })
            .catch(() => definirErro("Erro de conexão."));
    }

    function entrarComCodigo() {
        const codigo = document.getElementById("sessao-codigo").value.trim();
        if (!codigo) {
            definirErro("Digite o código.");
            return;
        }

        postJson("/api/entrar-codigo", { codigo })
            .then(res => res.json().then(dados => ({ status: res.status, dados })))
            .then(({ status, dados }) => {
                if (status === 429) {
                    definirErro("Muitas tentativas. Aguarde alguns minutos.");
                } else if (status !== 200) {
                    definirErro("Código não encontrado.");
                } else {
                    finalizar(true);
                }
            })
            .catch(() => definirErro("Erro de conexão."));
    }

    function exibirCodigo(codigo) {
        document.getElementById("sessao-codigo-valor").textContent = codigo;
        mostrarTela("codigo-mostra");
    }

    function copiarCodigo() {
        const codigo = document.getElementById("sessao-codigo-valor").textContent;
        try {
            navigator.clipboard.writeText(codigo).then(() => {
                document.getElementById("sessao-copiar").textContent = "Copiado!";
            });
        } catch (e) {}
    }

    function garantirLogin() {
        if (!loginEmAndamento) {
            loginEmAndamento = new Promise(resolve => {
                abrir("nick", resolve);
            }).then(sucesso => {
                loginEmAndamento = null;
                return sucesso;
            });
        }
        return loginEmAndamento;
    }

    window.fetch = function (entrada, init) {
        return fetchOriginal(entrada, init).then(res => {
            if (res.status !== 401) return res;

            return res.clone().json().catch(() => ({})).then(corpo => {
                if (corpo.erro !== "login_necessario") return res;

                return garantirLogin().then(sucesso => {
                    if (!sucesso) {
                        recarregarPagina();
                        throw new Error("login_cancelado");
                    }
                    recarregarPagina();
                    return fetchOriginal(entrada, init);
                });
            });
        });
    };

    window.Sessao = {
        abrirEntradaPorCodigo() {
            abrir("codigo-entrada", sucesso => { if (sucesso) location.reload(); });
        },
        mostrarCodigo(codigo) {
            abrir("codigo-mostra", () => {});
            exibirCodigo(codigo);
            document.getElementById("sessao-titulo-mostra").textContent = "Seu novo código";
        },
        sair() {
            postJson("/api/sair").then(() => { window.location.href = "/"; });
        }
    };
})();
