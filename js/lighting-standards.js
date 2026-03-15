// js/lighting-standards.js
// База знаний по освещению на основе СНиП, СП и СанПиН

const LIGHTING_STANDARDS = {
    // Нормы освещенности для разных типов помещений (в люксах) 
    roomTypes: {
        'living': { 
            name: 'Гостиная', 
            lux: 150, 
            description: 'Общее освещение',
            accent: true,
            colorTemp: '2700-3000K',
            recommendedFixtures: ['GX53', 'CHANDELIER', 'TRACK']
        },
        'bedroom': { 
            name: 'Спальня', 
            lux: 150, 
            description: 'Мягкий расслабляющий свет',
            accent: false,
            colorTemp: '2700-3000K',
            recommendedFixtures: ['GX53', 'CHANDELIER']
        },
        'kitchen': { 
            name: 'Кухня', 
            lux: 150, 
            description: 'Рабочее освещение',
            accent: true,
            colorTemp: '4000-4500K',
            recommendedFixtures: ['LED_PANEL', 'GX53']
        },
        'bathroom': { 
            name: 'Ванная', 
            lux: 50, 
            description: 'Влажное помещение',
            accent: false,
            colorTemp: '4000-5000K',
            recommendedFixtures: ['GX53']
        },
        'hallway': { 
            name: 'Коридор', 
            lux: 50, 
            description: 'Проходная зона',
            accent: false,
            colorTemp: '3000-4000K',
            recommendedFixtures: ['GX53']
        },
        'office': { 
            name: 'Кабинет', 
            lux: 300, 
            description: 'Рабочее место',
            accent: true,
            colorTemp: '4000-5000K',
            recommendedFixtures: ['LED_PANEL', 'GX53']
        },
        'children': { 
            name: 'Детская', 
            lux: 200, 
            description: 'Игры и занятия',
            accent: true,
            colorTemp: '3500-4500K',
            recommendedFixtures: ['GX53', 'CHANDELIER']
        }
    },
    
    // Технические характеристики светильников 
    fixtures: {
        'GX53': {
            name: 'Встраиваемый GX53',
            type: 'downlight',
            powerRange: [7, 12, 15],
            lumenPerWatt: 80,
            beamAngle: 30,
            minDistance: 1000,
            maxDistance: 1500,
            wallOffset: 600,
            mounting: 'flush',
            colorTemps: ['2700K', '3000K', '4000K']
        },
        'LED_PANEL': {
            name: 'LED панель',
            type: 'panel',
            powerRange: [18, 24, 36],
            lumenPerWatt: 100,
            beamAngle: 120,
            minDistance: 1200,
            maxDistance: 1800,
            wallOffset: 800,
            mounting: 'surface',
            colorTemps: ['3000K', '4000K', '5000K']
        },
        'CHANDELIER': {
            name: 'Люстра',
            type: 'pendant',
            powerRange: [40, 60, 80],
            lumenPerWatt: 60,
            beamAngle: 360,
            minDistance: 0,
            maxDistance: 0,
            wallOffset: 0,
            mounting: 'center',
            colorTemps: ['2700K', '3000K']
        },
        'TRACK': {
            name: 'Трековая система',
            type: 'track',
            powerRange: [10, 15, 20],
            lumenPerWatt: 90,
            beamAngle: 60,
            minDistance: 800,
            maxDistance: 1500,
            wallOffset: 500,
            mounting: 'linear',
            colorTemps: ['3000K', '4000K']
        },
        'LIGHT_LINE': {
            name: 'Световая линия',
            type: 'linear',
            powerRange: [20, 30, 40],
            lumenPerWatt: 95,
            beamAngle: 120,
            minDistance: 0,
            maxDistance: 0,
            wallOffset: 300,
            mounting: 'perimeter',
            colorTemps: ['2700K', '3000K', '4000K']
        }
    }
};

// Экспортируем в глобальную область
window.LIGHTING_STANDARDS = LIGHTING_STANDARDS;
console.log("✅ Lighting standards loaded");
