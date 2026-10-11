import { Request, Response } from "express";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Cliente from "../models/Cliente";
import Role from "../models/Role";
import Permissao from "../models/Permissao";
import ClienteRole from "../models/ClienteRole";
import { getJwtSecret } from "../config/jwt";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { mapearClienteResposta } from "../utils/dto";
import AppError from "../utils/app-error";
import {
  isStrongPassword,
  isValidCpf,
  isValidEmail,
  sanitizeCpf,
} from "../utils/cliente.validation";

export const listarClientes = async (req: Request, res: Response): Promise<void> => {
  
    const { page, limit, offset } = getPaginationParams(req);
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
    const incluirInativos = req.query.incluir_inativos === "true" || req.query.all === "true";

    const queryOptions: {
      attributes: { exclude: string[] };
      where: { ativo?: boolean };
      order: [string, string][];
      limit?: number;
      offset?: number;
    } = {
      attributes: { exclude: ["senha"] },
      where: incluirInativos ? {} : { ativo: true },
      order: [["id_cliente", "ASC"]],
    };

    if (shouldPaginate) {
      queryOptions.limit = limit;
      queryOptions.offset = offset;
    }

    const { rows: clientes, count } = await Cliente.findAndCountAll(queryOptions);

    const clientesPublicos = clientes.map((cliente) => mapearClienteResposta(cliente));
    res.status(200).json(shouldPaginate ? buildPaginatedResponse(clientesPublicos, count, page, limit) : clientesPublicos);
  
};

export const buscarClientePorId = async (req: Request, res: Response): Promise<void> => {
  
    const { id } = req.params;

    const cliente = await Cliente.findOne({
      where: { id_cliente: id, ativo: true },
      attributes: { exclude: ["senha"] },
    });

    if (!cliente) {
      throw new AppError(404, "Cliente nao encontrado.", "NAO_ENCONTRADO");
      
    }

    res.status(200).json(mapearClienteResposta(cliente));
  
};

/**
 * Vincula o cliente recem-criado ao seu papel no RBAC.
 *
 * Sem isso so o seed escrevia em cliente_role: quem se cadastrava pela API
 * ficava sem papel e recebia um token com permissoes vazias, o que barra
 * qualquer rota protegida por authorizePermission.
 *
 * Nao derruba o cadastro se o papel nao existir (banco ainda sem seed): o
 * cliente continua valido e o fallback pelo boolean admin cobre o acesso.
 */
const vincularPapelPadrao = async (idCliente: number, ehAdmin: boolean): Promise<void> => {
  
    const role = await Role.findOne({ where: { nome: ehAdmin ? "admin" : "cliente" } });

    if (!role) {
      return;
    }

    await ClienteRole.findOrCreate({
      where: { id_cliente: idCliente, id_role: role.id_role },
      defaults: { id_cliente: idCliente, id_role: role.id_role },
    });
  
};

export const criarCliente = async (req: Request, res: Response): Promise<void> => {
  
    const { nome, email, senha, telefone, cpf, admin } = req.body;
    const clienteLogado = req.cliente;

    if (!nome || !email || !senha || !cpf) {
      throw new AppError(400, "Nome, email, senha e CPF sao obrigatorios.", "REQUISICAO_INVALIDA");
      
    }

    if (!isValidEmail(email)) {
      throw new AppError(400, "E-mail invalido.", "REQUISICAO_INVALIDA");
      
    }

    if (!isValidCpf(cpf)) {
      throw new AppError(400, "CPF invalido.", "REQUISICAO_INVALIDA");
      
    }

    if (!isStrongPassword(senha)) {
      throw new AppError(400, "A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula e numero.", "REQUISICAO_INVALIDA");
      
    }

    const clienteExistente = await Cliente.findOne({ where: { email } });

    if (clienteExistente) {
      throw new AppError(409, "E-mail ja cadastrado.", "CONFLITO");
      
    }

    const cpfSanitizado = sanitizeCpf(cpf);
    const cpfEmUso = await Cliente.findOne({ where: { cpf: cpfSanitizado } });

    if (cpfEmUso) {
      throw new AppError(409, "CPF ja cadastrado.", "CONFLITO");
      
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);

    
    const isAdmin = clienteLogado?.admin === true && admin === true;

    const novoCliente = await Cliente.create({
      nome,
      email,
      senha: senhaCriptografada,
      telefone: telefone || null,
      cpf: cpfSanitizado,
      ativo: true,
      admin: isAdmin,
    });

    await vincularPapelPadrao(novoCliente.id_cliente, isAdmin);

    res.status(201).json({
      mensagem: "Cliente criado com sucesso.",
      cliente: mapearClienteResposta(novoCliente.toJSON()),
    });
  
};

