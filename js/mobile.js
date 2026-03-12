// Мобильные переменные
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
let mobileTool = 'draw';
let longPressTimer = null;
let selectedElement = null;
let selectedElementIndex = -1;
let selectedPointId = null;
let resizeTarget = null;
let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300;

let touchState = {
    dragElem: null,
    dragPoint: null,
    startX: 0,
    startY: 0,
    startElemX: 0,
    startElemY: 0,
    startPointX: 0,
    startPointY: 0,
    moved: false
};

function setMobileTool(tool) {
    mobileTool = tool;
    document.querySelectorAll('.mobile-tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`mobile-tool-${tool}`).classList.add('active');
    selectedElement = null;
    selectedPointId = null;
}

function initMobileHandlers() {
    if (!isMobile) return;
    
    console.log("✅ Мобильные обработчики инициализированы");
    
    document.getElementById('mobile-tool-draw').addEventListener('click', () => setMobileTool('draw'));
    document.getElementById('mobile-tool-edit').addEventListener('click', () => setMobileTool('edit'));
    document.getElementById('mobile-tool-delete').addEventListener('click', () => setMobileTool('delete'));
    
    svg.addEventListener('touchstart', handleGlobalTouchStart, { passive: false });
    svg.addEventListener('touchend', handleGlobalTouchEnd, { passive: false });
    svg.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    svg.addEventListener('touchcancel', handleGlobalTouchCancel, { passive: false });
    
    setupPinchAndPan();
}

function handleGlobalTouchStart(e) {
    if (e.touches.length > 1) return;
    
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    
    if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
        e.preventDefault();
        window.lastTapX = touchX;
        window.lastTapY = touchY;
        document.getElementById('addElementMenu').style.display = 'flex';
        lastTapTime = 0;
        return;
    }
    lastTapTime = currentTime;
    
    touchState.startX = touchX;
    touchState.startY = touchY;
    touchState.moved = false;
}

function handleGlobalTouchEnd(e) {
    if (e.touches.length > 0) return;
    
    if (!touchState.moved && mobileTool === 'draw' && !touchState.dragElem && !touchState.dragPoint) {
        const touch = e.changedTouches[0];
        if (touch) {
            const rect = svg.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            simulateClickForDrawing(touchX, touchY);
        }
    }
    
    touchState.dragElem = null;
    touchState.dragPoint = null;
    selectedPointId = null;
}

function handleGlobalTouchMove(e) {
    if (e.touches.length > 1) return;
    
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    const dx = Math.abs(currentX - touchState.startX);
    const dy = Math.abs(currentY - touchState.startY);
    
    if (dx > 5 || dy > 5) {
        touchState.moved = true;
        cancelLongPress();
    }
}

function handleGlobalTouchCancel(e) {
    cancelLongPress();
    touchState.dragElem = null;
    touchState.dragPoint = null;
    selectedPointId = null;
}

function simulateClickForDrawing(x, y) {
    let r = rooms[activeRoom];
    if (!r || r.closed) return;
    
    let mmX = pxToMm(x, 'x');
    let mmY = pxToMm(y, 'y');
    
    let first = r.points[0];
    if (r.points.length >= 3 && first) {
        let firstXpx = mmToPx(first.x, 'x');
        let firstYpx = mmToPx(first.y, 'y');
        if (Math.hypot(x - firstXpx, y - firstYpx) < 25) {
            saveState();
            r.closed = true;
            draw();
            return;
        }
    }
    
    saveState();
    let sX = snap(mmX, first ? first.x : null);
    let sY = snap(mmY, first ? first.y : null);
    
    let last = r.points[r.points.length - 1];
    if (last) {
        if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
            sY = last.y;
        } else {
            sX = last.x;
        }
    }
    
    r.points.push({ id: Date.now() + Math.random(), x: sX, y: sY });
    draw();
}

