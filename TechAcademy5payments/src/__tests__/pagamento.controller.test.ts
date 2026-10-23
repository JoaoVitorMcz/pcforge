import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { buscarPagamento } from "../config/database";

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

describe("API do serviço de Pagamentos", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "segredo_teste";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const token = (clienteId = 7) =>
    jwt.sign(
      { id_cliente: clienteId, email: "cliente@example.com", admin: false },
      "segredo_teste"
    );

  it("exige JWT local válido", async () => {
    const response = await request(app)
      .post("/pagamentos/mercado-pago/pedido/42/preference")
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.codigo).toBe("NAO_AUTENTICADO");
  });

  it("responde 409 quando o evento de pedido ainda não foi consumido", async () => {
    (buscarPagamento as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .post("/pagamentos/mercado-pago/pedido/42/preference")
      .set("Authorization", `Bearer ${token()}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.codigo).toBe("PEDIDO_AINDA_NAO_RECEBIDO");
  });
});
