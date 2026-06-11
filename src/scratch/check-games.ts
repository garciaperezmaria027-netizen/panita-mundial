import axios from 'axios';
import { logger } from '../utils/logger';

async function checkGames() {
  try {
    const response = await axios.get('https://worldcup26.ir/get/games');
    const games = response.data?.games || [];
    
    // Buscar los juegos de Colombia (id_team de Colombia o nombre)
    const colombiaGames = games.filter((g: any) => 
      (g.home_team_name_en && g.home_team_name_en.toLowerCase().includes('colombia')) ||
      (g.away_team_name_en && g.away_team_name_en.toLowerCase().includes('colombia'))
    );

    logger.info(`Total Colombia games found in API: ${colombiaGames.length}`);
    colombiaGames.forEach((g: any) => {
      logger.info(`Game ID: ${g.id} | ${g.home_team_name_en} vs ${g.away_team_name_en}`);
      logger.info(`  Raw local_date from API: "${g.local_date}"`);
      
      // Simular parsing
      const parts = g.local_date.trim().split(' ');
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      const month = parseInt(dateParts[0], 10) - 1;
      const day = parseInt(dateParts[1], 10);
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      
      // 1. Asumir local del servidor (Date sin especificar timezone)
      const localServ = new Date(year, month, day, hour, minute);
      // 2. Asumir UTC directo (Date.UTC)
      const utcDate = new Date(Date.UTC(year, month, day, hour, minute));
      
      logger.info(`  Parsed as Server Local -> ISO: "${localServ.toISOString()}"`);
      logger.info(`  Parsed as UTC -> ISO: "${utcDate.toISOString()}"`);
      
      // Convertir a America/Bogota
      logger.info(`  Server Local formatted to Colombia: "${localServ.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}"`);
      logger.info(`  UTC formatted to Colombia: "${utcDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}"`);
      logger.info('----------------------------------------------');
    });

  } catch (error: any) {
    logger.error('Error fetching games:', error.message);
  }
}

checkGames();
