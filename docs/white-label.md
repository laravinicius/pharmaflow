# MagisForm: perfis de cliente e publicação seletiva

Um repositório mantém a base comum em `main`. Branches de desenvolvimento são temporárias. Uma melhoria fica disponível no código compartilhado; publicar para um cliente não exige publicar para os demais. A versão vem de `package.json` e `package-lock.json`, comum a todos os perfis.

## Escolher a empresa

Execute na raiz do projeto:

```powershell
# Padrão: PIX Farma
npm run dev
npm run build

# MagisForm, identidade genérica do site
npm run dev -- --client=generic
npm run build -- --client=generic

# Seleção explícita de PIX Farma
npm run dev -- --client=pix-farma
npm run build -- --client=pix-farma

# Consultar identidade e destino, sem compilar ou publicar
npm run client:info -- --client=generic
```

`dev:client` e `build:client` são aliases que também aceitam `--client=...`. `PHARMAFLOW_CLIENT` seleciona o perfil para CI ou chamadas diretas ao Vite; `--client` tem precedência. Sem ambos, usa `pix-farma`. Um identificador desconhecido aborta antes de compilar.

A escolha é feita no desenvolvimento/build. O aplicativo empacotado tem uma identidade fixa: para atender outra empresa, gere e instale seu pacote próprio. Não há seletor de empresa na aplicação instalada e a seleção não movimenta dados entre bancos.

| Perfil | Marca | Instalador | Configuração no Windows |
|---|---|---|---|
| `pix-farma` | PIX Farma | `release/pix-farma/<versão>/PIX-Farma-Setup-<versão>.exe` | `%APPDATA%\pharmaflow\config.json` |
| `generic` | MagisForm | `release/generic/<versão>/MagisForm-Setup-<versão>.exe` | `%APPDATA%\magisform-generic\config.json` |

Cada pasta de saída contém também `latest.yml`, `.exe.blockmap` e `win-unpacked/resources/app-update.yml`. Não misture esses arquivos entre clientes. `npm run build` sempre usa `--publish never`; construir localmente não publica uma release.

## Estrutura e identidade

`config/clients/types.ts` define o contrato. Os arquivos `pix-farma.ts` e `generic.ts` contêm marca, caminhos dos assets, mensagens, módulos, regras, identidade desktop e distribuição. `index.ts` registra os identificadores disponíveis. `config/branding.ts` preserva os imports de `BRAND`, `COLORS`, `GRADIENTS` e `LOGO`, e expõe também `CLIENT`, `MESSAGES` e `RULES`.

O Vite seleciona e valida o perfil uma vez, injetando a mesma configuração no renderer e no processo principal. O empacotamento lê esse mesmo perfil. Assets são copiados/convertidos para `.client-build/<perfil>/public/`, ignorada pelo Git; bundles ficam separados nessa pasta. Os arquivos originais de `public/` e `website/` não são sobrescritos. `npm run clean` limpa somente as saídas dentro deste repositório, preservando os pacotes históricos na pasta vizinha.

O genérico reutiliza os SVGs oficiais de `website/assets/brand/`, inclusive o favicon convertido para ICO Windows em 256/128/64/48/32/16 pixels, sem redesenhar o símbolo. Usa verde `#173E35`, creme `#FFFDF8`, fundo `#F4F1E9`, coral `#D95C4F`, Vollkorn e Atkinson Hyperlegible Next locais com as licenças preservadas. Cores semânticas de erro/pagamento continuam distinguindo seus estados.

Ambos mantêm os módulos e regras atuais, incluindo a inatividade de cinco minutos. Os módulos têm tipo literal `true` nesta etapa e uma validação adicional no build impede desativação sem implementação. Quando houver requisitos funcionais diferentes, adicionar opções tipadas e aplicar os mesmos limites na UI e nos handlers IPC, preservando a autorização do usuário. Não duplicar componentes ou queries por cliente.

## Preservação da PIX Farma

Referências verificadas em 06/10/2026, antes da reorganização:

- HEAD: `3eda3797281a2335d810c1da19e2afd65aadbc6f`.
- Objeto da tag anotada `v0.2.0`: `37e84d6c1a97635c1f0c9a1105f0e758181a899a`; commit apontado pela tag: `575ee2d3e742ad39ed01f309fa23a932a2d70700`.
- Histórico e tags existentes foram mantidos. Os commits são referências de recuperação, sem reset ou criação de tags nesta etapa.

Permanecem `appId=com.pharmaflow.app`, nome do pacote `pharmaflow`, executável/produto `PIX Farma`, instalador `PIX-Farma-Setup-*`, diretório `%APPDATA%\pharmaflow` e cache `pharmaflow-updater`. O GUID NSIS continua derivado do mesmo `appId`; as opções padrão de instalação por usuário permanecem iguais.

O pacote anterior `../pharmaflow-pix-farma-release/0.1.9/win-unpacked` confirmou em runtime o nome `pharmaflow` e a pasta histórica. Os `app-update.yml` existentes, inclusive o de `0.2.0`, usam:

```yaml
owner: laravinicius
repo: pharmaflow
provider: github
releaseType: release
updaterCacheDirName: pharmaflow-updater
```

O GitHub resolve `laravinicius/pharmaflow` para `laravinicius/MagisForm`, onde as releases atuais estão hospedadas. Por isso o perfil mantém `repo: pharmaflow` gravado no updater e publica em `releaseRepo: MagisForm`. A validação prévia compara os dois destinos resolvidos pela API. Não recrie um repositório chamado `pharmaflow` nessa conta, pois o endereço antigo ainda é usado pelas instalações existentes.

## Cadastrar outro cliente

