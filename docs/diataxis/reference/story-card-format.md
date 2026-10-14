# Formato dos cartões Stories

Cartões Stories são arquivos Markdown declarados como material `story` em `exam.json` ou `attempt.json`. Materiais de simulado ficam em `shared/`; materiais de tentativa ficam em `attempts/<attempt-id>/cards/`.

## Estrutura obrigatória

O arquivo começa com H1 no formato `# Q<n> — título`. Em seguida, inclui metadados em lista Markdown:

```markdown
- **Domain**: identificador/nome
- **Task**: identificador/nome
- **Signal**: pista para reconhecer a situação
```

As seções H2 devem aparecer nesta ordem e ter conteúdo:

1. `Topic`
2. `Why you got it wrong`
3. `Why the right answer was different`
4. `Concepts to nail it next time`

O idioma do corpo é escolha da pessoa autora. Os títulos de seção são tokens do contrato e permanecem exatamente como escritos.

## Campos do manifesto

O material declara `id`, `type: "story"`, `title`, `path` e opcionalmente `questionNumber`. Se associado a uma questão, o cartão deve ser referenciado pelo mesmo ID com o `scope` correto. O número em H1 deve corresponder a `questionNumber`, quando presente.

## Validação

`tools/content.py` verifica as quatro seções, ordem, corpo não vazio, H1, número e metadados Domain/Task/Signal. O validador não julga correção pedagógica ou factual.
