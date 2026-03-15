// js/ai-lighting.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ - правильно расставляет освещение

// Сохраняем выбранный тип светильников глобально
let selectedMainLightType = 'GX53';

// Вспомогательные функции
function calculateRoomArea(room) {
    if (!room.closed || room.points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < room.points.length; i++) {
        const j = (i + 1) % room.points.length;
        area += room.points[i].x * room.points[j].y - room.points[j].x * room.points[i].y;
    }
    return Math.abs(area / 2) / 1000000;
}

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

function getCeilingHeight() {
    const bounds = getRoomBounds(rooms[activeRoom]);
    return ((bounds.maxY - bounds.minY) / 1000) || 2.7; // по умолчанию 2.7м
}

// УЛУЧШЕННАЯ проверка точки внутри многоугольника
function isPointInPolygon(point, polygon) {
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

// Расстояние от точки до отрезка
function distancePointToSegment(point, p1, p2) {
    const A = point.x - p1.x;
    const B = point.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
        xx = p1.x;
        yy = p1.y;
    } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
    } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Расстояние до ближайшей стены
function getDistanceToWalls(point, polygon) {
    let minDistance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        const dist = distancePointToSegment(point, p1, p2);
        minDistance = Math.min(minDistance, dist);
    }
    return minDistance;
}

