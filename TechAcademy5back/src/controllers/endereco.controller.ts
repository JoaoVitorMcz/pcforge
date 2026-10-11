import { Request, Response } from "express";
import Endereco from "../models/Endereco";
import Cliente from "../models/Cliente";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import AppError from "../utils/app-error";

const getClienteAutenticado = (req: Request) => {
  if (!req.cliente) {
    throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");
  }

  return req.cliente;
};



export const listarEnderecos = async (req: Request, res: Response): Promise<void> => {

    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const baseOptions = {
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id_cliente", "nome", "email"],
        },
      ],
      distinct: true,
      order: [["id_endereco", "DESC"]] as [["id_endereco", "DESC"]],
    };

    const { rows: enderecos, count } = shouldPaginate
      ? await Endereco.findAndCountAll({
          ...baseOptions,
          limit,
          offset,
        })
      : await Endereco.findAndCountAll(baseOptions);

    res
      .status(200)
      .json(shouldPaginate ? buildPaginatedResponse(enderecos, count, page, limit) : enderecos);

};



export const listarEnderecosPorCliente = async (req: Request, res: Response): Promise<void> => {

    const id_cliente = Number(req.params.id_cliente);
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const baseOptions = {
      where: { id_cliente },
      order: [["id_endereco", "DESC"]] as [["id_endereco", "DESC"]],
    };

    const { rows: enderecos, count } = shouldPaginate
      ? await Endereco.findAndCountAll({
          ...baseOptions,
          limit,
          offset,
        })
      : await Endereco.findAndCountAll(baseOptions);

    res
      .status(200)
      .json(shouldPaginate ? buildPaginatedResponse(enderecos, count, page, limit) : enderecos);

};


export const buscarEnderecoPorId = async (req: Request, res: Response): Promise<void> => {

    const id_endereco = Number(req.params.id);
    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const endereco = await Endereco.findByPk(id_endereco, {
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id_cliente", "nome", "email"],
        },
      ],
    });

    if (!endereco) {
      throw new AppError(404, "Endereco nao encontrado.", "NAO_ENCONTRADO");

    }

    if (!clienteLogado.admin && endereco.id_cliente !== clienteLogado.id_cliente) {
      throw new AppError(403, "Voce nao tem permissao para acessar este endereco.", "ACESSO_NEGADO");

    }

    res.status(200).json(endereco);

};


export const criarEndereco = async (req: Request, res: Response): Promise<void> => {

    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const { id_cliente, numero, complemento, bairro, cidade, estado, cep } = req.body;
    const idClienteBody = id_cliente !== undefined ? Number(id_cliente) : undefined;
    const idCliente = clienteLogado.admin ? idClienteBody : clienteLogado.id_cliente;

    if (!idCliente) {
      throw new AppError(400, "O id_cliente e obrigatorio.", "REQUISICAO_INVALIDA");

    }

    if (!clienteLogado.admin && idClienteBody !== undefined && idClienteBody !== clienteLogado.id_cliente) {
      throw new AppError(403, "Voce nao pode criar endereco para outro cliente.", "ACESSO_NEGADO");

    }

    const cliente = await Cliente.findByPk(idCliente);

    if (!cliente) {
      throw new AppError(404, "Cliente nao encontrado.", "NAO_ENCONTRADO");

    }

    const novoEndereco = await Endereco.create({
      id_cliente: idCliente,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
    });

    res.status(201).json({
      mensagem: "Endereco criado com sucesso.",
      endereco: novoEndereco,
    });

};


export const atualizarEndereco = async (req: Request, res: Response): Promise<void> => {

    const id_endereco = Number(req.params.id);
    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const endereco = await Endereco.findByPk(id_endereco);

    if (!endereco) {
      throw new AppError(404, "Endereco nao encontrado.", "NAO_ENCONTRADO");

    }

    if (!clienteLogado.admin && endereco.id_cliente !== clienteLogado.id_cliente) {
      throw new AppError(403, "Voce nao tem permissao para atualizar este endereco.", "ACESSO_NEGADO");

    }

    const { numero, complemento, bairro, cidade, estado, cep } = req.body;

    await endereco.update({
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
    });

    res.status(200).json({
      mensagem: "Endereco atualizado com sucesso.",
      endereco,
    });

};


export const deletarEndereco = async (req: Request, res: Response): Promise<void> => {

    const id_endereco = Number(req.params.id);
    const clienteLogado = getClienteAutenticado(req);

    if (!clienteLogado) {
      return;
    }

    const endereco = await Endereco.findByPk(id_endereco);

    if (!endereco) {
      throw new AppError(404, "Endereco nao encontrado.", "NAO_ENCONTRADO");

    }

    if (!clienteLogado.admin && endereco.id_cliente !== clienteLogado.id_cliente) {
      throw new AppError(403, "Voce nao tem permissao para deletar este endereco.", "ACESSO_NEGADO");

    }

    await endereco.destroy();

    res.status(200).json({ mensagem: "Endereco deletado com sucesso." });

};