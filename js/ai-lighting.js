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
        
        // Базовые требования по освещенности
        const requiredLux = roomStandard.lux;
        const totalLumens = requiredLux * this.area;
        
        const avgPower = fixtureSpec.powerRange[1] || 12;
        const lumensPerFixture = avgPower * fixtureSpec.lumenPerWatt;
        
        // Рассчитываем необходимое количество
        let requiredCount = Math.ceil(totalLumens / lumensPerFixture);
        
        // Минимум 4 светильника для равномерности
        requiredCount = Math.max(4, requiredCount);
        
        // Ограничиваем разумным количеством
        const maxByArea = Math.ceil(this.area / 2);
        const minByArea = Math.floor(this.area / 4);
        
        requiredCount = Math.min(requiredCount, maxByArea);
        requiredCount = Math.max(requiredCount, minByArea);
        
        console.log(`💡 Требуется светильников: ${requiredCount} (площадь ${this.area.toFixed(2)} м²)`);
        
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
                // Люстра - одна по центру
                candidates = [{
                    x: this.center.x,
                    y: this.center.y,
                    type: 'main',
                    priority: 10
                }];
            } else if (this.mainFixtureType === 'TRACK') {
                // Трековая система
                candidates = this.generateTrackPositions();
            } else {
                // Точечные светильники - РАВНОМЕРНАЯ СЕТКА
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
                    confidence: 90
                }
            };
        } catch (error) {
            console.error("❌ Ошибка в calculateOptimalLayout:", error);
            // Запасной вариант - сетка 3x3
            const fallbackPositions = this.generateFallbackPositions();
            return {
                main: fallbackPositions,
                accent: [],
                perimeter: [],
                stats: {
                    area: this.area,
                    requiredLux: 150,
                    totalLumens: this.area * 150,
                    estimatedPower: 100,
                    confidence: 60
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
        
        // Получаем реальные границы комнаты с отступом от стен
        const minX = this.bounds.minX + wallOffset;
        const maxX = this.bounds.maxX - wallOffset;
        const minY = this.bounds.minY + wallOffset;
        const maxY = this.bounds.maxY - wallOffset;
        
        // Проверяем, что отступы не слишком большие
        const effectiveWidth = Math.max(1000, maxX - minX);
        const effectiveHeight = Math.max(1000, maxY - minY);
        
        // Соотношение сторон комнаты
        const aspectRatio = effectiveWidth / effectiveHeight;
        
        // Рассчитываем оптимальную сетку
        let cols = Math.round(Math.sqrt(count * aspectRatio));
        let rows = Math.round(count / cols);
        
        // Корректируем, чтобы получить ровно нужное количество
        if (cols * rows < count) {
            if (aspectRatio > 1) {
                cols++;
            } else {
                rows++;
            }
        }
        
        cols = Math.max(2, Math.min(cols, 6));
        rows = Math.max(2, Math.min(rows, 6));
        
        console.log(`📐 Сетка: ${cols} x ${rows} = ${cols * rows} позиций`);
        
        // Шаг между светильниками (равномерный)
        const stepX = effectiveWidth / (cols + 1);
        const stepY = effectiveHeight / (rows + 1);
        
        // Генерируем позиции строго по сетке
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const x = minX + c * stepX;
                const y = minY + r * stepY;
                
                // Проверяем, что точка внутри комнаты
                if (isPointInPolygon({ x, y }, polygon)) {
                    positions.push({
                        x: x,
                        y: y,
                        type: 'main',
                        priority: 10
                    });
                }
            }
        }
        
        // Если получилось слишком много позиций, равномерно прореживаем
        if (positions.length > count * 1.5) {
            const step = Math.floor(positions.length / count);
            const filtered = [];
            for (let i = 0; i < positions.length && filtered.length < count; i += step) {
                filtered.push(positions[i]);
            }
            return filtered;
        }
        
        return positions;
    }
    
    // Запасной вариант - простая сетка 3x3
    generateFallbackPositions() {
        const positions = [];
        const minX = this.bounds.minX + 600;
        const maxX = this.bounds.maxX - 600;
        const minY = this.bounds.minY + 600;
        const maxY = this.bounds.maxY - 600;
        
        const stepX = (maxX - minX) / 4;
        const stepY = (maxY - minY) / 4;
        
        for (let r = 1; r <= 3; r++) {
            for (let c = 1; c <= 3; c++) {
                const x = minX + c * stepX;
                const y = minY + r * stepY;
                
                if (isPointInPolygon({ x: x, y: y }, this.room.points)) {
                    positions.push({
                        x: x,
                        y: y,
                        type: 'main',
                        priority: 5
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
                bestEdge = { p1: p1, p2: p2 };
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
                        width: maxLength * 0.8,
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
            
            // Векторы от точки
            const toPrev = { x: prev.x - point.x, y: prev.y - point.y };
            const toNext = { x: next.x - point.x, y: next.y - point.y };
            
            // Усредненное направление внутрь
            const dirX = (toPrev.x + toNext.x) / 2;
            const dirY = (toPrev.y + toNext.y) / 2;
            
            const len = Math.sqrt(dirX*dirX + dirY*dirY);
            
            if (len > 0) {
                // Нормализуем и смещаем на 400 мм внутрь
                const normX = dirX / len * 400;
                const normY = dirY / len * 400;
                
                const accentX = point.x + normX;
                const accentY = point.y + normY;
                
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
            if (length < 1000) continue;
            
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            // Делим длинную стену на несколько сегментов
            const segments = Math.floor(length / 2000) + 1;
            
            for (let s = 1; s <= segments; s++) {
                const t = s / (segments + 1);
                const centerX = p1.x + (p2.x - p1.x) * t;
                const centerY = p1.y + (p2.y - p1.y) * t;
                
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
                            width: 1200,
                            type: 'perimeter'
                        });
                        break;
                    }
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
            
            const key = `${Math.round(pos.x/100)},${Math.round(pos.y/100)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            valid.push(pos);
        }
        
        return valid;
    }
    
    optimizePositions(positions, requirements) {
        const optimized = [];
        
        // Просто берем нужное количество позиций (они уже равномерные)
        for (let i = 0; i < Math.min(requirements.requiredCount, positions.length); i++) {
            optimized.push(positions[i]);
        }
        
        // Если мало позиций, добавляем вокруг центра
        if (optimized.length < requirements.requiredCount) {
            const needed = requirements.requiredCount - optimized.length;
            const center = this.findRoomCenter();
            
            for (let i = 0; i < needed; i++) {
                const angle = (i / needed) * Math.PI * 2;
                const radius = 800;
                const x = center.x + Math.cos(angle) * radius;
                const y = center.y + Math.sin(angle) * radius;
                
                if (isPointInPolygon({ x: x, y: y }, this.room.points)) {
                    optimized.push({ 
                        x: x, 
                        y: y, 
                        type: 'main', 
                        priority: 1 
                    });
                }
            }
        }
        
        return optimized;
    }
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
        alert('❌ Сначала замкните контур комнаты');
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
    if (result.main && result.main.length > 0) {
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
    }
    
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
                    <div>Основных светильников: <b>${result.main ? result.main.length : 0} шт.</b></div>
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

// Добавляем CSS-анимации
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
