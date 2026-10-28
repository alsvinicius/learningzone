# Formato dos cartões Stories

Stories de certificação são arquivos Markdown declarados como material `story` em `exam.json` ou `attempt.json`. Materiais de simulado ficam em `shared/`; materiais de tentativa ficam em `attempts/<attempt-id>/cards/`. Stories de estudo são lições Markdown independentes declaradas em `study.json`.

Todo Story é uma **lição autônoma**. Stories de certificação explicam a situação e a decisão histórica; Stories de estudo desenvolvem um conceito sem atribuir erro ou resposta ao leitor.

## Estrutura de Stories de certificação

O arquivo de certificação começa com H1 no formato `# Q<n> — título`. Em seguida, inclui metadados em lista Markdown:

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

## Stories em trilhas de estudo

Uma lição `type: "story"` é independente de prova, tentativa e resultado do aluno. Começa com `# Story — título` e metadados editoriais `Domain`, `Task` e `Signal`. O Domain começa pelo ID declarado no estudo, seguido por travessão e nome; Task descreve a capacidade praticada; Signal resume a tensão ou pista do caso. Não invente códigos oficiais, número de questão ou resposta de aluno.

Stories de estudo declaram `**Story mode**: learning` e usam as telas `Topic`, `Where the initial model breaks`, `A more complete model` e `Concepts to nail it next time`. Em Topic, use `**Initial model:**` para uma hipótese plausível e `**Improved model:**` para a compreensão que o caso desenvolve. Nenhum campo representa uma resposta real ou erro do leitor. A segunda tela explica onde a intuição inicial deixa de explicar o sistema; a terceira constrói o raciocínio, as condições e os limites do conceito. A última termina com `The sentence to keep:`. A estrutura permite tantos Stories por domínio quanto forem úteis; cada um deve ensinar uma tensão, mecanismo ou decisão distinta.

## Conteúdo de cada ecrã

Cada secção responde a uma pergunta diferente. Uma secção que repete a anterior ou que remete ao relatório não cumpre o contrato.

### 1. Topic — contexto, resposta e gabarito da certificação

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

## Cobertura conceitual de uma trilha

Quando os Stories oferecem um percurso conceitual completo, a quantidade acompanha o conteúdo dos materiais de referência. Não há cota fixa por domínio. Cada cartão explica termos e mecanismos necessários para entendê-lo, suas condições e limites, uma decisão aplicada e uma pergunta de compreensão com resposta esperada. Links servem à conferência e ao aprofundamento; a compreensão do cartão não depende de abri-los.

A evidência editorial fica em uma matriz privada que relaciona materiais e seções aos Stories, registra conceitos, lacunas e hashes dos materiais revisados. Fundamentos transversais podem atender vários domínios sem duplicar a lição ou seu progresso. Casos integradores exercitam as relações entre conceitos. Cobertura estrutural, revisão semântica e aprendizagem do aluno são verificações diferentes: hashes e referências válidas não comprovam correção editorial nem retenção. Mudanças nos materiais exigem revisar o mapeamento afetado.

## Botão Stories e contexto de navegação

Dentro de uma trilha, o botão Stories e o atalho `s` abrem o carrossel das lições `type: "story"` dessa trilha. Um domínio selecionado limita o conjunto às associações explícitas das lições; a visão completa inclui cada lição uma vez. As telas usam os títulos do modo `learning`, sem número de questão. A conclusão é explícita no botão da lição e usa o progresso de estudos, separado das tentativas.

Na galeria, Stories fica desabilitado até escolher uma trilha ou certificação. Dentro de uma certificação, preserva o carrossel da tentativa aberta. Uma certificação previamente aberta, inclusive arquivada, nunca fornece Stories para uma trilha.
