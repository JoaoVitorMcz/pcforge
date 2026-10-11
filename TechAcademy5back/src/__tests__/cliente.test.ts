import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Cliente from "../models/Cliente";
import Role from "../models/Role";
import ClienteRole from "../models/ClienteRole";
import {
  buscarClientePorId,
  criarCliente,
  listarClientes,
  loginCliente,
} from "../controllers/cliente.controller";

jest.mock("../models/Cliente");
jest.mock("bcrypt");
jest.mock("jsonwebtoken");

// criarCliente vincula o papel padrao em cliente_role. Sem estes mocks, o
// helper tentaria conexao real com o MySQL: alem do ruido no console, a
// tentativa demora e deixava a suite intermitente sob execucao paralela.
jest.mock("../models/Role", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("../models/ClienteRole", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() },
}));
jest.mock("../models/Permissao", () => ({ __esModule: true, default: {} }));


beforeAll(() => {
  process.env.JWT_SECRET = "segredo_teste";
});


beforeEach(() => {
  jest.clearAllMocks();

  (Role.findOne as jest.Mock).mockResolvedValue({ id_role: 2, nome: "cliente" });
  (ClienteRole.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

  (jwt.sign as jest.Mock).mockReturnValue("token_fake");
  (jwt.verify as jest.Mock).mockReturnValue({
    id_cliente: 1,
    email: "joao@email.com",
    admin: false,
  });
});

const mockRequest = (body = {}, params = {}, query = {}): Partial<Request> => ({
  body,
  params,
  query,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("cliente.controller", () => {
  it("1. Login com sucesso retorna token", async () => {
    const clienteMock = {
      id_cliente: 1,
      email: "joao@email.com",
      senha: "hashSenha",
      admin: false,
      toJSON: () => ({
        id_cliente: 1,
        email: "joao@email.com",
        senha: "hashSenha",
      }),
    };

    (Cliente.findOne as jest.Mock).mockResolvedValue(clienteMock);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req = mockRequest({
      email: "joao@email.com",
      senha: "Senha123",
    });
    const res = mockResponse();

    await loginCliente(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token_fake" })
    );
    expect((res.json as jest.Mock).mock.calls[0][0].cliente).not.toHaveProperty("senha");
  });

  it("2. Rota protegida com token valido chama next()", () => {
    const { authMiddleware } = require("../config/auth.middleware");

    const req = {
      headers: { authorization: "Bearer token_fake" },
    } as unknown as Request;

    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authMiddleware(req, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it("3. Bloqueia acesso ao perfil de outro cliente", () => {
    
    const { selfOrAdminMiddleware } = require("../config/auth.middleware");

    const req = {
      cliente: {
        id_cliente: 1,
        email: "joao@email.com",
        admin: false,
      },
      params: { id: "2" },
    } as unknown as Request;

    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    selfOrAdminMiddleware()(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("4. Nao permite cadastro sem campos obrigatorios", async () => {
    const req = mockRequest({ nome: "Joao" });
    const res = mockResponse();

    await expect(criarCliente(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 400,
      codigo: "REQUISICAO_INVALIDA",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("5. Nao permite email invalido", async () => {
    const req = mockRequest({
      nome: "Joao",
      email: "email-invalido",
      senha: "Senha123",
      cpf: "12345678901",
    });
    const res = mockResponse();

    await expect(criarCliente(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 400,
      codigo: "REQUISICAO_INVALIDA",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("6. Senha e armazenada criptografada", async () => {
    (Cliente.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (bcrypt.hash as jest.Mock).mockResolvedValue("senhaHash");

    const novoCliente = {
      toJSON: () => ({
        id_cliente: 1,
        nome: "Joao",
        email: "joao@email.com",
        senha: "senhaHash",
      }),
    };

    (Cliente.create as jest.Mock).mockResolvedValue(novoCliente);

    const req = mockRequest({
      nome: "Joao",
      email: "joao@email.com",
      senha: "Senha123",
      cpf: "123.456.789-01",
    });

    const res = mockResponse();

    await criarCliente(req as Request, res as Response);

    expect(bcrypt.hash).toHaveBeenCalledWith("Senha123", 10);
    expect(Cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: "12345678901" })
    );
  });

  it("7. Retorna 404 quando cliente nao existe", async () => {
    (Cliente.findOne as jest.Mock).mockResolvedValue(null);

    const req = mockRequest({}, { id: "999" });
    const res = mockResponse();

    await expect(buscarClientePorId(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 404,
      codigo: "NAO_ENCONTRADO",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("8. Lista clientes com paginacao", async () => {
    (Cliente.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{
        id_cliente: 1,
        nome: "Joao",
        email: "joao@email.com",
        telefone: null,
        cpf: "12345678901",
        ativo: true,
        admin: false,
      }],
      count: 1,
    });

    const req = mockRequest({}, {}, { page: "1", limit: "10" });
    const res = mockResponse();

    await listarClientes(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      dados: [{
        id_cliente: 1,
        nome: "Joao",
        email: "joao@email.com",
        telefone: null,
        cpf: "12345678901",
        ativo: true,
        admin: false,
      }],
      paginacao: {
        paginaAtual: 1,
        porPagina: 10,
        totalItens: 1,
        totalPaginas: 1,
      },
    });
  });

  it("9. Cadastro bem-sucedido vincula o papel 'cliente' ao novo cliente", async () => {
    (Cliente.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue("hash_fake");
    (Cliente.create as jest.Mock).mockResolvedValue({
      id_cliente: 42,
      toJSON: () => ({ id_cliente: 42, nome: "Joao", email: "joao@email.com", senha: "hash_fake" }),
    });

    const req = mockRequest({
      nome: "Joao",
      email: "joao@email.com",
      senha: "Senha123",
      cpf: "390.533.447-05",
    });
    const res = mockResponse();

    await criarCliente(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);

    // Sem este vinculo o token sairia com permissoes vazias e o cliente novo
    // seria barrado em POST /pedidos, que exige a permissao pedido:criar.
    expect(Role.findOne).toHaveBeenCalledWith({ where: { nome: "cliente" } });
    expect(ClienteRole.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_cliente: 42, id_role: 2 } })
    );
    expect((res.json as jest.Mock).mock.calls[0][0].cliente).not.toHaveProperty("senha");
  });

  it("10. Cadastro nao falha quando o papel ainda nao existe no banco", async () => {
    (Cliente.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue("hash_fake");
    (Cliente.create as jest.Mock).mockResolvedValue({
      id_cliente: 43,
      toJSON: () => ({ id_cliente: 43, nome: "Maria", email: "maria@email.com", senha: "hash_fake" }),
    });
    // Banco sem seed: nenhum papel cadastrado.
    (Role.findOne as jest.Mock).mockResolvedValue(null);

    const req = mockRequest({
      nome: "Maria",
      email: "maria@email.com",
      senha: "Senha123",
      cpf: "390.533.447-05",
    });
    const res = mockResponse();

    await criarCliente(req as Request, res as Response);

    // O cadastro continua valendo: o fallback pelo boolean admin cobre o acesso.
    expect(res.status).toHaveBeenCalledWith(201);
    expect(ClienteRole.findOrCreate).not.toHaveBeenCalled();
  });
});