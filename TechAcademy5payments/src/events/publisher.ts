import redisClient from "../config/redis";
import AppError from "../errors/app-error";
import {
  PAGAMENTO_APROVADO_EVENT,
  PagamentoAprovadoEvent,
} from "./pagamento-aprovado.event";

export async function publicarPagamentoAprovado(
  event: PagamentoAprovadoEvent
): Promise<void> {
  if (!redisClient.isReady) {
    throw new AppError(
      503,
      "Pagamento confirmado no Mercado Pago, mas o evento nao pode ser publicado.",
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
        "Pagamento confirmado no Mercado Pago, mas nenhum consumidor recebeu o evento.",
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
      "Pagamento confirmado no Mercado Pago, mas o evento nao pode ser publicado.",
      "EVENTO_INDISPONIVEL"
    );
  }
}
