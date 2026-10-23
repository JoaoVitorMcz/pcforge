# Contratos de eventos do PC Forge

Os eventos abaixo atravessam contextos em canais Redis Pub/Sub. O nome do canal carrega
a versão do contrato; consumidores devem validar o payload antes de processá-lo. Datas são
strings ISO 8601 em UTC e valores monetários são números em BRL.

## `pedido.criado.v1`

Publicado depois que pedido, itens e baixa de estoque foram confirmados no MySQL.

```json
{
  "pedido_id": 42,
  "cliente": {
    "id_cliente": 7,
    "nome": "Cliente de teste",
    "email": "cliente@example.com"
  },
  "itens": [
    {
      "id_produto": 11,
      "nome": "Produto de teste",
      "quantidade": 2,
      "preco_unitario": 25
    }
  ],
  "valor": 50,
  "criado_em": "2026-10-23T20:00:00.000Z"
}
```

## `pedido.status-alterado.v1`

Publicado depois que a transição de status foi persistida.

```json
{
  "pedido_id": 42,
  "status_anterior": "pendente",
  "status_atual": "pago",
  "alterado_em": "2026-10-23T20:00:00.000Z"
}
```

## `pagamento.aprovado.v1`

Publicado pelo serviço de Pagamentos após consultar a transação no Mercado Pago e persistir
a aprovação no banco `pcforge_pagamentos`. A Loja consome o evento e atualiza apenas pedidos
que ainda estejam pendentes.

```json
{
  "pedidoId": 42,
  "paymentId": 9001,
  "aprovadoEm": "2026-10-23T20:00:00.000Z"
}
```

O serviço de Pagamentos consome `pedido.criado.v1` e grava uma cópia dos dados necessários
para criar preferências e confirmar pagamentos. Nenhum SELECT é feito no banco da Loja. Se
o evento ainda não foi processado quando o checkout é solicitado, a API responde HTTP 409
com o código `PEDIDO_AINDA_NAO_RECEBIDO`; o cliente pode tentar novamente.

## Falha de publicação

Redis Pub/Sub não retém mensagens. Se Redis estiver indisponível, a publicação falhar ou
nenhum consumidor estiver inscrito, a API retorna HTTP 503 com o identificador do pedido e
registra a falha. O pedido e a transição de status já foram persistidos e não são revertidos;
o cliente não deve repetir a operação cegamente. Outbox e reenvio automático permanecem fora
do escopo definido pelo ADR-001. A aprovação já persistida pode ser publicada novamente em
uma confirmação posterior; a Loja trata o evento de aprovação de forma idempotente.
