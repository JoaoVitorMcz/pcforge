import { Request, Response } from "express";
import { Op, fn, col } from "sequelize";
import Cliente from "../models/Cliente";
import Produto from "../models/Produto";
import Pedido from "../models/Pedido";

/** Status que um pedido pode assumir, na mesma ordem em que a UI os exibe. */
const STATUS_PEDIDO = [
  "pendente",
  "pago",
  "em_preparacao",
  "enviado",
  "entregue",
  "cancelado",
] as const;

/** Pedidos que ja representam dinheiro entrando. */
const STATUS_FATURADOS = ["pago", "enviado", "entregue"];

/** Abaixo disso o produto entra no alerta de reposicao. */
const LIMITE_ESTOQUE_BAIXO = 5;

export const obterDashboard = async (_req: Request, res: Response): Promise<void> => {

    const [contagens, faturamento, totalClientesAtivos, totalProdutosAtivos, produtosEstoqueBaixo] =
      await Promise.all([
        Pedido.findAll({
          attributes: ["status", [fn("COUNT", col("id_pedido")), "total"]],
          group: ["status"],
          raw: true,
        }) as unknown as Promise<{ status: string | null; total: number }[]>,

        Pedido.sum("valor", { where: { status: { [Op.in]: STATUS_FATURADOS } } }),

        Cliente.count({ where: { ativo: true } }),

        Produto.count({ where: { ativo: true } }),

        Produto.findAll({
          attributes: ["id_produto", "nome", "estoque"],
          where: { ativo: true, estoque: { [Op.lt]: LIMITE_ESTOQUE_BAIXO } },
          order: [["estoque", "ASC"]],
          raw: true,
        }),
      ]);

    // Garante que todo status conhecido apareca, mesmo zerado, para o app nao
    // precisar tratar chave ausente.
    const pedidosPorStatus = Object.fromEntries(
      STATUS_PEDIDO.map((status) => [
        status,
        Number(contagens.find((linha) => linha.status === status)?.total ?? 0),
      ])
    );

    const totalPedidos = Object.values(pedidosPorStatus).reduce((soma, qtd) => soma + qtd, 0);

    res.status(200).json({
      totalPedidos,
      pedidosPorStatus,
      faturamento: Number(faturamento ?? 0),
      totalClientesAtivos,
      totalProdutosAtivos,
      produtosEstoqueBaixo,
    });

};
