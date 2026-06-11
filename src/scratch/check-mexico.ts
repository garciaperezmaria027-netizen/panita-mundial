import axios from 'axios';
import { logger } from '../utils/logger';

async function checkMexico() {
  try {
    const response = await axios.get('https://worldcup26.ir/get/games');
    const games = response.data?.games || [];
    
    // Filtrar juegos del 11 de junio (06/11) o del 12 de junio
    const firstGames = games.slice(0, 10);

    firstGames.forEach((g: any) => {
      logger.info(`Game ID: ${g.id} | ${g.home_team_name_en || g.home_team_label} vs ${g.away_team_name_en || g.away_team_label}`);
      logger.info(`  Raw local_date: "${g.local_date}"`);
      
      const parts = g.local_date.trim().split(' ');
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      const month = parseInt(dateParts[0], 10) - 1;
      const day = parseInt(dateParts[1], 10);
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);

      // Parseo actual (UTC-5)
      const isoStr = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`;
      const parsedCurrent = new Date(isoStr);
      
      // Parseo UTC (GMT)
      const parsedUtc = new Date(Date.UTC(year, month, day, hour, minute));
      
      logger.info(`  Parsed Current -> Colombia: "${parsedCurrent.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}"`);
      logger.info(`  Parsed UTC -> Colombia:     "${parsedUtc.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}"`);
      logger.info('----------------------------------------------');
    });

  } catch (error: any) {
    logger.error('Error:', error.message);
  }
}

checkMexico();