export const atualizarCliente = async (req: Request, res: Response): Promise<void> => {
  
    const { id } = req.params;
    const { nome, email, telefone, cpf, senha, admin, ativo } = req.body;
    const clienteLogado = req.cliente;

    if (!clienteLogado) {
      throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");
      
    }

    if (clienteLogado.id_cliente !== Number(id) && !clienteLogado.admin) {
      throw new AppError(403, "Voce nao tem permissao para editar este cliente.", "ACESSO_NEGADO");
      
    }

   
    const whereClause = clienteLogado.admin
      ? { id_cliente: id }
      : { id_cliente: id, ativo: true };

    const cliente = await Cliente.findOne({ where: whereClause });

    if (!cliente) {
      throw new AppError(404, "Cliente nao encontrado.", "NAO_ENCONTRADO");
      
    }

if (!nome || !telefone || !cpf) {
  throw new AppError(400, "Nome, telefone e CPF sao obrigatorios para editar o perfil.", "REQUISICAO_INVALIDA");
  
}

    if (email && email !== cliente.email) {
      throw new AppError(400, "Nao e permitido alterar o e-mail.", "REQUISICAO_INVALIDA");
      
    }

    if (cpf && cpf !== cliente.cpf) {
      if (!isValidCpf(cpf)) {
        throw new AppError(400, "CPF invalido.", "REQUISICAO_INVALIDA");
        
      }

      const cpfSanitizado = sanitizeCpf(cpf);
      const cpfEmUso = await Cliente.findOne({
        where: { cpf: cpfSanitizado, id_cliente: { [Op.ne]: Number(id) } },
      });

      if (cpfEmUso) {
        throw new AppError(409, "CPF ja esta em uso por outro cliente.", "CONFLITO");
        
      }
    }

    const dadosAtualizados: Partial<{
      nome: string;
      telefone: string | null;
      cpf: string | null;
      senha: string;
      admin: boolean;
      ativo: boolean;
    }> = {};

    if (nome) dadosAtualizados.nome = nome;
    if (telefone !== undefined) dadosAtualizados.telefone = telefone;
    if (cpf) dadosAtualizados.cpf = sanitizeCpf(cpf);

    if (senha) {
      if (!isStrongPassword(senha)) {
        throw new AppError(400, "A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula e numero.", "REQUISICAO_INVALIDA");
        
      }
      dadosAtualizados.senha = await bcrypt.hash(senha, 10);
    }

    
    if (clienteLogado.admin) {
      if (admin !== undefined) dadosAtualizados.admin = Boolean(admin);
      if (ativo !== undefined) dadosAtualizados.ativo = Boolean(ativo);
    }

    await cliente.update(dadosAtualizados);

    res.status(200).json({
      mensagem: "Cliente atualizado com sucesso.",
      cliente: mapearClienteResposta(cliente.toJSON()),
    });
  
};

export const desativarCliente = async (req: Request, res: Response): Promise<void> => {
  
    const { id } = req.params;
    const clienteLogado = req.cliente;

    if (!clienteLogado) {
      throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");
      
    }

    if (clienteLogado.id_cliente !== Number(id) && !clienteLogado.admin) {
      throw new AppError(403, "Voce nao tem permissao para desativar este cliente.", "ACESSO_NEGADO");
      
    }

    const cliente = await Cliente.findOne({ where: { id_cliente: id, ativo: true } });

    if (!cliente) {
      throw new AppError(404, "Cliente nao encontrado ou ja inativo.", "NAO_ENCONTRADO");
      
    }

    await cliente.update({ ativo: false });

    res.status(200).json({ mensagem: "Cliente desativado com sucesso." });
  
};

type RoleComPermissoes = Role & { permissoes?: Permissao[] };
type ClienteComRoles = Cliente & { roles?: RoleComPermissoes[] };

/**
 * Achata o grafo cliente -> roles -> permissoes nas duas listas de strings que
 * viajam no token. As permissoes entram num Set porque dois papeis do mesmo
 * cliente podem conceder a mesma permissao.
 *
 * Le a associacao por propriedade, e nao por cliente.get("roles"), porque o
 * eager loading do Sequelize expoe as duas formas e a propriedade tambem
 * resolve para `undefined` num objeto simples, sem estourar.
 */
const extrairRbac = (cliente: Cliente): { roles: string[]; permissoes: string[] } => {
  const roles = (cliente as ClienteComRoles).roles ?? [];
  const permissoes = new Set<string>();

  for (const role of roles) {
    for (const permissao of role.permissoes ?? []) {
      permissoes.add(permissao.nome);
    }
  }

  return { roles: roles.map((role) => role.nome), permissoes: [...permissoes] };
};

export const loginCliente = async (req: Request, res: Response): Promise<void> => {
  
    const { email, senha } = req.body;

    if (!email || !senha) {
      throw new AppError(400, "E-mail e senha sao obrigatorios.", "REQUISICAO_INVALIDA");
      
    }

    const cliente = await Cliente.findOne({
      where: { email, ativo: true },
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          include: [{ model: Permissao, as: "permissoes", through: { attributes: [] } }],
        },
      ],
    });

    if (!cliente) {
      throw new AppError(401, "Credenciais invalidas.", "NAO_AUTENTICADO");
      
    }

    const senhaCorreta = await bcrypt.compare(senha, cliente.senha);

    if (!senhaCorreta) {
      throw new AppError(401, "Credenciais invalidas.", "NAO_AUTENTICADO");
      
    }

    const { roles, permissoes } = extrairRbac(cliente);
    // Enquanto o boolean e o RBAC coexistem, qualquer um dos dois faz um admin.
    const ehAdmin = cliente.admin || roles.includes("admin");
    // Banco ainda sem o seed do RBAC: deriva o papel do boolean para o token
    // nunca sair inconsistente consigo mesmo.
    const rolesEfetivas = roles.length > 0 ? roles : [ehAdmin ? "admin" : "cliente"];

    const token = jwt.sign(
      {
        id_cliente: cliente.id_cliente,
        email: cliente.email,
        admin: ehAdmin,
        roles: rolesEfetivas,
        permissoes,
      },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      cliente: mapearClienteResposta(cliente.toJSON()),
    });
  
};