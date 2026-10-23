import sequelize from "../config/database";
import Pedido from "../models/Pedido";
import ItemPedido from "../models/Itempedido";
import Produto from "../models/Produto";
import Cliente from "../models/Cliente";
import Endereco from "../models/Endereco";
import AppError from "../utils/app-error";
import { publicarPedidoCriado } from "./pedido-event.service";

export class HttpError extends AppError {
  constructor(statusCode: number, message: string) {
    super(statusCode, message, "PEDIDO_INVALIDO");
    this.name = "HttpError";
  }
}

interface PedidoItemInput {
  id_produto: number;
  quantidade: number;
}

interface CriarPedidoComItensInput {
  id_cliente: number;
  id_endereco_entrega: number;
  metodo?: string | null;
  itens: PedidoItemInput[];
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new HttpError(400, `${fieldName} deve ser um inteiro maior que zero.`);
  }

  return parsedValue;
}

async function validarEnderecoDoCliente(
  idEnderecoEntrega: number,
  idCliente: number,
  allowAdmin = false
) {
  const endereco = await Endereco.findByPk(idEnderecoEntrega);

  if (!endereco) {
    throw new HttpError(404, "Endereco de entrega nao encontrado.");
  }

  if (!allowAdmin && Number(endereco.id_cliente) !== Number(idCliente)) {
    throw new HttpError(403, "Este endereco nao pertence ao cliente autenticado.");
  }

  return endereco;
}

async function normalizarItensPedido(itens: PedidoItemInput[]) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new HttpError(400, "Informe pelo menos um item para criar o pedido.");
  }

  const quantidadePorProduto = new Map<number, number>();

  itens.forEach((item, index) => {
    const idProduto = parsePositiveInteger(item?.id_produto, `id_produto do item ${index + 1}`);
    const quantidade = parsePositiveInteger(item?.quantidade, `quantidade do item ${index + 1}`);

    quantidadePorProduto.set(idProduto, (quantidadePorProduto.get(idProduto) || 0) + quantidade);
  });

  const idsProdutos = Array.from(quantidadePorProduto.keys());
  const produtos = await Produto.findAll({
    where: {
      id_produto: idsProdutos,
      ativo: true,
    },
  });

  const produtoPorId = new Map(
    produtos.map((produto) => [Number(produto.id_produto), produto])
  );

  if (produtos.length !== idsProdutos.length) {
    const idsInvalidos = idsProdutos.filter((idProduto) => !produtoPorId.has(idProduto));
    throw new HttpError(
      404,
      `Os seguintes produtos nao foram encontrados ou estao inativos: ${idsInvalidos.join(", ")}.`
    );
  }

  return idsProdutos.map((idProduto) => {
    const produto = produtoPorId.get(idProduto)!;
    const quantidade = quantidadePorProduto.get(idProduto)!;
    const estoqueAtual = Number(produto.estoque || 0);

    if (estoqueAtual < quantidade) {
      throw new HttpError(
        409,
        `Estoque insuficiente para o produto "${produto.nome}". Disponivel: ${estoqueAtual}.`
      );
    }

    return {
      id_produto: idProduto,
      quantidade,
      preco_unitario: Number(produto.valor),
      produto,
    };
  });
}

export async function carregarPedidoDetalhado(idPedido: number) {
  return Pedido.findByPk(idPedido, {
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
            attributes: ["id_produto", "nome", "valor", "imagem", "estoque"],
          },
        ],
      },
    ],
  });
}

export async function carregarPedidoDetalhadoDoCliente(
  idPedido: number,
  idCliente: number,
  isAdmin = false
) {
  const pedido = await carregarPedidoDetalhado(idPedido);

  if (!pedido) {
    throw new HttpError(404, "Pedido nao encontrado.");
  }

  if (!isAdmin && Number(pedido.id_cliente) !== Number(idCliente)) {
    throw new HttpError(403, "Voce nao tem permissao para acessar este pedido.");
  }

  return pedido;
}

export async function criarPedidoComItens(input: CriarPedidoComItensInput, allowAdmin = false) {
  const idCliente = parsePositiveInteger(input.id_cliente, "id_cliente");
  const idEnderecoEntrega = parsePositiveInteger(
    input.id_endereco_entrega,
    "id_endereco_entrega"
  );
  const itensNormalizados = await normalizarItensPedido(input.itens);

  await validarEnderecoDoCliente(idEnderecoEntrega, idCliente, allowAdmin);
  const cliente = await Cliente.findByPk(idCliente, {
    attributes: ["id_cliente", "nome", "email"],
  });

  if (!cliente) {
    throw new HttpError(404, "Cliente do pedido nao encontrado.");
  }

  const valorTotal = itensNormalizados.reduce(
    (accumulator, item) => accumulator + item.quantidade * item.preco_unitario,
    0
  );

  const transaction = await sequelize.transaction();
  let pedidoId: number;

  try {
    const novoPedido = await Pedido.create(
      {
        id_cliente: idCliente,
        id_endereco_entrega: idEnderecoEntrega,
        metodo: input.metodo || null,
        valor: Number(valorTotal.toFixed(2)),
        status: "pendente",
      },
      { transaction }
    );
    pedidoId = novoPedido.id_pedido;

    await ItemPedido.bulkCreate(
      itensNormalizados.map((item) => ({
        id_pedido: pedidoId,
        id_produto: item.id_produto,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      })),
      { transaction }
    );

    // Baixa do estoque dentro da mesma transacao: se qualquer item falhar, o
    // rollback desfaz pedido, itens e baixa juntos. decrement faz um UPDATE
    // relativo (estoque = estoque - N), e nao uma leitura seguida de escrita,
    // que perderia atualizacoes com dois pedidos simultaneos.
    for (const item of itensNormalizados) {
      await Produto.decrement("estoque", {
        by: item.quantidade,
        where: { id_produto: item.id_produto },
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const pedidoCriado = await carregarPedidoDetalhado(pedidoId);

  if (!pedidoCriado) {
    throw new HttpError(500, "Nao foi possivel carregar o pedido criado.");
  }

  await publicarPedidoCriado({
    pedido_id: pedidoId,
    cliente: {
      id_cliente: cliente.id_cliente,
      nome: cliente.nome,
      email: cliente.email,
    },
    itens: itensNormalizados.map((item) => ({
      id_produto: item.id_produto,
      nome: item.produto.nome,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })),
    valor: Number(valorTotal.toFixed(2)),
    criado_em: new Date().toISOString(),
  });

  return pedidoCriado;
}
