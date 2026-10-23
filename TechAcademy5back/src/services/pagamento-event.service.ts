import AppError from "../utils/app-error";
import redisClient from "../config/redis";
import {
  PAGAMENTO_APROVADO_EVENT,
  PagamentoAprovadoEvent,
} from "../events/pagamento-aprovado.event";

export async function publicarPagamentoAprovado(
  event: PagamentoAprovadoEvent
): Promise<void> {
  if (!redisClient.isReady) {
    throw new AppError(
      503,
      "O servico de eventos esta indisponivel para confirmar o pagamento.",
      "EVENTO_INDISPONIVEL"
    );
  }

  try {
    const consumidores = await redisClient.publish(
      PAGAMENTO_APROVADO_EVENT,
      JSON.stringify(event)
    );

    if (consumidores === 0) {
      throw new AppError(
        503,
        "Nenhum consumidor recebeu o evento de pagamento aprovado.",
        "EVENTO_SEM_CONSUMIDOR"
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Falha ao publicar evento de pagamento aprovado:", error);
    throw new AppError(
      503,
      "Nao foi possivel publicar o evento de pagamento aprovado.",
      "EVENTO_INDISPONIVEL"
    );
  }
}
