# Como escrever um cartão Stories

Crie Markdown para uma questão, declare-o como material `story` e ligue-o à questão pelo ID. Um Story é uma lição autônoma de quatro ecrãs: ele não resume um relatório e não depende dele.

## Criar o arquivo

Use `cards/qNN.md` na pasta compartilhada do simulado ou da tentativa. Comece com H1 `# Q<n> — título`, declare `Domain`, `Task` e `Signal`, e escreva quatro seções não vazias nesta ordem:

1. `## Topic`
2. `## Why you got it wrong`
3. `## Why the right answer was different`
4. `## Concepts to nail it next time`

`Domain` e `Task` começam pelo código numérico oficial, por exemplo `1.5 — Design retrieval mechanisms for FM augmentation`. O `Signal` é um trecho curto do enunciado que entrega a resposta.

### Ecrã 1 — contexto, sua resposta, resposta correta

Reconstrua o caso em duas a quatro frases, sem depender do enunciado original, e declare as duas respostas:

```markdown
## Topic

<contexto do caso, com a exigência que decide o item>

**Your answer (incorrect):** <paráfrase fiel da opção escolhida>
**Correct answer:** <paráfrase fiel da opção gabaritada>
```

A paráfrase nomeia todos os serviços e mecanismos da opção, para que o cartão seja comparável com o enunciado, sem copiar o texto da fonte. Em multi-seleção, liste cada alternativa numa linha marcada com ✓ ou ✗.

### Ecrã 2 — o que você errou

Explique o erro inteiro, com o nome do raciocínio que falhou e o motivo de a falha. Use lista quando o erro tem partes distintas.

Para resposta correta, não invente um erro: diga que a resposta estava certa, explique o mecanismo e consolide a dúvida que ficou registrada.

### Ecrã 3 — por que o gabarito está certo

Mapeie cada exigência do enunciado ao mecanismo que a satisfaz e explique por que a alternativa mais tentadora falha. Nomeie as responsabilidades concretas dos serviços.

### Ecrã 4 — o que memorizar

Liste de memorização: no mínimo dois itens, com regras, distinções e gatilhos de escolha. Use uma tabela quando o contraste couber em pares curtos. Termine com a frase que resume a regra:

```markdown
- The sentence to keep: **<a regra em uma frase>**
```

## Declarar e relacionar

No `exam.json` ou `attempt.json` proprietário, inclua `id`, `type: "story"`, `title`, `path` relativo e `questionNumber`. Na questão, adicione `{ "scope": "exam", "id": "<id>" }` para material compartilhado ou `scope: "attempt"` para material específico.

## Validar

Execute `make check`. A validação verifica seções, ordem, corpo, H1, metadados, código de Domain e Task, a declaração das duas respostas no ecrã `Topic`, os itens de lista da secção de conceitos e o arquivo. Depois, abra Stories e confira o destino da questão.
