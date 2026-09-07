import pino from 'pino';

// pino-pretty roda num worker_thread separado que precisa ler o módulo como
// arquivo real em disco — dentro de um app.asar empacotado (Electron) isso
// falha silenciosamente e derruba o processo antes da janela abrir. Só
// tenta o transport bonito fora de um asar (dev, ou server standalone).
let transport: any = undefined;
const runningFromAsar = import.meta.url.includes('.asar/') || import.meta.url.includes('.asar\\');
if (!runningFromAsar) {
  try {
    const optionalModule = 'pino-pretty';
    await import(optionalModule);
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  } catch {}
}

const pinoInstance = pino({
  level: transport ? 'debug' : 'info',
  transport,
});

export const logger = {
  info(message: string, data?: object) {
    if (data) {
      pinoInstance.info(data, message);
    } else {
      pinoInstance.info(message);
    }
  },
  error(message: string, data?: object) {
    if (data) {
      pinoInstance.error(data, message);
    } else {
      pinoInstance.error(message);
    }
  },
  warn(message: string, data?: object) {
    if (data) {
      pinoInstance.warn(data, message);
    } else {
      pinoInstance.warn(message);
    }
  },
  debug(message: string, data?: object) {
    if (data) {
      pinoInstance.debug(data, message);
    } else {
      pinoInstance.debug(message);
    }
  },
};

export default logger;
