// js/ai-lighting.js
// ИИ-ассистент для оптимизации освещения - ИСПРАВЛЕННАЯ ВЕРСИЯ

// Глобальная переменная для выбранного типа
let selectedMainLightType = 'GX53';

// Проверяем, что стандарты загружены
if (!window.LIGHTING_STANDARDS) {
    console.error("❌ LIGHTING_STANDARDS не загружены! Проверь порядок скриптов.");
    window.LIGHTING_STANDARDS = {
        roomTypes: {
            'living': { name: 'Гостиная', lux: 150, accent: true },
            'bedroom': { name: 'Спальня', lux: 150, accent: false },
            'kitchen': { name: 'Кухня', lux: 150, accent: true }
        },
        fixtures: {
            'GX53': { powerRange: [7,12,15], lumenPerWatt: 80, minDistance: 1000, wallOffset: 600 },
            'LED_PANEL': { powerRange: [18,24,36], lumenPerWatt: 100, minDistance: 1200, wallOffset: 800 },
            'CHANDELIER': { powerRange: [40,60,80], lumenPerWatt: 60, minDistance: 0, wallOffset: 0 },
            'TRACK': { powerRange: [10,15,20], lumenPerWatt: 90, minDistance: 800, wallOffset: 500 }
        }
    };
}

// Вспомогательные функции
function calculateRoomArea(room) {
    if (!room || !room.closed || !room.points || room.points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < room.points.length; i++) {
        const j = (i + 1) % room.points.length;
        area += room.points[i].x * room.points[j].y - room.points[j].x * room.points[i].y;
    }
    return Math.abs(area / 2) / 1000000;
}

