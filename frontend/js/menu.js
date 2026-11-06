
document.addEventListener("DOMContentLoaded", async function() {

    const areaVisitante = document.getElementById("areaVisitante");
    const areaUsuario = document.getElementById("areaUsuario");
    const nomeUsuario = document.getElementById("nomeUsuario");

    try {

        const usuario = await carregarUsuario();

        if (usuario) {

            // Usuário autenticado
            areaVisitante.style.display = "none";
            areaUsuario.style.display = "inline-flex";

            nomeUsuario.textContent =
                "👤 " + usuario.nome;

        } else {

            // Visitante
            areaVisitante.style.display = "inline-flex";
            areaUsuario.style.display = "none";

        }

    } catch (erro) {

        console.error("Erro ao carregar menu:", erro);

        areaVisitante.style.display = "inline-flex";
        areaUsuario.style.display = "none";

    }

});
