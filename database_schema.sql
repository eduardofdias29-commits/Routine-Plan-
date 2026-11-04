
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    meta_agua_ml INTEGER DEFAULT 4000,
    meta_km_semanal REAL DEFAULT 0,
    codigo_hash TEXT
);

CREATE UNIQUE INDEX idx_usuarios_codigo ON usuarios(codigo_hash);

CREATE TABLE biblioteca_exercicios (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    grupo_muscular TEXT,
    descricao TEXT,
    midia_arquivo TEXT
);

CREATE TABLE treinos_planejados (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL,
    nome_treino TEXT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE exercicios (
    id INTEGER PRIMARY KEY,
    treino_planejado_id INTEGER NOT NULL,
    biblioteca_exercicio_id INTEGER NOT NULL,
    series INTEGER,
    repeticoes INTEGER,
    carga_kg REAL,
    ordem INTEGER,
    FOREIGN KEY (treino_planejado_id) REFERENCES treinos_planejados(id),
    FOREIGN KEY (biblioteca_exercicio_id) REFERENCES biblioteca_exercicios(id)
);

CREATE TABLE exercicios_realizados (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    exercicio_id INTEGER NOT NULL,
    data DATE NOT NULL,
    concluido BOOLEAN DEFAULT 0,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (exercicio_id) REFERENCES exercicios(id)
);

CREATE TABLE treinos_realizados (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    treino_planejado_id INTEGER NOT NULL,
    data DATE NOT NULL,
    concluido BOOLEAN DEFAULT 0,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (treino_planejado_id) REFERENCES treinos_planejados(id)
);

CREATE TABLE corridas (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    data DATE NOT NULL,
    distancia_km REAL NOT NULL,
    duracao_segundos INTEGER,
    fonte TEXT DEFAULT 'manual',
    percurso_gps TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE hidratacao (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    data DATE NOT NULL,
    ml_registrado INTEGER NOT NULL,
    horario TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE horarios_agua (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    quantidade_ml INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE agenda_treino (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    data DATE NOT NULL,
    treino_planejado_id INTEGER,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (treino_planejado_id) REFERENCES treinos_planejados(id),
    UNIQUE(usuario_id, data)
);

CREATE TABLE semana_modelo (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL,
    treino_planejado_id INTEGER,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (treino_planejado_id) REFERENCES treinos_planejados(id),
    UNIQUE(usuario_id, dia_semana)
);
