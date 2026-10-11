import { mapearClienteResposta } from "../utils/dto";

describe("DTO de saída do cliente", () => {
  it("remove campos adicionais e o hash da senha", () => {
    const cliente = {
      id_cliente: 7,
      nome: "Ana",
      email: "ana@example.com",
      telefone: null,
      cpf: "12345678901",
      ativo: true,
      admin: false,
      senha: "hash-secreto",
      campo_interno: "nao deve sair",
    };

    expect(mapearClienteResposta(cliente)).toEqual({
      id_cliente: 7,
      nome: "Ana",
      email: "ana@example.com",
      telefone: null,
      cpf: "12345678901",
      ativo: true,
      admin: false,
    });
  });
});
