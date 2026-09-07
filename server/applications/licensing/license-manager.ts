import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import { Server } from 'socket.io';
import { config, getConfigPath } from '../database/db.js';
import logger from '../utils/logger.js';

// Chave rotacionada de novo (05/09/2026) — a versão anterior desta rotação
// nunca foi salva em lugar nenhum (nem Vercel nem local), então
// LICENSE_SIGNING_PRIVATE_KEY ficou sem valor configurado na LOOMSITE e todo
// verify-license.js quebrava com "Servidor mal configurado". Projeto ainda em
// teste, sem licença de cliente real emitida, então foi corte seco de novo
// (sem aceitar a chave anterior em paralelo). Desta vez a privada está salva em
// LOOMSITE/LICENSE_SIGNING_KEY_SECRETO_NAO_COMMITAR.txt (gitignored) além de
// já configurada na env var da Vercel — não repetir o mesmo erro.
export const LICENSE_VERIFY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAuv7tIl90TgfUM8sFXXuA4Gr71lNSVxFY6vOjraMVbhM=
-----END PUBLIC KEY-----`;

export const DEV_LICENSE_KEY = 'DEV-LOOM-0000';

export interface LicenseVisaPayload {
  key: string;
  machineId: string;
  plan: string;
  issuedAt: number;
  validUntil: number;
}

export class LicenseManager {
  private static verifyUrl = process.env.LOOM_LICENSE_SERVER_URL || 'https://loomsite.vercel.app/api/verify-license';
  private static cachedMachineId: string | null = null;
  private static checkInterval: NodeJS.Timeout | null = null;

  /**
   * Gera um identificador único de hardware estável (Soft Lock).
   */
  public static getMachineId(): string {
    if (this.cachedMachineId) return this.cachedMachineId;

    try {
      const parts = [
        os.hostname(),
        os.userInfo()?.username || 'user',
        os.platform(),
        os.arch(),
        os.cpus()?.[0]?.model || 'cpu'
      ];
      const hash = crypto.createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 16);
      this.cachedMachineId = `LOOM-HWID-${hash.toUpperCase()}`;
    } catch {
      this.cachedMachineId = 'LOOM-HWID-GENERIC';
    }

    return this.cachedMachineId;
  }

  /**
   * Salva o estado atual da configuração no disco.
   */
  private static saveConfig(): void {
    try {
      const configPath = getConfigPath();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (err: any) {
      logger.error('[LicenseManager] Erro ao salvar loom.config.json', { error: err.message });
    }
  }

  /**
   * Valida matematicamente a assinatura Ed25519 de um Visto offline.
   */
  public static validateVisa(visaString: string): { valid: boolean; reason?: string; payload?: LicenseVisaPayload } {
    if (!visaString || typeof visaString !== 'string') {
      return { valid: false, reason: 'Visto inexistente ou formato inválido.' };
    }

    const parts = visaString.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Estrutura do visto corrompida.' };
    }

    const [payloadB64, sigB64] = parts;

    try {
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload: LicenseVisaPayload = JSON.parse(payloadJson);
      const signature = Buffer.from(sigB64, 'base64url');

      const publicKey = crypto.createPublicKey(LICENSE_VERIFY_PUBLIC_KEY);
      const isVerified = crypto.verify(
        null,
        Buffer.from(payloadJson, 'utf8'),
        publicKey,
        signature
      );

      if (!isVerified) {
        return { valid: false, reason: 'Assinatura criptográfica do visto é inválida.' };
      }

      // Validação de expiração offline (30 dias)
      if (Date.now() > payload.validUntil) {
        return { valid: false, reason: 'Visto offline expirou. Conecte-se à internet para renovar.', payload };
      }

      // Validação de Machine ID (Soft Lock)
      const currentMachineId = this.getMachineId();
      if (payload.machineId !== 'unbound' && payload.machineId !== currentMachineId) {
        return { valid: false, reason: 'Visto pertence a outro computador.', payload };
      }

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, reason: `Falha ao processar visto: ${err.message}` };
    }
  }

  /**
   * Identifica se está rodando em ambiente de desenvolvimento local.
   */
  public static isDevEnvironment(): boolean {
    if (process.env.FORCE_LICENSE_CHECK === 'true') return false;
    // Removido o fallback `NODE_ENV !== 'production'` — nenhum script de
    // lançamento real (electron-build.mjs, `npm start`) seta NODE_ENV, então
    // esse fallback tratava "ninguém setou nada" como dev por padrão. Isso
    // deixava DEV-LOOM-0000 válido até no instalador/AppImage empacotado e
    // no `npm run start` headless. Só os dois sinais explícitos de dev local
    // abaixo — `npm run dev`/`dev:server` já seta `npm_lifecycle_event`
    // corretamente, sem precisar de NODE_ENV nenhum.
    return (
      process.env.LOOM_DEV_SERVER === 'true' ||
      (process.env.npm_lifecycle_event?.startsWith('dev') ?? false)
    );
  }

  /**
   * Verifica se o LoomVTT possui uma licença ativa e válida neste momento.
   */
  public static isLicenseValid(): boolean {
    // 1. Caso de desenvolvimento com chave de dev (se FORCE_LICENSE_CHECK não estiver ativo)
    if (this.isDevEnvironment() && config?.license?.isDev && config?.license?.key === DEV_LICENSE_KEY) {
      return true;
    }

    // 2. Validação do Visto criptografado
    if (config?.license?.visa) {
      const result = this.validateVisa(config.license.visa);
      return result.valid;
    }

    return false;
  }

  /**
   * Ativa uma nova chave de licença.
   */
  public static async activateLicense(licenseKey: string): Promise<{ success: boolean; message?: string }> {
    if (!licenseKey || typeof licenseKey !== 'string') {
      return { success: false, message: 'Chave de licença não fornecida.' };
    }

    const cleanKey = licenseKey.trim().toUpperCase();

    // Bypass de Dev seguro
    if (cleanKey === DEV_LICENSE_KEY) {
      if (this.isDevEnvironment()) {
        config.license = {
          key: DEV_LICENSE_KEY,
          isDev: true,
          activatedAt: Date.now(),
        };
        this.saveConfig();
        logger.info('[LicenseManager] Licença DEV ativada com sucesso.');
        return { success: true, message: 'Ambiente de desenvolvimento desbloqueado com sucesso!' };
      } else {
        return {
          success: false,
          message: 'A chave DEV-LOOM-0000 só é aceita no ambiente de desenvolvimento.',
        };
      }
    }

    // Validação Online na Vercel
    try {
      const machineId = this.getMachineId();
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: cleanKey,
          machine_id: machineId,
        }),
      });

      if (response.status === 403) {
        return { success: false, message: 'Esta licença foi revogada, cancelada ou está inativa.' };
      }

      if (response.status === 404) {
        return { success: false, message: 'Chave de licença não encontrada no sistema.' };
      }

      if (response.status === 429) {
        return { success: false, message: 'Muitas tentativas de validação. Aguarde 1 minuto.' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Erro ao validar licença (${response.status}): ${errorText}` };
      }

      const data: any = await response.json();
      if (!data.visa) {
        return { success: false, message: 'Resposta do servidor de licença inválida.' };
      }

      // Valida o visto recebido antes de salvar
      const validation = this.validateVisa(data.visa);
      if (!validation.valid) {
        return { success: false, message: `Visto recebido é inválido: ${validation.reason}` };
      }

      config.license = {
        key: cleanKey,
        visa: data.visa,
        validUntil: data.validUntil || validation.payload?.validUntil,
        plan: data.plan || 'core',
        isDev: false,
        activatedAt: Date.now(),
      };

      this.saveConfig();
      logger.info('[LicenseManager] Licença ativada com sucesso', { key: cleanKey, plan: data.plan });
      return { success: true, message: 'Licença ativada com sucesso!' };

    } catch (err: any) {
      logger.error('[LicenseManager] Falha ao contatar servidor de licenças', { error: err.message });
      return {
        success: false,
        message: 'Não foi possível conectar ao servidor de licenças. Verifique sua conexão com a internet.',
      };
    }
  }

  /**
   * Inicia a checagem periódica em background (Fail-Open se sem internet, Revogação se 403).
   */
  public static startBackgroundCheck(io?: Server): void {
    if (this.checkInterval) clearInterval(this.checkInterval);

    const performCheck = async () => {
      // Se estiver em modo dev com chave dev, não pinga a Vercel
      if (config?.license?.isDev) return;

      const licenseKey = config?.license?.key;
      const currentVisa = config?.license?.visa;
      if (!licenseKey || !currentVisa) return;

      try {
        const response = await fetch(this.verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            license_key: licenseKey,
            machine_id: this.getMachineId(),
          }),
        });

        // 403 EXPLÍCITO: Licença revogada
        if (response.status === 403) {
          logger.warn('[LicenseManager] AVISO: Licença revogada detectada pelo servidor remoto!');
          delete config.license;
          this.saveConfig();

          if (io) {
            logger.warn('[LicenseManager] Desconectando todos os sockets ativos da sessão.');
            io.disconnectSockets(true);
          }
          return;
        }

        // 200 OK: Atualiza visto renovado
        if (response.ok) {
          const data: any = await response.json();
          if (data.visa) {
            const validation = this.validateVisa(data.visa);
            if (validation.valid) {
              config.license.visa = data.visa;
              config.license.validUntil = data.validUntil || validation.payload?.validUntil;
              this.saveConfig();
              logger.debug('[LicenseManager] Visto de licença renovado em background com sucesso.');
            }
          }
        }
      } catch (err: any) {
        // Fail-open: Qualquer erro de rede/timeout/DNS é ignorado silenciosamente
        logger.debug('[LicenseManager] Checagem de background ignorada (sem internet/timeout). Fail-Open ativo.');
      }
    };

    // Executa após 30 segundos de inicialização e a cada 4 horas
    setTimeout(performCheck, 30000);
    this.checkInterval = setInterval(performCheck, 4 * 60 * 60 * 1000);
  }
}