function setupPinchAndPan() {
    let initialDistance = 0;
    let initialScale = 1;
    let initialOffsetX = 0;
    let initialOffsetY = 0;
    let pinchCenter = { x: 0, y: 0 };
    let pinchCenterMM = { x: 0, y: 0 };
    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;
    
    svg.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            initialDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            initialScale = scale;
            initialOffsetX = offsetX;
            initialOffsetY = offsetY;
            
            const rect = svg.getBoundingClientRect();
            pinchCenter.x = (touch1.clientX + touch2.clientX) / 2 - rect.left;
            pinchCenter.y = (touch1.clientY + touch2.clientY) / 2 - rect.top;
            pinchCenterMM.x = (pinchCenter.x - offsetX) / (MM_TO_PX * scale);
            pinchCenterMM.y = (pinchCenter.y - offsetY) / (MM_TO_PX * scale);
        } else if (e.touches.length === 1 && e.target === svg) {
            isPanning = true;
            const touch = e.touches[0];
            const rect = svg.getBoundingClientRect();
            lastPanX = touch.clientX - rect.left;
            lastPanY = touch.clientY - rect.top;
        }
    });
    
    svg.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            scale = initialScale * (currentDistance / initialDistance);
            updateZoomLevel();
            
            const rect = svg.getBoundingClientRect();
            const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
            const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
            
            offsetX = centerX - pinchCenterMM.x * (MM_TO_PX * scale);
            offsetY = centerY - pinchCenterMM.y * (MM_TO_PX * scale);
            
            draw();
        } else if (e.touches.length === 1 && isPanning) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = svg.getBoundingClientRect();
            const currentX = touch.clientX - rect.left;
            const currentY = touch.clientY - rect.top;
            
            offsetX += (currentX - lastPanX);
            offsetY += (currentY - lastPanY);
            
            lastPanX = currentX;
            lastPanY = currentY;
            
            draw();
        }
    });
    
    svg.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialDistance = 0;
        }
        if (e.touches.length === 0) {
            isPanning = false;
        }
    });
}

function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function closeAddElementMenu() {
    document.getElementById('addElementMenu').style.display = 'none';
}

function addMobileElement(type) {
    closeAddElementMenu();
    
    const r = rooms[activeRoom];
    if (!r) return;
    
    let mmX, mmY;
    
    if (window.lastTapX !== undefined) {
        mmX = pxToMm(window.lastTapX, 'x');
        mmY = pxToMm(window.lastTapY, 'y');
    } else {
        const rect = svg.getBoundingClientRect();
        mmX = pxToMm(rect.width / 2, 'x');
        mmY = pxToMm(rect.height / 2, 'y');
    }
    
    saveState();
    if (!r.elements) r.elements = [];
    
    let sub;
    if (type === 'light') sub = document.getElementById("lightTypeSelector").value;
    else if (type === 'extra') sub = document.getElementById("extraTypeSelector").value;
    else if (type === 'rail') sub = document.getElementById("railTypeSelector").value;
    else if (type === 'pipe') sub = 'pipe';
    
    let s = getSnappedPos(mmX, mmY);
    let def = getElementDef(sub);
    
    let newEl = {
        type: type === 'pipe' ? 'pipe' : type,
        subtype: sub,
        x: s.x,
        y: s.y,
        rotation: 0
    };
    
    const isLinear = def.type === 'linear' || type === 'rail';
    if (isLinear) {
        newEl.width = 2000;
    }
    
    r.elements.push(newEl);
    draw();
}

// В mobile.js, в функции showElementContextMenu добавьте новый пункт

function showElementContextMenu(el) {
    const menu = document.getElementById('elementContextMenu');
    if (!menu) {
        console.error("❌ Контекстное меню не найдено");
        return;
    }
    
    selectedElement = el;
    window.currentContextElement = el;
    
    console.log("✅ Открыто меню для элемента:", el);
    
    const hasLength = el.width !== undefined;
    const lengthItem = document.getElementById('menu-edit-length');
    if (lengthItem) {
        lengthItem.style.display = hasLength ? 'block' : 'none';
    }
    
    // Добавляем пункт для редактирования позиции
    let positionItem = document.getElementById('menu-edit-position');
    if (!positionItem) {
        positionItem = document.createElement('div');
        positionItem.className = 'context-menu-item';
        positionItem.id = 'menu-edit-position';
        positionItem.innerHTML = '📍 Изменить позицию';
        positionItem.onclick = () => {
            closeElementContextMenu();
            if (typeof editElementPosition === 'function') {
                editElementPosition(el);
            } else {
                // Fallback если функция не найдена
                const newX = prompt('Введите координату X (см):', Math.round(el.x/10));
                const newY = prompt('Введите координату Y (см):', Math.round(el.y/10));
                if (newX && newY && !isNaN(newX) && !isNaN(newY)) {
                    saveState();
                    el.x = parseFloat(newX) * 10;
                    el.y = parseFloat(newY) * 10;
                    draw();
                }
            }
        };
        
        // Вставляем после меню длины
        const editLengthItem = document.getElementById('menu-edit-length');
        if (editLengthItem) {
            editLengthItem.parentNode.insertBefore(positionItem, editLengthItem.nextSibling);
        } else {
            menu.querySelector('.context-menu-content').appendChild(positionItem);
        }
    } else {
        positionItem.style.display = 'block';
    }
    
    const rotateItem = document.getElementById('menu-rotate');
    if (rotateItem) {
        rotateItem.style.display = 'block';
    }
    
    menu.style.display = 'flex';
    
    const r = rooms[activeRoom];
    if (r && r.elements) {
        const index = r.elements.findIndex(e => e === el);
        if (index !== -1) {
            window.currentContextElementIndex = index;
        }
    }
}
function closeElementContextMenu() {
    document.getElementById('elementContextMenu').style.display = 'none';
    setTimeout(() => {
        selectedElement = null;
        window.currentContextElement = null;
        window.currentContextElementIndex = undefined;
    }, 100);
}

