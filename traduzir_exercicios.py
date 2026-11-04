import csv
import os

from database import PASTA_PROJETO, get_connection
from services import biblioteca

ARQUIVO_TRADUCOES = os.path.join(PASTA_PROJETO, "traducoes.csv")


def carregar_traducoes():
    with open(ARQUIVO_TRADUCOES, encoding="utf-8", newline="") as f:
        return [
            (linha["ingles"].strip(), linha["portugues"].strip())
            for linha in csv.DictReader(f)
            if linha["ingles"].strip() and linha["portugues"].strip()
        ]


def ha_traducoes_pendentes():
    nomes = [ingles for ingles, portugues in carregar_traducoes() if ingles != portugues]
    if not nomes:
        return False

    marcadores = ",".join("?" for _ in nomes)
    conn = get_connection()
    pendentes = conn.execute(
        f"SELECT COUNT(*) AS n FROM biblioteca_exercicios WHERE nome IN ({marcadores})",
        nomes
    ).fetchone()["n"]
    conn.close()
    return pendentes > 0


def aplicar_traducoes():
    aplicadas = 0
    ja_corretas = 0
    nao_encontradas = []

    for nome_ingles, nome_pt in carregar_traducoes():
        exercicio = biblioteca.buscar_por_nome_exato(nome_ingles)

        if not exercicio:
            if not biblioteca.buscar_por_nome_exato(nome_pt):
                nao_encontradas.append(nome_ingles)
            else:
                ja_corretas += 1
            continue

        if exercicio["nome"] == nome_pt:
            ja_corretas += 1
            continue

        biblioteca.atualizar_nome(exercicio["id"], nome_pt)
        aplicadas += 1

    print(f"Traduções: {aplicadas} aplicadas, {ja_corretas} já estavam corretas.")
    if nao_encontradas:
        print(f"Não encontrados no banco ({len(nao_encontradas)}):")
        for nome in nao_encontradas:
            print(f"  - {nome}")


if __name__ == "__main__":
    aplicar_traducoes()
