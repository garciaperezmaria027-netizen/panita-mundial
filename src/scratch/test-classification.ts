const userMessage = "Oe contame qué partidos hay pa mañana";
const cleanMsg = userMessage.toLowerCase();
const footballKeywords = [
  'partido', 'resultado', 'juego', 'juega', 'jugar', 'jugador', 'vs', 'contra', 
  'clasificacion', 'posiciones', 'standing', 'tabla', 'grupo', 'goleador', 
  'asistidor', 'asistencia', 'alineacion', 'nomina', 'titular', 'suplente', 
  'dt', 'entrenador', 'estadistica', 'minuto', 'gol', 'tarjeta', 'roja', 
  'amarilla', 'fixture', 'fecha', 'mundial', 'copa del mundo', 'fifa', 'futbol', 'soccer'
];
const isFootballQuery = footballKeywords.some(keyword => cleanMsg.includes(keyword));

console.log(`Query: "${userMessage}"`);
console.log(`Cleaned: "${cleanMsg}"`);
console.log(`isFootballQuery: ${isFootballQuery}`);
for (const kw of footballKeywords) {
  if (cleanMsg.includes(kw)) {
    console.log(`Matched keyword: "${kw}"`);
  }
}
