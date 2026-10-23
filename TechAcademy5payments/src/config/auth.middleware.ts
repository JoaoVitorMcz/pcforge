import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import AppError from "../errors/app-error";

export interface TokenPayload {
  id_cliente: number;
  email: string;
  admin?: boolean;
  roles?: string[];
}

declare module "express-serve-static-core" {
  interface Request {
    cliente?: TokenPayload;
  }
}

export function autenticar(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const secret = process.env.JWT_SECRET;

  if (!token) {
    next(new AppError(401, "Token nao fornecido.", "NAO_AUTENTICADO"));
    return;
  }

  if (!secret) {
    next(new AppError(500, "JWT_SECRET nao configurado.", "CONFIGURACAO_INVALIDA"));
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (
      typeof decoded === "string" ||
      !Number.isInteger(decoded.id_cliente) ||
      decoded.id_cliente < 1 ||
      typeof decoded.email !== "string"
    ) {
      throw new Error("Token sem as claims esperadas.");
    }

    req.cliente = {
      id_cliente: decoded.id_cliente,
      email: decoded.email,
      admin:
        decoded.admin === true ||
        (Array.isArray(decoded.roles) && decoded.roles.includes("admin")),
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
    };
    next();
  } catch {
    next(new AppError(401, "Token invalido ou expirado.", "NAO_AUTENTICADO"));
  }
}
