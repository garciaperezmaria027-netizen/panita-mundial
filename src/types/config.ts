export interface BotConfig {
  dailyMessageHour: string; // Formato HH:MM
  timezone: string;         // Zona horaria, ej. America/Bogota
  privateChats: string[];    // JIDs de chats privados autorizados para el resumen y consultas
  groups: string[];          // JIDs de grupos autorizados
}
