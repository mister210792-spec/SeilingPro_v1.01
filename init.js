// materials.js - Типы полотен и профилей

// Типы полотен
let CANVAS_TYPES = {
    'pvc_gloss': { 
        label: 'MSD Classic', 
        basePrice: 450, 
        description: 'Матовый',
        multiplier: 1.0
    },
    'pvc_matte': { 
        label: 'MSD Premium', 
        basePrice: 400, 
        description: 'Матовый',
        multiplier: 1.0
    },
    'pvc_satin': { 
        label: 'Bauf', 
        basePrice: 500, 
        description: 'Матовый',
        multiplier: 1.1
    },
    'fabric_standard': { 
        label: 'TEQTUM', 
        basePrice: 800, 
        description: 'Pro',
        multiplier: 1.2
    },
    'fabric_print': { 
        label: 'Тканевый', 
        basePrice: 1200, 
        description: 'Pro',
        multiplier: 1.3
    }
};

// Типы профилей
let PROFILE_TYPES = {
    'wall_standard': { 
        label: 'Стеновой классический', 
        basePrice: 180, 
        unit: 'm', 
        description: 'Крепление к стене',
        color: '#607d8b'
    },
    'ceiling_standard': { 
        label: 'Потолочный', 
        basePrice: 200, 
        unit: 'm', 
        description: 'Крепление к потолку, мин. отступ',
        color: '#9e9e9e'
    },
    'separator': { 
        label: 'Разделительный', 
        basePrice: 350, 
        unit: 'm', 
        description: 'Для стыковки полотен',
        color: '#ff9800'
    },
    'floating': { 
        label: 'Парящий (со светом)', 
        basePrice: 850, 
        unit: 'm', 
        description: 'Эффект свечения по периметру',
        color: '#00bcd4'
    },
    'shadow': { 
        label: 'Теневой Kraab', 
        basePrice: 600, 
        unit: 'm', 
        description: 'С зазором 5-8 мм',
        color: '#795548'
    },
    'light_line': { 
        label: 'Теневой ПВХ', 
        basePrice: 500, 
        unit: 'm', 
        description: 'Под LED-подсветку',
        color: '#ffc107'
    },
    'aluminum_heavy': { 
        label: 'Алюминиевый усиленный', 
        basePrice: 300, 
        unit: 'm', 
        description: 'Для больших площадей',
        color: '#9c27b0'
    },
    'flexible': { 
        label: 'Гибкий (криволинейный)', 
        basePrice: 400, 
        unit: 'm', 
        description: 'Для фигурных конструкций',
        color: '#e91e63'
    }
};

// Загружаем сохраненные цены
function loadMaterialPrices() {
    const savedCanvas = localStorage.getItem('cp_canvas_types');
    const savedProfiles = localStorage.getItem('cp_profile_types');
    
    if (savedCanvas) {
        const parsed = JSON.parse(savedCanvas);
        Object.keys(parsed).forEach(key => {
            if (CANVAS_TYPES[key]) {
                CANVAS_TYPES[key].basePrice = parsed[key].basePrice;
            }
        });
    }
    
    if (savedProfiles) {
        const parsed = JSON.parse(savedProfiles);
        Object.keys(parsed).forEach(key => {
            if (PROFILE_TYPES[key]) {
                PROFILE_TYPES[key].basePrice = parsed[key].basePrice;
            }
        });
    }
}

// Сохраняем цены
function saveMaterialPrices() {
    localStorage.setItem('cp_canvas_types', JSON.stringify(CANVAS_TYPES));
    localStorage.setItem('cp_profile_types', JSON.stringify(PROFILE_TYPES));
}

// Функция для расчета стоимости полотна комнаты
function calculateCanvasCost(room) {
    if (!room || !room.closed || !room.area) return 0;
    const canvasType = room.canvasType || 'pvc_matte';
    const pricePerM2 = CANVAS_TYPES[canvasType]?.basePrice || 400;
    return room.area * pricePerM2;
}

// Функция для расчета стоимости профиля для конкретной стены
function calculateWallProfileCost(wallIndex, profileType) {
    const room = rooms[activeRoom];
    if (!room || !room.points || room.points.length < 2) return 0;
    
    const p1 = room.points[wallIndex];
    const p2 = room.points[(wallIndex + 1) % room.points.length];
    const wallLength = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2) / 1000; // в метрах
    
    const profile = PROFILE_TYPES[profileType] || PROFILE_TYPES['wall_standard'];
    return wallLength * profile.basePrice;
}