function menuEditLength() {
    closeElementContextMenu();
    if (selectedElement && selectedElement.width) {
        openElementResize(selectedElement);
    }
}

function menuRotate() {
    console.log("🔄 Вызвана функция поворота");
    
    let el = selectedElement || window.currentContextElement;
    
    if (!el) {
        if (window.currentContextElementIndex !== undefined) {
            const r = rooms[activeRoom];
            if (r && r.elements && r.elements[window.currentContextElementIndex]) {
                el = r.elements[window.currentContextElementIndex];
                console.log("✅ Нашли элемент по индексу");
            }
        }
        
        if (!el) {
            alert("Ошибка: выберите элемент заново");
            closeElementContextMenu();
            return;
        }
    }
    
    console.log("✅ Элемент найден:", el);
    
    const currentRot = el.rotation || 0;
    const newRot = prompt('Введите угол поворота (0-360°):', currentRot);
    
    if (newRot !== null) {
        const angle = parseFloat(newRot);
        if (!isNaN(angle)) {
            saveState();
            el.rotation = angle % 360;
            draw();
            console.log("✅ Элемент повёрнут на угол:", angle);
            closeElementContextMenu();
        } else {
            alert("Пожалуйста, введите число");
        }
    } else {
        closeElementContextMenu();
    }
}

function menuDelete() {
    closeElementContextMenu();
    if (selectedElement) {
        if (confirm('Удалить этот элемент?')) {
            saveState();
            const r = rooms[activeRoom];
            const index = r.elements.findIndex(el => el === selectedElement);
            if (index !== -1) {
                r.elements.splice(index, 1);
                draw();
            }
        }
    }
}

function openWallResize(wallIndex) {
    const r = rooms[activeRoom];
    const p1 = r.points[wallIndex];
    const p2 = r.points[(wallIndex + 1) % r.points.length];
    const curLen = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
    
    resizeTarget = { type: 'wall', index: wallIndex };
    
    document.getElementById('resizeModalTitle').textContent = 'Изменить длину стены';
    document.getElementById('currentLength').textContent = curLen;
    
    const slider = document.getElementById('resizeSlider');
    const input = document.getElementById('resizeInput');
    slider.value = curLen;
    input.value = curLen;
    slider.min = 10;
    slider.max = 1000;
    
    document.getElementById('resizeModal').style.display = 'block';
}

function openElementResize(el) {
    const curLen = Math.round(el.width / 10);
    
    resizeTarget = { type: 'element', element: el };
    
    document.getElementById('resizeModalTitle').textContent = 'Изменить длину элемента';
    document.getElementById('currentLength').textContent = curLen;
    
    const slider = document.getElementById('resizeSlider');
    const input = document.getElementById('resizeInput');
    slider.value = curLen;
    input.value = curLen;
    slider.min = 10;
    slider.max = 1000;
    
    document.getElementById('resizeModal').style.display = 'block';
}

function closeResizeModal() {
    document.getElementById('resizeModal').style.display = 'none';
    resizeTarget = null;
}

function applyResize() {
    const newLen = parseFloat(document.getElementById('resizeInput').value);
    if (isNaN(newLen) || newLen < 10) {
        alert('Введите корректную длину (минимум 10 см)');
        return;
    }
    
    saveState();
    
    if (resizeTarget.type === 'wall') {
        const r = rooms[activeRoom];
        const i = resizeTarget.index;
        const p1 = r.points[i];
        const p2 = r.points[(i + 1) % r.points.length];
        const nl = newLen * 10;
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const dx = Math.cos(ang) * nl - (p2.x - p1.x);
        const dy = Math.sin(ang) * nl - (p2.y - p1.y);
        
        for (let k = (i + 1) % r.points.length; k < r.points.length; k++) {
            if (k === 0 && r.closed) continue;
            r.points[k].x += dx;
            r.points[k].y += dy;
            if (k === 0) break;
        }
    } else if (resizeTarget.type === 'element') {
        resizeTarget.element.width = newLen * 10;
    }
    
    closeResizeModal();
    draw();
}

