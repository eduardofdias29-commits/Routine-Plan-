from database import get_connection, iniciar_banco
from services import usuarios


def garantir_biblioteca(sempre_traduzir=True):
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) AS n FROM biblioteca_exercicios").fetchone()["n"]
    conn.close()

    acabou_de_importar = False

    if total > 0:
        print(f"Biblioteca: {total} exercícios já importados.")
    else:
        try:
            from importar_todos_exercicios import importar
            importar()
            acabou_de_importar = True
        except Exception as erro:
            print(f"Biblioteca: não foi possível importar ({erro}).")
            print("Confira a conexão com a internet e reinicie o app (ou rode 'python configurar.py').")
            return

    from traduzir_exercicios import aplicar_traducoes, ha_traducoes_pendentes
    if sempre_traduzir or acabou_de_importar or ha_traducoes_pendentes():
        aplicar_traducoes()


def garantir_codigos_de_acesso():
    for usuario in usuarios.listar_sem_codigo():
        codigo = usuarios.gerar_novo_codigo(usuario["id"])
        print(f"Usuário '{usuario['nome']}' (id {usuario['id']}) ainda não tinha código de acesso.")
        print(f"  Código: {codigo}  <- anote, ele não será mostrado de novo.")


def preparar_ambiente(sempre_traduzir=False):
    iniciar_banco()
    garantir_biblioteca(sempre_traduzir)
    garantir_codigos_de_acesso()


def main():
    preparar_ambiente(sempre_traduzir=True)
    print("\nPronto. Rode: python app.py")


if __name__ == "__main__":
    main()
