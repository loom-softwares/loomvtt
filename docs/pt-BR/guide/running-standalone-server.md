# Executando o Servidor Node Standalone

Cobre o release de produção gerado por `npm run package:server` — um pacote de servidor Node puro, sem o app desktop Electron. Use este modo quando desejar rodar o LoomVTT em uma máquina headless (uma VPS, um servidor caseiro ou uma máquina Linux) sem interface gráfica desktop.

## 1. Compilar o release

A partir da raiz do projeto, no seu computador de desenvolvimento:

```bash
npm run build
npm run package:server
```

Isso produzirá a pasta `release/node/` — uma pasta auto-contida com o servidor compilado (`app/`), o cliente web compilado (`client/`) e um `package.json` enxuto. O pacote **não** inclui a pasta `node_modules`: ela é instalada na máquina de destino no passo seguinte, garantindo que dependências nativas (`better-sqlite3`) correspondam exatamente ao sistema operacional e arquitetura daquela máquina. A mesma pasta `release/node/` funciona em Windows, Linux e macOS.

## 2. Copiar para a máquina de destino

Copie a pasta `release/node/` inteira para onde desejar executá-la — outro disco, outro computador ou um servidor remoto. Não requer instalador.

## 3. Instalar e iniciar

No Windows, dentro dessa pasta:

```bash
npm install --omit=dev
npm start
```

No macOS/Linux, um inicializador com clique duplo está incluído — ele só instala dependências se a pasta `node_modules` estiver ausente, iniciando o servidor em seguida:

- **macOS**: clique duplo em `start.command` (o Finder o executa via Terminal.app)
- **Linux**: clique duplo ou execute `start.sh` (permissões de execução já vêm configuradas)

Ou diretamente via terminal:

```bash
./start.sh
```

O servidor iniciará na porta 3000 por padrão (`http://localhost:3000`).

## Escolhendo onde os dados são salvos

Por padrão, o LoomVTT armazena as pastas `Config/`, `Data/` (mundos, assets, banco de dados) e `Logs/` no diretório padrão do sistema operacional por usuário (`%LOCALAPPDATA%\LoomVTT` no Windows, `~/.config/LoomVTT` no Linux/macOS).

Para apontar todos esses dados para uma pasta de sua escolha — um disco diferente ou um diretório dedicado para uma instância de servidor — passe o argumento `--dataPath`:

```bash
./start.sh --dataPath="/caminho/para/pasta"          # Linux/macOS, via terminal
node app/index.js --dataPath="/caminho/para/pasta"   # Windows, via terminal
```

(diretamente via `npm start`, o npm requer um `--` extra para repassar a flag: `npm start -- --dataPath="/caminho/para/pasta"`)

O atalho `start.command` de clique duplo não recebe argumentos dessa forma — para definir um caminho de dados personalizado, execute via terminal.

A mesma configuração também funciona através de uma variável de ambiente, ideal para serviços e containers Docker:

```bash
LOOM_ROOT=/caminho/para/pasta node app/index.js
```

Comportamento:

- Se a pasta ainda não existir, ela será criada automaticamente (`Config/`, `Data/`, `Data/worlds/`, `Data/assets/`, `Logs/`).
- Se a pasta já contiver dados de uma instalação anterior do LoomVTT, os dados existentes serão reutilizados exatamente como estão — nada é sobrescrito.
- Sem `--dataPath`/`LOOM_ROOT`, nada muda: o LoomVTT usará a pasta padrão do sistema operacional.

## Mantendo o servidor ativo

O comando `npm start` roda em primeiro plano. Para uma implantação real de servidor contínuo, execute o LoomVTT sob um gerenciador de processos para que ele reinicie automaticamente em caso de falhas ou reinicialização do sistema — como o [pm2](https://pm2.keymetrics.io/) (`pm2 start app/index.js --name loomvtt`) ou um serviço do systemd executando `node app/index.js` diretamente.
