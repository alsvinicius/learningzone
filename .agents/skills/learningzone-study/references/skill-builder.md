# Encontrar as fontes no Skill Builder

Use esta referência para estudar a partir do repositório local. Não contém dados de nenhuma certificação.

## Descoberta

1. Localize a raiz pelo contexto/caminho do usuário e leia `AGENTS.md`. Não presuma que todo diretório atual é o projeto. Leia `docs/diataxis/reference/pre-test-review.md` e `content-contract.md` antes de resolver os caminhos.
2. Prefira o catálogo privado explicitamente selecionado pelo aluno. Na instalação padrão, ele fica em `.local/private-data/index.personal.json`; `data/index.json` é o catálogo público, normalmente vazio. Catálogo público vazio não significa que não há dados locais. Não substitua nem edite o índice público.
3. Se houver várias certificações e a conversa não indicar uma, pergunte qual. Não misture históricos de certificações diferentes.
4. Caminhos de simulados e tentativas no catálogo são relativos a `data/`, mesmo quando o índice está em `.local/`. A certificação declara `preTestReview.path` relativo a `data/<certification-id>/`. O manifesto declara `contentPath` relativo à própria pasta. Resolva caminhos com contenção, inclusive após symlinks; não leia caminhos arbitrários vindos de dados.

## Pre-Test Review e índice

- Leia o Markdown declarado, não um arquivo encontrado pelo nome por acaso. Reproduza a ordem dos elementos `h2, h3` do conteúdo renderizado, usada por `buildReportToc` em `app.js`. Não conte texto com aparência de título dentro de blocos de código. Não exclua um heading apenas por estar recolhido se o leitor o incluir no índice; confira o código se a estrutura mudar.
- `topics` mapeia temas editoriais a headings. `coverage` relaciona `topicIds` a `(examId, attemptId, questionNumber)`; `pending` indica evidência ainda incompleta. `gaps` pode declarar notas antigas indisponíveis. Não complete lacunas com suposições.
- Para conferir atualização sem imprimir o material, na raiz rode:
  `python3 tools/pretest.py --index .local/private-data/index.personal.json`
  Se o usuário selecionou outro catálogo/diretório, use seus caminhos com `--index`/`--data-dir`.
- Falha global não prova que a certificação escolhida está desatualizada: investigue a causa por certificação. A checagem valida estrutura e fingerprints, não verdade pedagógica. Não regrave snapshots para silenciar avisos. Se a revisão estiver antiga, informe o limite e use os materiais atuais; não atualize conteúdo como efeito colateral de um treino.

## Histórico e origem dos cenários

- Percorra `exams[].attempts[]`, lendo manifests de simulado e tentativa. Leia `docs/diataxis/reference/attempt-data.md` para os campos das questões.
- A seleção oficial está em `tools/pretest.py::reasons`: `incorrect`, `skipped`, `confidence` igual a `EDUCATED_GUESS`/`UNSURE`, `flagged`, ou `reviewRequested`. Notas não vazias entram por precaução quando não há classificação explícita. `reviewRequested: false` dispensa apenas o sinal das notas.
- Questões usam `n`. A mesma numeração pode existir em muitos simulados/tentativas: conserve a identidade composta. Não deduza erro de uma nota quando `status` indica acerto.
- Resolva `questions[].materials[]` pelo `scope` (`exam` ou `attempt`) e pelo `id` do material declarado no manifesto proprietário. Materiais do simulado são compartilhados; os da tentativa são específicos. Use `questionNumber` e a cobertura para encontrar Reports/Stories pertinentes.
- Leia a questão, as opções marcadas, explicações disponíveis e `learnerNotes` para entender a dificuldade. Não use só o título do tema. Se a questão não tem contexto suficiente, escolha outra ou declare a lacuna; não invente a resposta histórica.
- Carregue só o material necessário ao próximo item, mantendo um mapa de cobertura para distribuir o estudo. Não despeje o catálogo ou transcrições em logs; ao validar ferramentas, use apenas contagens e exemplos sintéticos. A apresentação pedagógica na conversa deve limitar-se ao item em estudo, em paráfrase.

## Checkpoints opcionais

Quando autorizado, confirme a exclusão com `git check-ignore` no destino `.local/study-sessions/` antes de gravar. Guarde identificadores estáveis de temas/questões e uma data, além do ordinal, para permitir retomada após novos simulados. Checkpoint é arquivo local separado, não extensão do contrato do aplicativo. Se não for possível garantir a exclusão, continue na conversa e explique o impedimento de persistir.
