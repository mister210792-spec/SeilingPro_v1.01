// js/ai-lighting.js
// ИИ-ассистент для оптимизации освещения

// Вспомогательные функции из core.js (дублируем для модульности)
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
    return (bounds.maxY - bounds.minY) / 1000;
}

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
    }
    
    calculateOptimalLayout() {
        const requirements = this.calculateLightingRequirements();
        const candidates = this.generateCandidates(requirements);
        const validPositions = this.filterValidPositions(candidates);
        const optimized = this.optimizePositions(validPositions, requirements);
        
        return {
            main: optimized.main,
            accent: optimized.accent,
            perimeter: optimized.perimeter,
            stats: {
                area: this.area,
                requiredLux: requirements.requiredLux,
                totalLumens: requirements.totalLumens,
                estimatedPower: requirements.estimatedPower,
                confidence: this.calculateConfidence(optimized)
            }
        };
    }
    
    calculateLightingRequirements() {
        const roomStandard = this.standards.roomTypes[this.roomType];
        const fixtureSpec = this.standards.fixtures[this.mainFixtureType];
        
        let heightCoeff = 1.0;
        const heightStr = this.height.toFixed(1);
        if (this.standards.heightCoefficients[heightStr]) {
            heightCoeff = this.standards.heightCoefficients[heightStr];
        } else if (this.height > 3.0) {
            heightCoeff = 1.5;
        }
        
        const safetyFactor = 1.3;
        const requiredLux = roomStandard.lux * heightCoeff * safetyFactor;
        const totalLumens = requiredLux * this.area;
        
        const avgPower = fixtureSpec.powerRange[1];
        const lumensPerFixture = avgPower * fixtureSpec.lumenPerWatt;
        
        let requiredCount = Math.ceil(totalLumens / lumensPerFixture);
        const maxByArea = Math.ceil(this.area / 1.5);
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
    
    generateCandidates(requirements) {
        const candidates = [];
        const fixtureSpec = requirements.fixtureSpec;
        const count = requirements.requiredCount;
        
        if (this.mainFixtureType === 'CHANDELIER') {
            const center = this.findRoomCenter();
            candidates.push({
                x: center.x,
                y: center.y,
                type: 'main',
                priority: 10
            });
        } else if (this.mainFixtureType === 'TRACK') {
            candidates.push(...this.generateTrackPositions());
        } else {
            candidates.push(...this.generateGridPositions(count, fixtureSpec));
        }
        
        return candidates;
    }
    
    generateGridPositions(count, fixtureSpec) {
        const positions = [];
        const minDistance = fixtureSpec.minDistance;
        const wallOffset = fixtureSpec.wallOffset;
        
        const width = this.bounds.maxX - this.bounds.minX;
        const height = this.bounds.maxY - this.bounds.minY;
        
        let cols = Math.ceil(Math.sqrt(count * (width / height)));
        let rows = Math.ceil(count / cols);
        
        const colSpacing = width / (cols + 1);
        const rowSpacing = height / (rows + 1);
        
        if (colSpacing < minDistance) {
            cols = Math.floor(width / minDistance) - 1;
            rows = Math.ceil(count / cols);
        }
        
        if (rowSpacing < minDistance) {
            rows = Math.floor(height / minDistance) - 1;
            cols = Math.ceil(count / rows);
        }
        
        cols = Math.max(1, cols);
        rows = Math.max(1, rows);
        
        let generated = 0;
        for (let r = 1; r <= rows && generated < count; r++) {
            for (let c = 1; c <= cols && generated < count; c++) {
                const x = this.bounds.minX + c * (width / (cols + 1));
                const y = this.bounds.minY + r * (height / (rows + 1));
                
                positions.push({
                    x, y,
                    type: 'main',
                    priority: 5
                });
                generated++;
            }
        }
        
        return positions;
    }
    
    generateTrackPositions() {
        const positions = [];
        
        let maxLength = 0;
        let longestEdge = null;
        
        for (let i = 0; i < this.room.points.length; i++) {
            const p1 = this.room.points[i];
            const p2 = this.room.points[(i + 1) % this.room.points.length];
            const length = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
            
            if (length > maxLength) {
                maxLength = length;
                longestEdge = { p1, p2 };
            }
        }
        
        if (longestEdge) {
            const angle = Math.atan2(
                longestEdge.p2.y - longestEdge.p1.y,
                longestEdge.p2.x - longestEdge.p1.x
            );
            
            const centerX = (longestEdge.p1.x + longestEdge.p2.x) / 2;
            const centerY = (longestEdge.p1.y + longestEdge.p2.y) / 2;
            
            let perpAngle = angle + Math.PI / 2;
            const testX = centerX + Math.cos(perpAngle) * 500;
            const testY = centerY + Math.sin(perpAngle) * 500;
            
            if (!isPointInPolygon({ x: testX, y: testY }, this.room.points)) {
                perpAngle = angle - Math.PI / 2;
            }
            
            const offset = 500;
            
            positions.push({
                x: centerX + Math.cos(perpAngle) * offset,
                y: centerY + Math.sin(perpAngle) * offset,
                rotation: angle * 180 / Math.PI,
                width: maxLength * 0.8,
                type: 'main',
                priority: 8
            });
        }
        
        return positions;
    }
    
    filterValidPositions(candidates) {
        const valid = [];
        const fixtureSpec = this.standards.fixtures[this.mainFixtureType];
        
        for (const pos of candidates) {
            if (!isPointInPolygon({ x: pos.x, y: pos.y }, this.room.points)) {
                continue;
            }
            
            const distToWall = getDistanceToWalls({ x: pos.x, y: pos.y }, this.room.points);
            
            if (distToWall < fixtureSpec.wallOffset - 200) {
                continue;
            }
            
            valid.push(pos);
        }
        
        return valid;
    }
    
    optimizePositions(positions, requirements) {
        const optimized = [];
        const fixtureSpec = requirements.fixtureSpec;
        const minDistance = fixtureSpec.minDistance;
        
        positions.sort((a, b) => b.priority - a.priority);
        
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
            }
        }
        
        if (optimized.length < requirements.requiredCount) {
            this.addFillPositions(optimized, requirements);
        }
        
        return {
            main: optimized,
            accent: this.generateAccentPositions(),
            perimeter: this.generatePerimeterPositions()
        };
    }
    
    generateAccentPositions() {
        const positions = [];
        const roomStandard = this.standards.roomTypes[this.roomType];
        
        if (!roomStandard.accent) return positions;
        
        this.room.points.forEach((point, i) => {
            const prev = this.room.points[(i - 1 + this.room.points.length) % this.room.points.length];
            const next = this.room.points[(i + 1) % this.room.points.length];
            
            const dir1 = { x: point.x - prev.x, y: point.y - prev.y };
            const dir2 = { x: next.x - point.x, y: next.y - point.y };
            
            const len1 = Math.sqrt(dir1.x**2 + dir1.y**2);
            const len2 = Math.sqrt(dir2.x**2 + dir2.y**2);
            
            if (len1 > 0 && len2 > 0) {
                const norm1 = { x: dir1.x / len1, y: dir1.y / len1 };
                const norm2 = { x: dir2.x / len2, y: dir2.y / len2 };
                
                const innerX = (norm1.x + norm2.x) * 400;
                const innerY = (norm1.y + norm2.y) * 400;
                
                const accentX = point.x - innerX;
                const accentY = point.y - innerY;
                
                if (isPointInPolygon({ x: accentX, y: accentY }, this.room.points)) {
                    positions.push({
                        x: accentX,
                        y: accentY,
                        type: 'accent',
                        subtype: 'GX53'
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
            
            const perpAngle = angle + Math.PI / 2;
            const offset = 300;
            
            const testX = centerX + Math.cos(perpAngle) * offset;
            const testY = centerY + Math.sin(perpAngle) * offset;
            
            if (isPointInPolygon({ x: testX, y: testY }, this.room.points)) {
                positions.push({
                    x: testX,
                    y: testY,
                    rotation: angle * 180 / Math.PI,
                    width: length * 0.6,
                    type: 'perimeter',
                    subtype: 'LIGHT_LINE'
                });
            } else {
                const altX = centerX + Math.cos(angle - Math.PI / 2) * offset;
                const altY = centerY + Math.sin(angle - Math.PI / 2) * offset;
                
                if (isPointInPolygon({ x: altX, y: altY }, this.room.points)) {
                    positions.push({
                        x: altX,
                        y: altY,
                        rotation: angle * 180 / Math.PI,
                        width: length * 0.6,
                        type: 'perimeter',
                        subtype: 'LIGHT_LINE'
                    });
                }
            }
        }
        
        return positions;
    }
    
    addFillPositions(positions, requirements) {
        const center = this.findRoomCenter();
        const needed = requirements.requiredCount - positions.length;
        
        for (let i = 0; i < needed; i++) {
            const angle = (i / needed) * Math.PI * 2;
            const radius = 800;
            
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            
            if (isPointInPolygon({ x, y }, this.room.points)) {
                positions.push({
                    x, y,
                    type: 'main',
                    priority: 1
                });
            }
        }
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
    
    calculateConfidence(optimized) {
        let confidence = 85;
        const recommended = this.calculateLightingRequirements().requiredCount;
        const countDiff = Math.abs(optimized.main.length - recommended);
        
        if (countDiff <= 1) confidence += 10;
        else if (countDiff <= 2) confidence += 5;
        else confidence -= 5 * countDiff;
        
        const width = this.bounds.maxX - this.bounds.minX;
        const height = this.bounds.maxY - this.bounds.minY;
        
        if (width / height > 2.5 || height / width > 2.5) {
            confidence -= 10;
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
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Помещение:</span> <strong>${room.name}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Площадь:</span> <strong>${area} м²</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Высота потолка:</span> <strong>${height} м</strong>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">📋 Тип помещения (по СНиП):</label>
                    <select id="smartRoomType" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        ${Object.entries(window.LIGHTING_STANDARDS.roomTypes).map(([key, value]) => 
                            `<option value="${key}">
                                ${value.name} — ${value.lux} лк
                            </option>`
                        ).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold;">💡 Тип основного освещения:</label>
                    <select id="smartMainLightType" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        <option value="GX53">Встраиваемые GX53 (теплый свет)</option>
                        <option value="LED_PANEL">LED панели (нейтральный свет)</option>
                        <option value="CHANDELIER">Люстра (центральное освещение)</option>
                        <option value="TRACK">Трековая система (зонирование)</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 10px;">
                    <h4 style="margin: 0 0 10px 0;">🔧 Дополнительные настройки</h4>
                    
                    <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <input type="checkbox" id="smartAccentLight" checked>
                        <span>Акцентное освещение (по углам)</span>
                    </label>
                    
                    <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <input type="checkbox" id="smartPerimeterLight">
                        <span>Подсветка по периметру</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="applySmartLightingOptimization()" style="flex: 2; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px;">
                        🚀 Запустить ИИ-оптимизацию
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
    
    closeSmartAILightingModal();
    showSmartAILoader();
    
    setTimeout(() => {
        try {
            const assistant = new LightingAIAssistant(room, roomType, mainLightType);
            const result = assistant.calculateOptimalLayout();
            
            applySmartLightingToRoom(room, result, accentLight, perimeterLight, mainLightType);
            showOptimizationReport(result);
            hideSmartAILoader();
        } catch (error) {
            console.error('Ошибка ИИ-оптимизации:', error);
            alert('Произошла ошибка при оптимизации');
            hideSmartAILoader();
        }
    }, 1500);
}

function showSmartAILoader() {
    const loader = document.createElement('div');
    loader.id = 'smartAILoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 20px; z-index: 10000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
        min-width: 300px;
    `;
    loader.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 15px; animation: pulse 1.5s infinite;">🧠</div>
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px;">ИИ-ассистент анализирует</div>
        <div style="color: #666; margin-bottom: 20px;">Применяются нормы СНиП и стандарты освещения...</div>
        <div style="width: 100%; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
            <div style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); animation: progress 1.5s ease-in-out infinite;"></div>
        </div>
    `;
    document.body.appendChild(loader);
}

function hideSmartAILoader() {
    const loader = document.getElementById('smartAILoader');
    if (loader) loader.remove();
}

function applySmartLightingToRoom(room, result, addAccent, addPerimeter, mainLightType) {
    saveState();
    
    if (confirm('Очистить существующие элементы перед добавлением новых?')) {
        room.elements = [];
    }
    
    if (!room.elements) room.elements = [];
    
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
    
    if (addAccent && result.accent) {
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
    
    if (addPerimeter && result.perimeter) {
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
            <div class="modal-content" style="width: 450px;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div style="font-size: 48px;">📊</div>
                    <div>
                        <h3 style="margin: 0; color: var(--dark);">Отчет ИИ-оптимизации</h3>
                        <p style="margin: 5px 0 0; color: #666;">На основе норм СНиП</p>
                    </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Основных светильников:</span>
                        <strong>${result.main.length} шт.</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Акцентных:</span>
                        <strong>${result.accent ? result.accent.length : 0} шт.</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Периметр:</span>
                        <strong>${result.perimeter ? result.perimeter.length : 0} линий</strong>
                    </div>
                    <div style="border-top: 1px solid #ddd; margin: 10px 0; padding-top: 10px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Расчетная освещенность:</span>
                            <strong>${Math.round(result.stats.requiredLux)} лк</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Световой поток:</span>
                            <strong>${Math.round(result.stats.totalLumens)} лм</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Уверенность ИИ:</span>
                            <strong>${result.stats.confidence}%</strong>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="closeAIReport()" style="flex: 1; background: var(--primary); color: white; border: none; padding: 12px;">
                        Готово
                    </button>
                </div>
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
    @keyframes progress {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 100%; }
    }
`;
document.head.appendChild(style);

// Экспорт функций
window.smartLightingOptimization = smartLightingOptimization;
window.applySmartLightingOptimization = applySmartLightingOptimization;
window.closeSmartAILightingModal = closeSmartAILightingModal;
window.closeAIReport = closeAIReport;