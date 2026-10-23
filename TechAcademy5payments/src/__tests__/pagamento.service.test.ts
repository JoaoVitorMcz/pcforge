jest.mock("../config/database", () => ({
  buscarPagamento: jest.fn(),
  salvarPreferencia: jest.fn(),
  salvarStatusPagamento: jest.fn(),
}));
jest.mock("../services/mercado-pago.service", () => ({
  criarPreferenciaMercadoPago: jest.fn(),
  buscarPagamentoMercadoPago: jest.fn(),
}));
jest.mock("../events/publisher", () => ({
  publicarPagamentoAprovado: jest.fn(),
}));

import {
  buscarPagamento,
  Pagamento,
  salvarPreferencia,
  salvarStatusPagamento,
} from "../config/database";
import { publicarPagamentoAprovado } from "../events/publisher";
import {
  buscarPagamentoMercadoPago,
  criarPreferenciaMercadoPago,
} from "../services/mercado-pago.service";
import {
  confirmarPagamento,
  gerarPreferencia,
} from "../services/pagamento.service";

describe("serviço de pagamentos", () => {
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
  const cliente = { id_cliente: 7, email: "cliente@example.com" };

  beforeEach(() => {
    jest.clearAllMocks();
    (buscarPagamento as jest.Mock).mockResolvedValue(pagamento);
    (salvarPreferencia as jest.Mock).mockResolvedValue(undefined);
    (salvarStatusPagamento as jest.Mock).mockResolvedValue(undefined);
    (publicarPagamentoAprovado as jest.Mock).mockResolvedValue(undefined);
  });

  it("retorna 409 quando pedido.criado.v1 ainda não chegou", async () => {
    (buscarPagamento as jest.Mock).mockResolvedValue(null);

    await expect(gerarPreferencia(42, cliente)).rejects.toMatchObject({
      statusCode: 409,
      code: "PEDIDO_AINDA_NAO_RECEBIDO",
    });
  });

  it("não permite gerar checkout de pedido de outro cliente", async () => {
    await expect(
      gerarPreferencia(42, { id_cliente: 99, email: "outro@example.com" })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(criarPreferenciaMercadoPago).not.toHaveBeenCalled();
  });

  it("gera e persiste a preferência preservando o contrato de resposta do checkout", async () => {
    (criarPreferenciaMercadoPago as jest.Mock).mockResolvedValue({
      id: "pref-123",
      init_point: "https://mp.example/checkout",
      sandbox_init_point: "https://sandbox.mp.example/checkout",
    });

    const response = await gerarPreferencia(42, cliente, "http://localhost:3001");

    expect(salvarPreferencia).toHaveBeenCalledWith(42, "pref-123");
    expect(response).toMatchObject({
      pedido: { id_pedido: 42, status: "pendente", valor: 50 },
      init_point: "https://mp.example/checkout",
      sandbox_init_point: "https://sandbox.mp.example/checkout",
    });
  });

  it("confirma o pagamento somente após verificar pedido, moeda e valor no Mercado Pago", async () => {
    (buscarPagamentoMercadoPago as jest.Mock).mockResolvedValue({
      id: 9001,
      status: "approved",
      external_reference: "42",
      transaction_amount: 50,
      currency_id: "BRL",
      date_approved: "2026-10-23T20:00:00.000Z",
    });

    const response = await confirmarPagamento(42, 9001, "approved", cliente);

    expect(salvarStatusPagamento).toHaveBeenCalledWith(
      42,
      9001,
      "approved",
      new Date("2026-10-23T20:00:00.000Z")
    );
    expect(publicarPagamentoAprovado).toHaveBeenCalledWith({
      pedidoId: 42,
      paymentId: 9001,
      aprovadoEm: "2026-10-23T20:00:00.000Z",
    });
    expect(response).toMatchObject({
      paymentStatus: "approved",
      verifiedWithMercadoPago: true,
      pedido: { id_pedido: 42, status: "pago" },
    });
  });

  it("recusa pagamento associado a pedido diferente e não publica aprovação", async () => {
    (buscarPagamentoMercadoPago as jest.Mock).mockResolvedValue({
      id: 9001,
      status: "approved",
      external_reference: "43",
      transaction_amount: 50,
      currency_id: "BRL",
    });

    await expect(confirmarPagamento(42, 9001, "approved", cliente)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(salvarStatusPagamento).not.toHaveBeenCalled();
    expect(publicarPagamentoAprovado).not.toHaveBeenCalled();
  });
});
