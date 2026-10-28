# Contrato de conteúdo v1

O catálogo usa JSON e Markdown estáticos sob `data/`. A aplicação interpreta arquivos declarados no índice e nos manifests. `tools/content.py` implementa a validação do catálogo; `make check` executa a verificação completa.

## Catálogo e caminhos

`data/index.json` contém `schemaVersion: 1` e `certifications`, inclusive quando vazio. Cada certificação declara `id`, `name` e `exams`; `code` é opcional. Cada simulado declara `id`, `path` para `exam.json` e `attempts`. Cada tentativa declara seu `id` de origem e `path` para `attempt.json`. A chave opcional `studies` acrescenta trilhas sem alterar a hierarquia de certificações; ausente equivale a uma lista vazia.

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
data/<study-id>/study.json
data/<study-id>/<module-id>/<lesson>.md
```

Caminhos do índice são relativos a `data/`. Caminhos de material são relativos ao manifesto que os declara. IDs de certificação e simulado são slugs minúsculos com dígitos e hífens; tentativa e material aceitam segmentos alfanuméricos, ponto, sublinhado e hífen, sem separador de diretório.

## Manifesto do simulado

`exam.json` tem `schemaVersion: 1`, `id`, `title` e `materials`. Cada material tem `id`, `type` (`report` ou `story`), `title`, `path` e `questionNumber` opcional positivo. Materiais declarados aqui são compartilhados por todas as tentativas. Arquivos têm extensão `.md`.

## Manifesto da tentativa

`attempt.json` contém `schemaVersion: 1`, `certificationId`, `examId`, `attemptId`, `score`, `totals`, `window`, `domains`, `tasks`, `questions` e `materials`. `score`, `totals` e `window` são objetos. Resultados e questões seguem o [modelo normalizado](attempt-data.md). Materiais declarados aqui são específicos desta tentativa.

Uma questão tem `n` inteiro positivo e pode conter `materials`, uma lista de referências `{ "scope": "exam" | "attempt", "id": "..." }`. O escopo indica qual manifesto declara aquele ID. `questionNumber` precisa corresponder a uma questão da tentativa.

## Materiais e Stories

IDs de material são únicos dentro do manifesto proprietário. Cada caminho precisa existir e permanecer dentro da pasta do manifesto. O tipo `story` precisa seguir [Formato Stories](story-card-format.md), que define as quatro seções obrigatórias, o conteúdo de cada uma e a declaração das duas respostas no ecrã `Topic`. Materiais sem referência em questão continuam acessíveis na biblioteca.

## Trilhas e domínios

Cada entrada em `studies` declara `id` e `path` para `data/<study-id>/study.json`. O manifesto usa `schemaVersion: 1`, `id`, `title`, `domains` e `modules`. Um domínio tem `id`, `name` e descrição opcional. Módulos têm `id`, `title`, `domainId` principal e lista ordenada `lessons`. Uma lição tem `id`, `title`, `type` (`deep-dive`, `decision-guide`, `case`, `challenge`, `story` ou `report`) e `path` Markdown relativo ao diretório do estudo. `domainIds` opcional associa uma lição transversal a domínios adicionais; ausente herda o domínio do módulo. `story` em estudo declara `Story mode: learning` e usa telas próprias para hipótese inicial, limites do modelo, raciocínio mais completo e conceitos. Pode haver várias lições Story em cada domínio; não há número de questão nem vínculo com tentativas.

Domínios e vínculos resolvem no manifesto. `domainIds` acrescenta associações transversais; cada lição também pertence sempre ao domínio principal de seu módulo. IDs de lição são únicos no módulo; IDs de módulo são únicos no estudo. Paths são relativos, terminam em `.md`, existem e permanecem contidos no diretório do estudo. Stories de estudo não criam simulados, tentativas ou resultados de certificação.

Uma certificação pode declarar `domains` com IDs e nomes. `domainIds` opcional em materiais e `domainId` opcional por questão habilitam navegação e filtro quando há associação explícita. Agregados de tentativa não são convertidos em associações individuais. Catálogos anteriores sem estes campos permanecem válidos.

## Regras de validação

- IDs são únicos no escopo correspondente.
- Paths absolutos, `..`, separadores Windows e caminhos fora do diretório são rejeitados.
- `exam.path` aponta para `exam.json` em `<cert>/<exam>/`; `attempt.path` aponta para `attempt.json` em `<cert>/<exam>/attempts/<attempt>/`.
- Todo arquivo e vínculo declarado existe.
- Estudos, domínios, módulos e lições opcionais têm IDs e referências válidos; Markdown não pode escapar da pasta do estudo.
- Números de questão e referências de material não se duplicam.
- O verificador confere consistência de totais, respostas e score.

Para criar conteúdo, siga o [guia de autoria](../how-to/add-study-content.md). Para privacidade, consulte [Conteúdo e licenças](../explanation/content-and-licensing.md).

## Revisão por certificação

A extensão opcional `preTestReview` declara uma revisão consolidada em nível de certificação, sem alterar a hierarquia dos simulados. Campos, cobertura, fingerprints e compatibilidade estão na [referência Pre-Test Review](pre-test-review.md). Questões podem preservar `learnerNotes` (texto) e `reviewRequested` (booleano editorial).

## Reports de estudo

Uma lição `type: "report"` é um documento de aprofundamento independente de questão e tentativa. Usa os mesmos campos, caminhos, domínios e progresso explícito das outras lições. O tipo é uma extensão aditiva do catálogo v1; catálogos anteriores não precisam de migração. O comportamento de índice, busca e leitura está em [Reports de estudo](study-reports.md). Materiais `report` em `exam.json` e `attempt.json` mantêm seus escopos históricos.
