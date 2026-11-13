import AppError from "../errors/app-error";
import { Pagamento } from "../config/database";
import CircuitBreaker from "./circuit-breaker";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_GET_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 300;
const MAX_RETRY_DELAY_MS = 2_000;
const RETRY_JITTER_MS = 250;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT_MS = 30_000;

const mercadoPagoCircuitBreaker = new CircuitBreaker({
  failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
  resetTimeoutMs: CIRCUIT_RESET_TIMEOUT_MS,
});

const TRANSIENT_ERROR_CODES = new Set([
  "MERCADO_PAGO_TIMEOUT",
  "MERCADO_PAGO_INDISPONIVEL",
  "MERCADO_PAGO_RATE_LIMIT",
]);

interface MercadoPagoPreference {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface MercadoPagoPayment {
  id?: number;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
}

function getAccessToken(): string {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new AppError(
      500,
      "MERCADO_PAGO_ACCESS_TOKEN nao configurado no servico de Pagamentos.",
      "CONFIGURACAO_INVALIDA"
    );
  }

  return accessToken;
}

function resolveFrontendUrl(frontendUrl?: string): string {
  const defaultUrl = process.env.FRONTEND_URL || "http://localhost:3001";

  if (!frontendUrl) {
    try {
      const parsed = new URL(defaultUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Protocolo inválido.");
      }
      return parsed.origin;
    } catch {
      throw new AppError(
        500,
        "FRONTEND_URL nao contem uma origem HTTP valida.",
        "CONFIGURACAO_INVALIDA"
      );
    }
  }

  let requestedUrl: URL;
  try {
    requestedUrl = new URL(frontendUrl);
  } catch {
    throw new AppError(400, "frontend_url invalida.", "REQUISICAO_INVALIDA");
  }

  if (!["http:", "https:"].includes(requestedUrl.protocol)) {
    throw new AppError(400, "frontend_url deve usar HTTP ou HTTPS.", "REQUISICAO_INVALIDA");
  }

  const allowedOrigins = new Set(
    [
      defaultUrl,
      ...(process.env.CORS_ORIGINS || "").split(","),
      "http://localhost:3001",
      "http://localhost:8081",
    ]
      .map((origin) => {
        try {
          return new URL(origin.trim()).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
  );

  if (!allowedOrigins.has(requestedUrl.origin)) {
    throw new AppError(400, "frontend_url nao esta entre as origens permitidas.", "REQUISICAO_INVALIDA");
  }

  return requestedUrl.origin;
}

async function parseResponse(
  response: Response,
  signal: AbortSignal
): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    throw new AppError(
      502,
      "Mercado Pago retornou uma resposta invalida.",
      "MERCADO_PAGO_ERRO"
    );
  }
}

async function requestMercadoPago(
  path: string,
  init: RequestInit
): Promise<unknown> {
  return mercadoPagoCircuitBreaker.execute(
    async () => {
      const method = (init.method || "GET").toUpperCase();
      const maxRetries = method === "GET" ? MAX_GET_RETRIES : 0;

      for (let attempt = 0; ; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS
        );

        try {
          const response = await fetch(`https://api.mercadopago.com${path}`, {
            ...init,
            signal: controller.signal,
          });
          if (
            method === "GET" &&
            deveTentarNovamente(response.status) &&
            attempt < maxRetries
          ) {
            await response.body?.cancel();
            clearTimeout(timeout);
            await aguardarRetry(attempt);
            continue;
          }

          if (response.status === 429) {
            throw new AppError(
              503,
              "Mercado Pago limitou temporariamente as requisicoes.",
              "MERCADO_PAGO_RATE_LIMIT"
            );
          }
          if (response.status >= 500) {
            throw new AppError(
              502,
              "Mercado Pago está temporariamente indisponível.",
              "MERCADO_PAGO_INDISPONIVEL"
            );
          }

          const data = await parseResponse(response, controller.signal);
          if (!response.ok) {
            const detail = typeof data === "string" ? data : JSON.stringify(data);
            throw new AppError(
              502,
              `Mercado Pago rejeitou a solicitacao: ${detail}`,
              "MERCADO_PAGO_ERRO"
            );
          }

          return data;
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }

          const timedOut = controller.signal.aborted;
          const requestError = new AppError(
            timedOut ? 504 : 502,
            timedOut
              ? "Tempo limite ao acessar o Mercado Pago."
              : "Nao foi possivel acessar o Mercado Pago.",
            timedOut ? "MERCADO_PAGO_TIMEOUT" : "MERCADO_PAGO_INDISPONIVEL"
          );

          if (
            attempt < maxRetries &&
            (timedOut || error instanceof TypeError)
          ) {
            clearTimeout(timeout);
            await aguardarRetry(attempt);
            continue;
          }

          console.error("Falha ao acessar o Mercado Pago:", {
            error: error instanceof Error ? error.name : "UnknownError",
            code: requestError.code,
          });
          throw requestError;
        } finally {
          clearTimeout(timeout);
        }
      }
    },
    (error) =>
      error instanceof AppError && TRANSIENT_ERROR_CODES.has(error.code)
  );
}

function deveTentarNovamente(statusCode: number): boolean {
  return statusCode >= 500;
}

async function aguardarRetry(retryIndex: number): Promise<void> {
  const exponentialDelay = Math.min(
    INITIAL_RETRY_DELAY_MS * 2 ** retryIndex,
    MAX_RETRY_DELAY_MS
  );
  const jitter = Math.floor(Math.random() * RETRY_JITTER_MS);
  await new Promise<void>((resolve) =>
    setTimeout(resolve, exponentialDelay + jitter)
  );
}

export async function criarPreferenciaMercadoPago(
  pagamento: Pagamento,
  frontendUrl?: string
): Promise<MercadoPagoPreference> {
  const accessToken = getAccessToken();
  const frontendBaseUrl = resolveFrontendUrl(frontendUrl);
  const retornoUrl = new URL("/checkout/retorno", frontendBaseUrl);
  retornoUrl.searchParams.set("pedido", String(pagamento.id_pedido));

  const data = await requestMercadoPago("/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_reference: String(pagamento.id_pedido),
      back_urls: {
        success: retornoUrl.toString(),
        failure: retornoUrl.toString(),
        pending: retornoUrl.toString(),
      },
      payer: {
        name: pagamento.cliente.nome || undefined,
        email: pagamento.cliente.email || undefined,
      },
      items: pagamento.itens.map((item, index) => ({
        id: String(item.id_produto || index + 1),
        title: item.nome,
        quantity: item.quantidade,
        currency_id: "BRL",
        unit_price: item.preco_unitario,
      })),
    }),
  });

  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as Record<string, unknown>).id !== "string"
  ) {
    throw new AppError(
      502,
      "Mercado Pago retornou uma preferencia invalida.",
      "MERCADO_PAGO_ERRO"
    );
  }

  return data as MercadoPagoPreference;
}

export async function buscarPagamentoMercadoPago(
  paymentId: number
): Promise<MercadoPagoPayment> {
  const accessToken = getAccessToken();
  const data = await requestMercadoPago(`/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof (data as Record<string, unknown>).status !== "string"
  ) {
    throw new AppError(
      502,
      "Mercado Pago retornou um pagamento invalido.",
      "MERCADO_PAGO_ERRO"
    );
  }

  return data as MercadoPagoPayment;
}