// ОСНОВНОЙ КЛАСС - ИСПРАВЛЕННЫЙ
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
    }
    
    calculateOptimalLayout() {
        const requirements = this.calculateLightingRequirements();
        
        // Генерируем кандидаты в зависимости от типа
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
            // Точечные светильники - УЛУЧШЕННАЯ генерация
            candidates = this.generateImprovedGridPositions(requirements);
        }
        
        // Фильтруем позиции (только внутри комнаты)
        const validPositions = this.filterValidPositions(candidates);
        
        // Оптимизируем расстояния
        const optimized = this.optimizePositions(validPositions, requirements);
        
        // Генерируем акцентное и периметральное освещение
        const accent = this.generateAccentPositions();
        const perimeter = this.generatePerimeterPositions();
        
        return {
            main: optimized,
            accent: accent,
            perimeter: perimeter,
            stats: {
                area: this.area,
                requiredLux: requirements.requiredLux,
                totalLumens: requirements.totalLumens,
                estimatedPower: requirements.estimatedPower,
                confidence: this.calculateConfidence(optimized, requirements)
            }
        };
    }
    
    calculateLightingRequirements() {
        const roomStandard = this.standards.roomTypes[this.roomType];
        const fixtureSpec = this.standards.fixtures[this.mainFixtureType];
        
        // Коэффициент высоты
        let heightCoeff = 1.0;
        if (this.height > 3.0) heightCoeff = 1.2;
        if (this.height > 3.5) heightCoeff = 1.5;
        
        const safetyFactor = 1.2; // Уменьшил для более реалистичного количества
        const requiredLux = roomStandard.lux * heightCoeff * safetyFactor;
        const totalLumens = requiredLux * this.area;
        
        const avgPower = fixtureSpec.powerRange[1] || 12;
        const lumensPerFixture = avgPower * (fixtureSpec.lumenPerWatt || 80);
        
        let requiredCount = Math.max(1, Math.ceil(totalLumens / lumensPerFixture));
        
        // Ограничения
        const maxByArea = Math.ceil(this.area / 2); // 1 светильник на 2 м²
        requiredCount = Math.min(requiredCount, maxByArea);
        
        return {
            requiredLux,
            totalLumens,
            requiredCount,
            avgPower,
            lumensPerFixture,
            heightCoeff,
            fixtureSpec,
            estimatedPower: requiredCount * avgPower
        };
    }
    
    // УЛУЧШЕННАЯ генерация позиций с учетом формы комнаты
    generateImprovedGridPositions(requirements) {
        const positions = [];
        const count = requirements.requiredCount;
        const fixtureSpec = requirements.fixtureSpec;
        const minDistance = fixtureSpec.minDistance || 1000;
        const wallOffset = fixtureSpec.wallOffset || 600;
        
        // Получаем массив точек комнаты
        const polygon = this.room.points;
        
        // Создаем равномерную сетку с запасом
        const step = Math.max(minDistance, 800); // шаг сетки
        
        // Определяем границы с отступом от стен
        const margin = wallOffset;
        const startX = this.bounds.minX + margin;
        const endX = this.bounds.maxX - margin;
        const startY = this.bounds.minY + margin;
        const endY = this.bounds.maxY - margin;
        
        // Если комната слишком маленькая, уменьшаем отступ
        if (endX - startX < step) {
            startX = this.bounds.minX + 200;
            endX = this.bounds.maxX - 200;
        }
        
        // Генерируем точки сетки
        for (let x = startX; x <= endX; x += step) {
            for (let y = startY; y <= endY; y += step) {
                // Проверяем, что точка внутри полигона
                if (isPointInPolygon({ x, y }, polygon)) {
                    // Проверяем расстояние до стен
                    const distToWall = getDistanceToWalls({ x, y }, polygon);
                    if (distToWall >= wallOffset - 100) {
                        positions.push({
                            x, y,
                            type: 'main',
                            priority: 5
                        });
                    }
                }
            }
        }
        
        // Если получилось слишком мало точек, добавляем вокруг центра
        if (positions.length < count) {
            const radius = Math.min(this.bounds.width, this.bounds.height) / 3;
            for (let i = 0; i < count * 2; i++) {
                const angle = (i / count) * Math.PI * 2;
                const x = this.center.x + Math.cos(angle) * radius;
                const y = this.center.y + Math.sin(angle) * radius;
                
                if (isPointInPolygon({ x, y }, polygon)) {
                    positions.push({
                        x, y,
                        type: 'main',
                        priority: 3
                    });
                }
            }
        }
        
        return positions;
    }
    
    generateTrackPositions() {
        const positions = [];
        
        // Находим самую длинную непрерывную стену
        let maxLength = 0;
        let bestEdge = null;
        let bestAngle = 0;
        
        for (let i = 0; i < this.room.points.length; i++) {
            const p1 = this.room.points[i];
            const p2 = this.room.points[(i + 1) % this.room.points.length];
            const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
            
            if (length > maxLength) {
                maxLength = length;
                bestEdge = { p1, p2 };
                bestAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            }
        }
        
        if (bestEdge) {
            // Центр стены
            const centerX = (bestEdge.p1.x + bestEdge.p2.x) / 2;
            const centerY = (bestEdge.p1.y + bestEdge.p2.y) / 2;
            
            // Смещаем внутрь комнаты
            const perpAngle = bestAngle + Math.PI / 2;
            const testX = centerX + Math.cos(perpAngle) * 500;
            const testY = centerY + Math.sin(perpAngle) * 500;
            
            let finalAngle = perpAngle;
            if (!isPointInPolygon({ x: testX, y: testY }, this.room.points)) {
                finalAngle = bestAngle - Math.PI / 2;
            }
            
            const offset = 500;
            const finalX = centerX + Math.cos(finalAngle) * offset;
            const finalY = centerY + Math.sin(finalAngle) * offset;
            
            if (isPointInPolygon({ x: finalX, y: finalY }, this.room.points)) {
                positions.push({
                    x: finalX,
                    y: finalY,
                    rotation: bestAngle * 180 / Math.PI,
                    width: maxLength * 0.7,
                    type: 'main',
                    priority: 8
                });
            }
        }
        
        return positions;
    }
    
    filterValidPositions(candidates) {
        const valid = [];
        const seen = new Set();
        
        for (const pos of candidates) {
            // Проверка внутри комнаты
            if (!isPointInPolygon({ x: pos.x, y: pos.y }, this.room.points)) {
                continue;
            }
            
            // Избегаем дубликатов
            const key = `${Math.round(pos.x/10)},${Math.round(pos.y/10)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            valid.push(pos);
        }
        
        return valid;
    }
    
    optimizePositions(positions, requirements) {
        const optimized = [];
        const fixtureSpec = requirements.fixtureSpec;
        const minDistance = fixtureSpec.minDistance || 1000;
        
        // Сортируем по приоритету
        positions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        for (const pos of positions) {
            let tooClose = false;
            
            for (const existing of optimized) {
                const dist = Math.sqrt(
                    Math.pow(pos.x - existing.x, 2) + 
                    Math.pow(pos.y - existing.y, 2)
                );
                
                if (dist < minDistance) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                optimized.push(pos);
                
                // Если набрали нужное количество, останавливаемся
                if (optimized.length >= requirements.requiredCount) {
                    break;
                }
            }
        }
        
        // Если мало точек, добавляем вокруг центра
        if (optimized.length < requirements.requiredCount) {
            const needed = requirements.requiredCount - optimized.length;
            for (let i = 0; i < needed; i++) {
                const angle = (i / needed) * Math.PI * 2;
                const radius = 800;
                const x = this.center.x + Math.cos(angle) * radius;
                const y = this.center.y + Math.sin(angle) * radius;
                
                if (isPointInPolygon({ x, y }, this.room.points)) {
                    optimized.push({ x, y, type: 'main', priority: 1 });
                }
            }
        }
        
        return optimized;
    }
    
    generateAccentPositions() {
        const positions = [];
        const roomStandard = this.standards.roomTypes[this.roomType];
        
        if (!roomStandard.accent) return positions;
        
        // Расставляем акцентный свет по углам
        this.room.points.forEach((point, i) => {
            const prev = this.room.points[(i - 1 + this.room.points.length) % this.room.points.length];
            const next = this.room.points[(i + 1) % this.room.points.length];
            
            // Векторы от точки к соседям
            const v1 = { x: point.x - prev.x, y: point.y - prev.y };
            const v2 = { x: next.x - point.x, y: next.y - point.y };
            
            // Нормализуем
            const len1 = Math.sqrt(v1.x**2 + v1.y**2);
            const len2 = Math.sqrt(v2.x**2 + v2.y**2);
            
            if (len1 > 0 && len2 > 0) {
                // Направление внутрь комнаты (сумма нормализованных векторов)
                const dirX = (v1.x / len1 + v2.x / len2) * 300;
                const dirY = (v1.y / len1 + v2.y / len2) * 300;
                
                const accentX = point.x - dirX;
                const accentY = point.y - dirY;
                
                if (isPointInPolygon({ x: accentX, y: accentY }, this.room.points)) {
                    positions.push({
                        x: accentX,
                        y: accentY,
                        type: 'accent'
                    });
                }
            }
        });
        
        return positions;
    }
    
    generatePerimeterPositions() {
        const positions = [];
        
        for (let i = 0; i < this.room.points.length; i++) {
            const p1 = this.room.points[i];
            const p2 = this.room.points[(i + 1) % this.room.points.length];
            
            const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            
            // Пробуем смещение в обе стороны от стены
            const offsets = [300, -300];
            
            for (const offset of offsets) {
                const perpAngle = angle + Math.PI / 2;
                const testX = centerX + Math.cos(perpAngle) * offset;
                const testY = centerY + Math.sin(perpAngle) * offset;
                
                if (isPointInPolygon({ x: testX, y: testY }, this.room.points)) {
                    positions.push({
                        x: testX,
                        y: testY,
                        rotation: angle * 180 / Math.PI,
                        width: length * 0.7,
                        type: 'perimeter'
                    });
                    break; // Нашли подходящую сторону
                }
            }
        }
        
        return positions;
    }
    
    findRoomCenter() {
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
    
    calculateConfidence(optimized, requirements) {
        let confidence = 85;
        
        // Оценка по количеству
        const ratio = optimized.length / requirements.requiredCount;
        if (ratio > 0.8) confidence += 10;
        else if (ratio < 0.5) confidence -= 15;
        
        // Оценка по покрытию площади
        const step = 500;
        let covered = 0;
        let total = 0;
        
        for (let x = this.bounds.minX; x <= this.bounds.maxX; x += step) {
            for (let y = this.bounds.minY; y <= this.bounds.maxY; y += step) {
                if (isPointInPolygon({ x, y }, this.room.points)) {
                    total++;
                    for (const pos of optimized) {
                        const dist = Math.sqrt((x - pos.x)**2 + (y - pos.y)**2);
                        if (dist < 1500) {
                            covered++;
                            break;
                        }
                    }
                }
            }
        }
        
        if (total > 0) {
            const coverage = (covered / total) * 100;
            if (coverage > 80) confidence += 10;
            else if (coverage < 50) confidence -= 10;
        }
        
        return Math.min(100, Math.max(50, confidence));
    }
}

// Функции интерфейса
function smartLightingOptimization() {
    const room = rooms[activeRoom];
    if (!room) {
        alert('❌ Выберите помещение');
        return;
    }
    
    if (!room.closed) {
        alert('❌ Сначала замкните контур комнаты');
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
                    <div><strong>${room.name}</strong> | Площадь: ${area} м² | Высота: ${height} м</div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold;">📋 Тип помещения:</label>
                    <select id="smartRoomType" style="width: 100%; padding: 10px; margin-top: 5px;">
                        ${Object.entries(window.LIGHTING_STANDARDS.roomTypes).map(([key, value]) => 
                            `<option value="${key}">${value.name} (${value.lux} лк)</option>`
                        ).join('')}
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
    const room = rooms[activeRoom];
    const roomType = document.getElementById('smartRoomType').value;
    const mainLightType = document.getElementById('smartMainLightType').value;
    const accentLight = document.getElementById('smartAccentLight').checked;
    const perimeterLight = document.getElementById('smartPerimeterLight').checked;
    
    // Сохраняем выбранный тип глобально
    selectedMainLightType = mainLightType;
    
    closeSmartAILightingModal();
    showSmartAILoader();
    
    // Даем время на анимацию загрузки
    setTimeout(() => {
        try {
            const assistant = new LightingAIAssistant(room, roomType, mainLightType);
            const result = assistant.calculateOptimalLayout();
            
            // Применяем к комнате
            applySmartLightingToRoom(room, result, accentLight, perimeterLight, mainLightType);
            
            hideSmartAILoader();
            showOptimizationReport(result);
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Произошла ошибка при оптимизации');
            hideSmartAILoader();
        }
    }, 1000);
}

function showSmartAILoader() {
    const loader = document.createElement('div');
    loader.id = 'smartAILoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 20px; z-index: 10000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
    `;
    loader.innerHTML = `
        <div style="font-size: 48px; animation: pulse 1.5s infinite;">🧠</div>
        <div style="font-size: 18px; margin-top: 15px;">ИИ анализирует помещение...</div>
    `;
    document.body.appendChild(loader);
}

function hideSmartAILoader() {
    const loader = document.getElementById('smartAILoader');
    if (loader) loader.remove();
}

// ИСПРАВЛЕННАЯ функция применения - теперь mainLightType передается правильно
function applySmartLightingToRoom(room, result, addAccent, addPerimeter, mainLightType) {
    saveState();
    
    // Очищаем существующие элементы
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
    
    draw();
    updateStats();
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
                    <div>Уверенность ИИ: <b>${result.stats.confidence}%</b></div>
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
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);

// Экспорт
window.smartLightingOptimization = smartLightingOptimization;
window.applySmartLightingOptimization = applySmartLightingOptimization;
window.closeSmartAILightingModal = closeSmartAILightingModal;
window.closeAIReport = closeAIReport;
