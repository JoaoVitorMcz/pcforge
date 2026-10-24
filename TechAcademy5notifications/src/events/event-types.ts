export const EVENTOS_NOTIFICACOES = [
  "pedido.criado.v1",
  "pedido.status-alterado.v1",
  "pagamento.aprovado.v1",
] as const;

export type TipoEventoNotificacao = (typeof EVENTOS_NOTIFICACOES)[number];
