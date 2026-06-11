import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  timestamp: number;
  ttl: number; // en milisegundos
  data: T;
}

class CacheManager {
  private cacheDir = path.join(process.cwd(), 'cache');

  constructor() {
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (err) {
      logger.error('No se pudo crear la carpeta de caché:', err);
    }
  }

  /**
   * Genera un nombre de archivo seguro a partir de una llave de caché
   */
  private getFilePath(key: string): string {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    // Sanitizar la llave para que sea legible en el nombre del archivo (opcional, ayuda a debugear)
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    return path.join(this.cacheDir, `${sanitizedKey}_${hash}.json`);
  }

  /**
   * Obtiene un elemento de la caché si no ha expirado
   */
  public get<T>(key: string): T | null {
    const filePath = this.getFilePath(key);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(fileContent);
      
      const now = Date.now();
      const age = now - entry.timestamp;

      if (age < entry.ttl) {
        logger.debug(`[Caché HIT] llave: ${key} (Edad: ${Math.round(age / 1000)}s, TTL: ${entry.ttl / 1000}s)`);
        return entry.data;
      }

      // Si expiró, se limpia asíncronamente
      logger.debug(`[Caché EXPIRADO] llave: ${key}`);
      fs.unlink(filePath, () => {});
      return null;
    } catch (err) {
      logger.error(`Error al leer caché para la llave ${key}:`, err);
      return null;
    }
  }

  /**
   * Guarda un elemento en la caché con un TTL específico en milisegundos
   */
  public set<T>(key: string, data: T, ttlMs: number): void {
    this.ensureCacheDirectory();
    const filePath = this.getFilePath(key);

    const entry: CacheEntry<T> = {
      timestamp: Date.now(),
      ttl: ttlMs,
      data
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
      logger.debug(`[Caché SET] llave: ${key} (TTL: ${ttlMs / 1000}s)`);
    } catch (err) {
      logger.error(`Error al guardar en caché para la llave ${key}:`, err);
    }
  }

  /**
   * Limpia toda la caché
   */
  public clear(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
        logger.info('Caché limpiada completamente.');
      }
    } catch (err) {
      logger.error('Error al limpiar la caché:', err);
    }
  }
}

export const cacheManager = new CacheManager();
