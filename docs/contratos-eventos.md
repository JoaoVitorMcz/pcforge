# Contratos de eventos

Os eventos abaixo são publicados pelos serviços em canais Redis Pub/Sub. O nome do canal
carrega a versão do contrato; consumidores devem validar o payload antes de processá-lo.
Datas são strings ISO 8601 em UTC e valores monetários são números em BRL.

## `pedido.criado.v1`

Publicado pela Loja depois que pedido, itens e baixa de estoque foram confirmados no MySQL.

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

Publicado pela Loja depois que a transição de status foi persistida.

```json
{
  "pedido_id": 42,
  "status_anterior": "pendente",
  "status_atual": "pago",
  "alterado_em": "2026-10-23T20:00:00.000Z"
}
```

## `pagamento.aprovado.v1`

Publicado pelo serviço de Pagamentos depois que a aprovação é verificada e persistida.

```json
{
  "pedidoId": 42,
  "paymentId": 123456,
  "aprovadoEm": "2026-10-23T20:00:00.000Z"
}
```

O serviço de Notificações assina os três canais acima e registra o tipo, o payload JSON e o
horário de recebimento no banco `pcforge_notificacoes`. O log de cada mensagem contém o tipo,
o identificador da gravação e o horário; o conteúdo do payload não é exposto no log.

## Falha de publicação

Redis Pub/Sub não retém mensagens. Se Redis estiver indisponível, a publicação falhar ou
nenhum consumidor estiver inscrito, a API retorna HTTP 503 com o identificador do pedido e
registra a falha. O pedido e a transição de status já foram persistidos e não são revertidos;
o cliente não deve repetir a operação cegamente. Outbox e reenvio automático permanecem fora
do escopo definido pelo ADR-001.
