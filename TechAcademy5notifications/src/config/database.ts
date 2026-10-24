import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "pcforge_notificacoes",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "rootpassword",
  connectionLimit: 10,
});

export interface EventoArmazenado {
  id: number;
  recebidoEm: string;
}

export async function inicializarBanco(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_recebidos (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tipo_evento VARCHAR(64) NOT NULL,
      payload JSON NOT NULL,
      recebido_em DATETIME(3) NOT NULL,
      INDEX idx_eventos_tipo_data (tipo_evento, recebido_em)
    )
  `);
}

export async function salvarEvento(
  tipoEvento: string,
  payload: unknown
): Promise<EventoArmazenado> {
  const recebidoEm = new Date().toISOString();
  const recebidoEmBanco = recebidoEm.slice(0, 23).replace("T", " ");
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO eventos_recebidos (tipo_evento, payload, recebido_em)
     VALUES (?, ?, ?)`,
    [tipoEvento, JSON.stringify(payload), recebidoEmBanco]
  );

  return {
    id: result.insertId,
    recebidoEm,
  };
}

export async function fecharBanco(): Promise<void> {
  await pool.end();
}
