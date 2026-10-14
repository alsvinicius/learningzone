# Modelo normalizado de tentativa

O app consome um objeto JSON estável, independente da fonte de origem. O índice aponta para o arquivo `attempt.json`. O objeto segue o [Contrato de conteúdo v1](content-contract.md).

## Identidade

- `schemaVersion`: inteiro `1`.
- `certificationId`: ID que coincide com o pai no índice.
- `examId`: ID que coincide com o simulado no índice.
- `attemptId`: ID que coincide com a tentativa declarada.

Os três IDs formam a identidade do progresso local. `attemptId` deve preservar o identificador da execução de origem quando houver.

## Resultado

- `score`: objeto com `percent`; pode incluir `passingPercent`, `passed`, valores bruto/total e metadados da fonte.
- `totals`: `questions`, `correct`, `incorrect`, `skipped`, `answered`, `timeSpentSeconds` e `avgSeconds`.
- `window`: metadados temporais da execução; campos não disponíveis na fonte podem ser omitidos.
- `domains`: lista de agregados por domínio, incluindo código, nome, questões e corretas.
- `tasks`: lista de agregados por tarefa, incluindo associação de domínio quando disponível.

O validador compara contagens e percentuais às questões. Não fabrique agregados que a fonte não fornece; preserve a informação original e documente limitações no adaptador.

## Questões

Cada questão usa `n` (inteiro positivo), `text`, `status` (`correct`, `incorrect` ou `skipped`), `seconds` e `options`. Uma opção tem `id`, texto, `chosen` e `correct`. A estrutura pode incluir `matching` para associação de itens e `materials` para referências ao material de estudo.

Uma referência de material contém `scope` (`exam` ou `attempt`) e `id`, sem caminho. O caminho é resolvido pelo manifesto proprietário. O verificador valida o formato normalizado e as relações entre agregados, respostas e pontuação.

## Conversores

Um conversor é código local específico da fonte, executado explicitamente pelo usuário. Ele lê um arquivo local, não deve fazer chamadas de rede, cria o formato normalizado e não sobrescreve tentativa existente. IDs de origem, pontuação e respostas precisam ser preservados; dados não disponíveis devem ser omitidos, nunca adivinhados.
