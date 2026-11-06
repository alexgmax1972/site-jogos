import mysql.connector


def conectar():
    conexao = mysql.connector.connect(
        host="localhost",
        user="root",
        password="81225573",
        database="site_jogos"
    )

    return conexao