function handleElementTouchStart(el, idx, e) {
    e.preventDefault();
    e.stopPropagation();
    
    cancelLongPress();
    
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    
    touchState.dragElem = el;
    touchState.startX = touch.clientX - rect.left;
    touchState.startY = touch.clientY - rect.top;
    touchState.startElemX = el.x;
    touchState.startElemY = el.y;
    touchState.moved = false;
    
    longPressTimer = setTimeout(() => {
        if (mobileTool === 'delete') {
            if (confirm('Удалить этот элемент?')) {
                saveState();
                rooms[activeRoom].elements.splice(idx, 1);
                draw();
            }
        } else {
            selectedElement = el;
            selectedElementIndex = idx;
            showElementContextMenu(el);
        }
        longPressTimer = null;
    }, 500);
}

function handleElementTouchEnd(el, idx, e) {
    e.preventDefault();
    e.stopPropagation();
    
    cancelLongPress();
    
    if (!touchState.moved) {
        console.log("👆 Короткое нажатие на элемент, idx:", idx);
        
        if (mobileTool === 'delete') {
            if (confirm('Удалить этот элемент?')) {
                saveState();
                rooms[activeRoom].elements.splice(idx, 1);
                draw();
            }
        } else {
            selectedElement = el;
            window.currentContextElement = el;
            window.currentContextElementIndex = idx;
            showElementContextMenu(el);
        }
    }
    
    touchState.dragElem = null;
}

function handleElementTouchMove(e) {
    if (!touchState.dragElem) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    const deltaX = currentX - touchState.startX;
    const deltaY = currentY - touchState.startY;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        cancelLongPress();
        touchState.moved = true;
    }
    
    const deltaMmX = deltaX / (MM_TO_PX * scale);
    const deltaMmY = deltaY / (MM_TO_PX * scale);
    
    touchState.dragElem.x = touchState.startElemX + deltaMmX;
    touchState.dragElem.y = touchState.startElemY + deltaMmY;
    
    draw();
}
// Добавьте эти функции в конец mobile.js

function handlePointTouchStart(pointId, e) {
    e.preventDefault();
    e.stopPropagation();
    
    cancelLongPress();
    
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const point = rooms[activeRoom].points.find(p => p.id === pointId);
    
    if (!point) return;
    
    touchState.dragPoint = point;
    touchState.startX = touch.clientX - rect.left;
    touchState.startY = touch.clientY - rect.top;
    touchState.startPointX = point.x;
    touchState.startPointY = point.y;
    touchState.moved = false;
    
    selectedPointId = pointId;
    
    longPressTimer = setTimeout(() => {
        if (mobileTool === 'delete') {
            const r = rooms[activeRoom];
            const index = r.points.findIndex(p => p.id === pointId);
            if (index !== -1) {
                saveState();
                r.points.splice(index, 1);
                if (r.points.length < 3) r.closed = false;
                draw();
            }
        }
        longPressTimer = null;
    }, 500);
}

function handlePointTouchEnd(pointId, e) {
    e.preventDefault();
    e.stopPropagation();
    
    cancelLongPress();
    touchState.dragPoint = null;
    selectedPointId = null;
}

function handlePointTouchMove(e) {
    if (!touchState.dragPoint) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = svg.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    const deltaX = currentX - touchState.startX;
    const deltaY = currentY - touchState.startY;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        cancelLongPress();
        touchState.moved = true;
    }
    
    const deltaMmX = deltaX / (MM_TO_PX * scale);
    const deltaMmY = deltaY / (MM_TO_PX * scale);
    
    touchState.dragPoint.x = snap(touchState.startPointX + deltaMmX);
    touchState.dragPoint.y = snap(touchState.startPointY + deltaMmY);
    
    draw();
}

// Экспортируем новые функции
window.handlePointTouchStart = handlePointTouchStart;
window.handlePointTouchEnd = handlePointTouchEnd;
window.handlePointTouchMove = handlePointTouchMove;

// Экспорт
window.isMobile = isMobile;
window.mobileTool = mobileTool;
window.initMobileHandlers = initMobileHandlers;
window.setMobileTool = setMobileTool;
window.closeAddElementMenu = closeAddElementMenu;
window.addMobileElement = addMobileElement;
window.closeElementContextMenu = closeElementContextMenu;
window.menuEditLength = menuEditLength;
window.menuRotate = menuRotate;
window.menuDelete = menuDelete;
window.openWallResize = openWallResize;
window.openElementResize = openElementResize;
window.closeResizeModal = closeResizeModal;
window.applyResize = applyResize;
window.handleElementTouchStart = handleElementTouchStart;
window.handleElementTouchEnd = handleElementTouchEnd;

window.handleElementTouchMove = handleElementTouchMove;


