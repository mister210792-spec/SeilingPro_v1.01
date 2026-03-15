// js/ai-lighting.js
// Модуль для AI-оптимизации расположения светильников

// Типы помещений и рекомендуемая освещенность (люкс)
const ROOM_TYPES = {
    'living': { name: 'Гостиная', lux: 150, accent: true },
    'bedroom': { name: 'Спальня', lux: 100, accent: false },
    'kitchen': { name: 'Кухня', lux: 200, accent: true },
    'bathroom': { name: 'Ванная', lux: 150, accent: false },
    'hallway': { name: 'Коридор', lux: 100, accent: false },
    'office': { name: 'Кабинет', lux: 300, accent: true },
    'children': { name: 'Детская', lux: 200, accent: false }
};

// Световая отдача разных типов светильников (люмен/Вт)
const LIGHT_EFFICACY = {
    'GX53': 80,        // Светодиодный GX53
    'LED_PANEL': 100,  // LED панель
    'CHANDELIER': 60,  // Люстра (обычно менее эффективна)
    'SURFACE': 85,     // Накладной
    'PENDANT': 75,     // Подвесной
    'TRACK': 90,       // Трековая система
    'LIGHT_LINE': 95   // Световая линия
};

// Функция для расчета площади комнаты
function calculateRoomArea(room) {
    if (!room.closed || room.points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < room.points.length; i++) {
        const j = (i + 1) % room.points.length;
        area += room.points[i].x * room.points[j].y - room.points[j].x * room.points[i].y;
    }
    return Math.abs(area / 2) / 1000000; // в м²
}

// Получить границы комнаты
function getRoomBounds(room) {
    const xs = room.points.map(p => p.x);
    const ys = room.points.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}

// Проверить, находится ли точка внутри многоугольника (алгоритм луча)
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Основная функция оптимизации
function optimizeLighting(roomIndex = activeRoom) {
    const room = rooms[roomIndex];
    if (!room) {
        alert('❌ Выберите помещение');
        return;
    }
    
    if (!room.closed) {
        alert('❌ Сначала замкните контур комнаты');
        return;
    }
    
    if (room.points.length < 3) {
        alert('❌ Комната должна иметь минимум 3 точки');
        return;
    }
    
    // Показываем модальное окно с настройками
    showLightingOptimizationModal(room);
}

