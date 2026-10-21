# ADR-002: Corte em 3 microsserviços com o Catálogo dentro da Loja

- **Status:** Aceita
- **Data:** 2026-10-15

## Contexto

O módulo exige decompor o monólito em microsserviços com **bancos de dados separados**. O
ponto de partida é a API Express da `TechAcademy5back`, que hoje atende clientes, catálogo,
pedidos e pagamentos sobre um único MySQL.

A decisão que importa não é *se* decompor, mas **onde cortar**. Um corte errado produz duas
falhas opostas: serviços grandes demais não demonstram o conceito, e serviços pequenos
demais transformam uma transação local em um protocolo distribuído — com toda a complexidade
de consistência que vem junto.

Duas características do código atual restringem o corte:

1. **A baixa de estoque e a criação do pedido estão na mesma transação.** Em
   `TechAcademy5back/src/services/pedido.service.ts`, a transação abre na linha 171 e o
   `Produto.decrement("estoque", …)` roda dentro dela, na linha 200. Se qualquer item falhar,
   o rollback desfaz pedido, itens e baixa juntos.
2. **O pagamento não tem tabela própria.** Não existe model `Pagamento` em
   `src/models/`; o estado do pagamento vive em `Pedido.status` e `Pedido.data_pagamento`.

## Decisão

Três serviços, cada um com seu banco e seu container:

| Serviço | Responsabilidade | Banco |
|---|---|---|
| **Loja** | clientes, **catálogo**, pedidos | MySQL (o atual) |
| **Pagamentos** | integração com o Mercado Pago, resiliência | banco próprio, novo |
| **Notificações** | consome eventos e grava o histórico | banco próprio, novo |

**Nenhum serviço consulta o banco de outro.** Os dados atravessam fronteiras por evento, via
Redis Pub/Sub, e cada serviço guarda a própria cópia do que precisa. Eventos versionados:
`pedido.criado.v1`, `pedido.status-alterado.v1`, `pagamento.aprovado.v1`.

O JWT continua sendo emitido pela Loja e é validado localmente por cada serviço, com o mesmo
`JWT_SECRET`. O Nginx vira o gateway e passa a ser a única porta exposta.

### Por que o Catálogo fica na Loja

É a parte menos óbvia e a mais importante. Separar o Catálogo significaria que o serviço de
Pedidos não poderia mais dar baixa no estoque dentro da própria transação: a reserva viraria
uma chamada remota, e garantir que "pedido criado" e "estoque reduzido" aconteçam juntos
exigiria uma **saga** com passo de compensação — estornar o estoque quando o pedido falha
depois da reserva.

Isso é uma quantidade de complexidade que o escopo não paga. Pior: trocaria uma garantia que
já funciona (a transação ACID, que corrigiu um bug real de estoque encontrado em auditoria)
por uma consistência eventual que precisaríamos implementar, testar e defender. O corte
seguiria o organograma do exercício, não o domínio.

Catálogo e Pedido compartilham um invariante — *não vender o que não existe em estoque* — e
um invariante que precisa valer imediatamente é o sinal mais claro de que duas entidades
pertencem ao mesmo contexto.

### Por que Pagamentos sai

Pelo motivo inverso. O Mercado Pago é um sistema externo, com falha e latência próprias, e a
integração com ele **não tem tabela própria para arrastar**: nasce com o banco limpo.
Também é o único ponto do sistema onde circuit breaker, retry e timeout têm razão de existir
— exatamente o que a rubrica de resiliência pede.

## Alternativas consideradas

- **Monólito modular (um serviço, módulos bem separados).** Menor risco e provavelmente a
  escolha certa para um sistema real deste tamanho. Descartada porque o requisito de
  microsserviços com bancos separados foi dado em aula.
- **Cinco serviços, com Catálogo e Clientes separados.** Demonstraria mais decomposição, ao
  custo da saga descrita acima e de um segundo protocolo distribuído para o login. Mais
  superfície para quebrar e mais difícil de defender.
- **Separar Pedidos de Catálogo com reserva de estoque assíncrona.** Tecnicamente possível
  com um padrão de reserva mais expiração, mas introduz estado intermediário ("reservado,
  não confirmado") que teria de aparecer na interface do cliente.

## Consequências

- **A confirmação de pagamento deixa de ser síncrona.** Hoje
  `src/controllers/pagamento.controller.ts` chama `criarPedidoComItens` (linha 33) e grava
  `pedido.update({ status: "pago" })` direto no model (linhas 164-165), devolvendo o pedido
  já pago na mesma resposta. Depois da extração, a Loja cria o pedido, o Pagamentos confirma
  com o Mercado Pago e publica `pagamento.aprovado.v1`; a Loja reage ao evento. A tela de
  retorno do checkout (`TechAcademy5front/src/Pages/CheckoutRetorno.jsx`) precisa lidar com
  "ainda processando" como estado normal, não como erro.
- **O serviço de Pagamentos precisa da própria tabela de transações.** O que hoje é um campo
  em `Pedido` vira entidade no banco novo, e a Loja mantém só o status do pedido, atualizado
  por evento.
- **A Loja passa a guardar cópia do que vem de fora.** É duplicação deliberada: o preço de
  cada evento é não ter acoplamento de banco.
- **Se o Redis cair, os eventos param.** O Pub/Sub não retém mensagens para consumidores
  desconectados ([ADR-001](001-redis-cache-e-eventos.md)). Um pagamento aprovado durante uma
  queda do Redis não chegaria à Loja. Em produção isso exigiria outbox ou fila durável; no
  escopo acadêmico, fica registrado como limitação conhecida.
- **O Catálogo dentro da Loja é uma decisão a defender, não a esconder.** Um avaliador pode
  perguntar por que não foram quatro serviços; a resposta é a transação da linha 200.
