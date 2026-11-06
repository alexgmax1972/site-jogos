const API_AUTH = "http://127.0.0.1:5000/api/auth";

/**
 * Verifica se existe um usuário logado.
 */
async function verificarLogin() {
    try {
        const resposta = await fetch(`${API_AUTH}/verificar`, {
            method: "GET",
            credentials: "include"
        });

        if (!resposta.ok) {
            return false;
        }

        const dados = await resposta.json();

        return dados.logado === true;

    } catch (erro) {
        console.error("Erro ao verificar login:", erro);
        return false;
    }
}

/**
 * Exige login antes de abrir um jogo.
 */
async function exigirLogin(paginaDestino) {
    const logado = await verificarLogin();

    if (logado) {
        window.location.href = paginaDestino;
        return;
    }

    const confirmar = confirm(
        "🔒 Para jogar, você precisa fazer Login ou se cadastrar.\n\n" +
        "Clique em OK para fazer Login.\n" +
        "Depois do login você será enviado para o jogo."
    );

    if (confirmar) {
        window.location.href =
            `login.html?redirect=${encodeURIComponent(paginaDestino)}`;
    }
}

/**
 * Protege uma página de jogo.
 *
 * Se não estiver logado, envia para o login.
 */
async function protegerPaginaJogo() {
    const logado = await verificarLogin();

    if (!logado) {
        const paginaAtual =
            window.location.pathname.split("/").pop();

        window.location.href =
            `login.html?redirect=${encodeURIComponent(paginaAtual)}`;
    }
}

/**
 * Faz logout.
 */
async function sair() {
    try {
        await fetch(`${API_AUTH}/logout`, {
            method: "POST",
            credentials: "include"
        });
    } catch (erro) {
        console.error("Erro ao fazer logout:", erro);
    }

    window.location.href = "login.html";
}

/**
 * Mostra informações do usuário logado.
 */
async function carregarUsuario() {
    try {
        const resposta = await fetch(`${API_AUTH}/verificar`, {
            method: "GET",
            credentials: "include"
        });

        if (!resposta.ok) {
            return null;
        }

        const dados = await resposta.json();

        if (!dados.logado) {
            return null;
        }

        return dados.usuario;

    } catch (erro) {
        console.error("Erro ao carregar usuário:", erro);
        return null;
    }
}
