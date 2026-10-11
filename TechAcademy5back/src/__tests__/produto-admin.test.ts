import { Request, Response } from "express";
import Produto from "../models/Produto";
import { criarProduto, atualizarProduto, desativarProduto } from "../controllers/produto.controller";
import { TokenPayload } from "../config/jwt";

jest.mock("../models/Produto");
jest.mock("../config/auth.middleware");
jest.mock("../config/jwt");

// O modulo de middleware esta auto-mockado acima, entao authorizeRole viria
// como jest.fn() e nao decidiria nada. Para o teste 18 provar o bloqueio de
// verdade, pega-se a implementacao real.
const { authorizeRole } = jest.requireActual<typeof import("../config/auth.middleware")>(
  "../config/auth.middleware"
);

const mockNext = jest.fn();

const mockRequest = (body = {}, params = {}, headers = {}): Partial<Request> => ({
  body,
  params,
  headers,
  cliente: undefined,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Produto CRUD - Controle de Acesso Admin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Criar Produto (POST) - Admin Only", () => {
    it("17. Admin pode criar produto", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      (Produto.create as jest.Mock).mockResolvedValue({
        id_produto: 1,
        nome: "RTX 4070",
        valor: 3899,
        id_categoria: 5,
        estoque: 10,
        ativo: true,
      });

      const req = mockRequest(
        { nome: "RTX 4070", valor: 3899, id_categoria: 5, estoque: 10 },
        {}
      ) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await criarProduto(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          mensagem: "Produto criado com sucesso.",
          produto: expect.objectContaining({ nome: "RTX 4070" }),
        })
      );
    });

    it("18. Usuário comum não pode criar produto (admin=false)", async () => {
      const clienteComum: TokenPayload = {
        id_cliente: 2,
        email: "cliente@pcforge.com",
        admin: false,
      };

      const req = mockRequest(
        { nome: "RTX 4070", valor: 3899, id_categoria: 5 },
        {}
      ) as Request;
      req.cliente = clienteComum;

      const res = mockResponse();

      // A rota tem authorizeRole(["admin"]) antes do controller: o middleware
      // barra e criarProduto nunca chega a rodar.
      authorizeRole(["admin"])(req, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Permissoes insuficientes para acessar este recurso.",
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(Produto.create).not.toHaveBeenCalled();
    });

    it("19. Rejeita criação sem campos obrigatórios", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      const req = mockRequest(
        { nome: "RTX 4070" }, // sem valor
        {}
      ) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await expect(criarProduto(req as Request, res as Response)).rejects.toMatchObject({
        statusCode: 400,
        codigo: "REQUISICAO_INVALIDA",
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it("20. Erro ao criar produto no banco", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      (Produto.create as jest.Mock).mockRejectedValue(new Error("DB Error"));

      const req = mockRequest(
        { nome: "RTX 4070", valor: 3899 },
        {}
      ) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await expect(criarProduto(req as Request, res as Response)).rejects.toThrow("DB Error");
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Atualizar Produto (PUT) - Admin Only", () => {
    it("21. Admin pode atualizar produto", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      const produtoMock = {
        id_produto: 1,
        nome: "RTX 4070",
        valor: 3899,
        update: jest.fn().mockResolvedValue(true),
      };

      (Produto.findOne as jest.Mock).mockResolvedValue(produtoMock);

      const req = mockRequest(
        { nome: "RTX 4070 Super", valor: 4499 },
        { id: "1" }
      ) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await atualizarProduto(req as Request, res as Response);

      expect(produtoMock.update).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          mensagem: "Produto atualizado com sucesso.",
        })
      );
    });

    it("22. Rejeita atualização de produto não encontrado", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      (Produto.findOne as jest.Mock).mockResolvedValue(null);

      const req = mockRequest(
        { nome: "RTX 4070 Super" },
        { id: "999" }
      ) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await expect(atualizarProduto(req as Request, res as Response)).rejects.toMatchObject({
        statusCode: 404,
        codigo: "NAO_ENCONTRADO",
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it("23. Preserva campos não enviados na atualização", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      const produtoMock = {
        id_produto: 1,
        nome: "RTX 4070",
        valor: 3899,
        estoque: 10,
        update: jest.fn().mockResolvedValue(true),
      };

      (Produto.findOne as jest.Mock).mockResolvedValue(produtoMock);

      const req = mockRequest(
        { valor: 4499 }, // só atualiza preço
        { id: "1" }
      ) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await atualizarProduto(req as Request, res as Response);

      expect(produtoMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ valor: 4499 })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("Desativar Produto (DELETE) - Admin Only", () => {
    it("24. Admin pode desativar produto", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      const produtoMock = {
        id_produto: 1,
        nome: "RTX 4070",
        update: jest.fn().mockResolvedValue(true),
      };

      (Produto.findOne as jest.Mock).mockResolvedValue(produtoMock);

      const req = mockRequest({}, { id: "1" }) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await desativarProduto(req as Request, res as Response);

      expect(produtoMock.update).toHaveBeenCalledWith({ ativo: false });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Produto desativado com sucesso.",
      });
    });

    it("25. Rejeita desativação de produto não encontrado", async () => {
      const adminCliente: TokenPayload = {
        id_cliente: 1,
        email: "admin@pcforge.com",
        admin: true,
      };

      (Produto.findOne as jest.Mock).mockResolvedValue(null);

      const req = mockRequest({}, { id: "999" }) as Request;
      req.cliente = adminCliente;

      const res = mockResponse();

      await expect(desativarProduto(req as Request, res as Response)).rejects.toMatchObject({
        statusCode: 404,
        codigo: "NAO_ENCONTRADO",
      });
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
