import { salvarEvento } from "../config/database";
import { TipoEventoNotificacao } from "./event-types";

export async function processarEvento(
  tipoEvento: TipoEventoNotificacao,
  mensagem: string
): Promise<void> {
  let payload: unknown;

  try {
    payload = JSON.parse(mensagem);
  } catch (error) {
    throw new Error(`Payload JSON inválido recebido em ${tipoEvento}.`, {
      cause: error,
    });
  }

  const evento = await salvarEvento(tipoEvento, payload);
  console.info(
    `Evento ${tipoEvento} recebido e armazenado (id=${evento.id}, recebidoEm=${evento.recebidoEm}).`
  );
}
