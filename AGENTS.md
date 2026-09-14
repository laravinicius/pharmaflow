# PharmaFlow — mapa para agentes

Aplicação desktop online-first para o fluxo de manipulação farmacêutica. Stack: Electron, React 19, TypeScript, Vite, Tailwind CSS v4 e MariaDB/MySQL.

## Navegação rápida

| Área | Onde consultar primeiro |
|---|---|
| Visão geral e fluxo de dados | [docs/architecture.md](docs/architecture.md) |
| Módulos e impactos prováveis | [docs/modules.md](docs/modules.md) |
| Schema e regras de persistência | [docs/database.md](docs/database.md) e `database.sql` |
| Login, sessão e autorização | [docs/authentication.md](docs/authentication.md) |
| Decisões relevantes | [docs/decisions/](docs/decisions/) |
| Funcionalidades e comandos | `README.md` e `package.json` |

## Estrutura principal

```text
electron/       processo principal, IPC, preload e acesso MariaDB
src/            renderer React: telas, contextos, hooks, tipos e cliente IPC
config/         branding e constantes visuais
web-server/     servidor HTTP auxiliar para a versão web de desenvolvimento
database.sql    fonte da verdade do schema; não criar migrations novas
scripts/        utilitários de build/ativos
public/         assets estáticos
docs/           contexto arquitetural para manutenção
```

## Regras essenciais

- O renderer nunca acessa o banco diretamente. Fluxo obrigatório: `src/services/lanDatabase.ts` → `electron/preload.ts` → handlers em `electron/main.ts` → `electron/db.ts`/MariaDB.
- Nova funcionalidade de dados normalmente exige revisar `database.sql`, `electron/main.ts`, `electron/preload.ts`, `src/services/lanDatabase.ts` e os consumidores React.
- `database.sql` é a fonte de verdade. `migrations/` é histórico legado e não deve receber novas migrações.
- UI e comentários novos devem estar em português brasileiro. Preserve o branding em `config/branding.ts`; use `COLORS`/`GRADIENTS`, não cores de marca hardcoded do Tailwind.
- Não documente nem exponha segredos. Nunca copie valores de `.env`, credenciais ou tokens para código ou documentação.
- O projeto não possui framework de testes configurado; `npm run lint` executa `tsc --noEmit`.

## Fluxo de trabalho

1. Classifique a tarefa e leia o documento indicado acima.
2. Inspecione os entrypoints e apenas os módulos afetados, seguindo as dependências documentadas.
3. Faça a menor alteração consistente com os padrões existentes.
4. Execute `npm run lint`; use `npm run build` quando a mudança atingir build, empacotamento ou integração Electron.
5. Atualize a documentação apenas se a arquitetura, uma regra ou uma decisão tiver mudado.

Não faça uma varredura completa do repositório para uma tarefa localizada quando o mapa já indicar a área relevante. Expanda a investigação se aparecerem dependências não documentadas, contratos IPC envolvidos ou efeitos no schema/autenticação.
