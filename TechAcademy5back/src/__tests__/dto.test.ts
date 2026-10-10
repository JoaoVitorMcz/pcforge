import {
  validarCriacaoPedido,
  validarCriacaoProduto,
  validarAtualizacaoPedido,
  validarAtualizacaoProduto,
} from "../utils/dto";

describe("DTOs de entrada", () => {
  it("normaliza os campos permitidos para criar produto", () => {
    expect(validarCriacaoProduto({ nome: " GPU ", valor: "1200", admin: true })).toEqual({
      nome: "GPU",
      valor: 1200,
    });
  });

  it("rejeita pedido com quantidade inválida antes do service", () => {
    expect(() => validarCriacaoPedido({
      id_endereco_entrega: 1,
      itens: [{ id_produto: 2, quantidade: 0 }],
    })).toThrow("Cada item deve informar id_produto e quantidade válida.");
  });

  it("rejeita atualização de produto sem campos", () => {
    expect(() => validarAtualizacaoProduto({})).toThrow(
      "Informe ao menos um campo para atualizar o produto."
    );
  });

  it("valida o DTO de atualização de status de pedido", () => {
    expect(validarAtualizacaoPedido({ status: "pago", campoInterno: "ignorado" })).toEqual({
      status: "pago",
    });
  });
});
