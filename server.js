//server.js - SPAWNS POR SALA CON DISTRIBUCIÓN EQUITATIVA
import express from 'express';
import { createServer } from 'http';  
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Obtener __dirname en ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos con headers especiales para cámara
app.use(express.static(join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    res.setHeader('Permissions-Policy', 'camera=*');
    res.setHeader('Feature-Policy', 'camera *');
  }
}));

// 🏟️ CONFIGURACIÓN SPAWNS POR SALA
const ROOM_CONFIG = {
  width: 5,
  height: 5,
  // División en zonas para distribución equitativa
  zones: {
    cols: 2,              // Dividir en 2x2 = 4 zonas
    rows: 2,
    spawnsPerZone: 1      // 2-3 spawns por zona
  },
  spawnInterval: 6000,    // Generar spawns cada 6 segundos
  despawnTime: 25000,     // Spawns duran 25 segundos
  maxSimultaneousSpawns: 6, // Total máximo en toda la sala
  minSpawnsActive: 3      // Mínimo de spawns activos siempre
};

const PROXIMITY_CONFIG = {
  discoveryRange: 3.0,
  hideRange: 4.0,
  updateInterval: 1500
};

// Tipos de objetos
const SPAWN_TYPES = {
  common: {
    images: ['common/IQU.png'],
    points: 10,
    probability: 0.5,
    despawnTime: 25000,
    captureRange: 2.2,
    color: '#00ff88'
  },
  rare: {
    images: ['rare/Bob.png'],
    points: 25,
    probability: 0.25,
    despawnTime: 20000,
    captureRange: 2.0,
    color: '#ffd700'
  },
  epic: {
    images: ['epic/Dora.png'],
    points: 50,
    probability: 0.05,
    captureRange: 1.8,
    despawnTime: 15000,
    color: '#ff6b35'
  }
};

// Estado del juego
let gameState = {
  players: {},
  spawns: [],
  nextSpawnId: 1,
  gameStats: {
    totalSpawns: 0,
    totalCaptures: 0
  },
  // 🆕 Tracking de zonas
  zoneStats: {
    0: { spawns: 0, lastSpawn: 0 },  // Zona superior-izquierda
    1: { spawns: 0, lastSpawn: 0 },  // Zona superior-derecha
    2: { spawns: 0, lastSpawn: 0 },  // Zona inferior-izquierda
    3: { spawns: 0, lastSpawn: 0 }   // Zona inferior-derecha
  }
};

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// 🗺️ FUNCIONES DE ZONAS

/**
 * Obtener zona basada en posición
 */
function getZoneFromPosition(position) {
  const zoneWidth = ROOM_CONFIG.width / ROOM_CONFIG.zones.cols;
  const zoneHeight = ROOM_CONFIG.height / ROOM_CONFIG.zones.rows;
  
  const col = Math.floor(position.x / zoneWidth);
  const row = Math.floor(position.y / zoneHeight);
  
  // Asegurar que no se salga de los límites
  const finalCol = Math.min(col, ROOM_CONFIG.zones.cols - 1);
  const finalRow = Math.min(row, ROOM_CONFIG.zones.rows - 1);
  
  return finalRow * ROOM_CONFIG.zones.cols + finalCol;
}

/**
 * Obtener límites de una zona
 */
function getZoneBounds(zoneId) {
  const zoneWidth = ROOM_CONFIG.width / ROOM_CONFIG.zones.cols;
  const zoneHeight = ROOM_CONFIG.height / ROOM_CONFIG.zones.rows;
  
  const col = zoneId % ROOM_CONFIG.zones.cols;
  const row = Math.floor(zoneId / ROOM_CONFIG.zones.cols);
  
  return {
    minX: col * zoneWidth,
    maxX: (col + 1) * zoneWidth,
    minY: row * zoneHeight,
    maxY: (row + 1) * zoneHeight
  };
}

/**
 * Generar posición aleatoria dentro de una zona
 */
function generatePositionInZone(zoneId) {
  const bounds = getZoneBounds(zoneId);
  const margin = 0.3; // Margen para evitar bordes exactos
  
  return {
    x: bounds.minX + margin + Math.random() * (bounds.maxX - bounds.minX - 2 * margin),
    y: bounds.minY + margin + Math.random() * (bounds.maxY - bounds.minY - 2 * margin)
  };
}

/**
 * Contar spawns activos por zona
 */
function updateZoneStats() {
  // Resetear contadores
  Object.keys(gameState.zoneStats).forEach(zoneId => {
    gameState.zoneStats[zoneId].spawns = 0;
  });
  
  // Contar spawns actuales
  gameState.spawns.forEach(spawn => {
    const zone = getZoneFromPosition(spawn.position);
    gameState.zoneStats[zone].spawns++;
  });
}

