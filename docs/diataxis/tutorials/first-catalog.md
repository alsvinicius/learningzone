# Crie seu primeiro catálogo

Neste tutorial você vai criar uma certificação e um simulado local sem tentativas. No fim, o seletor mostrará o simulado e a aplicação abrirá um material compartilhado. O exemplo é sintético; substitua nomes e texto por conteúdo que você tem direito de usar.

## 1. Abra uma cópia limpa

Na raiz do projeto, execute:

```bash
make check
make serve
```

Abra `http://localhost:8000/`. Você verá o estado vazio porque a distribuição começa sem certificações. Deixe o servidor aberto.

## 2. Crie a pasta e o manifesto

Em outro terminal, crie `data/demo-cert/practice/shared/`. Esses arquivos ficam no computador e são ignorados pelo Git, exceto `data/index.json`.

Crie `data/demo-cert/practice/exam.json`:

```json
{
  "schemaVersion": 1,
  "id": "practice",
  "title": "Simulado de demonstração",
  "materials": [
    { "id": "starter-guide", "type": "report", "title": "Guia inicial", "path": "shared/starter-guide.md" }
  ]
}
```

Crie `data/demo-cert/practice/shared/starter-guide.md` com algumas linhas Markdown, como `# Guia inicial` e uma nota inventada por você.

## 3. Registre a certificação

Substitua o conteúdo de `data/index.json` por este catálogo mínimo:

```json
{
  "schemaVersion": 1,
  "certifications": [{
    "id": "demo-cert",
    "name": "Certificação de demonstração",
    "exams": [{
      "id": "practice",
      "path": "demo-cert/practice/exam.json",
      "attempts": []
    }]
  }]
}
```

IDs de certificação e simulado são slugs minúsculos com hífens. `path` é relativo a `data/`; caminhos de material são relativos ao manifesto que os declara. Leia o [contrato completo](../reference/content-contract.md) para adicionar tentativas e Stories.

## 4. Valide e veja o resultado

Execute `make check`. A saída termina com `0 attempt(s), 1 certification(s)`. Volte à aplicação e recarregue. Selecione “Certificação de demonstração” e o simulado. O app mostra que não há tentativas e mantém o material compartilhado acessível.

Você criou um catálogo válido. O próximo passo é [adicionar uma tentativa](../how-to/add-attempt.md). Antes de contribuir código, restaure o índice vazio; não versione seu catálogo local.
