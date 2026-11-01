import { invalidarCachePorPrefixo } from "../utils/cache";
import { logError } from "../utils/logger";
import {
  parseProdutoAtualizadoEvent,
  PRODUTO_ATUALIZADO_EVENT,
} from "./produto.event";

export async function processarProdutoAtualizado(
  message: string
): Promise<void> {
  const event = parseProdutoAtualizadoEvent(message);
  if (!event) {
    logError("Evento produto.atualizado.v1 ignorado: payload inválido", {
      eventName: PRODUTO_ATUALIZADO_EVENT,
    });
    return;
  }

  await invalidarCachePorPrefixo("produtos:");
}
