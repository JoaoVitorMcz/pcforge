# Context Map e Bounded Contexts

Como o domínio do PC Forge se divide em contextos, o que cada um significa por dentro e como
eles conversam. Entrega da SCRUM-29.

O recorte em três serviços e a razão de cada corte estão no
[ADR-002](adr/002-corte-microsservicos.md). Este documento descreve o que esse corte produz
em termos de **domínio**: fronteiras, linguagem e relações.

---

## Por que dividir em contextos

Um **bounded context** é a fronteira dentro da qual um termo tem um significado único. Fora
dela, a mesma palavra pode significar outra coisa — e tentar fazer um único modelo servir a
todos os significados é como um sistema grande normalmente apodrece.

O exemplo vivo neste projeto é a palavra **pedido**. Para a Loja, um pedido é o carrinho
confirmado: tem itens, endereço de entrega, estoque já baixado e um ciclo de vida que passa
por `pendente`, `pago`, `enviado`, `entregue` e `cancelado`. Para o serviço de Pagamentos, um
pedido é bem menos que isso — é só o que basta para cobrar: um identificador, um valor, uma
lista de itens com preço e o e-mail de quem paga. Endereço de entrega, estoque e categoria
não significam nada ali.

Forçar os dois a compartilhar o mesmo modelo faria o Pagamentos carregar conceitos que não
usa e a Loja expor detalhes que não deveria. Separar deixa cada um com o modelo que
realmente precisa.

---

## Os três contextos

### Loja — o contexto central

**Responsabilidade:** clientes, catálogo e pedidos. É onde a compra acontece e onde está a
regra de negócio que não pode ser violada: *não vender o que não há em estoque*.

**Linguagem ubíqua:**

| Termo | Significado aqui |
|---|---|
| **Cliente** | Pessoa cadastrada, com papéis e permissões (RBAC) |
| **Produto** | Item do catálogo, com preço, estoque e categoria |
| **Pedido** | Carrinho confirmado: itens, endereço, valor, status |
| **Item de pedido** | Produto, quantidade e **preço no momento da compra** |
| **Estoque** | Quantidade disponível, reduzida na mesma transação do pedido |
| **Status** | `pendente` → `pago` → `enviado` → `entregue`, ou `cancelado` |

**Fronteira:** o catálogo fica dentro deste contexto, e não em um serviço próprio, porque
produto e pedido compartilham o invariante do estoque. Um invariante que precisa valer
imediatamente é o sinal mais forte de que duas entidades pertencem ao mesmo contexto — a
justificativa completa está no ADR-002.

### Pagamentos — o contexto de cobrança

**Responsabilidade:** transformar um pedido em uma cobrança no Mercado Pago e acompanhar o
que acontece com ela.

**Linguagem ubíqua:**

| Termo | Significado aqui |
|---|---|
| **Pedido** | Apenas a cópia necessária para cobrar: id, valor, itens, e-mail do pagador |
| **Transação** | Uma tentativa de cobrança, com seu próprio ciclo de vida |
| **Preferência** | Intenção de pagamento criada no Mercado Pago, que gera o link de checkout |
| **Pagador** | Quem paga — não é necessariamente o "cliente" da Loja |

**Fronteira:** este contexto **não conhece** estoque, endereço de entrega, categoria nem
papéis de usuário. Se precisasse de algum deles, seria sinal de que a fronteira está no lugar
errado.

**Por que é um contexto à parte:** o Mercado Pago é um sistema externo com falha e latência
próprias. Isolá-lo permite aplicar retry, timeout e circuit breaker em um único lugar, sem
contaminar o resto. E a integração não tem tabela própria para arrastar — nasce limpa.

### Notificações — o contexto de histórico

**Responsabilidade:** assinar os eventos que circulam e guardar o histórico deles.

**Linguagem ubíqua:**

| Termo | Significado aqui |
|---|---|
| **Evento** | Algo que aconteceu: tipo, payload, horário de recebimento |
| **Assinatura** | A declaração de quais tipos de evento interessam |

**Fronteira:** é um contexto **somente de leitura** do que os outros publicam. Não toma
decisão de negócio e ninguém depende dele para funcionar. É a prova viva de que a mensageria
circula.

---

## Como os contextos se relacionam

Os padrões abaixo são os nomes que o DDD dá a cada tipo de relação.

### Loja → Pagamentos e Loja → Notificações: *Publisher/Subscriber*

A Loja publica eventos sem saber quem escuta. Quem precisa, assina.

