-- Estrutura inicial para futura migração do Mapa de Sala para MySQL.
CREATE DATABASE IF NOT EXISTS mapa_sala CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mapa_sala;

CREATE TABLE cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE ambientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo ENUM('Sala','Informática','Saúde','Engenharia','EAD','Auditório','Outro') NOT NULL DEFAULT 'Sala',
  bloco VARCHAR(80), andar VARCHAR(40), capacidade INT, ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE disciplinas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(180) NOT NULL,
  codigo VARCHAR(50),
  curso_id INT,
  FOREIGN KEY (curso_id) REFERENCES cursos(id)
);

CREATE TABLE turmas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  curso_id INT NOT NULL,
  semestre INT,
  grupo VARCHAR(50),
  turno ENUM('Matutino','Noturno','Integral','EAD') NOT NULL,
  FOREIGN KEY (curso_id) REFERENCES cursos(id)
);

CREATE TABLE horarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  turma_id INT NOT NULL,
  disciplina_id INT NOT NULL,
  ambiente_id INT NOT NULL,
  dia_semana ENUM('Seg','Ter','Qua','Qui','Sex','Sab') NOT NULL,
  inicio TIME NOT NULL,
  fim TIME,
  modalidade ENUM('Presencial','Híbrida','EAD') NOT NULL DEFAULT 'Presencial',
  FOREIGN KEY (turma_id) REFERENCES turmas(id),
  FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
  FOREIGN KEY (ambiente_id) REFERENCES ambientes(id)
);
