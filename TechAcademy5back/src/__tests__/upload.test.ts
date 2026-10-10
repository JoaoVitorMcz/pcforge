import request from "supertest";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";

// Mock middleware to bypass auth and mark as admin for upload tests
jest.mock("../config/auth.middleware", () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.cliente = { id_cliente: 1, email: "admin@pcforge.com", admin: true };
    next();
  },
  adminMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
  authorizeRole:
    (_roles?: string[]) => (_req: Request, _res: Response, next: NextFunction) =>
      next(),
  authorizePermission:
    (_permissoes?: string[]) => (_req: Request, _res: Response, next: NextFunction) =>
      next(),
  selfOrAdminMiddleware:
    (_paramName?: string) => (_req: Request, _res: Response, next: NextFunction) =>
      next(),
}));

import app from "../index";

// Pasta temporaria criada em src/test-support/jest.env.ts. Nunca aponta para
// os uploads reais, entao a suite grava arquivos sem apagar nada de ninguem.
const uploadDir = process.env.UPLOAD_DIR as string;

describe("Upload - integração", () => {
  beforeAll(() => {
    expect(uploadDir).toBeTruthy();
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  });

  it("Extensão inválida (exe) deve retornar 400", async () => {
    const res = await request(app)
      .post("/upload/imagem")
      .attach("imagem", Buffer.from("fake image"), { filename: "malicious.exe", contentType: "image/jpeg" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatchObject({ codigo: "UPLOAD_INVALIDO" });
  });

  it("Tamanho excedido deve retornar 413", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 0);

    const res = await request(app)
      .post("/upload/imagem")
      .attach("imagem", big, { filename: "big.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(413);
    expect(res.body.erro).toMatchObject({ codigo: "UPLOAD_INVALIDO" });
  });

  it("Colisão de nome: dois uploads com mesmo originalname geram nomes diferentes", async () => {
    const buf1 = Buffer.alloc(100, 1);
    const buf2 = Buffer.alloc(100, 2);

    const res1 = await request(app)
      .post("/upload/imagem")
      .attach("imagem", buf1, { filename: "same.jpg", contentType: "image/jpeg" });

    expect(res1.status).toBe(201);
    expect(res1.body).toHaveProperty("url");

    const res2 = await request(app)
      .post("/upload/imagem")
      .attach("imagem", buf2, { filename: "same.jpg", contentType: "image/jpeg" });

    expect(res2.status).toBe(201);
    expect(res2.body).toHaveProperty("url");

    const name1 = path.basename(res1.body.url);
    const name2 = path.basename(res2.body.url);

    expect(name1).not.toBe(name2);
    // também checar que os arquivos foram gravados
    expect(fs.existsSync(path.join(uploadDir, name1))).toBe(true);
    expect(fs.existsSync(path.join(uploadDir, name2))).toBe(true);
  });

  it("Upload válido retorna 201 e URL começa com /uploads/", async () => {
    const buf = Buffer.alloc(200, 3);

    const res = await request(app)
      .post("/upload/imagem")
      .attach("imagem", buf, { filename: "valid.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("url");
    expect(res.body.url.startsWith("/uploads/")).toBe(true);
  });
});
