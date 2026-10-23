# Formato dos cartões Stories

Cartões Stories são arquivos Markdown declarados como material `story` em `exam.json` ou `attempt.json`. Materiais de simulado ficam em `shared/`; materiais de tentativa ficam em `attempts/<attempt-id>/cards/`.

Um Story é uma **lição autônoma**. Ele não resume um relatório e não depende dele: quem abre o cartão entende a situação, a decisão, o motivo do erro e o que memorizar sem sair da tela.

## Estrutura obrigatória

O arquivo começa com H1 no formato `# Q<n> — título`. Em seguida, inclui metadados em lista Markdown:

```markdown
- **Domain**: <código> — <nome do domínio>
- **Task**: <código> — <nome da tarefa>
- **Signal**: "<trecho curto do enunciado que entrega a resposta>"
```

As seções H2 devem aparecer nesta ordem e ter conteúdo:

1. `Topic`
2. `Why you got it wrong`
3. `Why the right answer was different`
4. `Concepts to nail it next time`

Os títulos de seção são tokens do contrato e permanecem exatamente como escritos. O idioma do corpo é escolha da pessoa autora.

## Conteúdo de cada ecrã

Cada secção responde a uma pergunta diferente. Uma secção que repete a anterior ou que remete ao relatório não cumpre o contrato.

### 1. Topic — contexto, sua resposta, resposta correta

Abre com o contexto do enunciado: a situação, a exigência que decide a item e a armadilha do caso. Em seguida, declara **Your answer** e **Correct answer**.

```
## Topic

<2 a 4 frases que reconstroem o caso sem depender do enunciado original>

**Your answer (incorrect):** <paráfrase fiel da opção escolhida>
**Correct answer:** <paráfrase fiel da opção gabaritada>
```

A paráfrase nomeia todos os mecanismos e serviços da opção original, para que o cartão seja comparável com o enunciado, mas não copia o texto da fonte.

### 2. Why you got it wrong — a explicação completa do erro

Explica o que foi feito e por que não se sustenta. Use listas com o erro nomeado no início da linha.

- Para resposta **incorreta**: o raciocínio registrado, o ponto em que ele falha e a armadilha concreta que foi escolhida.
- Para resposta **correta**: o que estava certo, a dúvida ou o risco que ficou por registrar e o que consolidaria o acerto.

O texto não repete o comentário do aluno nem o relatório; ele explica o mecanismo do erro.

### 3. Why the right answer was different — por que o gabarito está certo

Explica o mecanismo que satisfaz a exigência do enunciado, requisito por requisito, e por que a alternativa tentadora falha. Nomeia serviços e responsabilidades concretas. É a secção que responde "por que e não a outra?".

### 4. Concepts to nail it next time — o que memorizar

Lista de memorização: no mínimo dois itens de lista com regras, distinções e gatilhos de escolha. Use uma tabela quando o contraste couber em pares curtos. Termine com a frase que resume a regra.

## Autoria do Domain e Task

O `Domain` e o `Task` usam os códigos e nomes oficiais do blueprint, e começam sempre pelo código numérico.

Quando a origem atribui tarefas apenas em agregado, a atribuição por questão é uma **reconstrução editorial**. Ela é aceitável quando reproduz exatamente as contagens oficiais de questões e de acertos por tarefa e por domínio, o que confere consistência com os agregados da própria origem. Mesmo assim, registre no README da tentativa que a atribuição por questão é editorial, porque a origem não a expõe.

Quando o cartão cobre apenas parte das questões de uma tarefa, como acontece quando só as respostas erradas recebem Story, a reconciliação com os agregados deixa de ser verificável. Nesse caso, o rótulo editorial precisa dizer isso, e não apenas citar o código.

## Campos do manifesto

O material declara `id`, `type: "story"`, `title`, `path` e opcionalmente `questionNumber`. Se associado a uma questão, o cartão deve ser referenciado pelo mesmo ID com o `scope` correto. O número em H1 deve corresponder a `questionNumber`, quando presente.

## Links

O último ecrã pode apontar para o relatório completo e para o guia conceitual usando a rota da aplicação: `<index.html>#<certificação>/<simulado>/<tentativa>/<id-do-material>`. A rota abre a página de leitura em nova aba; dentro dela, links entre relatórios permanecem na mesma página. Caminhos `.md` continuam válidos para abrir o arquivo diretamente.

## Validação

`tools/content.py` verifica as quatro seções, a ordem, corpo não vazio, H1, número e metadados Domain/Task/Signal. Ele exige que Domain e Task comecem por código numérico, que a secção de conceitos contenha itens de lista e que o ecrã Topic declare a resposta do aluno e a resposta gabaritada. O validador não julga correção pedagógica ou factual.
