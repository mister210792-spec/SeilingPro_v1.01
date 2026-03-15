// js/ai-lighting.js
// ПРОФЕССИОНАЛЬНАЯ расстановка светильников

// Глобальная переменная
let selectedMainLightType = 'GX53';

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
        return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    }
    const xs = room.points.map(p => p.x);
    const ys = room.points.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
    };
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

// НОВЫЙ КЛАСС С ПРОФЕССИОНАЛЬНОЙ РАССТАНОВКОЙ
class ProLightingDesigner {
    constructor(room, roomType, fixtureType) {
        this.room = room;
        this.roomType = roomType;
        this.fixtureType = fixtureType;
        this.bounds = getRoomBounds(room);
        this.polygon = room.points;
        
        // Стандартные параметры для точечных светильников
        this.wallOffset = 600; // 60 см от стен
        this.step = 1000; // 1 метр между светильниками
        this.minDistance = 800; // минимальное расстояние 80 см
        
        console.log("🎯 Профессиональный дизайнер света запущен");
    }
    
    // ГЛАВНЫЙ МЕТОД - равномерная расстановка
    calculateOptimalLayout() {
        try {
            // Для люстры - просто центр
            if (this.fixtureType === 'CHANDELIER') {
                return {
                    main: this.placeChandelier(),
                    accent: [],
                    perimeter: []
                };
            }
            
            // Для треков - особая логика
            if (this.fixtureType === 'TRACK') {
                return {
                    main: this.placeTrackSystem(),
                    accent: [],
                    perimeter: []
                };
            }
            
            // Для точечных светильников - РАВНОМЕРНАЯ СЕТКА
            const mainPositions = this.placeDownlights();
            
            // Акцентное освещение по желанию
            const accentPositions = this.placeAccentLights();
            
            return {
                main: mainPositions,
                accent: accentPositions,
                perimeter: []
            };
            
        } catch (error) {
            console.error("Ошибка в дизайнере:", error);
            return {
                main: this.placeFallback(),
                accent: [],
                perimeter: []
            };
        }
    }
    
