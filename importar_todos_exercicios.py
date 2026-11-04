import json
import urllib.request

from services import biblioteca

URL_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
BASE_IMAGENS = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"

TRADUCAO_GRUPO = {
    "abdominals": "Abdômen",
    "abductors": "Pernas",
    "adductors": "Pernas",
    "biceps": "Braço",
    "calves": "Pernas",
    "chest": "Peito",
    "forearms": "Braço",
    "glutes": "Pernas",
    "hamstrings": "Pernas",
    "lats": "Costas",
    "lower back": "Costas",
    "middle back": "Costas",
    "neck": "Pescoço",
    "quadriceps": "Pernas",
    "shoulders": "Ombro",
    "traps": "Costas",
    "triceps": "Braço",
}

def importar():
    print("Baixando catálogo completo...")
    with urllib.request.urlopen(URL_JSON, timeout=30) as resposta:
        todos_exercicios = json.load(resposta)
    print(f"{len(todos_exercicios)} exercícios encontrados.\n")

    importados = 0

    for ex in todos_exercicios:
        musculo_principal = ex.get("primaryMuscles", ["outros"])[0] if ex.get("primaryMuscles") else "outros"
        grupo_pt = TRADUCAO_GRUPO.get(musculo_principal, "Outros")

        url_imagem = f"{BASE_IMAGENS}/{ex['images'][0]}" if ex.get("images") else None

        biblioteca.criar_exercicio(ex["name"], grupo_pt, ex.get("category", ""), url_imagem)
        importados += 1

        if importados % 100 == 0:
            print(f"  {importados} importados...")

    print(f"\n✅ {importados} exercícios importados com sucesso.")
    return importados


if __name__ == "__main__":
    importar()
