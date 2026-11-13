import { Pagamento } from "../config/database";
import {
  buscarPagamentoMercadoPago,
  criarPreferenciaMercadoPago,
} from "../services/mercado-pago.service";

describe("integração com Mercado Pago", () => {
  const pagamento: Pagamento = {
    id_pedido: 42,
    id_cliente: 7,
    valor: 50,
    cliente: { nome: "Cliente de teste", email: "cliente@example.com" },
    itens: [
      {
        id_produto: 11,
        nome: "Produto de teste",
        quantidade: 2,
        preco_unitario: 25,
      },
    ],
    preference_id: null,
    payment_id: null,
    status: "pending",
    aprovado_em: null,
  };
  let fetchMock: jest.SpyInstance;
  let originalAccessToken: string | undefined;
  let originalFrontendUrl: string | undefined;
  let originalCorsOrigins: string | undefined;

  beforeEach(() => {
    originalAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    originalFrontendUrl = process.env.FRONTEND_URL;
    originalCorsOrigins = process.env.CORS_ORIGINS;
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-token-de-teste";
    process.env.FRONTEND_URL = "https://pcforge.local";
    process.env.CORS_ORIGINS =
      "https://pcforge.local,http://localhost:3001";
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
    if (originalAccessToken === undefined) {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    } else {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = originalAccessToken;
    }
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
  });

  it("cria preferência com o pedido armazenado e URLs de retorno da web", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pref-123",
          init_point: "https://mp.example/checkout",
          sandbox_init_point: "https://sandbox.mp.example/checkout",
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      )
    );

    const preference = await criarPreferenciaMercadoPago(
      pagamento,
      "https://pcforge.local"
    );
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);

    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect(request.headers.Authorization).toBe("Bearer TEST-token-de-teste");
    expect(body).toMatchObject({
      external_reference: "42",
      back_urls: {
        success: "https://pcforge.local/checkout/retorno?pedido=42",
      },
      payer: { name: "Cliente de teste", email: "cliente@example.com" },
      items: [
        {
          id: "11",
          title: "Produto de teste",
          quantity: 2,
          currency_id: "BRL",
          unit_price: 25,
        },
      ],
    });
    expect(preference.id).toBe("pref-123");
  });

  it("consulta o pagamento pelo ID no endpoint oficial", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 9001,
          status: "approved",
          external_reference: "42",
          transaction_amount: 50,
          currency_id: "BRL",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const payment = await buscarPagamentoMercadoPago(9001);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.mercadopago.com/v1/payments/9001"
    );
    expect(payment.status).toBe("approved");
  });

  it("repete consultas GET em falha de rede e aplica timeout a cada tentativa", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 9001,
            status: "approved",
            external_reference: "42",
            transaction_amount: 50,
            currency_id: "BRL",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    await expect(buscarPagamentoMercadoPago(9001)).resolves.toMatchObject({
      status: "approved",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("repete consultas GET em respostas HTTP transitórias", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("indisponível", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 9001, status: "approved" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    await expect(buscarPagamentoMercadoPago(9001)).resolves.toMatchObject({
      status: "approved",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 502, "MERCADO_PAGO_ERRO"],
    [429, 503, "MERCADO_PAGO_RATE_LIMIT"],
  ])("não repete consultas GET para HTTP %i", async (status, errorStatus, code) => {
    fetchMock.mockResolvedValue(new Response("solicitacao rejeitada", { status }));

    await expect(buscarPagamentoMercadoPago(9001)).rejects.toMatchObject({
      statusCode: errorStatus,
      code,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não repete a criação de preferência POST quando o Mercado Pago retorna 5xx", async () => {
    fetchMock.mockResolvedValue(
      new Response("indisponível", { status: 503 })
    );

    await expect(criarPreferenciaMercadoPago(pagamento)).rejects.toMatchObject({
      statusCode: 502,
      code: "MERCADO_PAGO_INDISPONIVEL",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("interrompe a chamada quando o Mercado Pago excede o timeout", async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    }));

    const preferenceRequest = criarPreferenciaMercadoPago(pagamento);
    const timeoutAssertion = expect(preferenceRequest).rejects.toMatchObject({
      statusCode: 504,
      code: "MERCADO_PAGO_TIMEOUT",
    });
    await jest.advanceTimersByTimeAsync(8_000);

    await timeoutAssertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recusa uma origem de retorno que não foi permitida", async () => {
    await expect(
      criarPreferenciaMercadoPago(pagamento, "https://attacker.example")
    ).rejects.toMatchObject({ statusCode: 400, code: "REQUISICAO_INVALIDA" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expõe indisponibilidade do token sem fazer chamada externa", async () => {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;

    await expect(criarPreferenciaMercadoPago(pagamento)).rejects.toMatchObject({
      statusCode: 500,
      code: "CONFIGURACAO_INVALIDA",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
