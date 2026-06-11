import * as dotenv from 'dotenv';
import { sportsService } from '../services/sports';
import * as formatter from '../utils/formatter';
import { logger } from '../utils/logger';

dotenv.config();

async function runCheck() {
  logger.info('🧪 [Test Dates] Consultando partidos para verificar horario de Colombia...');
  
  // Consultar partidos del 11 de junio (Día 1)
  const matches11 = await sportsService.getMatchesToday('2026-06-11');
  
  logger.info('\n📅 --- PARTIDOS DEL 11 DE JUNIO ---');
  matches11.forEach(m => {
    const time = formatter.formatColombiaTime(m.fixture.date);
    logger.info(`ID: ${m.fixture.id} | ${m.teams.home.name} vs ${m.teams.away.name}`);
    logger.info(`  ISO Date:       "${m.fixture.date}"`);
    logger.info(`  Hora Colombia:  "${time}"`);
    logger.info(`  Canales TV:     "${formatter.getColombiaBroadcasters(m).tv.join(' / ')}"`);
  });

  // Consultar partidos del 12 de junio (Día 2)
  const matches12 = await sportsService.getMatchesToday('2026-06-12');
  
  logger.info('\n📅 --- PARTIDOS DEL 12 DE JUNIO ---');
  matches12.forEach(m => {
    const time = formatter.formatColombiaTime(m.fixture.date);
    logger.info(`ID: ${m.fixture.id} | ${m.teams.home.name} vs ${m.teams.away.name}`);
    logger.info(`  ISO Date:       "${m.fixture.date}"`);
    logger.info(`  Hora Colombia:  "${time}"`);
  });
}

runCheck();
