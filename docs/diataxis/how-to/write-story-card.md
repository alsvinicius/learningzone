# Como escrever um cartão Stories

Crie Markdown para uma questão, declare-o como material `story` e ligue-o à questão pelo ID.

## Criar o arquivo

Use `cards/qNN.md` na pasta compartilhada do simulado ou da tentativa. Comece com H1 `# Q<n> — título`, declare `Domain`, `Task` e `Signal`, e escreva quatro seções não vazias nesta ordem:

1. `## Topic`
2. `## Why you got it wrong`
3. `## Why the right answer was different`
4. `## Concepts to nail it next time`

Escreva texto original e conciso; não inclua gabaritos protegidos ou material que não possa ser redistribuído.

## Declarar e relacionar

No `exam.json` ou `attempt.json` proprietário, inclua `id`, `type: "story"`, `title`, `path` relativo e `questionNumber`. Na questão, adicione `{ "scope": "exam", "id": "<id>" }` para material compartilhado ou `scope: "attempt"` para material específico.

## Validar

Execute `make check`. A validação verifica seções, ordem, corpo, H1, metadados, número e arquivo. Depois, abra Stories e confira o destino da questão.
