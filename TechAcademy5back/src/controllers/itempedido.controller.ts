import { Request, Response } from "express";
import { Transaction } from "sequelize";
import ItemPedido from "../models/Itempedido";
import Pedido from "../models/Pedido";
import Produto from "../models/Produto";
import sequelize from "../config/database";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import AppError from "../utils/app-error";

const getClienteAutenticado = (req: Request) => {
  if (!req.cliente) {
    throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");
  }

  return req.cliente;
};

const validarAcessoAoPedido = (req: Request, idClientePedido: number) => {
  const clienteLogado = getClienteAutenticado(req);
  if (!clienteLogado.admin && idClientePedido !== clienteLogado.id_cliente) {
    throw new AppError(403, "Voce nao tem permissao para acessar este pedido.", "ACESSO_NEGADO");
  }
};


export const listarItensDoPedido = async (req: Request, res: Response): Promise<void> => {

    const id_pedido = Number(req.params.id_pedido);
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;

    const pedido = await Pedido.findByPk(id_pedido);

    if (!pedido) {
      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    validarAcessoAoPedido(req, pedido.id_cliente);

    const baseOptions = {
      where: { id_pedido },
      include: [
        {
          model: Produto,
          as: "produto",
          attributes: ["id_produto", "nome", "descricao", "valor", "imagem"],
        },
      ],
      distinct: true,
    };

    const { rows: itens, count } = shouldPaginate
      ? await ItemPedido.findAndCountAll({
          ...baseOptions,
          limit,
          offset,
        })
      : await ItemPedido.findAndCountAll(baseOptions);

    res.status(200).json(shouldPaginate ? buildPaginatedResponse(itens, count, page, limit) : itens);

};


export const buscarItemPorId = async (req: Request, res: Response): Promise<void> => {

    const id_item = Number(req.params.id);

    const item = await ItemPedido.findByPk(id_item, {
      include: [
        {
          model: Produto,
          as: "produto",
          attributes: ["id_produto", "nome", "descricao", "valor", "imagem"],
        },
      ],
    });

    if (!item) {
      throw new AppError(404, "Item nao encontrado.", "NAO_ENCONTRADO");

    }

    const pedido = await Pedido.findByPk(item.id_pedido);

    if (!pedido) {
      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    validarAcessoAoPedido(req, pedido.id_cliente);

    res.status(200).json(item);

};


/**
 * Move estoque ao mexer nos itens de um pedido ja criado.
 *
 * O pedido baixa o estoque na criacao (pedido.service), entao qualquer
 * alteracao posterior tem de mover a diferenca: delta positivo consome, delta
 * negativo devolve. Sem isso, editar itens desencontrava o estoque do que
 * estava realmente vendido.
 *
 * Devolve a mensagem de erro quando nao ha estoque para o aumento, ou null
 * quando o ajuste foi aplicado.
 */
async function ajustarEstoque(
  idProduto: number,
  delta: number,
  transaction: Transaction
): Promise<string | null> {
  if (delta === 0) {
    return null;
  }

  const produto = await Produto.findByPk(idProduto, { transaction });

  if (!produto) {
    return "Produto nao encontrado.";
  }

  if (delta > 0 && Number(produto.estoque ?? 0) < delta) {
    return `Estoque insuficiente para o produto "${produto.nome}". Disponivel: ${Number(produto.estoque ?? 0)}.`;
  }

  if (delta > 0) {
    await Produto.decrement("estoque", { by: delta, where: { id_produto: idProduto }, transaction });
  } else {
    await Produto.increment("estoque", { by: -delta, where: { id_produto: idProduto }, transaction });
  }

  return null;
}

export const adicionarItem = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  let transactionCommitted = false;

  try {
    const id_pedido = Number(req.params.id_pedido);
    const { id_produto, quantidade, preco_unitario } = req.body;

    if (!id_produto || !quantidade || !preco_unitario) {

      throw new AppError(400, "id_produto, quantidade e preco_unitario sao obrigatorios.", "REQUISICAO_INVALIDA");

    }

    const pedido = await Pedido.findByPk(id_pedido, { transaction });

    if (!pedido) {

      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    validarAcessoAoPedido(req, pedido.id_cliente);

    const statusBloqueados = ["enviado", "entregue", "cancelado"];
    if (statusBloqueados.includes(pedido.status ?? "")) {

      throw new AppError(409, `Nao e possivel adicionar itens a um pedido com status "${pedido.status}".`, "CONFLITO");

    }

    const produto = await Produto.findOne({
      where: { id_produto: Number(id_produto), ativo: true },
      transaction,
    });

    if (!produto) {

      throw new AppError(404, "Produto nao encontrado ou inativo.", "NAO_ENCONTRADO");

    }

    const itemExistente = await ItemPedido.findOne({
      where: { id_pedido, id_produto: Number(id_produto) },
      transaction,
    });

    const erroEstoque = await ajustarEstoque(Number(id_produto), Number(quantidade), transaction);

    if (erroEstoque) {

      throw new AppError(409, erroEstoque, "CONFLITO");

    }

    let item: ItemPedido;

    if (itemExistente) {
      await itemExistente.update(
        { quantidade: itemExistente.quantidade + Number(quantidade) },
        { transaction }
      );
      item = itemExistente;
    } else {
      item = await ItemPedido.create(
        {
          id_pedido,
          id_produto: Number(id_produto),
          quantidade: Number(quantidade),
          preco_unitario: Number(preco_unitario),
        },
        { transaction }
      );
    }

    const todosItens = await ItemPedido.findAll({ where: { id_pedido }, transaction });
    const novoTotal = todosItens.reduce(
      (acc, i) => acc + i.quantidade * Number(i.preco_unitario),
      0
    );
    await pedido.update({ valor: novoTotal }, { transaction });

    await transaction.commit();
    transactionCommitted = true;

    res.status(201).json({ mensagem: "Item adicionado ao pedido.", item });
  } catch (error) {
    if (!transactionCommitted) {
      await transaction.rollback();
    }
    throw error;
  }
};


export const atualizarQuantidadeItem = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  let transactionCommitted = false;

  try {
    const id_item = Number(req.params.id);
    const { quantidade } = req.body;

    if (!quantidade || Number(quantidade) < 1) {

      throw new AppError(400, "Quantidade deve ser maior que zero.", "REQUISICAO_INVALIDA");

    }

    const item = await ItemPedido.findByPk(id_item, { transaction });

    if (!item) {

      throw new AppError(404, "Item nao encontrado.", "NAO_ENCONTRADO");

    }

    const pedido = await Pedido.findByPk(item.id_pedido, { transaction });

    if (!pedido) {

      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    validarAcessoAoPedido(req, pedido.id_cliente);

    const statusBloqueados = ["enviado", "entregue", "cancelado"];
    if (statusBloqueados.includes(pedido.status ?? "")) {

      throw new AppError(409, `Nao e possivel editar itens de um pedido com status "${pedido.status}".`, "CONFLITO");

    }

    const erroEstoque = await ajustarEstoque(
      item.id_produto,
      Number(quantidade) - item.quantidade,
      transaction
    );

    if (erroEstoque) {

      throw new AppError(409, erroEstoque, "CONFLITO");

    }

    await item.update({ quantidade: Number(quantidade) }, { transaction });

    const todosItens = await ItemPedido.findAll({ where: { id_pedido: item.id_pedido }, transaction });
    const novoTotal = todosItens.reduce(
      (acc, i) => acc + i.quantidade * Number(i.preco_unitario),
      0
    );
    await pedido.update({ valor: novoTotal }, { transaction });

    await transaction.commit();
    transactionCommitted = true;

    res.status(200).json({ mensagem: "Quantidade atualizada.", item });
  } catch (error) {
    if (!transactionCommitted) {
      await transaction.rollback();
    }
    throw error;
  }
};


export const removerItem = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  let transactionCommitted = false;

  try {
    const id_item = Number(req.params.id);

    const item = await ItemPedido.findByPk(id_item, { transaction });

    if (!item) {

      throw new AppError(404, "Item nao encontrado.", "NAO_ENCONTRADO");

    }

    const pedido = await Pedido.findByPk(item.id_pedido, { transaction });

    if (!pedido) {

      throw new AppError(404, "Pedido nao encontrado.", "NAO_ENCONTRADO");

    }

    validarAcessoAoPedido(req, pedido.id_cliente);

    const statusBloqueados = ["enviado", "entregue", "cancelado"];
    if (statusBloqueados.includes(pedido.status ?? "")) {

      throw new AppError(409, `Nao e possivel remover itens de um pedido com status "${pedido.status}".`, "CONFLITO");

    }

    await ajustarEstoque(item.id_produto, -item.quantidade, transaction);
    await item.destroy({ transaction });

    const itensRestantes = await ItemPedido.findAll({ where: { id_pedido: item.id_pedido }, transaction });
    const novoTotal = itensRestantes.reduce(
      (acc, i) => acc + i.quantidade * Number(i.preco_unitario),
      0
    );
    await pedido.update({ valor: novoTotal }, { transaction });

    await transaction.commit();
    transactionCommitted = true;

    res.status(200).json({ mensagem: "Item removido do pedido." });
  } catch (error) {
    if (!transactionCommitted) {
      await transaction.rollback();
    }
    throw error;
  }
};