import * as fs from 'fs';
import * as path from 'path';

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private logDir = path.join(process.cwd(), 'logs');
  private logFile = path.join(this.logDir, 'bot.log');

  constructor() {
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('No se pudo crear la carpeta de logs:', err);
    }
  }

  private formatMessage(level: LogLevel, message: string, ...optionalParams: any[]): string {
    const timestamp = new Date().toISOString();
    let formattedParams = '';
    
    if (optionalParams.length > 0) {
      formattedParams = optionalParams.map(param => {
        if (param instanceof Error) {
          return `\n${param.stack || param.message}`;
        }
        if (typeof param === 'object') {
          try {
            return ` ${JSON.stringify(param)}`;
          } catch {
            return ` [Unserializable Object]`;
          }
        }
        return ` ${param}`;
      }).join('');
    }

    return `[${timestamp}] [${level}] ${message}${formattedParams}`;
  }

  private writeToFile(text: string) {
    try {
      fs.appendFileSync(this.logFile, text + '\n', 'utf-8');
    } catch (err) {
      console.error('Error escribiendo en bot.log:', err);
    }
  }

  public debug(message: string, ...optionalParams: any[]) {
    const text = this.formatMessage(LogLevel.DEBUG, message, ...optionalParams);
    console.log(`\x1b[36m${text}\x1b[0m`); // Cian
    this.writeToFile(text);
  }

  public info(message: string, ...optionalParams: any[]) {
    const text = this.formatMessage(LogLevel.INFO, message, ...optionalParams);
    console.log(`\x1b[32m${text}\x1b[0m`); // Verde
    this.writeToFile(text);
  }

  public warn(message: string, ...optionalParams: any[]) {
    const text = this.formatMessage(LogLevel.WARN, message, ...optionalParams);
    console.warn(`\x1b[33m${text}\x1b[0m`); // Amarillo
    this.writeToFile(text);
  }

  public error(message: string, ...optionalParams: any[]) {
    const text = this.formatMessage(LogLevel.ERROR, message, ...optionalParams);
    console.error(`\x1b[31m${text}\x1b[0m`); // Rojo
    this.writeToFile(text);
  }
}

export const logger = new Logger();
