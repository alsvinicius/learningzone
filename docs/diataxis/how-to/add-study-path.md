# Como criar uma trilha de estudo

Use este procedimento quando o material responde a um tema de estudo, não a uma certificação e suas tentativas. O catálogo público deve continuar vazio; guarde a trilha no catálogo privado.

## Estrutura

```text
data/<study-id>/study.json
data/<study-id>/<module-id>/<lesson>.md
.local/private-data/index.personal.json
```

O índice privado declara a entrada em `studies` com o caminho relativo a `data/`. O manifesto define domínios com `id`, `name` e descrição opcional. Cada módulo possui `id`, `title`, `domainId` e lições ordenadas. Tipos aceitos: `deep-dive`, `decision-guide`, `case`, `challenge`, `story`, `report`. Para Stories independentes da certificação, use as quatro seções descritas em [Formato Stories](../reference/story-card-format.md#stories-em-trilhas-de-estudo); vincule a lição ao domínio principal do módulo e a domínios adicionais quando necessário.

Uma lição transversal pode definir `domainIds`; sem esse campo herda o domínio principal do módulo. Progresso é associado uma única vez à identidade da lição mesmo quando aparece em vários domínios.

## Validar e usar

```bash
python3 tools/check.py --index .local/private-data/index.personal.json --quiet
make start
```

Use `--quiet` para evitar revelar dados do catálogo privado no terminal. Acesse Biblioteca → trilha → domínio → módulo → lição; recarregue uma rota direta e salve a trilha para uso offline. O verificador rejeita arquivos ausentes, vínculos quebrados e caminhos que escapem do estudo. Não use `git add -f` com conteúdo em `data/`.

O esquema completo está no [Contrato de conteúdo v1](../reference/content-contract.md). Para associar conteúdo de certificação, consulte a mesma referência e mantenha associações explícitas por questão ou material.

Para revisar os Stories, abra a Biblioteca, escolha a trilha, selecione um domínio e acione Stories na barra superior. Confira as quatro telas, a passagem ao próximo Story e o retorno ao domínio ao fechar. Na visão completa, Stories reúne todas as lições desse tipo da trilha; o botão não reutiliza a certificação anteriormente aberta.

Para adicionar aprofundamento, declare uma lição `type: "report"` no módulo correspondente. Consulte os [critérios e comportamento dos Reports](../reference/study-reports.md). Abra Reports na trilha e no domínio, busque um termo presente no texto, selecione a lição e confira navegação por seções, recarga e offline. Mantenha fontes, auditoria e matriz editorial do conteúdo local em diretórios ignorados.
