import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { BotConfig } from '../types/config';
import { logger } from '../utils/logger';

// Cargar variables de entorno
dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

class ConfigManager {
  private config!: BotConfig;

  constructor() {
    this.loadConfig();
    this.validateEnv();
  }

  /**
   * Carga la configuración del archivo config.json
   */
  private loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
        this.config = JSON.parse(fileContent);
      } else {
        // Valores por defecto
        this.config = {
          dailyMessageHour: '07:00',
          timezone: 'America/Bogota',
          privateChats: [],
          groups: []
        };
        this.saveConfig();
        logger.info('Archivo config.json no existía. Se ha creado uno con valores por defecto.');
      }
    } catch (error) {
      logger.error('Error al cargar config.json, usando valores por defecto:', error);
      this.config = {
        dailyMessageHour: '07:00',
        timezone: 'America/Bogota',
        privateChats: [],
        groups: []
      };
    }
  }

  /**
   * Guarda la configuración actual en el archivo config.json
   */
  private saveConfig() {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Error al guardar config.json:', error);
    }
  }

  /**
   * Valida que las variables de entorno obligatorias estén presentes
   */
  private validateEnv() {
    const provider = process.env.SPORTS_PROVIDER || 'api-football';
    const requiredEnv = ['ADMIN_PHONE'];
    if (provider !== 'free-2026') {
      requiredEnv.push('API_FOOTBALL_KEY');
    }
    const missing = requiredEnv.filter(env => !process.env[env]);
    if (missing.length > 0) {
      logger.warn(`¡ATENCIÓN! Faltan las siguientes variables de entorno: ${missing.join(', ')}`);
    }

    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      logger.warn('¡ATENCIÓN! No se encontró ni GEMINI_API_KEY ni OPENROUTER_API_KEY.');
      logger.warn('El servicio de IA no funcionará sin al menos una de estas claves.');
    }
  }

  // --- GETTERS ---
  
  public get(): BotConfig {
    return { ...this.config };
  }

  public getDailyMessageHour(): string {
    return this.config.dailyMessageHour;
  }

  public getTimezone(): string {
    return this.config.timezone;
  }

  public getPrivateChats(): string[] {
    return [...this.config.privateChats];
  }

  public getGroups(): string[] {
    return [...this.config.groups];
  }

  public getAdminPhone(): string {
    return process.env.ADMIN_PHONE || '573000000000';
  }

  public getGeminiApiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  }

  public getGeminiModel(): string {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  }

  public getGoogleSearchKey(): string {
    return process.env.GOOGLE_SEARCH_KEY || '';
  }

  public getGoogleCseId(): string {
    return process.env.GOOGLE_CSE_ID || '';
  }

  public getOpenRouterApiKey(): string {
    return process.env.OPENROUTER_API_KEY || '';
  }

  public getOpenRouterModels(): string[] {
    const modelsStr = process.env.OPENROUTER_MODELS || 'google/gemini-2.5-flash:free,qwen/qwen3-coder:free,deepseek/deepseek-chat:free,openrouter/free';
    return modelsStr.split(',').map(m => m.trim()).filter(m => m.length > 0);
  }

  public getApiFootballKey(): string {
    return process.env.API_FOOTBALL_KEY || '';
  }

  public getApiFootballUrl(): string {
    return process.env.API_FOOTBALL_URL || 'https://v3.football.api-sports.io';
  }

  public getApiFootballLeague(): number {
    return parseInt(process.env.API_FOOTBALL_LEAGUE || '1', 10);
  }

  public getApiFootballSeason(): number {
    return parseInt(process.env.API_FOOTBALL_SEASON || '2026', 10);
  }

  // --- SETTERS ---

  public setDailyMessageHour(hour: string): boolean {
    // Validar formato HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(hour)) {
      return false;
    }
    this.config.dailyMessageHour = hour;
    this.saveConfig();
    logger.info(`Hora de resumen diario actualizada a: ${hour}`);
    return true;
  }

  public addPrivateChat(jid: string): boolean {
    if (!this.config.privateChats.includes(jid)) {
      this.config.privateChats.push(jid);
      this.saveConfig();
      logger.info(`Chat privado agregado: ${jid}`);
      return true;
    }
    return false;
  }

  public removePrivateChat(jid: string): boolean {
    const index = this.config.privateChats.indexOf(jid);
    if (index !== -1) {
      this.config.privateChats.splice(index, 1);
      this.saveConfig();
      logger.info(`Chat privado eliminado: ${jid}`);
      return true;
    }
    return false;
  }

  public addGroup(jid: string): boolean {
    if (!this.config.groups.includes(jid)) {
      this.config.groups.push(jid);
      this.saveConfig();
      logger.info(`Grupo agregado: ${jid}`);
      return true;
    }
    return false;
  }

  public removeGroup(jid: string): boolean {
    const index = this.config.groups.indexOf(jid);
    if (index !== -1) {
      this.config.groups.splice(index, 1);
      this.saveConfig();
      logger.info(`Grupo eliminado: ${jid}`);
      return true;
    }
    return false;
  }
}

export const configManager = new ConfigManager();