// Показать модальное окно настроек оптимизации
function showLightingOptimizationModal(room) {
    const area = calculateRoomArea(room).toFixed(2);
    
    const modalHtml = `
        <div id="aiLightingModal" class="modal" style="display: block; z-index: 5000;">
            <div class="modal-content" style="width: 450px; max-width: 95%;">
                <h3 style="margin-top: 0; color: var(--primary);">🤖 AI Оптимизация освещения</h3>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Помещение:</span> <strong>${room.name}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Площадь:</span> <strong>${area} м²</strong>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Тип помещения:</label>
                    <select id="aiRoomType" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        ${Object.entries(ROOM_TYPES).map(([key, value]) => 
                            `<option value="${key}">${value.name} (${value.lux} люкс)</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Тип основного освещения:</label>
                    <select id="aiMainLightType" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        <option value="GX53">Встраиваемые GX53</option>
                        <option value="LED_PANEL">LED панели</option>
                        <option value="CHANDELIER">Люстра</option>
                        <option value="TRACK">Трековая система</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">Дополнительные опции:</label>
                    <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <input type="checkbox" id="aiAccentLight" checked>
                        <span>Акцентное освещение (подсветка зон)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="aiPerimeterLight">
                        <span>Подсветка по периметру</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="applyLightingOptimization()" style="flex: 2; background: var(--primary); color: white; border: none; padding: 12px;">
                        🚀 Применить оптимизацию
                    </button>
                    <button onclick="closeAILightingModal()" style="flex: 1; background: #eee; border: none; padding: 12px;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старое модальное окно, если есть
    const oldModal = document.getElementById('aiLightingModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Закрыть модальное окно
function closeAILightingModal() {
    const modal = document.getElementById('aiLightingModal');
    if (modal) modal.remove();
}

// ОСНОВНАЯ ФУНКЦИЯ: Применить оптимизацию освещения
function applyLightingOptimization() {
    const room = rooms[activeRoom];
    const roomType = document.getElementById('aiRoomType').value;
    const mainLightType = document.getElementById('aiMainLightType').value;
    const accentLight = document.getElementById('aiAccentLight').checked;
    const perimeterLight = document.getElementById('aiPerimeterLight').checked;
    
    closeAILightingModal();
    
    // Показываем индикатор загрузки
    showAILoader();
    
    // Немного задержки для визуального эффекта "думает"
    setTimeout(() => {
        // 1. Рассчитываем необходимое количество света
        const result = calculateLightingLayout(room, roomType, mainLightType, accentLight, perimeterLight);
        
        // 2. Применяем к комнате
        applyLightingToRoom(room, result);
        
        // 3. Показываем результат
        showOptimizationResult(result);
        
        hideAILoader();
    }, 800);
}

// ПОКАЗАТЬ ЗАГРУЗЧИК
function showAILoader() {
    const loader = document.createElement('div');
    loader.id = 'aiLoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 20px; z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center;
    `;
    loader.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 15px;">🤖</div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">AI анализирует помещение...</div>
        <div style="width: 200px; height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden;">
            <div style="width: 60%; height: 100%; background: var(--primary); animation: aiProgress 1.5s infinite;"></div>
        </div>
    `;
    document.body.appendChild(loader);
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes aiProgress {
            0% { width: 10%; }
            50% { width: 80%; }
            100% { width: 10%; }
        }
    `;
    document.head.appendChild(style);
}

function hideAILoader() {
    const loader = document.getElementById('aiLoader');
    if (loader) loader.remove();
}

// ОСНОВНОЙ АЛГОРИТМ РАСЧЕТА
function calculateLightingLayout(room, roomType, mainLightType, accentLight, perimeterLight) {
    const bounds = getRoomBounds(room);
    const area = calculateRoomArea(room);
    
    // 1. Определяем требования к освещенности
    const requiredLux = ROOM_TYPES[roomType].lux;
    
    // 2. Светоотдача выбранного типа светильника
    const efficacy = LIGHT_EFFICACY[mainLightType] || 80;
    
    // 3. Предполагаемая мощность одного светильника (Вт)
    let wattPerFixture = 12; // по умолчанию для GX53
    
    switch(mainLightType) {
        case 'GX53': wattPerFixture = 12; break;
        case 'LED_PANEL': wattPerFixture = 36; break;
        case 'CHANDELIER': wattPerFixture = 60; break;
        case 'TRACK': wattPerFixture = 15; break;
    }
    
    // 4. Световой поток одного светильника (люмен)
    const lumensPerFixture = wattPerFixture * efficacy;
    
    // 5. Общий требуемый световой поток (люмен)
    // люкс = люмен / м²
    const totalLumensRequired = requiredLux * area;
    
    // 6. Количество основных светильников
    let mainCount = Math.ceil(totalLumensRequired / lumensPerFixture);
    
    // Ограничиваем разумным количеством
    mainCount = Math.min(Math.max(mainCount, 1), 20);
    
    // 7. Генерируем позиции для основных светильников
    const mainPositions = generateMainLightPositions(room, bounds, mainCount, mainLightType);
    
    // 8. Акцентное освещение (если нужно)
    const accentPositions = accentLight ? generateAccentLightPositions(room, bounds) : [];
    
    // 9. Подсветка по периметру (если нужно)
    const perimeterPositions = perimeterLight ? generatePerimeterLightPositions(room) : [];
    
    return {
        main: {
            type: mainLightType,
            count: mainCount,
            positions: mainPositions
        },
        accent: {
            type: 'GX53', // для акцентов используем маленькие
            count: accentPositions.length,
            positions: accentPositions
        },
        perimeter: {
            type: 'LIGHT_LINE',
            count: perimeterPositions.length,
            positions: perimeterPositions
        },
        stats: {
            area: area,
            requiredLux: requiredLux,
            totalLumens: totalLumensRequired,
            estimatedPower: mainCount * wattPerFixture + accentPositions.length * 8
        }
    };
}

// Генерация позиций для основных светильников
function generateMainLightPositions(room, bounds, count, lightType) {
    const positions = [];
    
    if (lightType === 'CHANDELIER' && count === 1) {
        // Люстра - одна по центру
        const center = findRoomCenter(room);
        positions.push({ x: center.x, y: center.y, rotation: 0, width: null });
        return positions;
    }
    
    if (lightType === 'TRACK') {
        // Трековая система - вдоль длинной стены
        return generateTrackPositions(room, bounds);
    }
    
    // Для точечных светильников - равномерная сетка
    const cols = Math.ceil(Math.sqrt(count * (bounds.width / bounds.height)));
    const rows = Math.ceil(count / cols);
    
    const cellWidth = bounds.width / (cols + 1);
    const cellHeight = bounds.height / (rows + 1);
    
    let generated = 0;
    for (let r = 1; r <= rows && generated < count; r++) {
        for (let c = 1; c <= cols && generated < count; c++) {
            const x = bounds.minX + c * cellWidth;
            const y = bounds.minY + r * cellHeight;
            
            // Проверяем, что точка внутри комнаты
            if (pointInPolygon({ x, y }, room.points)) {
                positions.push({ x, y, rotation: 0, width: null });
                generated++;
            }
        }
    }
    
    // Если не хватило точек, добавляем в центры сегментов
    if (generated < count) {
        const center = findRoomCenter(room);
        for (let i = generated; i < count; i++) {
            positions.push({
                x: center.x + (Math.random() - 0.5) * 500,
                y: center.y + (Math.random() - 0.5) * 500,
                rotation: 0,
                width: null
            });
        }
    }
    
    return positions;
}

// Найти центр комнаты
function findRoomCenter(room) {
    let sumX = 0, sumY = 0;
    room.points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
    });
    return {
        x: sumX / room.points.length,
        y: sumY / room.points.length
    };
}

// Генерация трековой системы
function generateTrackPositions(room, bounds) {
    const positions = [];
    
    // Находим самую длинную стену
    let maxLength = 0;
    let longestEdge = null;
    
    for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i];
        const p2 = room.points[(i + 1) % room.points.length];
        const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
        
        if (length > maxLength) {
            maxLength = length;
            longestEdge = { p1, p2 };
        }
    }
    
    if (longestEdge) {
        // Размещаем трек параллельно самой длинной стене, с отступом
        const angle = Math.atan2(
            longestEdge.p2.y - longestEdge.p1.y,
            longestEdge.p2.x - longestEdge.p1.x
        );
        
        const centerX = (longestEdge.p1.x + longestEdge.p2.x) / 2;
        const centerY = (longestEdge.p1.y + longestEdge.p2.y) / 2;
        
        // Смещаем внутрь комнаты
        const perpAngle = angle + Math.PI / 2;
        const offset = 500; // 50 см от стены
        
        positions.push({
            x: centerX + Math.cos(perpAngle) * offset,
            y: centerY + Math.sin(perpAngle) * offset,
            rotation: angle * 180 / Math.PI,
            width: maxLength * 0.8 // трек 80% от длины стены
        });
    }
    
    return positions;
}

// Акцентное освещение (по углам или зонам)
function generateAccentLightPositions(room, bounds) {
    const positions = [];
    
    // Углы комнаты
    room.points.forEach((point, i) => {
        // Смещаем от угла внутрь
        const prev = room.points[(i - 1 + room.points.length) % room.points.length];
        const next = room.points[(i + 1) % room.points.length];
        
        const dir1 = { x: point.x - prev.x, y: point.y - prev.y };
        const dir2 = { x: next.x - point.x, y: next.y - point.y };
        
        const len1 = Math.sqrt(dir1.x**2 + dir1.y**2);
        const len2 = Math.sqrt(dir2.x**2 + dir2.y**2);
        
        if (len1 > 0 && len2 > 0) {
            const norm1 = { x: dir1.x / len1, y: dir1.y / len1 };
            const norm2 = { x: dir2.x / len2, y: dir2.y / len2 };
            
            // Внутренний вектор (примерно биссектриса)
            const innerX = (norm1.x + norm2.x) * 300;
            const innerY = (norm1.y + norm2.y) * 300;
            
            positions.push({
                x: point.x - innerX,
                y: point.y - innerY,
                rotation: 0,
                width: null
            });
        }
    });
    
    return positions;
}

// Подсветка по периметру (световые линии вдоль стен)
function generatePerimeterLightPositions(room) {
    const positions = [];
    
    for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i];
        const p2 = room.points[(i + 1) % room.points.length];
        
        const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        
        // Центр стены
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        
        // Смещаем внутрь комнаты
        const perpAngle = angle + Math.PI / 2;
        const offset = 200; // 20 см от стены
        
        positions.push({
            x: centerX + Math.cos(perpAngle) * offset,
            y: centerY + Math.sin(perpAngle) * offset,
            rotation: angle * 180 / Math.PI,
            width: length * 0.7 // 70% длины стены
        });
    }
    
    return positions;
}

// Применить результаты к комнате
function applyLightingToRoom(room, result) {
    saveState();
    
    // Очищаем существующие элементы (опционально)
    if (confirm('Очистить существующие элементы перед добавлением новых?')) {
        room.elements = [];
    }
    
    if (!room.elements) room.elements = [];
    
    // Добавляем основные светильники
    result.main.positions.forEach(pos => {
        room.elements.push({
            type: result.main.type === 'TRACK' ? 'rail' : 'light',
            subtype: result.main.type,
            x: pos.x,
            y: pos.y,
            rotation: pos.rotation || 0,
            width: pos.width
        });
    });
    
    // Добавляем акцентное освещение
    result.accent.positions.forEach(pos => {
        room.elements.push({
            type: 'light',
            subtype: 'GX53',
            x: pos.x,
            y: pos.y,
            rotation: 0,
            width: null
        });
    });
    
    // Добавляем периметр
    result.perimeter.positions.forEach(pos => {
        room.elements.push({
            type: 'light',
            subtype: 'LIGHT_LINE',
            x: pos.x,
            y: pos.y,
            rotation: pos.rotation,
            width: pos.width
        });
    });
    
    // Перерисовываем
    draw();
    updateStats();
}

// Показать результат оптимизации
function showOptimizationResult(result) {
    const stats = result.stats;
    
    const resultHtml = `
        <div id="aiResult" class="modal" style="display: block; z-index: 5001;">
            <div class="modal-content" style="width: 400px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">✨</div>
                <h3 style="color: var(--success); margin-top: 0;">Оптимизация завершена!</h3>
                
                <div style="background: #f0f8ff; padding: 15px; border-radius: 10px; margin: 20px 0; text-align: left;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Основных светильников:</span> <strong>${result.main.count} шт.</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Акцентных:</span> <strong>${result.accent.count} шт.</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Периметр:</span> <strong>${result.perimeter.count} линий</strong>
                    </div>
                    <div style="border-top: 1px solid #ddd; margin: 10px 0; padding-top: 10px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Расчетная мощность:</span> <strong>${stats.estimatedPower} Вт</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Освещенность:</span> <strong>${stats.requiredLux} люкс</strong>
                        </div>
                    </div>
                </div>
                
                <button onclick="closeAIResult()" style="background: var(--primary); color: white; border: none; padding: 12px 30px; border-radius: 8px;">
                    Отлично!
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', resultHtml);
}

function closeAIResult() {
    const modal = document.getElementById('aiResult');
    if (modal) modal.remove();
}

// Экспорт функций
window.optimizeLighting = optimizeLighting;
window.applyLightingOptimization = applyLightingOptimization;
window.closeAILightingModal = closeAILightingModal;