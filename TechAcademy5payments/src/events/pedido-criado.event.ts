export const PEDIDO_CRIADO_EVENT = "pedido.criado.v1";

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

export function parsePedidoCriadoEvent(message: string): PedidoCriadoEvent | null {
  try {
    const value: unknown = JSON.parse(message);

    if (!value || typeof value !== "object") {
      return null;
    }

    const event = value as Record<string, unknown>;
    const cliente = event.cliente as Record<string, unknown> | undefined;
    const itens = event.itens;

    if (
      !Number.isInteger(event.pedido_id) ||
      Number(event.pedido_id) < 1 ||
      !cliente ||
      !Number.isInteger(cliente.id_cliente) ||
      Number(cliente.id_cliente) < 1 ||
      typeof cliente.nome !== "string" ||
      typeof cliente.email !== "string" ||
      !Array.isArray(itens) ||
      itens.length === 0 ||
      !Number.isFinite(event.valor) ||
      Number(event.valor) <= 0 ||
      typeof event.criado_em !== "string" ||
      Number.isNaN(Date.parse(event.criado_em))
    ) {
      return null;
    }

    const itensValidos = itens.every((item: unknown) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const linha = item as Record<string, unknown>;
      return (
        Number.isInteger(linha.id_produto) &&
        Number(linha.id_produto) > 0 &&
        typeof linha.nome === "string" &&
        Number.isInteger(linha.quantidade) &&
        Number(linha.quantidade) > 0 &&
        Number.isFinite(linha.preco_unitario) &&
        Number(linha.preco_unitario) > 0
      );
    });

    if (!itensValidos) {
      return null;
    }

    return {
      pedido_id: Number(event.pedido_id),
      cliente: {
        id_cliente: Number(cliente.id_cliente),
        nome: cliente.nome,
        email: cliente.email,
      },
      itens: itens as PedidoCriadoEvent["itens"],
      valor: Number(event.valor),
      criado_em: event.criado_em,
    };
  } catch {
    return null;
  }
}
