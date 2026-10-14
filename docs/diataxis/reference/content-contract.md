# Contrato de conteúdo v1

O catálogo usa JSON e Markdown estáticos sob `data/`. A aplicação interpreta arquivos declarados no índice e nos manifests. `tools/content.py` implementa a validação do catálogo; `make check` executa a verificação completa.

## Catálogo e caminhos

`data/index.json` contém `schemaVersion: 1` e `certifications`, inclusive quando vazio. Cada certificação declara `id`, `name` e `exams`; `code` é opcional. Cada simulado declara `id`, `path` para `exam.json` e `attempts`. Cada tentativa declara seu `id` de origem e `path` para `attempt.json`.

Exemplo sintético mínimo válido:

```json
{
  "schemaVersion": 1,
  "certifications": [{
    "id": "sample-cert",
    "name": "Certificação de exemplo",
    "exams": [{
      "id": "practice-set",
      "path": "sample-cert/practice-set/exam.json",
      "attempts": []
    }]
  }]
}
```

Árvore esperada:

```text
data/index.json
data/<certification-id>/<exam-id>/exam.json
data/<certification-id>/<exam-id>/shared/<material>.md
data/<certification-id>/<exam-id>/attempts/<attempt-id>/attempt.json
data/<certification-id>/<exam-id>/attempts/<attempt-id>/reports/<material>.md
data/<certification-id>/<exam-id>/attempts/<attempt-id>/cards/<material>.md
```

Caminhos do índice são relativos a `data/`. Caminhos de material são relativos ao manifesto que os declara. IDs de certificação e simulado são slugs minúsculos com dígitos e hífens; tentativa e material aceitam segmentos alfanuméricos, ponto, sublinhado e hífen, sem separador de diretório.

## Manifesto do simulado

`exam.json` tem `schemaVersion: 1`, `id`, `title` e `materials`. Cada material tem `id`, `type` (`report` ou `story`), `title`, `path` e `questionNumber` opcional positivo. Materiais declarados aqui são compartilhados por todas as tentativas. Arquivos têm extensão `.md`.

## Manifesto da tentativa

`attempt.json` contém `schemaVersion: 1`, `certificationId`, `examId`, `attemptId`, `score`, `totals`, `window`, `domains`, `tasks`, `questions` e `materials`. `score`, `totals` e `window` são objetos. Resultados e questões seguem o [modelo normalizado](attempt-data.md). Materiais declarados aqui são específicos desta tentativa.

Uma questão tem `n` inteiro positivo e pode conter `materials`, uma lista de referências `{ "scope": "exam" | "attempt", "id": "..." }`. O escopo indica qual manifesto declara aquele ID. `questionNumber` precisa corresponder a uma questão da tentativa.

## Materiais e Stories

IDs de material são únicos dentro do manifesto proprietário. Cada caminho precisa existir e permanecer dentro da pasta do manifesto. O tipo `story` precisa seguir [Formato Stories](story-card-format.md). Materiais sem referência em questão continuam acessíveis na biblioteca.

## Regras de validação

- IDs são únicos no escopo correspondente.
- Paths absolutos, `..`, separadores Windows e caminhos fora do diretório são rejeitados.
- `exam.path` aponta para `exam.json` em `<cert>/<exam>/`; `attempt.path` aponta para `attempt.json` em `<cert>/<exam>/attempts/<attempt>/`.
- Todo arquivo e vínculo declarado existe.
- Números de questão e referências de material não se duplicam.
- O verificador confere consistência de totais, respostas e score.

Para criar conteúdo, siga o [guia de autoria](../how-to/add-study-content.md). Para privacidade, consulte [Conteúdo e licenças](../explanation/content-and-licensing.md).