1. Copie `config/clients/generic.ts` para `<cliente>.ts` e registre o import em `index.ts`.
2. Defina `id`, marca, mensagens e os caminhos de assets/fontes. Use assets próprios ou a marca genérica conforme o contrato com a empresa.
3. Defina valores únicos para `appId`, `packageName`, `productName`, `executableName`, `userDataDirectory`, `artifactName` e `updaterCacheDirName`. O build rejeita identidades compartilhadas entre perfis.
4. Crie um repositório de distribuição separado, público para o updater GitHub atual, contendo somente releases/artefatos. Defina `distribution.owner`, `repo` e `releaseRepo` para esse destino e somente então `configured: true`.
5. Execute lint, build do perfil e confira sua identidade e `app-update.yml`. Configure no aplicativo o MariaDB próprio dessa empresa pelo fluxo de configuração existente.

O destino `laravinicius/MagisForm-generic-releases` foi **reservado na configuração**, não criado nesta etapa. `configured: false` permite build local para avaliação, mas bloqueia publicação e consulta automática de atualizações. Antes de distribuir esse aplicativo, crie/valide o destino e compile novamente com `configured: true`; o endereço fica gravado no pacote. Não coloque credenciais ou tokens no perfil.

Novos perfis iniciam com a conexão vazia. O schema não mudou; nenhum dado ou configuração real foi copiado. A configuração MariaDB e a criação do banco de cada cliente são independentes da seleção de marca.

## Publicar seletivamente

O endereço de atualização é definido durante o empacotamento, conforme a [documentação de publicação do electron-builder](https://www.electron.build/publish/). Releases de cada cliente têm seu próprio instalador e metadados. Um cliente pode permanecer em uma versão anterior e receber depois uma versão maior, pulando versões intermediárias.

**PIX Farma:** o workflow `Release` responde exclusivamente a tags `v*`. Atualize a versão comum quando necessário, mantenha `package-lock.json` coerente, faça o commit e crie a tag correspondente nesse commit. O workflow confere tag/versão/commit, compila apenas `pix-farma` e publica no repositório atual usando o token do próprio GitHub Actions.

**Outros clientes:** em GitHub → Actions → **Publicar cliente** → **Run workflow**, informe `client` e o SHA completo de 40 caracteres do commit a distribuir. Esse commit precisa conter o perfil, o destino habilitado e a versão desejada. A execução gera e publica somente esse cliente. `pix-farma` é rejeitada neste fluxo; tags `v*` no repositório comum continuam exclusivas da PIX.

Configure o segredo `CLIENT_RELEASE_TOKEN` no repositório de código: token de CI com permissão de escrita em Contents nos repositórios de distribuição necessários. Se forem usados tokens com escopo específico por repositório, inclua cada destino autorizado. Não é necessário dar acesso ao código nos repositórios de distribuição. O updater atual não inclui esse token no aplicativo; distribuição privada exige uma solução de autenticação própria fora desta etapa.

As publicações são serializadas por perfil no CI. Antes do build e novamente antes de publicar, a rotina confere destino e versão. Releases existentes, inclusive rascunhos, bloqueiam republicação. Nos repositórios de distribuição, tags existentes também bloqueiam a criação. A rotina não faz upload de arquivos sobre uma release existente.

Para conferir sem publicar:

```powershell
npm run release:check -- --client=generic
```

`build:release -- --client=<perfil>` faz essa conferência, build local e publicação; execute somente quando quiser publicar. A versão atual `0.2.0` da PIX já existe e é recusada. Se uma publicação falhar deixando rascunho, examine-o antes de decidir sua recuperação; a rotina não remove nem sobrescreve versões automaticamente.

## Validação desta etapa

```powershell
npm run lint
npm run build -- --client=pix-farma
npm run build -- --client=generic
npm run verify:clients
```

`verify:clients` confere dentro dos pacotes: versão, marca, título, logos, ICO 256, mensagem, ausência da mensagem PIX no genérico, diretórios, nomes, destino/cache do updater, instalador único e SHA-512 do `latest.yml`. Também confere seleção inválida e igualdade dos módulos/regras. O teste lê as saídas já construídas, sem publicar ou acessar o banco.

Evidências locais de 06/10/2026:

- Lint e builds Windows dos dois perfis passaram, com NSIS, blockmap e metadados próprios.
- Hashes SHA-256 de todos os arquivos do pacote PIX permaneceram iguais após compilar o genérico; teste inverso também feito. Assets originais e `database.sql` permaneceram sem alterações.
- Pacotes executados em Electron, com pasta de dados sintética: o anterior `0.1.9` e o reorganizado PIX `0.2.0` leram a mesma conexão salva, sem alterar o arquivo; o genérico abriu com pasta diferente e conexão em branco.
- Logo, fontes, título e paleta foram conferidos em runtime. As credenciais e a conexão de QA eram sintéticas e não apontavam para um banco operacional.
- O build com identificador inválido foi recusado; publicação PIX `0.2.0` e publicação genérica sem destino habilitado foram recusadas antes de compilar/publicar.

**Limite da evidência:** a preservação da configuração foi validada no runtime dos pacotes em ambiente isolado, sem instalar NSIS no Windows do usuário. Ainda falta homologar a atualização completa em VM Windows: instalar uma PIX anterior, configurar um banco sintético, aplicar o instalador reorganizado e verificar a conexão, atalhos/registro e o ciclo de download/instalação do updater. Não houve publicação real nem execução do workflow no GitHub nesta etapa; a independência de publicação está validada pela configuração, pelos bloqueios e pelos artefatos locais.

Para essa homologação, use snapshot de VM e servidor/feed de teste. Preserve o feed PIX gravado no pacote final e não publique uma versão já existente como teste. Compare o `latest.yml` público antes/depois da publicação de um cliente novo para demonstrar também a independência em produção.