/**
 * Encontrar zona que necesita más spawns
 */
function findZoneNeedingSpawns() {
  updateZoneStats();
  
  let needyZones = [];
  
  Object.keys(gameState.zoneStats).forEach(zoneId => {
    const zone = gameState.zoneStats[zoneId];
    if (zone.spawns < ROOM_CONFIG.zones.spawnsPerZone) {
      needyZones.push({
        id: parseInt(zoneId),
        spawns: zone.spawns,
        priority: ROOM_CONFIG.zones.spawnsPerZone - zone.spawns
      });
    }
  });
  
  if (needyZones.length === 0) return null;
  
  // Ordenar por prioridad (zonas con menos spawns primero)
  needyZones.sort((a, b) => b.priority - a.priority);
  
  return needyZones[0].id;
}

// 🎯 SISTEMA DE SPAWN POR SALA

/**
 * Generar spawns para mantener distribución equitativa
 */
function generateRoomSpawns() {
  console.log('🎯 Generando spawns para la sala...');
  
  // Verificar si necesitamos generar spawns
  if (gameState.spawns.length >= ROOM_CONFIG.maxSimultaneousSpawns) {
    console.log(`⏸️ Máximo de spawns alcanzado (${gameState.spawns.length}/${ROOM_CONFIG.maxSimultaneousSpawns})`);
    return;
  }
  
  // Encontrar zona que necesita spawns
  const needyZone = findZoneNeedingSpawns();
  
  if (needyZone === null) {
    console.log('✅ Todas las zonas tienen suficientes spawns');
    return;
  }
  
  // Generar spawn en la zona necesitada
  const spawn = createSpawnInZone(needyZone);
  if (spawn) {
    gameState.spawns.push(spawn);
    gameState.gameStats.totalSpawns++;
        
    // Actualizar timestamp de la zona
    gameState.zoneStats[needyZone].lastSpawn = Date.now();
    
    // Programar auto-despawn
    setTimeout(() => {
      removeSpawn(spawn.id);
    }, spawn.despawnTime);
    
    // Chequear proximidad para todos los jugadores
    setTimeout(() => {
      Object.keys(gameState.players).forEach(playerId => {
        checkProximityForPlayer(playerId);
      });
    }, 500);
  }
}

/**
 * Crear spawn en zona específica
 */
function createSpawnInZone(zoneId) {
  const spawnType = determineSpawnType();
  const spawnConfig = SPAWN_TYPES[spawnType];
  
  // Intentar hasta 5 veces encontrar posición libre
  let position;
  let attempts = 0;
  const maxAttempts = 5;
  const minDistance = 1.8; // Aumentado de 1.0 a 1.8 metros
  
  do {
    position = generatePositionInZone(zoneId);
    const tooClose = gameState.spawns.some(existingSpawn => 
      calculateDistance(position, existingSpawn.position) < minDistance
    );
    
    if (!tooClose) break;
    
    attempts++;
    console.log(`⚠️ Intento ${attempts}: Posición muy cerca en zona ${zoneId}`);
    
  } while (attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    console.log(`⚠️ No se pudo encontrar posición libre en zona ${zoneId} después de ${maxAttempts} intentos`);
    return null;
  }
  
  return {
    id: gameState.nextSpawnId++,
    type: spawnType,
    position: position,
    zone: zoneId,
    createdAt: Date.now(),
    image: spawnConfig.images[Math.floor(Math.random() * spawnConfig.images.length)],
    points: spawnConfig.points,
    captureRange: spawnConfig.captureRange,
    despawnTime: spawnConfig.despawnTime,
    color: spawnConfig.color,
    rarity: spawnType,
    visibleTo: []
  };
}

/**
 * Generar spawns iniciales para llenar la sala
 */
