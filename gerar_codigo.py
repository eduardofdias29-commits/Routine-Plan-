import sys

from database import iniciar_banco
from services import usuarios

iniciar_banco()

usuario_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
usuario = usuarios.get_usuario(usuario_id)

if not usuario:
    print(f"Não existe usuário com id {usuario_id}.")
    sys.exit(1)

codigo = usuarios.gerar_novo_codigo(usuario_id)
print(f"Novo código de acesso de '{usuario['nome']}': {codigo}")
print("O código anterior deixou de valer. Anote este, ele não será mostrado de novo.")
