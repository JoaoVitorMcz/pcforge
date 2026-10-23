import mysql, { RowDataPacket } from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "pcforge_pagamentos",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "rootpassword",
  connectionLimit: 10,
  decimalNumbers: true,
});

export interface PagamentoRow extends RowDataPacket {
  id_pedido: number;
  id_cliente: number;
  valor: number;
  cliente: { nome: string; email: string };
  itens: Array<{
    id_produto: number;
    nome: string;
    quantidade: number;
    preco_unitario: number;
  }>;
  preference_id: string | null;
  payment_id: number | null;
  status: string;
  aprovado_em: Date | null;
}

export interface Pagamento {
  id_pedido: number;
  id_cliente: number;
  valor: number;
  cliente: { nome: string; email: string };
  itens: Array<{
    id_produto: number;
    nome: string;
    quantidade: number;
    preco_unitario: number;
  }>;
  preference_id: string | null;
  payment_id: number | null;
  status: string;
  aprovado_em: Date | null;
}

export async function inicializarBanco(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id_pedido BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      id_cliente BIGINT UNSIGNED NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      cliente JSON NOT NULL,
      itens JSON NOT NULL,
      preference_id VARCHAR(128) NULL,
      payment_id BIGINT UNSIGNED NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      aprovado_em DATETIME(3) NULL,
      criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX idx_pagamentos_cliente (id_cliente),
      INDEX idx_pagamentos_payment (payment_id)
    )
  `);
}

export async function salvarPedido(event: {
  pedido_id: number;
  cliente: { id_cliente: number; nome: string; email: string };
  itens: Pagamento["itens"];
  valor: number;
}): Promise<boolean> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT IGNORE INTO pagamentos
      (id_pedido, id_cliente, valor, cliente, itens, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [
      event.pedido_id,
      event.cliente.id_cliente,
      event.valor,
      JSON.stringify({ nome: event.cliente.nome, email: event.cliente.email }),
      JSON.stringify(event.itens),
    ]
  );

  return result.affectedRows === 1;
}

export async function buscarPagamento(idPedido: number): Promise<Pagamento | null> {
  const [rows] = await pool.execute<PagamentoRow[]>(
    `SELECT id_pedido, id_cliente, valor, cliente, itens, preference_id,
      payment_id, status, aprovado_em
     FROM pagamentos WHERE id_pedido = ? LIMIT 1`,
    [idPedido]
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id_pedido: Number(row.id_pedido),
    id_cliente: Number(row.id_cliente),
    valor: Number(row.valor),
    cliente: row.cliente,
    itens: row.itens,
    preference_id: row.preference_id,
    payment_id: row.payment_id ? Number(row.payment_id) : null,
    status: row.status,
    aprovado_em: row.aprovado_em,
  };
}

export async function salvarPreferencia(
  idPedido: number,
  preferenceId: string
): Promise<void> {
  await pool.execute(
    `UPDATE pagamentos
     SET preference_id = ?
     WHERE id_pedido = ? AND status <> 'approved'`,
    [preferenceId, idPedido]
  );
}

export async function salvarStatusPagamento(
  idPedido: number,
  paymentId: number,
  status: string,
  aprovadoEm: Date | null
): Promise<void> {
  await pool.execute(
    `UPDATE pagamentos
     SET payment_id = ?, status = ?, aprovado_em = ?
     WHERE id_pedido = ?`,
    [paymentId, status, aprovadoEm, idPedido]
  );
}

export async function fecharBanco(): Promise<void> {
  await pool.end();
}

export default pool;
