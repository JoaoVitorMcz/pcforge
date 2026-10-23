import { Request, Response } from "express";
import Pedido from "../models/Pedido";
import ItemPedido from "../models/Itempedido";
import Produto from "../models/Produto";
import Cliente from "../models/Cliente";
import Endereco from "../models/Endereco";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { criarPedidoComItens } from "../services/pedido.service";
import sequelize from "../config/database";
import AppError from "../utils/app-error";
import { publicarPedidoStatusAlterado } from "../services/pedido-event.service";

/**
 * Transicoes de status que o pedido aceita.
 *
 * Sem isto o handler so conferia se o status existia na lista, entao um pedido
 * "entregue" podia voltar para "pendente" e um "cancelado" podia ser revivido.
 * "entregue" e "cancelado" sao terminais: nada sai deles.
 */
const TRANSICOES_DE_STATUS: Record<string, string[]> = {
  pendente: ["pago", "cancelado"],
  pago: ["em_preparacao", "cancelado"],
  em_preparacao: ["enviado", "cancelado"],
  enviado: ["entregue"],
  entregue: [],
  cancelado: [],
};

const getClienteAutenticado = (req: Request) => {
  if (!req.cliente) {
    throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");
  }

  return req.cliente;
};


export const listarPedidos = async (req: Request, res: Response): Promise<void> => {

    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const baseOptions = {
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id_cliente", "nome", "email"],
        },
        {
          model: Endereco,
          as: "endereco_entrega",
        },
        {
          model: ItemPedido,
          as: "itens",
          include: [
            {
              model: Produto,
              as: "produto",
              attributes: ["id_produto", "nome", "valor"],
            },
          ],
        },
      ],
      order: [["data_pedido", "DESC"]] as [["data_pedido", "DESC"]],
      distinct: true,
    };

    const { rows: pedidos, count } = shouldPaginate
      ? await Pedido.findAndCountAll({
          ...baseOptions,
          limit,
          offset,
        })
      : await Pedido.findAndCountAll(baseOptions);

    res
      .status(200)
      .json(shouldPaginate ? buildPaginatedResponse(pedidos, count, page, limit) : pedidos);

};


export const listarPedidosPorCliente = async (
  req: Request,
  res: Response
): Promise<void> => {

    const id_cliente = Number(req.params.id_cliente);
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const baseOptions = {
      where: { id_cliente },
      include: [
        {
          model: Endereco,
          as: "endereco_entrega",
        },
        {
          model: ItemPedido,
          as: "itens",
          include: [
            {
              model: Produto,
              as: "produto",
              attributes: ["id_produto", "nome", "valor", "imagem"],
            },
          ],
        },
      ],
      order: [["data_pedido", "DESC"]] as [["data_pedido", "DESC"]],
      distinct: true,
    };

    const { rows: pedidos, count } = shouldPaginate
      ? await Pedido.findAndCountAll({
          ...baseOptions,
          limit,
          offset,
        })
      : await Pedido.findAndCountAll(baseOptions);

    res
      .status(200)
      .json(shouldPaginate ? buildPaginatedResponse(pedidos, count, page, limit) : pedidos);

};


export const buscarPedidoPorId = async (req: Request, res: Response): Promise<void> => {

    const id_pedido = Number(req.params.id);
    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const pedido = await Pedido.findByPk(id_pedido, {
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id_cliente", "nome", "email", "telefone"],
        },
        {
          model: Endereco,
          as: "endereco_entrega",
        },
        {
          model: ItemPedido,
          as: "itens",
          include: [
            {
              model: Produto,
              as: "produto",
              attributes: ["id_produto", "nome", "valor", "imagem"],
            },
          ],
        },
      ],
    });

    if (!pedido) {
      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    if (!clienteLogado.admin && pedido.id_cliente !== clienteLogado.id_cliente) {
      throw new AppError(403, "Voce nao tem permissao para acessar este pedido.", "ACESSO_NEGADO");

    }

    res.status(200).json(pedido);

};