É a relação mais fraca possível entre contextos, e é de propósito: a Loja não tem referência
nenhuma ao Pagamentos no código. Os payloads versionados estão documentados em
[Contratos de eventos da Loja](contratos-eventos.md). Como Redis Pub/Sub não retém mensagens,
se a publicação falhar depois de o pedido ser persistido, a API retorna 503 com o identificador
do pedido e registra a falha; pedido e status permanecem gravados. O cliente não deve repetir
a operação cegamente. Outbox e reenvio automático estão fora do escopo do ADR-001.

**Eventos publicados**, versionados para permitir evolução sem quebrar quem consome:

| Evento | Quando | Quem consome |
|---|---|---|
| `pedido.criado.v1` | Pedido confirmado na Loja | Pagamentos, Notificações |
| `pedido.status-alterado.v1` | Mudança de status | Notificações |
| `pagamento.aprovado.v1` | Mercado Pago aprova | **Loja**, Notificações |

Note que a Loja é publicadora **e** assinante: ela publica `pedido.criado` e consome
`pagamento.aprovado`. Esse ciclo é o que torna a confirmação de pagamento assíncrona, e é
também a razão de a SCRUM-23 ter sido dividida — publicar não depende de ninguém, consumir
depende do serviço de Pagamentos existir.

### Pagamentos → Mercado Pago: *Anti-Corruption Layer*

A relação mais importante de defender na apresentação.

O Mercado Pago tem o próprio vocabulário, e ele **não é o nosso**:

| Vocabulário do Mercado Pago | O que significa no nosso domínio |
|---|---|
| `preference_id` | Identificador da intenção de cobrança |
| `external_reference` | O nosso id de pedido, visto de fora |
| `init_point` / `sandbox_init_point` | URL para onde o cliente vai pagar |
| `payment_id` | Identificador da transação deles |
| `unit_price`, `currency_id` | Preço e moeda de cada item |
| `payer` | Pagador |
| `approved` / `pending` / `rejected` | Resultado da cobrança |

Uma **Anti-Corruption Layer** é uma camada de tradução na fronteira: tudo que entra é
convertido para o nosso vocabulário antes de chegar ao domínio, e tudo que sai é convertido
para o deles.

**Por que isso importa na prática:** sem a ACL, `approved` e `preference_id` vazam para
dentro do sistema e aparecem no controller, no banco e até no front. Aí o dia em que o
Mercado Pago mudar um nome de campo — ou o dia em que vocês quiserem aceitar PIX direto —
a mudança atravessa o projeto inteiro. Com a ACL, ela para na camada de tradução.

É também um caso de relação **Conformist** no sentido estrito do DDD: não temos nenhuma
influência sobre o modelo do Mercado Pago, só podemos nos adaptar a ele. A ACL é o que
impede que essa submissão contamine o domínio.

---

## O desenho

Especificação para o diagrama em `docs/diagramas/context-map.drawio.png`, pelo padrão de
[diagramas/README.md](diagramas/README.md).

**Caixas** — três contextos nossos mais um sistema externo:

| Caixa | Posição sugerida | Conteúdo |
|---|---|---|
| **Loja** | centro-esquerda, maior | "Clientes · Catálogo · Pedidos" + nota "invariante: estoque" |
| **Pagamentos** | centro-direita | "Transações · Preferências" |
| **Notificações** | abaixo, centro | "Histórico de eventos" |
| **Mercado Pago** | extrema direita, estilo diferente (tracejado ou cinza) | "Sistema externo" |

Cada contexto nosso leva seu banco desenhado junto — é o que mostra visualmente que não há
banco compartilhado.

**Setas:**

1. Loja → Pagamentos — `pedido.criado.v1`, rótulo **Publisher/Subscriber**
2. Pagamentos → Loja — `pagamento.aprovado.v1`, mesmo rótulo
3. Loja → Notificações — `pedido.criado.v1`, `pedido.status-alterado.v1`
4. Pagamentos → Notificações — `pagamento.aprovado.v1`
5. Pagamentos → Mercado Pago — HTTPS, com uma **barra de ACL** desenhada sobre a seta, do
   lado de Pagamentos, rotulada **Anti-Corruption Layer**

As setas de 1 a 4 passam pelo Redis: vale desenhá-lo como um elemento no meio, rotulado
"Redis Pub/Sub", para deixar claro que nenhuma delas é chamada HTTP direta.

**Legenda:** uma linha explicando que seta cheia é evento assíncrono e seta tracejada é
chamada síncrona.

---

## Referências

- [ADR-002 — corte em 3 microsserviços](adr/002-corte-microsservicos.md)
- [ADR-001 — Redis como cache e broker](adr/001-redis-cache-e-eventos.md)
- EVANS, Eric. *Domain-Driven Design*, cap. 14 — Maintaining Model Integrity
