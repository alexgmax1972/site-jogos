
const API_URL = "http://127.0.0.1:5000";

async function carregarJogos() {
    const listaJogos = document.getElementById("lista-jogos");

    if (!listaJogos) {
        console.warn("Elemento lista-jogos não encontrado.");
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/api/jogos`);

        if (!resposta.ok) {
            throw new Error("Não foi possível carregar os jogos.");
        }

        const jogos = await resposta.json();

        listaJogos.innerHTML = "";

        if (jogos.length === 0) {
            listaJogos.innerHTML = "<p>Nenhum jogo disponível.</p>";
            return;
        }

        jogos.forEach((jogo) => {
            const card = document.createElement("div");
            card.className = "card-jogo";

            const imagem = document.createElement("img");

            imagem.src = jogo.imagem
                ? jogo.imagem
                : "imagens/jogos/reinos-oriente.png";

            imagem.alt = `Capa do jogo ${jogo.nome}`;
            imagem.className = "imagem-jogo";

            const titulo = document.createElement("h3");
            titulo.textContent = `🎮 ${jogo.nome}`;

            const descricao = document.createElement("p");
            descricao.textContent =
                jogo.descricao || "Sem descrição disponível.";

            const categoria = document.createElement("span");
            categoria.className = "categoria";
            categoria.textContent = jogo.categoria || "Geral";

            card.appendChild(imagem);
            card.appendChild(titulo);
            card.appendChild(descricao);
            card.appendChild(categoria);

            listaJogos.appendChild(card);
        });

    } catch (erro) {
        console.error("Erro:", erro);

        listaJogos.innerHTML = `
            <p>
                Não foi possível conectar ao servidor.
                Verifique se o Flask está funcionando.
            </p>
        `;
    }
}

document.addEventListener("DOMContentLoaded", carregarJogos);