    // ОСНОВНОЙ МЕТОД - расстановка точечных светильников
    placeDownlights() {
        const positions = [];
        
        // Определяем рабочую область с отступом от стен
        const workArea = {
            minX: this.bounds.minX + this.wallOffset,
            maxX: this.bounds.maxX - this.wallOffset,
            minY: this.bounds.minY + this.wallOffset,
            maxY: this.bounds.maxY - this.wallOffset
        };
        
        // Проверяем, что область не слишком маленькая
        if (workArea.maxX - workArea.minX < 800) {
            workArea.minX = this.bounds.minX + 300;
            workArea.maxX = this.bounds.maxX - 300;
        }
        if (workArea.maxY - workArea.minY < 800) {
            workArea.minY = this.bounds.minY + 300;
            workArea.maxY = this.bounds.maxY - 300;
        }
        
        const width = workArea.maxX - workArea.minX;
        const height = workArea.maxY - workArea.minY;
        
        // Рассчитываем количество рядов и колонок
        // Шаг между светильниками - 1 метр (1000 мм)
        const cols = Math.max(2, Math.floor(width / this.step) + 1);
        const rows = Math.max(2, Math.floor(height / this.step) + 1);
        
        // Равномерные отступы по краям
        const marginX = (width - (cols - 1) * this.step) / 2;
        const marginY = (height - (rows - 1) * this.step) / 2;
        
        console.log(`📐 Сетка: ${cols} x ${rows} = ${cols * rows} светильников`);
        
        // Генерируем позиции строго по сетке с шагом 1 метр
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Рассчитываем координаты с равномерными отступами
                const x = workArea.minX + marginX + col * this.step;
                const y = workArea.minY + marginY + row * this.step;
                
                // Для четных рядов делаем смещение на полшага (шахматный порядок)
                const finalX = (row % 2 === 1) ? x + this.step/2 : x;
                
                // Проверяем, что точка внутри комнаты
                if (isPointInPolygon({ x: finalX, y: y }, this.polygon)) {
                    positions.push({
                        x: finalX,
                        y: y,
                        type: 'main'
                    });
                }
            }
        }
        
        // Если получилось слишком много, прореживаем
        const maxCount = Math.floor(this.calculateOptimalCount());
        if (positions.length > maxCount) {
            return this.thinOutPositions(positions, maxCount);
        }
        
        return positions;
    }
    
    // Расчет оптимального количества светильников
    calculateOptimalCount() {
        const area = calculateRoomArea(this.room);
        
        // Для жилых комнат: 1 светильник на 1.5-2 м²
        if (area < 10) return 4;      // маленькая комната
        if (area < 15) return 6;      // средняя
        if (area < 20) return 8;      // больше средней
        if (area < 30) return 12;     // большая
        return 16;                     // очень большая
    }
    
    // Прореживание для равномерности
    thinOutPositions(positions, targetCount) {
        if (positions.length <= targetCount) return positions;
        
        const result = [];
        const step = positions.length / targetCount;
        
        for (let i = 0; i < positions.length && result.length < targetCount; i += step) {
            const index = Math.floor(i);
            if (index < positions.length) {
                result.push(positions[index]);
            }
        }
        
        return result;
    }
    
    // Расстановка люстры
    placeChandelier() {
        // Находим центр комнаты
        let sumX = 0, sumY = 0;
        this.polygon.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
        const centerX = sumX / this.polygon.length;
        const centerY = sumY / this.polygon.length;
        
        return [{
            x: centerX,
            y: centerY,
            type: 'main',
            width: null
        }];
    }
    
    // Трековая система
    placeTrackSystem() {
        // Находим самую длинную стену
        let maxLength = 0;
        let bestWall = null;
        
        for (let i = 0; i < this.polygon.length; i++) {
            const p1 = this.polygon[i];
            const p2 = this.polygon[(i + 1) % this.polygon.length];
            const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
            
            if (length > maxLength) {
                maxLength = length;
                bestWall = { p1, p2 };
            }
        }
        
        if (bestWall) {
            const angle = Math.atan2(
                bestWall.p2.y - bestWall.p1.y,
                bestWall.p2.x - bestWall.p1.x
            );
            
            const centerX = (bestWall.p1.x + bestWall.p2.x) / 2;
            const centerY = (bestWall.p1.y + bestWall.p2.y) / 2;
            
            // Смещаем внутрь комнаты
            const perpAngle = angle + Math.PI / 2;
            const offset = 600;
            
            const testX = centerX + Math.cos(perpAngle) * offset;
            const testY = centerY + Math.sin(perpAngle) * offset;
            
            if (isPointInPolygon({ x: testX, y: testY }, this.polygon)) {
                return [{
                    x: testX,
                    y: testY,
                    rotation: angle * 180 / Math.PI,
                    width: maxLength * 0.8,
                    type: 'main'
                }];
            } else {
                // Пробуем в другую сторону
                const altX = centerX + Math.cos(perpAngle - Math.PI) * offset;
                const altY = centerY + Math.sin(perpAngle - Math.PI) * offset;
                
                if (isPointInPolygon({ x: altX, y: altY }, this.polygon)) {
                    return [{
                        x: altX,
                        y: altY,
                        rotation: angle * 180 / Math.PI,
                        width: maxLength * 0.8,
                        type: 'main'
                    }];
                }
            }
        }
        
        return [];
    }
    
    // Акцентное освещение по углам
    placeAccentLights() {
        const positions = [];
        
        for (let i = 0; i < this.polygon.length; i++) {
            const point = this.polygon[i];
            const prev = this.polygon[(i - 1 + this.polygon.length) % this.polygon.length];
            const next = this.polygon[(i + 1) % this.polygon.length];
            
            // Находим направление внутрь комнаты
            const toPrev = { x: point.x - prev.x, y: point.y - prev.y };
            const toNext = { x: next.x - point.x, y: next.y - point.y };
            
            // Нормализуем
            const lenPrev = Math.sqrt(toPrev.x**2 + toPrev.y**2);
            const lenNext = Math.sqrt(toNext.x**2 + toNext.y**2);
            
            if (lenPrev > 0 && lenNext > 0) {
                const dirPrev = { x: toPrev.x / lenPrev, y: toPrev.y / lenPrev };
                const dirNext = { x: toNext.x / lenNext, y: toNext.y / lenNext };
                
                // Усредненное направление внутрь
                const dirX = (dirPrev.x + dirNext.x) / 2;
                const dirY = (dirPrev.y + dirNext.y) / 2;
                
                const norm = Math.sqrt(dirX**2 + dirY**2);
                if (norm > 0) {
                    const finalDirX = dirX / norm * 400;
                    const finalDirY = dirY / norm * 400;
                    
                    const accentX = point.x - finalDirX;
                    const accentY = point.y - finalDirY;
                    
                    if (isPointInPolygon({ x: accentX, y: accentY }, this.polygon)) {
                        positions.push({
                            x: accentX,
                            y: accentY,
                            type: 'accent'
                        });
                    }
                }
            }
        }
        
        return positions;
    }
    
    // Запасной вариант
    placeFallback() {
        const positions = [];
        const center = {
            x: (this.bounds.minX + this.bounds.maxX) / 2,
            y: (this.bounds.minY + this.bounds.maxY) / 2
        };
        
        // Простая сетка 3x3
        for (let row = 1; row <= 3; row++) {
            for (let col = 1; col <= 3; col++) {
                const x = this.bounds.minX + col * (this.bounds.maxX - this.bounds.minX) / 4;
                const y = this.bounds.minY + row * (this.bounds.maxY - this.bounds.minY) / 4;
                
                if (isPointInPolygon({ x, y }, this.polygon)) {
                    positions.push({ x, y, type: 'main' });
                }
            }
        }
        
        return positions;
    }
}

