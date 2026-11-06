from flask import Blueprint, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash

from database import conectar

api = Blueprint("api", __name__)


# ============================================================
# JOGOS
# ============================================================

@api.route("/api/jogos", methods=["GET"])
def listar_jogos():

    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                id,
                nome,
                descricao,
                categoria,
                imagem,
                criado_em
            FROM jogos
            ORDER BY id DESC
        """)

        jogos = cursor.fetchall()

        return jsonify(jogos)

    finally:

        cursor.close()
        conexao.close()


# ============================================================
# RANKING
# ============================================================

@api.route("/api/ranking", methods=["GET"])
def ranking():

    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                u.id,
                u.nome,
                COALESCE(SUM(p.pontuacao), 0) AS pontuacao
            FROM usuarios u

            LEFT JOIN pontuacoes p
                ON p.usuario_id = u.id

            GROUP BY
                u.id,
                u.nome

            ORDER BY
                pontuacao DESC,
                u.nome ASC

            LIMIT 100
        """)

        jogadores = cursor.fetchall()

        for jogador in jogadores:
            jogador["pontuacao"] = int(jogador["pontuacao"] or 0)

        return jsonify(jogadores)

    except Exception as erro:

        print("ERRO NO RANKING:", erro)

        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao carregar ranking."
        }), 500

    finally:

        cursor.close()
        conexao.close()


# ============================================================
# CADASTRO
# ============================================================

@api.route("/api/auth/cadastro", methods=["POST"])
def cadastro():

    dados = request.get_json()

    if not dados:
        return jsonify({
            "sucesso": False,
            "mensagem": "Dados não enviados."
        }), 400

    nome = dados.get("nome", "").strip()
    email = dados.get("email", "").strip().lower()
    senha = dados.get("senha", "")

    if not nome or not email or not senha:

        return jsonify({
            "sucesso": False,
            "mensagem": "Preencha todos os campos."
        }), 400

    if len(nome) < 3:

        return jsonify({
            "sucesso": False,
            "mensagem": "O nome deve possuir pelo menos 3 caracteres."
        }), 400

    if len(senha) < 6:

        return jsonify({
            "sucesso": False,
            "mensagem": "A senha deve possuir pelo menos 6 caracteres."
        }), 400

    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT id
            FROM usuarios
            WHERE email = %s
            LIMIT 1
        """, (email,))

        usuario_existente = cursor.fetchone()

        if usuario_existente:

            return jsonify({
                "sucesso": False,
                "mensagem": "Este e-mail já possui uma conta."
            }), 409

        senha_hash = generate_password_hash(senha)

        cursor.execute("""
            INSERT INTO usuarios
            (
                nome,
                email,
                senha
            )
            VALUES
            (
                %s,
                %s,
                %s
            )
        """, (
            nome,
            email,
            senha_hash
        ))

        conexao.commit()

        usuario_id = cursor.lastrowid

        session["usuario_id"] = usuario_id
        session["usuario_nome"] = nome
        session["usuario_email"] = email

        return jsonify({

            "sucesso": True,

            "mensagem":
                "Cadastro realizado com sucesso!",

            "usuario": {

                "id": usuario_id,

                "nome": nome,

                "email": email

            }

        }), 201

    except Exception as erro:

        conexao.rollback()

        print("ERRO NO CADASTRO:", erro)

        return jsonify({

            "sucesso": False,

            "mensagem":
                "Erro ao realizar cadastro."

        }), 500

    finally:

        cursor.close()
        conexao.close()


# ============================================================
# LOGIN
# ============================================================

@api.route("/api/auth/login", methods=["POST"])
def login():

    dados = request.get_json()

    if not dados:

        return jsonify({

            "sucesso": False,

            "mensagem":
                "Dados não enviados."

        }), 400

    email = dados.get(
        "email",
        ""
    ).strip().lower()

    senha = dados.get(
        "senha",
        ""
    )

    if not email or not senha:

        return jsonify({

            "sucesso": False,

            "mensagem":
                "Informe o e-mail e a senha."

        }), 400

    conexao = conectar()
    cursor = conexao.cursor(dictionary=True)

    try:

        cursor.execute("""
            SELECT
                id,
                nome,
                email,
                senha
            FROM usuarios
            WHERE email = %s
            LIMIT 1
        """, (email,))

        usuario = cursor.fetchone()

        if not usuario:

            return jsonify({

                "sucesso": False,

                "mensagem":
                    "E-mail ou senha incorretos."

            }), 401

        senha_correta = check_password_hash(
            usuario["senha"],
            senha
        )

        if not senha_correta:

            return jsonify({

                "sucesso": False,

                "mensagem":
                    "E-mail ou senha incorretos."

            }), 401

        session["usuario_id"] = usuario["id"]

        session["usuario_nome"] = usuario["nome"]

        session["usuario_email"] = usuario["email"]

        return jsonify({

            "sucesso": True,

            "mensagem":
                "Login realizado com sucesso!",

            "usuario": {

                "id":
                    usuario["id"],

                "nome":
                    usuario["nome"],

                "email":
                    usuario["email"]

            }

        })

    except Exception as erro:

        print("ERRO NO LOGIN:", erro)

        return jsonify({

            "sucesso": False,

            "mensagem":
                "Erro ao realizar login."

        }), 500

    finally:

        cursor.close()
        conexao.close()


# ============================================================
# VERIFICAR LOGIN
# ============================================================

@api.route("/api/auth/verificar", methods=["GET"])
def verificar_login():

    usuario_id = session.get(
        "usuario_id"
    )

    if not usuario_id:

        return jsonify({
            "logado": False
        }), 401

    return jsonify({

        "logado": True,

        "usuario": {

            "id":
                usuario_id,

            "nome":
                session.get("usuario_nome"),

            "email":
                session.get("usuario_email")

        }

    })


# ============================================================
# LOGOUT
# ============================================================

@api.route("/api/auth/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({

        "sucesso": True,

        "mensagem":
            "Logout realizado com sucesso."

    })
