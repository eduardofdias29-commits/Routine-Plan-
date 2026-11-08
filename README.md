# RoutinePlan — Treinos, Água e Corrida.

**Site no ar:** https://SEU-APP.onrender.com

> Projeto pessoal e independente, feito para estudo e portfólio.

## Preview

<!-- Troque por um GIF ou print salvo em docs/ -->
![RoutinePlan](docs/preview.gif)

## Sobre o projeto

Comecei o RoutinePlan no segundo semestre de Análise e Desenvolvimento de Sistemas por um motivo simples: eu queria um app para montar e acompanhar meus próprios treinos de academia, e nenhum que eu testei fazia do jeito que eu uso.

O projeto também é um exemplo de como um aplicativo de saúde pode funcionar na web. A interface foi pensada para o celular, com tema claro e escuro, e o visitante pode navegar pela biblioteca de exercícios sem criar conta. Só quando quer salvar algo ele escolhe um nick, sem senha, e recebe um código de acesso para voltar à mesma conta em outro aparelho.

Os 876 exercícios vêm do [Free Exercise DB](https://github.com/yuhonas/free-exercise-db). Os nomes foram traduzidos para português por mim e ficam no arquivo `traducoes.csv`.

> Essa é a primeira versão do site roda no plano gratuito do Render, que dorme depois de um tempo parado, e o primeiro acesso demora cerca de um minuto. Os dados ficam em um banco Postgres gratuito (Neon), então nick e treinos continuam salvos entre atualizações e funcionam no celular e no computador.

## Stack

- **Back-end:** Python e Flask
- **Banco de dados:** SQLite no desenvolvimento local e Postgres (Neon) em produção
- **Front-end:** HTML, CSS e JavaScript puro, sem frameworks
- **Deploy:** Render com Gunicorn

## Fonte dos dados

| Dado | Fonte |
|---|---|
| Exercícios e imagens | [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) |
| Traduções dos nomes | `traducoes.csv`, feitas por mim |

## Funcionalidades

- **Biblioteca de exercícios** com imagem, busca e filtro por grupo muscular, aberta para qualquer visitante
- **Meus treinos:** monte treinos com exercícios da biblioteca, veja as miniaturas e marque o que já fez
- **Semana-modelo:** defina o que treinar em cada dia da semana, peça uma sugestão de distribuição com base nos seus treinos e aplique no calendário
- **Calendário** de treinos, mostrando os dias a partir de 5 dias antes de hoje
- **Histórico** de treinos concluídos, com duração e exercícios realizados
- **Hidratação:** registro de água, meta diária e horários de lembrete
- **Corrida:** registro manual ou por GPS, percurso no mapa e meta semanal de quilômetros
- **Entrada sem senha:** nick e código de acesso, com limite de tentativas por IP. Com o mesmo código você entra em qualquer aparelho e vê os mesmos treinos
- **Tema claro e escuro**

## Rodando localmente

Requisitos: Python 3.10 ou superior.

```bash
git clone https://github.com/eduardofdias29-commits/routineplan.git
cd routineplan

python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux e macOS

pip install -r requirements.txt
python app.py
```

Abra http://127.0.0.1:5000.

Sem configuração, o app usa um arquivo SQLite local. Na primeira execução ele cria o banco, importa os exercícios (precisa de internet) e aplica as traduções. Não é preciso rodar mais nada.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `SECRET_KEY` | Chave que assina os cookies de sessão. Obrigatória em produção. Sem ela, o app gera uma e guarda em `.secret_key`. |
| `DATABASE_URL` | Endereço de um banco Postgres. Se definida, o app usa o Postgres em vez do SQLite. Em produção, use a URL do Neon. |
| `DATABASE_PATH` | Caminho do arquivo SQLite. Opcional, o padrão é `database.db` na pasta do projeto. |
| `FLASK_DEBUG` | Use `1` para ligar o modo de depuração no desenvolvimento. |

## Estrutura

```
routineplan/
├── app.py                  rotas das páginas e da API
├── configurar.py           prepara o banco, importa exercícios e traduções
├── database.py             conexão e criação do banco
├── database_schema.sql     tabelas
├── traducoes.csv           traduções dos nomes dos exercícios
├── gerar_codigo.py         gera um novo código de acesso para um usuário
├── requirements.txt
├── render.yaml             configuração opcional de deploy no Render
├── services/               regras de negócio
│   ├── treinos.py
│   ├── agenda.py
│   ├── semana.py
│   ├── biblioteca.py
│   ├── hidratacao.py
│   ├── corridas.py
│   └── usuarios.py
├── templates/              páginas HTML
└── static/                 CSS e JavaScript
```

## API

Todas as rotas respondem em JSON. As de leitura funcionam sem login. As de escrita exigem um nick e retornam 401 para visitantes.

**Conta**
- `POST /api/entrar` cria a conta a partir de um nick e devolve o código de acesso
- `POST /api/entrar-codigo` entra com um código existente
- `POST /api/sair`
- `POST /api/codigo/novo` gera um novo código
- `GET /api/perfil` e `POST /api/perfil`

**Treinos**
- `GET /api/modelos` e `POST /api/modelos`
- `GET /api/modelos/<id>/exercicios`
- `PATCH /api/modelos/<id>` e `DELETE /api/modelos/<id>`
- `POST /api/treinos/<id>/exercicios` e `POST /api/treinos/<id>/concluir`
- `POST /api/exercicios/<id>/concluir` e `DELETE /api/exercicios/<id>`
- `GET /api/treinos/hoje`
- `GET /api/historico`

**Agenda e semana-modelo**
- `GET /api/agenda`, `POST /api/agenda/dia` e `DELETE /api/agenda/dia/<data>`
- `GET /api/semana-modelo`
- `POST /api/semana-modelo/<dia>` e `DELETE /api/semana-modelo/<dia>`
- `POST /api/semana-modelo/sugerir` e `POST /api/semana-modelo/aplicar`

**Biblioteca**
- `GET /api/biblioteca`
- `GET /api/biblioteca/grupos`
- `GET /api/biblioteca/buscar` e `GET /api/biblioteca/pesquisar`

**Hidratação**
- `POST /api/hidratacao/registrar` e `GET /api/hidratacao/hoje`
- `GET /api/hidratacao/horarios`, `POST /api/hidratacao/horarios` e `DELETE /api/hidratacao/horarios/<id>`
- `GET /api/hidratacao/bloco-atual`

**Corridas**
- `POST /api/corridas/manual` e `POST /api/corridas/app`
- `GET /api/corridas/semana` e `GET /api/corridas/<id>`

## Segurança

- O código de acesso é guardado só como hash SHA-256
- Tentativas erradas são limitadas por IP
- Cada usuário só acessa os próprios dados, e o acesso a dados de outros retorna 404
- O banco e a chave de sessão ficam fora do repositório

## Próximos passos

- Treinos de exemplo para novas contas
- Exportar e importar os dados do usuário
- Gráficos de evolução de carga e de corrida

## Aviso

Projeto de estudo e portfólio, sem fins comerciais. As informações de treino são pessoais e não substituem a orientação de um profissional de educação física.

---

Feito por [Eduardo](https://github.com/eduardofdias29-commits).
