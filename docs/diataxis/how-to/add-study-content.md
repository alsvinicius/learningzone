# Como adicionar conteúdo de estudo

Este guia organiza arquivos próprios no contrato da aplicação. A distribuição começa vazia; conteúdo sob `data/` é ignorado pelo Git para que cada instalação possa permanecer privada.

## Planejar a hierarquia

Use um ID estável por certificação, um ID por conjunto/prova e um ID original por tentativa:

```text
data/index.json
data/<certification-id>/<exam-id>/
  exam.json
  shared/
  attempts/<attempt-id>/
    attempt.json
    reports/
    cards/
```

Materiais em `shared/` são acessíveis em qualquer tentativa daquele simulado. Relatórios e Stories em `attempts/<id>/` pertencem somente à execução. Um material pode ser associado a uma questão ou permanecer na biblioteca geral.

## Atualizar o catálogo

1. Crie `exam.json` com `schemaVersion`, `id`, `title` e `materials`.
2. Inclua certificação e simulado em `data/index.json`; declare `attempts: []` se ainda não houver resultados.
3. Para cada execução, crie `attempt.json`, registre-a em `attempts` e preserve o ID original.
4. Registre cada Markdown em `materials` no manifesto proprietário.
5. Para associar material a uma questão, adicione `{ "scope": "exam" | "attempt", "id": "material-id" }` a `questions[].materials`.

Os campos exatos estão em [Contrato de conteúdo v1](../reference/content-contract.md). Evite IDs dependentes de título mutável ou nome temporário de arquivo.

## Normalizar uma origem

O app consome um formato comum. Um conversor local por fonte deve mapear resultados para [Modelo normalizado de tentativa](../reference/attempt-data.md), preservar valores conhecidos e não inventar respostas, pontuações, domínios ou metadados. O conversor compatível com AWS Skill Builder recebe arquivo e IDs por argumento; não faz chamadas de rede. Para outra estrutura, implemente um adaptador separado.

Mantenha exportações originais fora do Git. Execute conversores sobre arquivos locais temporários e apague o bruto quando a saída for conferida.

## Atribuir domínio e tarefa

O `Domain` e o `Task` de um Story usam os códigos e nomes oficiais do blueprint. Quando a origem publica apenas os totais por domínio e por tarefa, sem dizer a qual questão cada um pertence, a atribuição por questão é uma reconstrução editorial. Reconstrua-a e confira: a atribuição é aceitável quando reproduz exatamente as contagens oficiais de questões e de acertos em cada tarefa e em cada domínio. Registre no README da tentativa que a atribuição é editorial, para que ninguém a leia como dado da origem.

## Validar e revisar

```bash
make check
make serve
```

Confira contagens, respostas, score e agregados com a origem. Na interface, abra uma tentativa, um material compartilhado, um específico e Stories associados. Para simulado sem tentativa, confirme que material compartilhado permanece disponível.

Um Story é uma lição autônoma: leia os quatro ecrãs de um cartão sem abrir o relatório e confirme que o contexto, a resposta dada, a resposta gabaritada, o erro, o mecanismo e a lista de memorização estão todos no cartão. Consulte [Formato Stories](../reference/story-card-format.md) e [Escrever cartões Stories](write-story-card.md).

Antes de abrir uma contribuição de código, restaure `data/index.json` para `{"schemaVersion":1,"certifications":[]}`. Não use `git add -f` em conteúdo local. Veja [privacidade e licenças](../explanation/content-and-licensing.md).

A entrega inclui [preparar ou atualizar o Pre-Test Review](update-pre-test-review.md), consolidando todas as tentativas da certificação. Consulte a [referência](../reference/pre-test-review.md) para seleção e cobertura.