function generateInitialSpawns() {
  console.log('Generando spawns iniciales para la sala...');
  
  // Generar spawns para cada zona
  for (let zoneId = 0; zoneId < ROOM_CONFIG.zones.cols * ROOM_CONFIG.zones.rows; zoneId++) {
    for (let i = 0; i < ROOM_CONFIG.zones.spawnsPerZone; i++) {
      if (gameState.spawns.length >= ROOM_CONFIG.maxSimultaneousSpawns) break;
      
      const spawn = createSpawnInZone(zoneId);
      if (spawn) {
        gameState.spawns.push(spawn);
        gameState.gameStats.totalSpawns++;
        
        setTimeout(() => {
          removeSpawn(spawn.id);
        }, spawn.despawnTime);
      }
    }
  }
  
  console.log(`✅ ${gameState.spawns.length} spawns iniciales generados`);
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('🎮 Usuario conectado:', socket.id);

  socket.on('join-game', (playerData) => {
    gameState.players[socket.id] = {
      id: socket.id,
      name: playerData.name || 'Jugador',
      position: playerData.position || { x: 2.5, y: 2.5 },
      points: 0,
      captures: 0,
      streak: 0,
      bestStreak: 0,
      multiplier: 1.0,
      lastCaptureTime: 0,
      visibleSpawns: [],
      joinedAt: Date.now()
    };
    
    console.log(`👤 ${playerData.name} se unió al juego`);
    
    // Enviar estado inicial
    const visibleSpawns = getVisibleSpawnsForPlayer(socket.id);
    socket.emit('game-state', {
      player: gameState.players[socket.id],
      spawns: visibleSpawns,
      roomConfig: ROOM_CONFIG,
      spawnTypes: SPAWN_TYPES,
      totalPlayers: Object.keys(gameState.players).length
    });
    
    socket.broadcast.emit('player-joined', gameState.players[socket.id]);
    
    // Chequear proximidad inmediatamente
    setTimeout(() => {
      checkProximityForPlayer(socket.id);
    }, 1000);
  });

  socket.on('player-move', (newPosition) => {
    if (gameState.players[socket.id]) {
      const validPosition = {
        x: Math.max(0, Math.min(ROOM_CONFIG.width, newPosition.x)),
        y: Math.max(0, Math.min(ROOM_CONFIG.height, newPosition.y))
      };
      
      gameState.players[socket.id].position = validPosition;
      socket.broadcast.emit('player-moved', {
        playerId: socket.id,
        position: validPosition
      });
      
      socket.emit('position-updated', validPosition);
      
      checkProximityForPlayer(socket.id);
    }
  });

  socket.on('attempt-capture', (captureData) => {
    const player = gameState.players[socket.id];
    
    if (!player) {
      socket.emit('capture-failed', { reason: 'Jugador no encontrado' });
      return;
    }
    
    let targetSpawn = null;
    let closestDistance = Infinity;
    
    gameState.spawns.forEach(spawn => {
      if (spawn.visibleTo.includes(socket.id)) {
        const distance = calculateDistance(player.position, spawn.position);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetSpawn = spawn;
        }
      }
    });
    
    if (!targetSpawn) {
      socket.emit('capture-failed', { 
        reason: 'No hay objetos visibles cerca'
      });
      return;
    }
    
    const distance = calculateDistance(player.position, targetSpawn.position);
    const captureRange = targetSpawn.captureRange || 2.0;
    
    console.log(`🎯 ${player.name} intenta capturar ${targetSpawn.type} (zona ${targetSpawn.zone}). Distancia: ${distance.toFixed(2)}m`);
    
    if (distance <= captureRange) {
      handleSuccessfulCapture(socket.id, targetSpawn);
    } else {
      socket.emit('capture-failed', {
        reason: 'Demasiado lejos',
        distance: distance,
        required: captureRange
      });
    }
  });

  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      console.log(`👋 ${player.name} se desconectó`);
      
      gameState.spawns.forEach(spawn => {
        spawn.visibleTo = spawn.visibleTo.filter(id => id !== socket.id);
      });
      
      delete gameState.players[socket.id];
      socket.broadcast.emit('player-left', {
        playerId: socket.id,
        playerName: player.name
      });
    }
  });
});

// FUNCIONES AUXILIARES

function checkProximityForPlayer(playerId) {
  const player = gameState.players[playerId];
  if (!player) return;
  
  gameState.spawns.forEach(spawn => {
    const distance = calculateDistance(player.position, spawn.position);
    const wasVisible = spawn.visibleTo.includes(playerId);
    
    if (distance <= PROXIMITY_CONFIG.discoveryRange && !wasVisible) {
      spawn.visibleTo.push(playerId);
      player.visibleSpawns.push(spawn.id);
      
      console.log(`✅ Spawn ${spawn.id} (${spawn.emoji}) zona ${spawn.zone} visible para ${player.name} a ${distance.toFixed(1)}m`);
      
      io.to(playerId).emit('spawn-discovered', {
        spawn: spawn,
        distance: distance
      });
      
    } else if (distance >= PROXIMITY_CONFIG.hideRange && wasVisible) {
      spawn.visibleTo = spawn.visibleTo.filter(id => id !== playerId);
      player.visibleSpawns = player.visibleSpawns.filter(id => id !== spawn.id);
      
      console.log(`❌ Spawn ${spawn.id} oculto para ${player.name} a ${distance.toFixed(1)}m`);
      
      io.to(playerId).emit('spawn-hidden', {
        spawnId: spawn.id,
        distance: distance
      });
    }
  });
}

