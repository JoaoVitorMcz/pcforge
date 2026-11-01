import AppError from "../utils/app-error";
import redisClient from "../config/redis";
import { logError } from "../utils/logger";
import {
  PRODUTO_ATUALIZADO_EVENT,
  ProdutoAtualizadoEvent,
} from "../events/produto.event";

export async function publicarProdutoAtualizado(
  produtoId: number
): Promise<void> {
  const mensagemIndisponivel =
    `Produto ${produtoId} foi persistido, mas o evento ${PRODUTO_ATUALIZADO_EVENT} não foi entregue.`;

  if (!redisClient.isReady) {
    logError("Evento de produto não entregue", {
      eventName: PRODUTO_ATUALIZADO_EVENT,
      productId: produtoId,
      errorCode: "EVENTO_INDISPONIVEL",
    });
    throw new AppError(503, mensagemIndisponivel, "EVENTO_INDISPONIVEL");
  }

  const event: ProdutoAtualizadoEvent = {
    produto_id: produtoId,
    atualizado_em: new Date().toISOString(),
  };

  try {
    const consumidores = await redisClient.publish(
      PRODUTO_ATUALIZADO_EVENT,
      JSON.stringify(event)
    );

    if (consumidores === 0) {
      logError("Evento de produto sem consumidores", {
        eventName: PRODUTO_ATUALIZADO_EVENT,
        productId: produtoId,
        errorCode: "EVENTO_SEM_CONSUMIDOR",
      });
      throw new AppError(503, mensagemIndisponivel, "EVENTO_SEM_CONSUMIDOR");
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logError(
      "Falha ao publicar evento de produto",
      { eventName: PRODUTO_ATUALIZADO_EVENT, productId: produtoId },
      error
    );
    throw new AppError(503, mensagemIndisponivel, "EVENTO_INDISPONIVEL");
  }
}
