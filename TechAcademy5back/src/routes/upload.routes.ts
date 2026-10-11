import { Router, Request, Response } from "express";
import { upload } from "../config/upload";
import { authMiddleware, authorizeRole } from "../config/auth.middleware";
import AppError from "../utils/app-error";

const router = Router();

router.post(
  "/imagem",
  authMiddleware,
  authorizeRole(["admin"]),
  upload.single("imagem"),
  (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, "Nenhuma imagem enviada.", "UPLOAD_INVALIDO");
    }

    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ mensagem: "Upload realizado com sucesso.", url });
  }
);

export default router;
