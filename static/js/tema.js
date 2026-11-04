(function () {
    let tema = "dark";
    try {
        tema = localStorage.getItem("tema") || "dark";
    } catch (e) {}
    document.documentElement.setAttribute("data-tema", tema);
})();

function alternarTema() {
    const atual = document.documentElement.getAttribute("data-tema");
    const novo = atual === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-tema", novo);
    try {
        localStorage.setItem("tema", novo);
    } catch (e) {}
    sincronizarToggleTema();
}

function sincronizarToggleTema() {
    const toggle = document.getElementById("toggle-tema");
    if (!toggle) return;
    toggle.classList.toggle("ativo", document.documentElement.getAttribute("data-tema") === "light");
}

document.addEventListener("DOMContentLoaded", sincronizarToggleTema);