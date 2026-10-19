# Skill Builder

**Uma aplicação de estudo local-first para organizar certificações, simulados, tentativas e materiais próprios.** O código é genérico: a distribuição começa deliberadamente sem certificações, provas, questões, relatórios ou Stories. Você adiciona apenas conteúdo que tem direito de usar.

A aplicação é estática, não exige conta, não envia dados a um servidor e pode guardar o shell e os materiais selecionados para leitura offline. O progresso de leitura fica no armazenamento local do navegador. Os arquivos de conteúdo são separados do código e podem ser mantidos privados.

> **Privacidade do conteúdo:** tudo em `data/`, exceto `data/index.json`, é ignorado pelo Git. O índice público inicial está vazio. Antes de publicar mudanças, execute `make check-public` e revise `git status --short` antes de publicar.

## Começar

Requisitos: Python 3.10 ou superior, Node.js 18 ou superior para os testes de lógica JavaScript, e um navegador moderno. A aplicação não usa dependências de runtime nem processo de build.

```bash
git clone https://example.invalid/project.git
cd learningzone
make check
make serve
```

Abra `http://localhost:8000/`. O servidor de desenvolvimento escuta apenas em `127.0.0.1`. Para usar outro endereço, informe `make serve PORT=8080`. Em hospedagem estática, publique os arquivos do projeto e sirva pela raiz; HTTPS é necessário para instalação PWA fora de `localhost`.

### Executar pela Project Gallery

O LearningZone é uma aplicação estática, sem backend. Para executá-lo pelo catálogo local, use `make start` e `make stop`; a galeria atribui uma porta exclusiva ao servidor Web, que escuta somente em `127.0.0.1`. O manifesto [`project-gallery.json`](project-gallery.json) declara o serviço. Depois de iniciar a galeria, para registrar manualmente execute `node <CAMINHO_DA_PROJECT_GALLERY>/src/cli.ts register` na raiz deste projeto, substituindo o marcador pelo diretório onde a galeria está instalada.

Sem conteúdo local, o primeiro acesso mostra um estado vazio: o projeto não distribui conteúdo de certificação. Se você mantém um catálogo privado em `.local/private-data/index.personal.json`, `make start` o seleciona automaticamente na Gallery. `make serve-private` também permite abri-lo no terminal. Ambos o servem na rota `data/index.json`, sem copiar ou alterar o índice público versionado. Para escolher o catálogo público na Gallery, pare o servidor e execute `make start PRIVATE_INDEX_PATH=`. Veja as opções na [referência de comandos](docs/diataxis/reference/development-commands.md). `make check-public` continua exigindo que o índice público permaneça vazio. Siga o tutorial [Seu primeiro catálogo](docs/diataxis/tutorials/first-catalog.md) para criar um conjunto local.

## O que a aplicação oferece

- Navegação hierárquica: certificação → simulado → tentativa.
- Materiais compartilhados por simulado e materiais vinculados a uma tentativa.
- Relatórios e cartões Stories em Markdown, com vínculos opcionais por questão.
- Busca, filtros e atalhos de teclado.
- Progresso local por tentativa e retomada de Stories.
- PWA e cache offline selecionável.
- Contrato JSON versionado e validador sem dependências Python externas.

Veja a [documentação Diátaxis](docs/diataxis/README.md) por necessidade, o [contrato de conteúdo](docs/diataxis/reference/content-contract.md) para todos os campos, [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo de colaboração e [SECURITY.md](SECURITY.md) para relatos de vulnerabilidade.

## Estrutura essencial

```text
index.html, app.js, app.css       aplicação web estática
 data/index.json                 catálogo (começa vazio; arquivo público)
 data/<cert>/<exam>/             conteúdo local, ignorado pelo Git
 tools/                          validação e conversores locais
 tests/                          testes automatizados sem material real
 docs/diataxis/                  tutorial, guias, referências e explicações
 .agents/skills/add-study-content/ skill local para orientar agentes
```

## Preparar uma distribuição pública

Antes de criar um commit ou release público, execute `make check-public`. O comando exige catálogo vazio e verifica que todos os demais itens em `data/` estão ignorados. Revise manualmente o diff e os arquivos documentais para procurar material, nomes ou metadados privados.

## Licença e conteúdo

O código está sob a licença MIT; consulte [LICENSE](LICENSE). A licença do código não concede direitos sobre questões, cursos, marcas, imagens ou materiais que cada pessoa adicionar localmente. A pessoa que cria ou distribui conteúdo deve verificar sua licença e origem. Consulte [Política de conteúdo](docs/diataxis/explanation/content-and-licensing.md).