// Функции интерфейса
function smartLightingOptimization() {
    console.log("🧠 Запуск профессионального дизайнера света");
    
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
    
    showLightingModal(room);
}

function showLightingModal(room) {
    const area = calculateRoomArea(room).toFixed(2);
    
    const modalHtml = `
        <div id="smartAILightingModal" class="modal" style="display: block; z-index: 5000;">
            <div class="modal-content" style="width: 450px;">
                <h3 style="margin-top: 0; color: var(--primary);">💡 Профессиональная расстановка света</h3>
                
                <div style="background: #f0f7ff; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div><strong>${room.name}</strong></div>
                    <div>Площадь: ${area} м²</div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold;">📋 Тип помещения:</label>
                    <select id="smartRoomType" style="width: 100%; padding: 10px; margin-top: 5px;">
                        <option value="living">Гостиная</option>
                        <option value="bedroom">Спальня</option>
                        <option value="kitchen">Кухня</option>
                        <option value="office">Кабинет</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold;">💡 Тип освещения:</label>
                    <select id="smartMainLightType" style="width: 100%; padding: 10px; margin-top: 5px;">
                        <option value="GX53">Точечные светильники (равномерно)</option>
                        <option value="LED_PANEL">LED панели</option>
                        <option value="CHANDELIER">Люстра (центр)</option>
                        <option value="TRACK">Трековая система</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="smartAccentLight">
                        <span>Акцентное освещение по углам</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="applyProLighting()" style="flex: 2; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px;">
                        🚀 Расставить светильники
                    </button>
                    <button onclick="closeLightingModal()" style="flex: 1; background: #eee; border: none; padding: 12px;">
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

function closeLightingModal() {
    const modal = document.getElementById('smartAILightingModal');
    if (modal) modal.remove();
}

function applyProLighting() {
    const room = rooms[activeRoom];
    const roomType = document.getElementById('smartRoomType').value;
    const fixtureType = document.getElementById('smartMainLightType').value;
    const addAccent = document.getElementById('smartAccentLight').checked;
    
    closeLightingModal();
    
    // Показываем загрузчик
    const loader = document.createElement('div');
    loader.id = 'lightingLoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 20px; z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    `;
    loader.innerHTML = `<div style="font-size: 24px;">⏳ Рассчитываем оптимальное расположение...</div>`;
    document.body.appendChild(loader);
    
    setTimeout(() => {
        try {
            // Создаем дизайнера
            const designer = new ProLightingDesigner(room, roomType, fixtureType);
            const result = designer.calculateOptimalLayout();
            
            // Применяем к комнате
            if (typeof saveState === 'function') saveState();
            
            if (!room.elements) room.elements = [];
            
            // Очищаем или добавляем
            if (confirm('Очистить существующие элементы?')) {
                room.elements = [];
            }
            
            // Добавляем основные светильники
            if (result.main && result.main.length > 0) {
                result.main.forEach(pos => {
                    room.elements.push({
                        type: fixtureType === 'TRACK' ? 'rail' : 'light',
                        subtype: fixtureType,
                        x: pos.x,
                        y: pos.y,
                        rotation: pos.rotation || 0,
                        width: pos.width
                    });
                });
            }
            
            // Добавляем акцентные
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
            
            // Обновляем отображение
            if (typeof draw === 'function') draw();
            if (typeof updateStats === 'function') updateStats();
            
            // Показываем результат
            showResult(result.main.length, result.accent.length);
            
        } catch (error) {
            console.error("Ошибка:", error);
            alert('Произошла ошибка при расстановке');
        }
        
        document.body.removeChild(loader);
    }, 500);
}

function showResult(mainCount, accentCount) {
    const resultHtml = `
        <div id="lightingResultModal" class="modal" style="display: block; z-index: 5001;">
            <div class="modal-content" style="width: 350px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 10px;">✨</div>
                <h3 style="margin: 0 0 15px 0;">Расстановка завершена!</h3>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div>Основных светильников: <b>${mainCount} шт.</b></div>
                    ${accentCount > 0 ? `<div>Акцентных: <b>${accentCount} шт.</b></div>` : ''}
                </div>
                
                <button onclick="closeResultModal()" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px;">
                    Отлично!
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', resultHtml);
}

function closeResultModal() {
    const modal = document.getElementById('lightingResultModal');
    if (modal) modal.remove();
}

// Экспорт
window.smartLightingOptimization = smartLightingOptimization;
window.applyProLighting = applyProLighting;
window.closeLightingModal = closeLightingModal;
window.closeResultModal = closeResultModal;

console.log("✅ Профессиональный дизайнер света загружен");