function getRoomBounds(room) {
    if (!room || !room.points || room.points.length === 0) {
        return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
    }
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

function getCeilingHeight() {
    try {
        if (!rooms || !rooms[activeRoom]) return 2.7;
        const bounds = getRoomBounds(rooms[activeRoom]);
        return ((bounds.maxY - bounds.minY) / 1000) || 2.7;
    } catch (e) {
        return 2.7;
    }
}

function isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;
    
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

// Основной класс ИИ-ассистента
class LightingAIAssistant {
    constructor(room, roomType, mainFixtureType) {
        this.room = room;
        this.roomType = roomType;
        this.mainFixtureType = mainFixtureType;
        this.standards = window.LIGHTING_STANDARDS;
        this.bounds = getRoomBounds(room);
        this.area = calculateRoomArea(room);
        this.height = getCeilingHeight();
        this.center = this.findRoomCenter();
        
        console.log("🤖 ИИ-ассистент создан", {
            room: room.name,
            area: this.area,
            height: this.height,
            type: roomType
        });
    }
    
    findRoomCenter() {
        if (!this.room.points || this.room.points.length === 0) {
            return { x: 0, y: 0 };
        }
        let sumX = 0, sumY = 0;
        this.room.points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
        return {
            x: sumX / this.room.points.length,
            y: sumY / this.room.points.length
        };
    }
    
    calculateLightingRequirements() {
        const roomStandard = this.standards.roomTypes[this.roomType] || 
                            { lux: 150, name: 'Стандарт' };
        const fixtureSpec = this.standards.fixtures[this.mainFixtureType] || 
                           { powerRange: [12], lumenPerWatt: 80, minDistance: 1000, wallOffset: 600 };
        
        const requiredLux = roomStandard.lux * 1.2;
        const totalLumens = requiredLux * this.area;
        
        const avgPower = fixtureSpec.powerRange[1] || 12;
        const lumensPerFixture = avgPower * fixtureSpec.lumenPerWatt;
        
        let requiredCount = Math.max(1, Math.ceil(totalLumens / lumensPerFixture));
        const maxByArea = Math.ceil(this.area / 2);
        requiredCount = Math.min(requiredCount, maxByArea, 12); // Не больше 12 светильников
        
        return {
            requiredLux,
            totalLumens,
            requiredCount,
            avgPower,
            lumensPerFixture,
            fixtureSpec,
            estimatedPower: requiredCount * avgPower
        };
    }
    
    calculateOptimalLayout() {
        try {
            const requirements = this.calculateLightingRequirements();
            
            // Генерируем позиции в зависимости от типа
            let candidates = [];
            
            if (this.mainFixtureType === 'CHANDELIER') {
                candidates = [{
                    x: this.center.x,
                    y: this.center.y,
                    type: 'main',
                    priority: 10
                }];
            } else if (this.mainFixtureType === 'TRACK') {
                candidates = this.generateTrackPositions();
            } else {
                candidates = this.generateGridPositions(requirements);
            }
            
            // Фильтруем позиции (только внутри комнаты)
            const validPositions = this.filterValidPositions(candidates);
            
            // Оптимизируем расстояния
            const optimized = this.optimizePositions(validPositions, requirements);
            
            return {
                main: optimized,
                accent: this.generateAccentPositions(),
                perimeter: this.generatePerimeterPositions(),
                stats: {
                    area: this.area,
                    requiredLux: requirements.requiredLux,
                    totalLumens: requirements.totalLumens,
                    estimatedPower: requirements.estimatedPower,
                    confidence: 85
                }
            };
        } catch (error) {
            console.error("❌ Ошибка в calculateOptimalLayout:", error);
            // Возвращаем запасной вариант
            return {
                main: [{ x: this.center.x, y: this.center.y, type: 'main' }],
                accent: [],
                perimeter: [],
                stats: {
                    area: this.area,
                    requiredLux: 150,
                    totalLumens: this.area * 150,
                    estimatedPower: 50,
                    confidence: 50
                }
            };
        }
    }
    
    // УЛУЧШЕННАЯ генерация равномерной сетки
generateGridPositions(requirements) {
    const positions = [];
    const count = requirements.requiredCount;
    const fixtureSpec = requirements.fixtureSpec;
    const wallOffset = fixtureSpec.wallOffset || 600;
    
    const polygon = this.room.points;
    
    // Получаем реальные границы комнаты
    const minX = this.bounds.minX + wallOffset;
    const maxX = this.bounds.maxX - wallOffset;
    const minY = this.bounds.minY + wallOffset;
    const maxY = this.bounds.maxY - wallOffset;
    
    // Вычисляем оптимальное количество рядов и колонок
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Соотношение сторон комнаты
    const aspectRatio = width / height;
    
    // Рассчитываем оптимальную сетку
    let cols = Math.ceil(Math.sqrt(count * aspectRatio));
    let rows = Math.ceil(count / cols);
    
    // Корректируем, чтобы получить ровно count или ближайшее меньшее
    while (cols * rows > count * 1.2) {
        if (cols > rows) {
            cols--;
        } else {
            rows--;
        }
    }
    
    cols = Math.max(2, cols);
    rows = Math.max(2, rows);
    
    console.log(`📐 Сетка: ${cols} x ${rows} = ${cols * rows} позиций`);
    
    // Шаг между светильниками
    const stepX = width / (cols + 1);
    const stepY = height / (rows + 1);
    
    // Генерируем позиции строго по сетке
    for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
            const x = minX + c * stepX;
            const y = minY + r * stepY;
            
            // Проверяем, что точка внутри комнаты
            if (isPointInPolygon({ x, y }, polygon)) {
                positions.push({
                    x, y,
                    type: 'main',
                    priority: 10 // Высокий приоритет для равномерной сетки
                });
            }
        }
    }
    
    return positions;
}
    
    generateTrackPositions() {
        const positions = [];
        
        // Находим самую длинную стену
        let maxLength = 0;
        let bestEdge = null;
        
        for (let i = 0; i < this.room.points.length; i++) {
            const p1 = this.room.points[i];
            const p2 = this.room.points[(i + 1) % this.room.points.length];
            const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
            
            if (length > maxLength) {
                maxLength = length;
                bestEdge = { p1, p2 };
            }
        }
        
        if (bestEdge) {
            const angle = Math.atan2(
                bestEdge.p2.y - bestEdge.p1.y,
                bestEdge.p2.x - bestEdge.p1.x
            );
            
            const centerX = (bestEdge.p1.x + bestEdge.p2.x) / 2;
            const centerY = (bestEdge.p1.y + bestEdge.p2.y) / 2;
            
            // Пробуем смещение в обе стороны
            for (const sign of [1, -1]) {
                const perpAngle = angle + (Math.PI / 2) * sign;
                const testX = centerX + Math.cos(perpAngle) * 500;
                const testY = centerY + Math.sin(perpAngle) * 500;
                
                if (isPointInPolygon({ x: testX, y: testY }, this.room.points)) {
                    positions.push({
                        x: testX,
                        y: testY,
                        rotation: angle * 180 / Math.PI,
                        width: maxLength * 0.7,
                        type: 'main',
                        priority: 8
                    });
                    break;
                }
            }
        }
        
        return positions;
    }
    
    generateAccentPositions() {
        const positions = [];
        const roomStandard = this.standards.roomTypes[this.roomType] || { accent: false };
        
        if (!roomStandard.accent || this.room.points.length < 3) return positions;
        
        // Расставляем акценты по углам
        for (let i = 0; i < this.room.points.length; i++) {
            const point = this.room.points[i];
            const prev = this.room.points[(i - 1 + this.room.points.length) % this.room.points.length];
            const next = this.room.points[(i + 1) % this.room.points.length];
            
            // Векторы от точки к соседям
            const dir1 = { x: point.x - prev.x, y: point.y - prev.y };
            const dir2 = { x: next.x - point.x, y: next.y - point.y };
            
            const len1 = Math.sqrt(dir1.x**2 + dir1.y**2);
            const len2 = Math.sqrt(dir2.x**2 + dir2.y**2);
            
            if (len1 > 0 && len2 > 0) {
                // Направление внутрь комнаты
                const norm1 = { x: dir1.x / len1, y: dir1.y / len1 };
                const norm2 = { x: dir2.x / len2, y: dir2.y / len2 };
                
                const innerX = (norm1.x + norm2.x) * 300;
                const innerY = (norm1.y + norm2.y) * 300;
                
                const accentX = point.x - innerX;
                const accentY = point.y - innerY;
                
                if (isPointInPolygon({ x: accentX, y: accentY }, this.room.points)) {
                    positions.push({
                        x: accentX,
                        y: accentY,
                        type: 'accent'
                    });
                }
            }
        }
        
        return positions;
    }
    
    generatePerimeterPositions() {
        const positions = [];
        
        for (let i = 0; i < this.room.points.length; i++) {
            const p1 = this.room.points[i];
            const p2 = this.room.points[(i + 1) % this.room.points.length];
            
            const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
            if (length < 500) continue; // Пропускаем короткие стены
            
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            
            // Пробуем смещение в обе стороны
            for (const sign of [1, -1]) {
                const perpAngle = angle + (Math.PI / 2) * sign;
                const testX = centerX + Math.cos(perpAngle) * 300;
                const testY = centerY + Math.sin(perpAngle) * 300;
                
                if (isPointInPolygon({ x: testX, y: testY }, this.room.points)) {
                    positions.push({
                        x: testX,
                        y: testY,
                        rotation: angle * 180 / Math.PI,
                        width: length * 0.6,
                        type: 'perimeter'
                    });
                    break;
                }
            }
        }
        
        return positions;
    }
    
    filterValidPositions(candidates) {
        const valid = [];
        const seen = new Set();
        
        for (const pos of candidates) {
            if (!isPointInPolygon({ x: pos.x, y: pos.y }, this.room.points)) {
                continue;
            }
            
            const key = `${Math.round(pos.x/50)},${Math.round(pos.y/50)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            valid.push(pos);
        }
        
        return valid;
    }
    
    // УЛУЧШЕННАЯ оптимизация - сохраняем равномерность
optimizePositions(positions, requirements) {
    const optimized = [];
    const fixtureSpec = requirements.fixtureSpec;
    const minDistance = fixtureSpec.minDistance || 1000;
    
    // Если у нас есть равномерная сетка, просто берем первые N позиций
    if (positions.length >= requirements.requiredCount) {
        // Сортируем для равномерного распределения по комнате
        positions.sort((a, b) => {
            // Чередуем для равномерности
            const aKey = Math.floor(a.x / 1000) + Math.floor(a.y / 1000) * 100;
            const bKey = Math.floor(b.x / 1000) + Math.floor(b.y / 1000) * 100;
            return aKey - bKey;
        });
        
        // Берем нужное количество
        for (let i = 0; i < requirements.requiredCount && i < positions.length; i++) {
            optimized.push(positions[i]);
        }
    } else {
        // Если позиций мало, добавляем все
        optimized.push(...positions);
    }
    
    return optimized;
}

// Функции интерфейса
function smartLightingOptimization() {
    console.log("🧠 Запуск ИИ-ассистента");
    
    if (!rooms || rooms.length === 0) {
        alert('❌ Сначала создайте помещение');
        return;
    }
    
    const room = rooms[activeRoom];
    if (!room) {
        alert('❌ Выберите помещение');
        return;
    }
    
    if (!room.closed) {
        alert('❌ Сначала замкните контур комнаты (соедините последнюю точку с первой)');
        return;
    }
    
    if (room.points.length < 3) {
        alert('❌ Комната должна иметь минимум 3 точки');
        return;
    }
    
    showSmartLightingModal(room);
}

function showSmartLightingModal(room) {
    const area = calculateRoomArea(room).toFixed(2);
    const height = getCeilingHeight().toFixed(1);
    
    const modalHtml = `
        <div id="smartAILightingModal" class="modal" style="display: block; z-index: 5000;">
            <div class="modal-content" style="width: 500px; max-width: 95%;">
                <h3 style="margin-top: 0; color: var(--primary);">🧠 ИИ-ассистент по освещению</h3>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div><strong>${room.name}</strong></div>
                    <div>Площадь: ${area} м² | Высота: ${height} м</div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold;">📋 Тип помещения:</label>
                    <select id="smartRoomType" style="width: 100%; padding: 10px; margin-top: 5px;">
                        <option value="living">Гостиная (150 лк)</option>
                        <option value="bedroom">Спальня (150 лк)</option>
                        <option value="kitchen">Кухня (150 лк)</option>
                        <option value="bathroom">Ванная (50 лк)</option>
                        <option value="hallway">Коридор (50 лк)</option>
                        <option value="office">Кабинет (300 лк)</option>
                        <option value="children">Детская (200 лк)</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold;">💡 Тип освещения:</label>
                    <select id="smartMainLightType" style="width: 100%; padding: 10px; margin-top: 5px;">
                        <option value="GX53">Встраиваемые GX53 (точечные)</option>
                        <option value="LED_PANEL">LED панели</option>
                        <option value="CHANDELIER">Люстра</option>
                        <option value="TRACK">Трековая система</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="smartAccentLight" checked>
                        <span>Акцентное освещение (по углам)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="smartPerimeterLight">
                        <span>Подсветка по периметру</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="applySmartLightingOptimization()" style="flex: 2; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px;">
                        🚀 Расставить светильники
                    </button>
                    <button onclick="closeSmartAILightingModal()" style="flex: 1; background: #eee; border: none; padding: 12px;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('smartAILightingModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeSmartAILightingModal() {
    const modal = document.getElementById('smartAILightingModal');
    if (modal) modal.remove();
}

function applySmartLightingOptimization() {
    console.log("🚀 Применение оптимизации");
    
    const room = rooms[activeRoom];
    const roomType = document.getElementById('smartRoomType').value;
    const mainLightType = document.getElementById('smartMainLightType').value;
    const accentLight = document.getElementById('smartAccentLight').checked;
    const perimeterLight = document.getElementById('smartPerimeterLight').checked;
    
    selectedMainLightType = mainLightType;
    
    closeSmartAILightingModal();
    showSmartAILoader();
    
    setTimeout(() => {
        try {
            const assistant = new LightingAIAssistant(room, roomType, mainLightType);
            const result = assistant.calculateOptimalLayout();
            
            console.log("✅ Результат оптимизации:", result);
            
            applySmartLightingToRoom(room, result, accentLight, perimeterLight, mainLightType);
            
            hideSmartAILoader();
            showOptimizationReport(result);
        } catch (error) {
            console.error("❌ Ошибка:", error);
            alert('Произошла ошибка при оптимизации. Попробуйте еще раз.');
            hideSmartAILoader();
        }
    }, 800);
}

function showSmartAILoader() {
    const loader = document.createElement('div');
    loader.id = 'smartAILoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 20px; z-index: 10000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
        min-width: 280px;
    `;
    loader.innerHTML = `
        <div style="font-size: 48px; animation: pulseAI 1.5s infinite;">🧠</div>
        <div style="font-size: 18px; margin-top: 15px;">ИИ анализирует помещение...</div>
    `;
    document.body.appendChild(loader);
}

function hideSmartAILoader() {
    const loader = document.getElementById('smartAILoader');
    if (loader) loader.remove();
}

function applySmartLightingToRoom(room, result, addAccent, addPerimeter, mainLightType) {
    if (typeof saveState === 'function') {
        saveState();
    }
    
    if (confirm('Очистить существующие элементы перед добавлением новых?')) {
        room.elements = [];
    }
    
    if (!room.elements) room.elements = [];
    
    // Добавляем основные светильники
    result.main.forEach(pos => {
        room.elements.push({
            type: mainLightType === 'TRACK' ? 'rail' : 'light',
            subtype: mainLightType,
            x: pos.x,
            y: pos.y,
            rotation: pos.rotation || 0,
            width: pos.width
        });
    });
    
    // Добавляем акцентное освещение
    if (addAccent && result.accent && result.accent.length > 0) {
        result.accent.forEach(pos => {
            room.elements.push({
                type: 'light',
                subtype: 'GX53',
                x: pos.x,
                y: pos.y,
                rotation: 0,
                width: null
            });
        });
    }
    
    // Добавляем периметр
    if (addPerimeter && result.perimeter && result.perimeter.length > 0) {
        result.perimeter.forEach(pos => {
            room.elements.push({
                type: 'light',
                subtype: 'LIGHT_LINE',
                x: pos.x,
                y: pos.y,
                rotation: pos.rotation,
                width: pos.width
            });
        });
    }
    
    if (typeof draw === 'function') draw();
    if (typeof updateStats === 'function') updateStats();
}

function showOptimizationReport(result) {
    const reportHtml = `
        <div id="aiReportModal" class="modal" style="display: block; z-index: 5001;">
            <div class="modal-content" style="width: 400px;">
                <h3 style="margin-top: 0;">📊 Результат оптимизации</h3>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <div>Основных светильников: <b>${result.main.length} шт.</b></div>
                    <div>Акцентных: <b>${result.accent ? result.accent.length : 0} шт.</b></div>
                    <div>Периметр: <b>${result.perimeter ? result.perimeter.length : 0} линий</b></div>
                    <div style="margin-top: 10px;">Освещенность: <b>${Math.round(result.stats.requiredLux)} лк</b></div>
                </div>
                
                <button onclick="closeAIReport()" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px;">
                    Готово
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', reportHtml);
}

function closeAIReport() {
    const modal = document.getElementById('aiReportModal');
    if (modal) modal.remove();
}

// Добавляем CSS-анимации ТОЛЬКО ЕСЛИ ИХ НЕТ
if (!document.getElementById('aiAnimationStyles')) {
    const style = document.createElement('style');
    style.id = 'aiAnimationStyles';
    style.textContent = `
        @keyframes pulseAI {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

// Экспорт в глобальную область
window.smartLightingOptimization = smartLightingOptimization;
window.applySmartLightingOptimization = applySmartLightingOptimization;
window.closeSmartAILightingModal = closeSmartAILightingModal;
window.closeAIReport = closeAIReport;

console.log("✅ AI-ассистент загружен и готов к работе");
