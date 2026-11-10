# ADR-004: Monorepo com um job de CI por serviço

- **Status:** Aceita
- **Data:** 2026-11-08

## Contexto

Ao dividir o sistema em três serviços ([ADR-002](002-corte-microsservicos.md)), foi preciso
decidir onde fica o código de cada um. São cinco aplicações: os três serviços, a web e o app
mobile. Além delas existe a infraestrutura que as une: `docker-compose.yml`, a configuração
do Nginx e o workflow de CI.

O plano inicial do módulo previa **um repositório só, com pipelines independentes por
serviço**: cada serviço com o próprio workflow e um filtro de `paths`, para que uma mudança no
Pagamentos não rodasse os testes da Loja.

## Decisão

**Um repositório (`pcforge`), com uma pasta por aplicação.** Cada pasta tem o próprio
`package.json`, os próprios testes e, nos serviços, o próprio `Dockerfile`:

| Pasta | Aplicação | Job no CI |
|---|---|---|
| `TechAcademy5back/` | serviço Loja | `backend-tests` |
| `TechAcademy5payments/` | serviço Pagamentos | `payments-tests` |
| `TechAcademy5notifications/` | serviço Notificações | `notifications-tests` |
| `TechAcademy5front/` | web | `frontend-tests` e `e2e-tests` |
| `TechAcademy5mobile/` | app mobile | `mobile-checks` |

A infraestrutura compartilhada fica na raiz.

**O CI é um workflow só, com um job por aplicação, e todo PR roda todos os jobs.** O filtro
de `paths` do plano inicial não foi adotado, por dois motivos:

1. **O CI completo leva cerca de 100 segundos.** Os jobs rodam em paralelo, e o filtro
   economizaria muito pouco tempo.
2. **Um filtro mal configurado falha em silêncio.** Se um caminho ficar de fora da lista, os
   testes daquele serviço deixam de rodar e o PR passa verde sem ninguém perceber. Rodar
   tudo sempre elimina essa classe de erro, e o preço são os mesmos 100 segundos.

O nome `TechAcademy5*` das pastas veio do módulo anterior. Foi mantido de propósito: trocar
exigiria reescrever o CI, o compose, os Dockerfiles e os caminhos de volume, sem ganho além
da estética.

## Alternativas consideradas

- **Um repositório por serviço (polyrepo).** É o arranjo mais comum em microsserviços com
  equipes separadas. Para uma dupla, custaria caro: cinco repositórios para configurar,
  manter e revisar, e uma mudança de contrato de evento viraria PRs coordenados em dois
  repositórios, sem garantia de entrarem juntos.
- **Monorepo com filtro de `paths` por serviço.** Era o plano inicial. Descartado pelos dois
  motivos da decisão. Pode ser revisto se o CI ficar lento, e nesse caso o filtro de cada
  serviço precisaria incluir também os arquivos compartilhados, como o `docker-compose.yml`.

## Consequências

- **Uma mudança de contrato pode entrar num PR atômico.** O produtor e os consumidores de um
  evento mudam no mesmo commit, e a revisão vê os dois lados juntos.
- **Mas o CI não verifica se os contratos continuam compatíveis.** Cada serviço testa o
  próprio lado contra um payload de exemplo escrito no teste, e nenhum teste liga o
  publicador ao consumidor. Se a Loja mudar o formato de `pedido.criado.v1`, os testes da
  Loja e os do Pagamentos continuam verdes. Hoje a proteção é o documento
  [contratos-eventos.md](../contratos-eventos.md) somado à revisão do PR. O passo seguinte
  seria um teste de contrato: um schema do evento validado nos dois lados, no publicador e no
  consumidor.
- **A versão é do sistema, não de cada serviço.** A tag `v2.0.0` marca o estado dos três
  serviços juntos ([versionamento.md](../gestao/versionamento.md)). Num polyrepo, cada
  serviço teria a própria versão, e saber quais versões funcionam juntas viraria um problema.
- **Todo PR paga o CI inteiro**, incluindo um PR que só mexe em documentação. Hoje isso
  custa menos de dois minutos.
- **A independência entre serviços não é garantida pela estrutura.** Nada impede, tecnicamente,
  que o código de um serviço importe um arquivo de outro. A separação depende da revisão de PR
  e da regra do ADR-002. Num polyrepo, isso seria impossível por construção.

## Referências

- [ADR-002 — corte em 3 microsserviços](002-corte-microsservicos.md)
- [ADR-003 — um banco MySQL por serviço](003-banco-de-dados-por-servico.md)
- [Fluxo de trabalho e Definição de Pronto](../gestao/fluxo-de-trabalho.md)
