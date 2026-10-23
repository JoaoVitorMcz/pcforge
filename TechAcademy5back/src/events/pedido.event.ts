export const PEDIDO_CRIADO_EVENT = "pedido.criado.v1";
export const PEDIDO_STATUS_ALTERADO_EVENT = "pedido.status-alterado.v1";

export interface PedidoCriadoEvent {
  pedido_id: number;
  cliente: {
    id_cliente: number;
    nome: string;
    email: string;
  };
  itens: Array<{
    id_produto: number;
    nome: string;
    quantidade: number;
    preco_unitario: number;
  }>;
  valor: number;
  criado_em: string;
}

export interface PedidoStatusAlteradoEvent {
  pedido_id: number;
  status_anterior: string;
  status_atual: string;
  alterado_em: string;
}