// Функция для рендера модального окна выбора материалов
function showMaterialSelectionModal(roomIndex = activeRoom) {
    const room = rooms[roomIndex];
    if (!room) return;
    
    // Инициализируем объекты материалов для комнаты, если их нет
    if (!room.materials) {
        room.materials = {
            canvasType: 'pvc_matte',
            wallProfiles: {} // Индекс стены -> тип профиля
        };
    }
    
    // Заполняем HTML модального окна
    const modalHtml = `
        <div id="materialModal" class="modal" style="display: block; z-index: 6000;">
            <div class="modal-content" style="width: 500px; max-width: 95%;">
                <h3 style="margin-top: 0;">Материалы для "${room.name}"</h3>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">🧵 Тип полотна</h4>
                    <select id="canvasTypeSelect" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        ${Object.keys(CANVAS_TYPES).map(key => {
                            const ct = CANVAS_TYPES[key];
                            return `<option value="${key}" ${room.materials.canvasType === key ? 'selected' : ''}>
                                ${ct.label} - ${ct.basePrice} руб/м² ${ct.description ? `(${ct.description})` : ''}
                            </option>`;
                        }).join('')}
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">📏 Типы профиля по стенам</h4>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        Можно назначить разный профиль на каждую стену
                    </p>
                    
                    <div id="wallsProfilesList" style="max-height: 300px; overflow-y: auto;">
                        ${renderWallProfilesList(room)}
                    </div>
                </div>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">💰 Предварительный расчет</h4>
                    <div id="materialCostPreview">
                        ${calculateMaterialCostPreview(room)}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="saveMaterialSettings()" style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 8px;">
                        Сохранить
                    </button>
                    <button onclick="closeMaterialModal()" style="background: #eee; border: none; padding: 10px 20px; border-radius: 8px;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старое модальное окно, если есть
    const oldModal = document.getElementById('materialModal');
    if (oldModal) oldModal.remove();
    
    // Добавляем новое
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Добавляем обработчики
    document.getElementById('canvasTypeSelect').addEventListener('change', updateMaterialPreview);
}

function renderWallProfilesList(room) {
    if (!room.points || room.points.length < 3) return '<p>Сначала замкните контур комнаты</p>';
    
    let html = '';
    for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i];
        const p2 = room.points[(i + 1) % room.points.length];
        const wallLength = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2) / 1000;
        
        const currentProfile = room.materials?.wallProfiles?.[i] || 'wall_standard';
        
        html += `
            <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: bold;">Стена ${i+1}</span>
                    <span style="color: #666;">${wallLength.toFixed(2)} м</span>
                </div>
                <select class="wall-profile-select" data-wall="${i}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                    ${Object.keys(PROFILE_TYPES).map(key => {
                        const pt = PROFILE_TYPES[key];
                        return `<option value="${key}" ${currentProfile === key ? 'selected' : ''}>
                            ${pt.label} - ${pt.basePrice} руб/м
                        </option>`;
                    }).join('')}
                </select>
            </div>
        `;
    }
    return html;
}

function calculateMaterialCostPreview(room) {
    if (!room.area) {
        // Рассчитываем площадь
        let area = 0;
        for(let i=0; i<room.points.length; i++) {
            let j = (i+1)%room.points.length;
            if(room.closed) area += room.points[i].x * room.points[j].y - room.points[j].x * room.points[i].y;
        }
        room.area = room.closed ? Math.abs(area/2)/1000000 : 0;
    }
    
    const canvasPrice = CANVAS_TYPES[room.materials?.canvasType || 'pvc_matte'].basePrice;
    const canvasCost = room.area * canvasPrice;
    
    let profilesCost = 0;
    if (room.materials?.wallProfiles) {
        for (let i = 0; i < room.points.length; i++) {
            const p1 = room.points[i];
            const p2 = room.points[(i + 1) % room.points.length];
            const wallLength = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2) / 1000;
            const profileType = room.materials.wallProfiles[i] || 'wall_standard';
            profilesCost += wallLength * (PROFILE_TYPES[profileType]?.basePrice || 180);
        }
    }
    
    return `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Полотно:</span> <span>${room.area.toFixed(2)} м² × ${canvasPrice} руб = ${canvasCost.toFixed(0)} руб</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Профили:</span> <span>${profilesCost.toFixed(0)} руб</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px solid #ddd; margin-top: 5px; padding-top: 5px;">
            <span>ИТОГО:</span> <span>${(canvasCost + profilesCost).toFixed(0)} руб</span>
        </div>
    `;
}

function updateMaterialPreview() {
    const room = rooms[activeRoom];
    if (!room) return;
    
    // Обновляем выбранный тип полотна
    const canvasSelect = document.getElementById('canvasTypeSelect');
    if (canvasSelect) {
        room.materials = room.materials || { wallProfiles: {} };
        room.materials.canvasType = canvasSelect.value;
    }
    
    // Обновляем профили для стен
    const profileSelects = document.querySelectorAll('.wall-profile-select');
    profileSelects.forEach(select => {
        const wallIndex = select.dataset.wall;
        room.materials.wallProfiles[wallIndex] = select.value;
    });
    
    // Обновляем предпросмотр
    const previewDiv = document.getElementById('materialCostPreview');
    if (previewDiv) {
        previewDiv.innerHTML = calculateMaterialCostPreview(room);
    }
}

function saveMaterialSettings() {
    const room = rooms[activeRoom];
    if (!room) return;
    
    // Сохраняем текущие значения из формы
    updateMaterialPreview();
    
    // Обновляем отображение и смету
    draw();
    updateStats();
    
    closeMaterialModal();
    
    console.log("✅ Материалы сохранены для комнаты", room.name);
}

function closeMaterialModal() {
    const modal = document.getElementById('materialModal');
    if (modal) modal.remove();
}

// Функция для редактирования цен материалов
function openMaterialPriceModal() {
    loadMaterialPrices();
    
    const modalHtml = `
        <div id="materialPriceModal" class="modal" style="display: block; z-index: 6000;">
            <div class="modal-content" style="width: 600px; max-width: 95%; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin-top: 0;">🛠️ Редактирование цен материалов</h3>
                
                <div style="margin-bottom: 25px;">
                    <h4 style="border-bottom: 2px solid #00bcd4; padding-bottom: 5px;">Полотна</h4>
                    ${Object.keys(CANVAS_TYPES).map(key => {
                        const ct = CANVAS_TYPES[key];
                        return `
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 6px;">
                                <span style="flex: 2;">${ct.label}</span>
                                <span style="flex: 1; color: #666;">${ct.description || ''}</span>
                                <input type="number" class="canvas-price-input" data-key="${key}" value="${ct.basePrice}" style="width: 100px; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                                <span>руб/м²</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div style="margin-bottom: 25px;">
                    <h4 style="border-bottom: 2px solid #ff9800; padding-bottom: 5px;">Профили</h4>
                    ${Object.keys(PROFILE_TYPES).map(key => {
                        const pt = PROFILE_TYPES[key];
                        return `
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 6px;">
                                <span style="flex: 2; border-left: 4px solid ${pt.color}; padding-left: 8px;">${pt.label}</span>
                                <span style="flex: 1; color: #666; font-size: 11px;">${pt.description || ''}</span>
                                <input type="number" class="profile-price-input" data-key="${key}" value="${pt.basePrice}" style="width: 100px; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                                <span>руб/м</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid #eee; padding-top: 15px;">
                    <button onclick="saveMaterialPrices()" style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 8px;">
                        Сохранить цены
                    </button>
                    <button onclick="closeMaterialPriceModal()" style="background: #eee; border: none; padding: 10px 20px; border-radius: 8px;">
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('materialPriceModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveMaterialPricesFromModal() {
    // Сохраняем цены полотен
    document.querySelectorAll('.canvas-price-input').forEach(input => {
        const key = input.dataset.key;
        if (CANVAS_TYPES[key]) {
            CANVAS_TYPES[key].basePrice = parseFloat(input.value) || 400;
        }
    });
    
    // Сохраняем цены профилей
    document.querySelectorAll('.profile-price-input').forEach(input => {
        const key = input.dataset.key;
        if (PROFILE_TYPES[key]) {
            PROFILE_TYPES[key].basePrice = parseFloat(input.value) || 180;
        }
    });
    
    saveMaterialPrices();
    closeMaterialPriceModal();
    alert('✅ Цены материалов сохранены');
}

function closeMaterialPriceModal() {
    const modal = document.getElementById('materialPriceModal');
    if (modal) modal.remove();
}

// Модифицируем generateFullEstimate для учета разных профилей
function generateFullEstimate() {
    let totalArea = 0, totalPerim = 0, globalElements = {}; 
    
    // Для детализации по материалам
    let canvasDetails = [];
    let profileDetails = [];
    
    rooms.forEach((r, roomIdx) => {
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length;
            p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        const roomArea = r.closed ? Math.abs(a/2)/1000000 : 0;
        const roomPerim = p/1000;
        
        totalArea += roomArea;
        totalPerim += roomPerim;
        
        // Детали по полотну
        const canvasType = r.materials?.canvasType || 'pvc_matte';
        const canvasPrice = CANVAS_TYPES[canvasType]?.basePrice || 400;
        canvasDetails.push({
            roomName: r.name,
            canvasType: CANVAS_TYPES[canvasType]?.label || 'ПВХ Матовый',
            area: roomArea,
            price: canvasPrice,
            cost: roomArea * canvasPrice
        });
        
        // Детали по профилям (по стенам)
        if (r.materials?.wallProfiles) {
            for (let i = 0; i < r.points.length; i++) {
                const p1 = r.points[i];
                const p2 = r.points[(i + 1) % r.points.length];
                const wallLength = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2) / 1000;
                const profileType = r.materials.wallProfiles[i] || 'wall_standard';
                const profilePrice = PROFILE_TYPES[profileType]?.basePrice || 180;
                
                profileDetails.push({
                    roomName: r.name,
                    wallIndex: i+1,
                    profileType: PROFILE_TYPES[profileType]?.label || 'Стеновой',
                    length: wallLength,
                    price: profilePrice,
                    cost: wallLength * profilePrice
                });
            }
        }
        
        // Элементы (как было)
        if (r.elements) {
            r.elements.forEach(el => {
                let key = el.subtype || (el.type === 'pipe' ? 'pipe' : el.type);
                if (!globalElements[key]) globalElements[key] = { count: 0, length: 0 };
                globalElements[key].count++;
                if (el.width) globalElements[key].length += (el.width / 1000);
            });
        }
    });
    
    let totalSum = 0, rowsHTML = "";
    
    // Полотна по типам
    let canvasByType = {};
    canvasDetails.forEach(d => {
        const key = d.canvasType;
        if (!canvasByType[key]) {
            canvasByType[key] = { area: 0, cost: 0, price: d.price };
        }
        canvasByType[key].area += d.area;
        canvasByType[key].cost += d.cost;
    });
    
    Object.keys(canvasByType).forEach(key => {
        const data = canvasByType[key];
        totalSum += data.cost;
        rowsHTML += `<tr><td>Полотно: ${key}</td><td>${data.area.toFixed(2)} м²</td><td>${data.price}</td><td>${data.cost.toFixed(0)}</td></tr>`;
    });
    
    // Профили по типам
    let profileByType = {};
    profileDetails.forEach(d => {
        const key = d.profileType;
        if (!profileByType[key]) {
            profileByType[key] = { length: 0, cost: 0, price: d.price };
        }
        profileByType[key].length += d.length;
        profileByType[key].cost += d.cost;
    });
    
    Object.keys(profileByType).forEach(key => {
        const data = profileByType[key];
        totalSum += data.cost;
        rowsHTML += `<tr><td>Профиль: ${key}</td><td>${data.length.toFixed(2)} м.п.</td><td>${data.price}</td><td>${data.cost.toFixed(0)}</td></tr>`;
    });
    
    // Элементы (как было)
    for (let key in globalElements) {
        let data = globalElements[key];
        let def = getElementDef(key);
        
        let price = window.prices[key] || 0;
        if (price === 0 && def && def.price) price = def.price;
        
        let sum = 0;
        let qtyString = "";
        
        if (key === 'pipe') {
            sum = data.count * price;
            qtyString = `${data.count} шт.`;
        } else if (def && def.type === 'linear') {
            sum = data.length * price;
            qtyString = `${data.length.toFixed(2)} м.п.`;
        } else {
            sum = data.count * price;
            qtyString = `${data.count} шт.`;
        }
        
        totalSum += sum;
        let displayName = def && def.label ? def.label : (key === 'pipe' ? 'Обвод трубы' : key);
        rowsHTML += `<tr><td>${displayName}</td><td>${qtyString}</td><td>${price.toFixed(0)}</td><td>${sum.toFixed(0)}</td></tr>`;
    }
    
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Смета</title><style>body{font-family:sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:12px}.total{margin-top:20px;font-size:24px;background:#2c3e50;color:white;padding:20px;text-align:right}</style></head><body><h1>СМЕТА ПО ОБЪЕКТУ</h1><table><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="total">ИТОГО: ${totalSum.toFixed(0)} руб.</div></body></html>`);
    win.document.close();
}

// Экспорт
window.CANVAS_TYPES = CANVAS_TYPES;
window.PROFILE_TYPES = PROFILE_TYPES;
window.loadMaterialPrices = loadMaterialPrices;
window.saveMaterialPrices = saveMaterialPrices;
window.showMaterialSelectionModal = showMaterialSelectionModal;
window.openMaterialPriceModal = openMaterialPriceModal;
window.saveMaterialPricesFromModal = saveMaterialPricesFromModal;
window.closeMaterialPriceModal = closeMaterialPriceModal;