function getVisibleSpawnsForPlayer(playerId) {
  return gameState.spawns.filter(spawn => 
    spawn.visibleTo.includes(playerId)
  );
}

function handleSuccessfulCapture(playerId, spawn) {
  const player = gameState.players[playerId];
  
  const now = Date.now();
  const timeSinceLastCapture = now - player.lastCaptureTime;
  
  if (timeSinceLastCapture < 5000) {
    player.streak += 1;
    player.multiplier = Math.min(2.0, 1.0 + (player.streak * 0.2));
  } else {
    player.streak = 1;
    player.multiplier = 1.0;
  }
  
  const basePoints = spawn.points;
  const finalPoints = Math.round(basePoints * player.multiplier);
  
  player.points += finalPoints;
  player.captures += 1;
  player.lastCaptureTime = now;
  player.bestStreak = Math.max(player.bestStreak, player.streak);
  
  removeSpawn(spawn.id);
  gameState.gameStats.totalCaptures += 1;
  
  console.log(`✅ ${player.name} capturó ${spawn.emoji} de zona ${spawn.zone}! +${finalPoints} pts`);
  
  io.emit('spawn-captured', {
    spawnId: spawn.id,
    playerId: playerId,
    playerName: player.name,
    newPoints: player.points,
    pointsEarned: finalPoints,
    multiplier: player.multiplier,
    streak: player.streak,
    spawnType: spawn.type,
    position: spawn.position
  });
  
  // 🆕 Generar nuevo spawn en cualquier zona que lo necesite
  setTimeout(() => {
    generateRoomSpawns();
  }, 2000);
}

function removeSpawn(spawnId) {
  const spawnIndex = gameState.spawns.findIndex(s => s.id === spawnId);
  if (spawnIndex === -1) return;
  
  const spawn = gameState.spawns[spawnIndex];
  
  spawn.visibleTo.forEach(playerId => {
    const player = gameState.players[playerId];
    if (player) {
      player.visibleSpawns = player.visibleSpawns.filter(id => id !== spawnId);
    }
    
    io.to(playerId).emit('spawn-removed', { spawnId: spawnId });
  });
  
  gameState.spawns.splice(spawnIndex, 1);
  console.log(`🗑️ Spawn ${spawnId} removido de zona ${spawn.zone}`);
}

function calculateDistance(pos1, pos2) {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) + 
    Math.pow(pos1.y - pos2.y, 2)
  );
}

function determineSpawnType() {
  const rand = Math.random();
  
  if (rand < SPAWN_TYPES.epic.probability) return 'epic';
  if (rand < SPAWN_TYPES.epic.probability + SPAWN_TYPES.rare.probability) return 'rare';
  return 'common';
}

// INICIALIZACIÓN

console.log('🚀 Iniciando sistema de spawns por sala...');

// Generar spawns iniciales
generateInitialSpawns();

// Generar spawns periódicamente para mantener distribución
const spawnInterval = setInterval(() => {
  generateRoomSpawns();
}, ROOM_CONFIG.spawnInterval);

// Chequear proximidad periódicamente
const proximityInterval = setInterval(() => {
  Object.keys(gameState.players).forEach(playerId => {
    checkProximityForPlayer(playerId);
  });
}, PROXIMITY_CONFIG.updateInterval);

// 🆕 Log de estadísticas periódico
const statsInterval = setInterval(() => {
  updateZoneStats();
  console.log('📊 Estadísticas de zona:', Object.keys(gameState.zoneStats).map(zoneId => 
    `Zona ${zoneId}: ${gameState.zoneStats[zoneId].spawns} spawns`
  ).join(', '));
}, 15000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  clearInterval(spawnInterval);
  clearInterval(proximityInterval);
  clearInterval(statsInterval);
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Servidor DataGo Spawns por Sala en http://localhost:${PORT}`);
  console.log(`📱 Para móvil: http://10.0.2.62:${PORT}`);
  console.log(`🎯 Sala: ${ROOM_CONFIG.width}x${ROOM_CONFIG.height}m dividida en ${ROOM_CONFIG.zones.cols}x${ROOM_CONFIG.zones.rows} zonas`);
  console.log(`🎁 Spawns por zona: ${ROOM_CONFIG.zones.spawnsPerZone} | Total máximo: ${ROOM_CONFIG.maxSimultaneousSpawns}`);
  console.log(`👁️  Rango descubrimiento: ${PROXIMITY_CONFIG.discoveryRange}m`);
});