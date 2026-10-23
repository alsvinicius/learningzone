# Como adicionar uma tentativa

Uma tentativa é o resultado normalizado de uma execução de prova/simulado. Ela pertence a um simulado, mantém o ID fornecido pela origem e pode ter relatórios e Stories próprios.

## 1. Declare o simulado

O catálogo precisa ter certificação e simulado antes da conversão. Crie `data/<cert>/<exam>/exam.json` e inclua o caminho relativo no índice. Se não houver materiais compartilhados, use `"materials": []`. Os campos estão em [Contrato de conteúdo v1](../reference/content-contract.md).

## 2. Preserve a fonte e escolha o adaptador

Guarde a exportação original em local ignorado, por exemplo `.raw-attempt.json`. Identifique o conversor correspondente ao formato e à versão da origem. Para exportações AWS Skill Builder compatíveis:

```bash
python3 tools/normalize.py .raw-attempt.json <certification-id> <exam-id> <attempt-id>
```

O conversor exige que o simulado já exista, cria uma pasta de tentativa e recusa sobrescrever uma tentativa existente. Para outras fontes, implemente conversor separado para o formato canônico; não assuma que campos distintos são equivalentes.

## 3. Acrescente materiais

Relatórios Markdown ficam em `reports/`; cartões em `cards/`. Registre-os em `attempt.json`. Associe materiais à questão por ID e escopo, nunca repetindo caminho no objeto da questão. Consulte [Formato Stories](../reference/story-card-format.md).

## 4. Verifique

Execute `make check` e `make serve`. Compare contagens, respostas, score e agregados com a fonte. Abra materiais no app e confirme que a tentativa aparece uma única vez. Apague exportações brutas quando não forem necessárias. Conteúdo de estudo permanece local; consulte [política de conteúdo](../explanation/content-and-licensing.md).

Após registrar a tentativa e os materiais, [atualize o Pre-Test Review](update-pre-test-review.md) de toda a certificação. Preserve as notas do aluno, confira a cobertura e valide o catálogo privado explicitamente antes de finalizar.
