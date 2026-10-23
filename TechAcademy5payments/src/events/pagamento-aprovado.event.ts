export const PAGAMENTO_APROVADO_EVENT = "pagamento.aprovado.v1";

export interface PagamentoAprovadoEvent {
  pedidoId: number;
  paymentId: number;
  aprovadoEm: string;
}
