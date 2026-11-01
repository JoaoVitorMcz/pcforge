export const PRODUTO_ATUALIZADO_EVENT = "produto.atualizado.v1";

export interface ProdutoAtualizadoEvent {
  produto_id: number;
  atualizado_em: string;
}

export function parseProdutoAtualizadoEvent(
  message: string
): ProdutoAtualizadoEvent | null {
  try {
    const event: unknown = JSON.parse(message);
    if (!event || typeof event !== "object") {
      return null;
    }

    const payload = event as Record<string, unknown>;
    const atualizadoEm =
      typeof payload.atualizado_em === "string" ? payload.atualizado_em : "";

    if (
      !Number.isInteger(payload.produto_id) ||
      Number(payload.produto_id) < 1 ||
      !atualizadoEm ||
      Number.isNaN(Date.parse(atualizadoEm))
    ) {
      return null;
    }

    return {
      produto_id: Number(payload.produto_id),
      atualizado_em: atualizadoEm,
    };
  } catch {
    return null;
  }
}