export const criarPedido = async (req: Request, res: Response): Promise<void> => {

    const clienteAutenticado = req.cliente;
    const isAdmin = clienteAutenticado?.admin === true;
    const idCliente =
      isAdmin && req.body.id_cliente
        ? Number(req.body.id_cliente)
        : Number(clienteAutenticado?.id_cliente);

    if (!idCliente) {
      throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");

    }

    const pedidoCriado = await criarPedidoComItens(
      {
        id_cliente: idCliente,
        id_endereco_entrega: Number(req.body.id_endereco_entrega),
        metodo: req.body.metodo || null,
        itens: req.body.itens,
      },
      isAdmin
    );

    res.status(201).json({ mensagem: "Pedido criado com sucesso.", pedido: pedidoCriado });

};

interface PedidoUpdateData {
  status: string;
  data_pagamento?: Date;
}


export const atualizarStatusPedido = async (req: Request, res: Response): Promise<void> => {

    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const id_pedido = Number(req.params.id);
    const { status, data_pagamento } = req.body;

    // Derivado da maquina de estados para as duas listas nao divergirem.
    const statusValidos = Object.keys(TRANSICOES_DE_STATUS);

    if (!status || !statusValidos.includes(status)) {
      throw new AppError(400, `Status invalido. Use um dos seguintes: ${statusValidos.join(", ")}.`, "REQUISICAO_INVALIDA");

    }

    const pedido = await Pedido.findByPk(id_pedido);

    if (!pedido) {
      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    const statusAtual = pedido.status ?? "pendente";
    const destinosPermitidos = TRANSICOES_DE_STATUS[statusAtual] ?? [];

    if (status !== statusAtual && !destinosPermitidos.includes(status)) {
      throw new AppError(409, destinosPermitidos.length
          ? `Nao e possivel mudar de "${statusAtual}" para "${status}". Transicoes validas: ${destinosPermitidos.join(", ")}.`
          : `Pedido com status "${statusAtual}" e final e nao aceita mudanca de status.`, "CONFLITO");

    }

    const dadosAtualizados: PedidoUpdateData = { status };

    if (status === "pago" && !pedido.data_pagamento) {
      dadosAtualizados.data_pagamento = data_pagamento ? new Date(data_pagamento) : new Date();
    }

    await pedido.update(dadosAtualizados);

    if (status !== statusAtual) {
      await publicarPedidoStatusAlterado({
        pedido_id: id_pedido,
        status_anterior: statusAtual,
        status_atual: status,
        alterado_em: new Date().toISOString(),
      });
    }

    res.status(200).json({ mensagem: "Status do pedido atualizado.", pedido });

};


export const cancelarPedido = async (req: Request, res: Response): Promise<void> => {

    const id_pedido = Number(req.params.id);
    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const pedido = await Pedido.findByPk(id_pedido);

    if (!pedido) {
      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    if (!clienteLogado.admin && pedido.id_cliente !== clienteLogado.id_cliente) {
      throw new AppError(403, "Voce nao tem permissao para cancelar este pedido.", "ACESSO_NEGADO");

    }

    const statusNaoCancelaveis = ["enviado", "entregue", "cancelado"];

    if (statusNaoCancelaveis.includes(pedido.status ?? "")) {
      throw new AppError(409, `Pedido com status "${pedido.status}" nao pode ser cancelado.`, "CONFLITO");

    }

    // Devolver o estoque e o cancelamento tem de acontecer juntos: se a
    // devolucao falhasse depois do update, o produto ficaria com estoque preso
    // num pedido que nao existe mais. A guarda de statusNaoCancelaveis acima
    // impede cancelar duas vezes e devolver em dobro.
    const statusAnterior = pedido.status ?? "pendente";
    const transaction = await sequelize.transaction();

    try {
      const itens = await ItemPedido.findAll({ where: { id_pedido }, transaction });

      for (const item of itens) {
        await Produto.increment("estoque", {
          by: item.quantidade,
          where: { id_produto: item.id_produto },
          transaction,
        });
      }

      await pedido.update({ status: "cancelado" }, { transaction });
      await transaction.commit();
    } catch (erroCancelamento) {
      await transaction.rollback();
      throw erroCancelamento;
    }

    await publicarPedidoStatusAlterado({
      pedido_id: id_pedido,
      status_anterior: statusAnterior,
      status_atual: "cancelado",
      alterado_em: new Date().toISOString(),
    });

    res.status(200).json({ mensagem: "Pedido cancelado com sucesso." });

};