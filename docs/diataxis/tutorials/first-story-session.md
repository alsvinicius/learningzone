# Faça uma primeira sessão Stories

Este tutorial acompanha a criação de uma tentativa sintética com uma questão e um cartão. Você terminará com Stories aberto e verá como a posição fica guardada neste navegador.

## Preparar o catálogo

Siga [Crie seu primeiro catálogo](first-catalog.md) para registrar a certificação `demo-cert` e o simulado `practice`. Adicione uma tentativa seguindo o [modelo normalizado](../reference/attempt-data.md) e declare o caminho no array `attempts`. Use uma questão inventada e opções originais.

Na pasta `data/demo-cert/practice/attempts/run-1/`, crie `attempt.json` com este resultado sintético de uma questão pulada:

```json
{
  "schemaVersion": 1,
  "certificationId": "demo-cert",
  "examId": "practice",
  "attemptId": "run-1",
  "score": { "percent": 0 },
  "totals": {
    "questions": 1,
    "correct": 0,
    "incorrect": 0,
    "skipped": 1,
    "answered": 0,
    "timeSpentSeconds": 0,
    "avgSeconds": 0
  },
  "window": {},
  "domains": [],
  "tasks": [],
  "questions": [
    {
      "n": 1,
      "text": "Qual opção demonstra um conceito inventado?",
      "status": "skipped",
      "seconds": 0,
      "options": [
        { "id": "a", "text": "Exemplo sintético A", "chosen": false, "correct": false },
        { "id": "b", "text": "Exemplo sintético B", "chosen": false, "correct": false }
      ],
      "materials": []
    }
  ],
  "materials": []
}
```

No índice, acrescente ao simulado o registro `{"id":"run-1","path":"demo-cert/practice/attempts/run-1/attempt.json"}` dentro de `attempts`.

## Criar o cartão

Crie `cards/q01.md` com título `# Q1 — Conceito de demonstração`, metadados `Domain`, `Task` e `Signal` e as quatro seções obrigatórias:

```markdown
## Topic
Conceito inventado deste tutorial.

## Why you got it wrong
Uma confusão plausível na questão sintética.

## Why the right answer was different
A distinção que resolve o exemplo.

## Concepts to nail it next time
Uma regra de lembrança escrita por você.
```

No manifesto, acrescente a `materials` um item com ID `story-q01`, tipo `story`, título, caminho `cards/q01.md` e `questionNumber: 1`. Na questão 1, acrescente `materials: [{"scope":"attempt","id":"story-q01"}]`. Substitua também `materials: []` no nível da tentativa por esse item. A questão pulada não altera contagens nem percentuais.

## Validar e estudar

Execute `make check`, recarregue o app e selecione certificação, simulado e tentativa. Abra **Stories** e navegue com setas ou `j`/`k`. Recarregue a página: a sessão retoma a posição guardada pelo navegador.

O exemplo existe para ensinar o fluxo; não está cadastrado na distribuição. Consulte [Formato Stories](../reference/story-card-format.md) e [Modelo de tentativa](../reference/attempt-data.md) para os campos completos.
