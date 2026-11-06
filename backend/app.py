from flask import Flask, jsonify
from flask_cors import CORS

from routes import api


app = Flask(__name__)


# ============================================================
# CONFIGURAÇÃO DA SESSÃO
# ============================================================

app.config["SECRET_KEY"] = "site-jogos-chave-secreta-2026"


# Permite que o frontend em 127.0.0.1:5500
# envie e receba cookies da sessão do Flask.
CORS(
    app,
    supports_credentials=True
)


# ============================================================
# ROTAS DA API
# ============================================================

app.register_blueprint(api)


# ============================================================
# TESTE PRINCIPAL
# ============================================================

@app.route("/")
def inicio():

    return jsonify({
        "mensagem": "Site de Jogos funcionando!",
        "status": "online"
    })


# ============================================================
# TESTE DA API
# ============================================================

@app.route("/api/teste")
def teste():

    return jsonify({
        "mensagem": "API funcionando corretamente!",
        "banco": "site_jogos"
    })


# ============================================================
# EXECUÇÃO
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
