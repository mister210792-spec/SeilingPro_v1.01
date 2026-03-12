// core.js - ПОЛНАЯ ВЕРСИЯ

// Основные переменные
const svg = document.getElementById("canvas");
const GRID_SNAP_MM = 10; 
const LIGHT_SNAP_MM = 50; 
const MM_TO_PX = 3.78;

let scale = 0.18;
let offsetX = 100;
let offsetY = 100;
let rooms = [];
let activeRoom = 0;
let dragId = null;
let dragElem = null;
let isPanning = false;
let startPanX, startPanY;
let mousePos = { x: 0, y: 0, shift: false };
let isHoveringFirstPoint = false;
let currentTool = 'draw';
let showDiagonals = true;
let showMeasures = true;
let history = [];
let selectedElementForEdit = null;
// Флаг для пропуска модального окна (будет использоваться из projects.js)
window.skipRoomTypeModal = false;
// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

function saveState() {
    if (history.length > 50) history.shift();
    history.push(JSON.stringify(rooms));
}

function undo() {
    if (history.length > 0) {
        rooms = JSON.parse(history.pop());
        if (activeRoom >= rooms.length) activeRoom = Math.max(0, rooms.length - 1);
        renderTabs();
        draw();
    }
}

function setTool(tool) {
    currentTool = (currentTool === tool) ? 'draw' : tool;
    document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool);
    if (btn && currentTool !== 'draw') btn.classList.add('active');
}

function toggleDiagonals() {
    showDiagonals = !showDiagonals;
    document.getElementById("toggleDiags").classList.toggle("btn-toggle-active", showDiagonals);
    draw();
}

function toggleMeasures() {
    showMeasures = !showMeasures;
    document.getElementById("toggleMeasures").classList.toggle("btn-toggle-active", showMeasures);
    draw();
}

function renameRoom() {
    let r = rooms[activeRoom];
    let newName = prompt("Введите название помещения:", r.name);
    if (newName) {
        saveState();
        r.name = newName;
        renderTabs();
        updateStats();
    }
}

function mmToPx(mm, axis) {
    return axis === 'x' ? (mm * MM_TO_PX * scale) + offsetX : (mm * MM_TO_PX * scale) + offsetY;
}

function pxToMm(px, axis) {
    return axis === 'x' ? (px - offsetX) / (MM_TO_PX * scale) : (px - offsetY) / (MM_TO_PX * scale);
}

function snap(mm, firstMm = null, step = GRID_SNAP_MM) {
    if (firstMm !== null && Math.abs(mm - firstMm) < 50) return firstMm;
    return Math.round(mm / step) * step;
}

function getSnappedPos(mx, my, currentEl = null) {
    let r = rooms[activeRoom];
    let fx = snap(mx, null, LIGHT_SNAP_MM);
    let fy = snap(my, null, LIGHT_SNAP_MM);
    if (r.elements) {
        r.elements.forEach(el => {
            if (el === currentEl) return;
            if (Math.abs(fx - el.x) < 80) fx = el.x;
            if (Math.abs(fy - el.y) < 80) fy = el.y;
        });
    }
    return { x: fx, y: fy };
}

function drawGrid() {
    const s100 = 100 * MM_TO_PX * scale; 
    if (s100 > 5) {
        for (let x = offsetX % s100; x < svg.clientWidth; x += s100) {
            svg.appendChild(createLine(x, 0, x, svg.clientHeight, "#f1f1f1", 0.5));
        }
        for (let y = offsetY % s100; y < svg.clientHeight; y += s100) {
            svg.appendChild(createLine(0, y, svg.clientWidth, y, "#f1f1f1", 0.5));
        }
    }
}

function createLine(x1, y1, x2, y2, c, w, d) {
    let l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", x1);
    l.setAttribute("y1", y1);
    l.setAttribute("x2", x2);
    l.setAttribute("y2", y2);
    l.setAttribute("stroke", c);
    l.setAttribute("stroke-width", w);
    if (d) l.setAttribute("stroke-dasharray", d);
    return l;
}

function renderText(x, y, txt, cls) {
    let t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.setAttribute("class", cls);
    t.textContent = txt;
    svg.appendChild(t);
    return t;
}

// ========== ПОЛНАЯ ФУНКЦИЯ DRAW ==========

function draw(isExport = false) {
    updateZoomLevel();
    svg.innerHTML = "";
    if (!isExport) drawGrid();
    
    let r = rooms[activeRoom];
    if (!r) return;
    
    if (r.closed && r.points.length > 3 && showDiagonals) {
        for (let i = 0; i < r.points.length; i++) {
            for (let j = i + 2; j < r.points.length; j++) {
                if (i === 0 && j === r.points.length - 1) continue;
                let p1 = r.points[i], p2 = r.points[j];
                svg.appendChild(createLine(mmToPx(p1.x, 'x'), mmToPx(p1.y, 'y'), mmToPx(p2.x, 'x'), mmToPx(p2.y, 'y'), "rgba(142, 68, 173, 0.15)", 1, "4,4"));
                let d = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
                renderText(mmToPx((p1.x+p2.x)/2, 'x'), mmToPx((p1.y+p2.y)/2, 'y'), d, "diag-label");
            }
        }
    }
    
    if (r.points.length > 0) {
        let pts = r.points.map(p => `${mmToPx(p.x, 'x')},${mmToPx(p.y, 'y')}`).join(" ");
        let poly = document.createElementNS("http://www.w3.org/2000/svg", r.closed ? "polygon" : "polyline");
        poly.setAttribute("points", pts);
        poly.setAttribute("fill", r.closed ? "rgba(0,188,212,0.05)" : "none");
        poly.setAttribute("stroke", "#2c3e50");
        poly.setAttribute("stroke-width", 2.5);
        svg.appendChild(poly);
        
        r.points.forEach((p, i) => {
            if (!r.closed && i === r.points.length - 1) return;
            let pNext = r.points[(i + 1) % r.points.length];
            let d = Math.round(Math.sqrt((pNext.x-p.x)**2 + (pNext.y-p.y)**2)/10);
            if (d > 0) {
                let txt = renderText(mmToPx((p.x+pNext.x)/2, 'x'), mmToPx((p.y+pNext.y)/2, 'y'), d + " см", "length-label");
                if (!isExport && window.isMobile) {
                    txt.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openWallResize(i);
                    }, { passive: false });
                } else if (!isExport) {
                    txt.onclick = () => resizeWall(i);
                }
            }
        });
    }
    
    // Умный луч для десктопа - отображение размера при рисовании
    if (r.points.length > 0 && !r.closed && !dragId && !dragElem && !isExport && currentTool === 'draw' && !window.isMobile) {
        let last = r.points[r.points.length - 1];
        let first = r.points[0];
        let rawX = pxToMm(mousePos.x, 'x');
        let rawY = pxToMm(mousePos.y, 'y');
        let sX = snap(rawX, first ? first.x : null);
        let sY = snap(rawY, first ? first.y : null);
        
        if (!mousePos.shift) {
            if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
                sY = last.y;
            } else {
                sX = last.x;
            }
        }
        
        isHoveringFirstPoint = (r.points.length >= 3 && first && 
            Math.sqrt((mousePos.x - mmToPx(first.x, 'x'))**2 + 
                      (mousePos.y - mmToPx(first.y, 'y'))**2) < 25);
        
        svg.appendChild(createLine(
            mmToPx(last.x, 'x'), mmToPx(last.y, 'y'),
            mmToPx(sX, 'x'), mmToPx(sY, 'y'),
            isHoveringFirstPoint ? "var(--success)" : "var(--primary)",
            2, "6,4"
        ));
        
        if (first && (Math.abs(sX - first.x) < 2 || Math.abs(sY - first.y) < 2)) {
            svg.appendChild(createLine(
                mmToPx(first.x, 'x'), mmToPx(first.y, 'y'),
                mmToPx(sX, 'x'), mmToPx(sY, 'y'),
                "#bbb", 1, "4,4"
            ));
        }
        
        let dist = Math.round(Math.sqrt((sX - last.x)**2 + (sY - last.y)**2) / 10);
        if (dist > 0) {
            renderText(
                mmToPx((last.x + sX)/2, 'x'),
                mmToPx((last.y + sY)/2, 'y') - 10,
                dist + " см",
                "live-label"
            );
        }
    }
    
   if (r.elements) {
    r.elements.forEach((el, idx) => {
        let def = getElementDef(el.subtype);
        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Добавляем подсветку для выбранного элемента
        if (el === selectedElementForEdit) {
            // Рисуем рамку вокруг элемента
            let bbox = { x: el.x, y: el.y, width: el.width || 200 };
            let padding = 50; // 5 см в мм
            
            let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", mmToPx(el.x - (bbox.width/2) - padding, 'x'));
            rect.setAttribute("y", mmToPx(el.y - padding, 'y'));
            rect.setAttribute("width", mmToPx(bbox.width + padding*2, 'x') - mmToPx(el.x - (bbox.width/2) - padding, 'x'));
            rect.setAttribute("height", mmToPx(padding*2, 'y') - mmToPx(0, 'y'));
            rect.setAttribute("fill", "none");
            rect.setAttribute("stroke", "var(--primary)");
            rect.setAttribute("stroke-width", "2");
            rect.setAttribute("stroke-dasharray", "5,5");
            svg.appendChild(rect);
        }
        
        g.setAttribute("transform", `rotate(${el.rotation || 0}, ${mmToPx(el.x, 'x')}, ${mmToPx(el.y, 'y')})`);
            
            const isLinear = def.type === 'linear' || el.type === 'rail';
            
            if (r.closed && showMeasures) drawElementMeasures(el, r);
            
          if (isLinear) {
    let w = el.width || 2000;
    let color = el.type === 'rail' ? "#fb8c00" : (el.subtype === 'TRACK' ? "#333" : "var(--light)");
    let line = createLine(mmToPx(el.x - w/2, 'x'), mmToPx(el.y, 'y'), mmToPx(el.x + w/2, 'x'), mmToPx(el.y, 'y'), color, 5);
    line.setAttribute("stroke-linecap", "round");
    g.appendChild(line);
    
    // Создаем подпись с размером
    let label = renderText(mmToPx(el.x, 'x'), mmToPx(el.y, 'y') - 10, `${w/10} см`, el.type === 'rail' ? "rail-label" : "light-label");
    
    // Добавляем обработчик клика для изменения размера
    if (!isExport) {
        label.style.cursor = 'pointer';
        label.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Запоминаем текущий элемент
            window.currentResizeElement = el;
            
            // Показываем диалог ввода размера
            const currentLength = w / 10; // в см
            const newLength = prompt(`Введите длину элемента (см):`, currentLength);
            
            if (newLength && !isNaN(newLength) && parseFloat(newLength) > 0) {
                saveState();
                el.width = parseFloat(newLength) * 10;
                draw();
                
                // Показываем уведомление
                if (typeof showNotification === 'function') {
                    showNotification(`✅ Длина изменена на ${newLength} см`);
                }
            }
        };
        
        // Добавляем подсказку при наведении
        label.title = 'Нажмите, чтобы изменить длину';
    }
    
    g.appendChild(label);
} 
         // В функции draw(), найдите блок else для нелинейных элементов
// и добавьте обработчик клика на сам элемент

else {
    let symbol = drawSymbol(el, def);
    g.appendChild(symbol);
    
    // Добавляем возможность редактировать размер для элементов, у которых есть размер
    if (!isExport && el.width) {
        g.style.cursor = 'pointer';
        g.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            window.currentResizeElement = el;
            const currentSize = el.width / 10; // в см
            
            const newSize = prompt(`Введите размер элемента (см):`, currentSize);
            if (newSize && !isNaN(newSize) && parseFloat(newSize) > 0) {
                saveState();
                el.width = parseFloat(newSize) * 10;
                draw();
                
                if (typeof showNotification === 'function') {
                    showNotification(`✅ Размер изменен на ${newSize} см`);
                }
            }
        };
        g.title = 'Нажмите, чтобы изменить размер';
    }
}
            
         if (!isExport) {
    if (window.isMobile) {
        // Мобильная версия - долгое нажатие для выбора
        g.addEventListener('touchstart', (e) => handleElementTouchStart(el, idx, e), { passive: false });
        g.addEventListener('touchend', (e) => handleElementTouchEnd(el, idx, e), { passive: false });
        g.addEventListener('touchmove', handleElementTouchMove, { passive: false });
        g.addEventListener('touchcancel', cancelLongPress, { passive: false });
    } else {
        // Десктоп версия - добавляем выбор элемента
        g.style.cursor = 'pointer';
        g.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Если зажат Ctrl, то выбираем элемент для редактирования
            if (e.ctrlKey) {
                selectElementForEdit(el);
            } else {
                // Обычное перетаскивание
                if (e.altKey) {
                    saveState();
                    let copy = JSON.parse(JSON.stringify(el));
                    r.elements.push(copy);
                    dragElem = copy;
                } else {
                    saveState();
                    dragElem = el;
                }
            }
        };
        
        g.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveState();
            r.elements.splice(idx, 1);
            draw();
        };
    }
}
            svg.appendChild(g);
        });
    }
    
    if (!isExport) {
        r.points.forEach((p, i) => {
            let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", mmToPx(p.x, 'x'));
            c.setAttribute("cy", mmToPx(p.y, 'y'));
            c.setAttribute("r", selectedPointId === p.id ? 8 : 5);
            c.setAttribute("fill", selectedPointId === p.id ? "var(--primary)" : "white");
            c.setAttribute("stroke", "#e74c3c");
            c.setAttribute("stroke-width", 2);
            
            if (window.isMobile) {
                c.addEventListener('touchstart', (e) => handlePointTouchStart(p.id, e), { passive: false });
                c.addEventListener('touchend', (e) => handlePointTouchEnd(p.id, e), { passive: false });
                c.addEventListener('touchmove', handlePointTouchMove, { passive: false });
                c.addEventListener('touchcancel', cancelLongPress, { passive: false });
            } else {
                c.onmousedown = (e) => {
                    e.stopPropagation();
                    if (currentTool === 'draw') {
                        saveState();
                        dragId = p.id;
                    }
                };
                c.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveState();
                    r.points.splice(i, 1);
                    if (r.points.length < 3) r.closed = false;
                    draw();
                };
            }
            svg.appendChild(c);
        });
    }
    
    updateStats();
}

function drawSymbol(el, def) {
    let cx = mmToPx(el.x, 'x'), cy = mmToPx(el.y, 'y');
    let s = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    if (el.subtype === 'GX53') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="black" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="black"/>`;
        return s;
    }
    if (el.subtype === 'CHANDELIER') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="10" fill="white" stroke="black" stroke-width="1.5"/><path d="M${cx-7} ${cy} L${cx+7} ${cy} M${cx} ${cy-7} L${cx} ${cy+7} M${cx-5} ${cy-5} L${cx+5} ${cy+5} M${cx+5} ${cy-5} L${cx-5} ${cy+5}" stroke="black" stroke-width="1"/>`;
        return s;
    }
    if (el.subtype === 'FIRE_ALARM') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="#ff5252" stroke-width="2"/><path d="M${cx-4} ${cy-4} L${cx+4} ${cy+4} M${cx+4} ${cy-4} L${cx-4} ${cy+4}" stroke="#ff5252" stroke-width="1.5"/>`;
        return s;
    }
    if (el.type === 'pipe') {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="6" fill="#9e9e9e" stroke="black" stroke-width="1"/><path d="M${cx-3} ${cy-3} L${cx+3} ${cy+3}" stroke="white" stroke-width="1"/>`;
        return s;
    }
    
    let shape = def.shape || 'circle';
    let fill = def.type === 'service' ? '#e0f7fa' : 'white';
    let stroke = '#2c3e50';
    
    if (def.type === 'service') {
        s.innerHTML = `<path d="M${cx} ${cy-10} L${cx+2} ${cy-3} L${cx+9} ${cy-3} L${cx+3} ${cy+2} L${cx+5} ${cy+9} L${cx} ${cy+5} L${cx-5} ${cy+9} L${cx-3} ${cy+2} L${cx-9} ${cy-3} L${cx-2} ${cy-3} Z" fill="#ffd700" stroke="#f57f17" stroke-width="1"/>`;
        return s;
    }
    
    if (shape === 'square') {
        s.innerHTML = `<rect x="${cx-9}" y="${cy-9}" width="18" height="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (shape === 'triangle') {
        s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+9},${cy+8} ${cx-9},${cy+8}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    } else if (shape === 'diamond') {
        s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+10},${cy} ${cx},${cy+10} ${cx-10},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    } else {
        s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2" fill="${stroke}"/>`;
    }
    return s;
}

function drawElementMeasures(el, room) {
    let def = getElementDef(el.subtype);
    const isLinear = def.type === 'linear' || el.type === 'rail';
    let anchorPoints = [];
    
    if (isLinear) {
        let w = (el.width || 2000) / 2;
        let rad = (el.rotation || 0) * Math.PI / 180;
        anchorPoints.push({ x: el.x - w * Math.cos(rad), y: el.y - w * Math.sin(rad) });
        anchorPoints.push({ x: el.x + w * Math.cos(rad), y: el.y + w * Math.sin(rad) });
    } else {
        anchorPoints.push({ x: el.x, y: el.y });
    }
    
    anchorPoints.forEach(pt => {
        let dists = [];
        for (let i = 0; i < room.points.length; i++) {
            let p1 = room.points[i];
            let p2 = room.points[(i + 1) % room.points.length];
            if (Math.abs(p1.x - p2.x) < 1 && pt.y >= Math.min(p1.y, p2.y) && pt.y <= Math.max(p1.y, p2.y)) {
                dists.push({ axis: 'x', val: p1.x, d: Math.abs(pt.x - p1.x), pt: pt });
            } else if (Math.abs(p1.y - p2.y) < 1 && pt.x >= Math.min(p1.x, p2.x) && pt.x <= Math.max(p1.x, p2.x)) {
                dists.push({ axis: 'y', val: p1.y, d: Math.abs(pt.y - p1.y), pt: pt });
            }
        }
        
        let bX = dists.filter(d => d.axis === 'x').sort((a, b) => a.d - b.d)[0];
        let bY = dists.filter(d => d.axis === 'y').sort((a, b) => a.d - b.d)[0];
        
        if (bX) {
            svg.appendChild(createLine(mmToPx(bX.pt.x, 'x'), mmToPx(bX.pt.y, 'y'), mmToPx(bX.val, 'x'), mmToPx(bX.pt.y, 'y'), "var(--danger)", 0.8, "2,2"));
            renderText(mmToPx(bX.pt.x + (bX.val > bX.pt.x ? 100 : -100), 'x'), mmToPx(bX.pt.y, 'y') - 5, Math.round(bX.d / 10) + " см", "measure-label");
        }
        if (bY) {
            svg.appendChild(createLine(mmToPx(bY.pt.x, 'x'), mmToPx(bY.pt.y, 'y'), mmToPx(bY.pt.x, 'x'), mmToPx(bY.val, 'y'), "var(--danger)", 0.8, "2,2"));
            renderText(mmToPx(bY.pt.x, 'x') + 15, mmToPx(bY.pt.y + (bY.val > bY.pt.y ? 100 : -100), 'y'), Math.round(bY.d / 10) + " см", "measure-label");
        }
    });
}

// ========== ОБРАБОТЧИКИ МЫШИ ==========

svg.onmousemove = (e) => {
    if (window.isMobile) return;
    const rect = svg.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    mousePos.shift = e.shiftKey;
    
    if (isPanning) {
        offsetX = e.clientX - startPanX;
        offsetY = e.clientY - startPanY;
        draw();
        return;
    }
    if (dragId) {
        let p = rooms[activeRoom].points.find(pt => pt.id === dragId);
        if (p) {
            p.x = snap(pxToMm(mousePos.x, 'x'));
            p.y = snap(pxToMm(mousePos.y, 'y'));
            draw();
            drawSmartGuides(p.x, p.y, dragId);
        }
        return;
    }
    if (dragElem) {
        let s = getSnappedPos(pxToMm(mousePos.x, 'x'), pxToMm(mousePos.y, 'y'), dragElem);
        dragElem.x = s.x;
        dragElem.y = s.y;
        draw();
        drawSmartGuides(dragElem.x, dragElem.y, null);
        return;
    }
    draw();
};

svg.onmousedown = (e) => {
    if (window.isMobile) return;
    if (e.target === svg && currentTool === 'draw') {
        isPanning = true;
        startPanX = e.clientX - offsetX;
        startPanY = e.clientY - offsetY;
    }
};

window.onmouseup = () => {
    if (window.isMobile) return;
    isPanning = false;
    dragId = null;
    dragElem = null;
};

svg.onclick = (e) => {
    if (window.isMobile) return;
    if (isPanning) return;
    
    let r = rooms[activeRoom];
    if (!r) return;
    
    let rect = svg.getBoundingClientRect();
    let mmX = pxToMm(e.clientX - rect.left, 'x');
    let mmY = pxToMm(e.clientY - rect.top, 'y');
    
    if (currentTool !== 'draw') {
        saveState();
        if (!r.elements) r.elements = [];
        
        let sub;
        if (currentTool === 'light') sub = document.getElementById("lightTypeSelector").value;
        else if (currentTool === 'rail') sub = document.getElementById("railTypeSelector").value;
        else if (currentTool === 'extra') sub = document.getElementById("extraTypeSelector").value;
        else if (currentTool === 'pipe') sub = 'pipe';
        
        let s = getSnappedPos(mmX, mmY);
        let def = getElementDef(sub);
        
        let newEl = {
            type: currentTool === 'pipe' ? 'pipe' : currentTool,
            subtype: sub,
            x: s.x,
            y: s.y,
            rotation: 0
        };
        
        const isLinear = def.type === 'linear' || currentTool === 'rail' || currentTool === 'pipe';
        if (isLinear) {
            let dl = prompt("Длина (см):", "200");
            newEl.width = (parseFloat(dl) * 10) || 2000;
        }
        
        r.elements.push(newEl);
        draw();
        return;
    }
    
    if (r.closed || dragId) return;
    
    let first = r.points[0];
    if (r.points.length >= 3 && first) {
        let firstXpx = mmToPx(first.x, 'x');
        let firstYpx = mmToPx(first.y, 'y');
        if (Math.sqrt((e.clientX - rect.left - firstXpx)**2 + (e.clientY - rect.top - firstYpx)**2) < 25) {
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
    if (last && !e.shiftKey) {
        if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
            sY = last.y;
        } else {
            sX = last.x;
        }
    }
    
    r.points.push({ id: Date.now() + Math.random(), x: sX, y: sY });
    draw();
};

svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    
    if (e.shiftKey) {
        let r = rooms[activeRoom];
        let mmX = pxToMm(mousePos.x, 'x');
        let mmY = pxToMm(mousePos.y, 'y');
        let target = r.elements?.find(el => Math.sqrt((el.x-mmX)**2 + (el.y-mmY)**2) < 200);
        if (target) {
            target.rotation = (target.rotation || 0) + (e.deltaY > 0 ? 1 : -1);
            draw();
            return;
        }
    }
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    offsetX = x - (x - offsetX) * delta;
    offsetY = y - (y - offsetY) * delta;
    scale *= delta;
    draw();
}, { passive: false });

// ========== ФУНКЦИИ РАБОТЫ С КОМНАТАМИ ==========

function addRoom() {
    if(window.currentUser && window.currentUser.plan === 'free' && rooms.length >= 1) {
        alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
        return;
    }
    saveState();
    
    rooms.push({
        name: "Полотно " + (rooms.length + 1),
        points: [],
        id: Date.now(),
        closed: false,
        elements: []
    });
    
    activeRoom = rooms.length - 1;
    renderTabs();
    draw();
}

function removeRoom(idx, e) {
    e.stopPropagation();
    if (confirm("Удалить это помещение?")) {
        saveState();
        rooms.splice(idx, 1);
        activeRoom = Math.max(0, activeRoom - 1);
        if (rooms.length === 0) addRoom();
        renderTabs();
        draw();
    }
}

function renderTabs() {
    const tabs = document.getElementById("tabs");
    tabs.innerHTML = "";
    rooms.forEach((r, i) => {
        let t = document.createElement("div");
        t.className = "tab" + (i === activeRoom ? " active" : "");
        t.innerHTML = `${r.name} <span class="close-tab" onclick="removeRoom(${i}, event)">×</span>`;
        t.onclick = () => {
            activeRoom = i;
            renderTabs();
            draw();
        };
        tabs.appendChild(t);
    });
    
    updateZoomLevel();
}

// ========== ФУНКЦИИ ЗУМА ==========

function updateZoomLevel() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = Math.round(scale * 100) + '%';
    }
}

function zoomIn() {
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let newScale = Math.min(scale * 1.2, 3.0);
    
    if (newScale !== scale) {
        offsetX = centerX - (centerX - offsetX) * (newScale / scale);
        offsetY = centerY - (centerY - offsetY) * (newScale / scale);
        scale = newScale;
        updateZoomLevel();
        draw();
    }
}

function zoomOut() {
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let newScale = scale * 0.8;
    
    offsetX = centerX - (centerX - offsetX) * (newScale / scale);
    offsetY = centerY - (centerY - offsetY) * (newScale / scale);
    scale = newScale;
    updateZoomLevel();
    draw();
}

function resetView() {
    scale = 0.18;
    offsetX = 100;
    offsetY = 100;
    updateZoomLevel();
    draw();
}

function setScaleFor5x5() {
    const roomWidth = 5000;
    const roomHeight = 5000;
    
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (containerWidth === 0 || containerHeight === 0) {
        console.log("⚠️ Контейнер еще не загружен, пробуем позже");
        setTimeout(() => setScaleFor5x5(), 50);
        return;
    }
    
    const roomWidthPx = roomWidth * MM_TO_PX;
    const roomHeightPx = roomHeight * MM_TO_PX;
    
    const scaleX = (containerWidth * 0.8) / roomWidthPx;
    const scaleY = (containerHeight * 0.8) / roomHeightPx;
    
    let newScale = Math.min(scaleX, scaleY);
    scale = Math.max(0.1, Math.min(1.0, newScale));
    
    offsetX = containerWidth / 2;
    offsetY = containerHeight / 2;
    
    updateZoomLevel();
    console.log("📐 Масштаб установлен для 5x5 метров:", scale.toFixed(3));
}

function centerView() {
    const r = rooms[activeRoom];
    if (!r || r.points.length === 0) return;
    
    let minX = Math.min(...r.points.map(p => p.x));
    let maxX = Math.max(...r.points.map(p => p.x));
    let minY = Math.min(...r.points.map(p => p.y));
    let maxY = Math.max(...r.points.map(p => p.y));
    
    const padding = 500;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const container = document.getElementById('canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const scaleX = (containerWidth * 0.9) / (width * MM_TO_PX);
    const scaleY = (containerHeight * 0.9) / (height * MM_TO_PX);
    scale = Math.min(scaleX, scaleY);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    offsetX = containerWidth / 2 - centerX * MM_TO_PX * scale;
    offsetY = containerHeight / 2 - centerY * MM_TO_PX * scale;
    
    updateZoomLevel();
    draw();
}

// ========== ФУНКЦИИ СТАТИСТИКИ ==========

function updateStats() {
    let listHTML = "";
    let totalArea = 0;
    let totalPerim = 0;
    let totalElemCounts = {};
    
    rooms.forEach((r, idx) => {
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length;
            p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        let ra = r.closed ? Math.abs(a/2)/1000000 : 0;
        totalArea += ra;
        totalPerim += (p/1000);
        
        if (idx === activeRoom) {
            document.getElementById("roomTitle").innerText = r.name;
            document.getElementById("currentArea").innerText = ra.toFixed(2) + " м²";
            document.getElementById("currentPerim").innerText = (p/1000).toFixed(2) + " м";
            
            if (r.elements?.length > 0) {
                let counts = {};
                r.elements.forEach(el => {
                    let name = el.type === 'pipe' ? 'Обвод трубы' : (window.LIGHT_DATA[el.subtype]?.label || window.EXTRA_DATA[el.subtype]?.label || window.RAIL_DATA[el.subtype]?.label || el.subtype);
                    let key = el.width ? `${name} (${el.width/10} см)` : name;
                    counts[key] = (counts[key] || 0) + 1;
                });
                for (let k in counts) {
                    listHTML += `<div class="estimate-item"><span>${k}</span> <span class="estimate-qty">${counts[k]} шт.</span></div>`;
                }
            } else {
                listHTML = "Нет элементов";
            }
        }
        
        r.elements?.forEach(el => {
            let name = el.type === 'pipe' ? 'Обвод трубы' : (window.LIGHT_DATA[el.subtype]?.label || window.EXTRA_DATA[el.subtype]?.label || window.RAIL_DATA[el.subtype]?.label || el.subtype);
            let key = el.width ? `${name} (${el.width/10} см)` : name;
            totalElemCounts[key] = (totalElemCounts[key] || 0) + 1;
        });
    });
    
    document.getElementById("elementsList").innerHTML = listHTML;
    document.getElementById("totalArea").innerText = totalArea.toFixed(2) + " м²";
    document.getElementById("totalPerim").innerText = totalPerim.toFixed(2) + " м";
    
    let teH = "";
    for (let n in totalElemCounts) {
        teH += `${n}: ${totalElemCounts[n]} шт. | `;
    }
    document.getElementById("totalElements").innerText = teH || "Нет элементов";
    
    return totalElemCounts;
}

// В файле core.js - обновим generateFullEstimate для работы с двумя прайсами

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
        
        // Детали по полотну (из первого прайса)
        const canvasType = r.materials?.canvasType || 'pvc_matte';
        const canvasPrice = window.CANVAS_TYPES?.[canvasType]?.basePrice || 400;
        canvasDetails.push({
            roomName: r.name,
            canvasType: window.CANVAS_TYPES?.[canvasType]?.label || 'ПВХ Матовый',
            area: roomArea,
            price: canvasPrice,
            cost: roomArea * canvasPrice
        });
        
        // Детали по профилям (из первого прайса)
        if (r.materials?.wallProfiles) {
            for (let i = 0; i < r.points.length; i++) {
                const p1 = r.points[i];
                const p2 = r.points[(i + 1) % r.points.length];
                const wallLength = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2) / 1000;
                const profileType = r.materials.wallProfiles[i] || 'wall_standard';
                const profilePrice = window.PROFILE_TYPES?.[profileType]?.basePrice || 180;
                
                profileDetails.push({
                    roomName: r.name,
                    wallIndex: i+1,
                    profileType: window.PROFILE_TYPES?.[profileType]?.label || 'Стеновой',
                    length: wallLength,
                    price: profilePrice,
                    cost: wallLength * profilePrice
                });
            }
        }
        
        // Элементы (из второго прайса)
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
    
    // Элементы (из второго прайса)
    for (let key in globalElements) {
        let data = globalElements[key];
        let def = getElementDef(key);
        
        let price = window.prices?.[key] || 0;
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
function mirrorRoom() {
    saveState();
    let r = rooms[activeRoom];
    if (!r || r.points.length === 0) return;
    let minX = Math.min(...r.points.map(p => p.x));
    let maxX = Math.max(...r.points.map(p => p.x));
    let mid = (minX + maxX) / 2;
    r.points.forEach(p => { p.x = mid - (p.x - mid); });
    if (r.elements) {
        r.elements.forEach(el => {
            el.x = mid - (el.x - mid);
            if (el.rotation) el.rotation = -el.rotation;
        });
    }
    draw();
}

function exportImage() {
    draw(true);
    let svgData = new XMLSerializer().serializeToString(svg);
    let canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth * 2;
    canvas.height = svg.clientHeight * 2;
    let ctx = canvas.getContext("2d");
    let img = new Image();
    
    img.onload = () => {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        let a = document.createElement("a");
        a.download = "plan.png";
        a.href = canvas.toDataURL();
        a.click();
        draw();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

function resizeWall(i) {
    let r = rooms[activeRoom];
    let p1 = r.points[i];
    let p2 = r.points[(i + 1) % r.points.length];
    let curLen = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
    let n = prompt("Новая длина стены (см):", curLen);
    
    if (n && !isNaN(n)) {
        saveState();
        let nl = n * 10;
        let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let dx = Math.cos(ang) * nl - (p2.x - p1.x);
        let dy = Math.sin(ang) * nl - (p2.y - p1.y);
        
        for (let k = (i + 1) % r.points.length; k < r.points.length; k++) {
            if (k === 0 && r.closed) continue;
            r.points[k].x += dx;
            r.points[k].y += dy;
            if (k === 0) break;
        }
        draw();
    }
}
// Добавьте в core.js после функции resizeWall

function openElementResizeWithWalls(el) {
    const r = rooms[activeRoom];
    if (!r || !r.closed) {
        alert("Сначала замкните контур помещения");
        return;
    }
    
    // Находим ближайшие стены для элемента
    const walls = findNearestWalls(el, r);
    
    // Сохраняем текущие размеры
    const currentLength = Math.round(el.width / 10); // в см
    const currentX = Math.round(el.x / 10); // в см
    const currentY = Math.round(el.y / 10); // в см
    
    // Создаем модальное окно
    const modalHtml = `
        <div id="elementResizeModal" class="modal" style="display: block; z-index: 7000;">
            <div class="modal-content" style="width: 450px; max-width: 95%;">
                <h3 style="margin-top: 0; color: var(--dark);">✏️ Редактирование элемента</h3>
                
                <div style="margin-bottom: 20px;">
                    <p><strong>Элемент:</strong> ${getElementDef(el.subtype)?.label || el.subtype}</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">📏 Длина элемента</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="elem-length-slider" min="10" max="500" value="${currentLength}" step="5" style="flex: 1;">
                        <input type="number" id="elem-length-input" value="${currentLength}" min="10" max="500" style="width: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                        <span>см</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">📐 Позиция относительно стен</h4>
                    
                    ${walls.leftWall !== null ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>От левой стены:</span>
                            <span id="left-wall-distance">${Math.round(walls.leftWall.distance / 10)} см</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="range" id="left-wall-slider" min="0" max="${Math.round(walls.rightWall?.distance / 10 || 500)}" value="${Math.round(walls.leftWall.distance / 10)}" step="5" style="flex: 1;">
                            <input type="number" id="left-wall-input" value="${Math.round(walls.leftWall.distance / 10)}" min="0" max="${Math.round(walls.rightWall?.distance / 10 || 500)}" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <span>см</span>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${walls.topWall !== null ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>От верхней стены:</span>
                            <span id="top-wall-distance">${Math.round(walls.topWall.distance / 10)} см</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="range" id="top-wall-slider" min="0" max="${Math.round(walls.bottomWall?.distance / 10 || 500)}" value="${Math.round(walls.topWall.distance / 10)}" step="5" style="flex: 1;">
                            <input type="number" id="top-wall-input" value="${Math.round(walls.topWall.distance / 10)}" min="0" max="${Math.round(walls.bottomWall?.distance / 10 || 500)}" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <span>см</span>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${walls.rightWall !== null ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>От правой стены:</span>
                            <span id="right-wall-distance">${Math.round(walls.rightWall.distance / 10)} см</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="range" id="right-wall-slider" min="0" max="${Math.round((walls.rightWall.maxDistance) / 10)}" value="${Math.round(walls.rightWall.distance / 10)}" step="5" style="flex: 1;">
                            <input type="number" id="right-wall-input" value="${Math.round(walls.rightWall.distance / 10)}" min="0" max="${Math.round((walls.rightWall.maxDistance) / 10)}" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <span>см</span>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${walls.bottomWall !== null ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>От нижней стены:</span>
                            <span id="bottom-wall-distance">${Math.round(walls.bottomWall.distance / 10)} см</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="range" id="bottom-wall-slider" min="0" max="${Math.round((walls.bottomWall.maxDistance) / 10)}" value="${Math.round(walls.bottomWall.distance / 10)}" step="5" style="flex: 1;">
                            <input type="number" id="bottom-wall-input" value="${Math.round(walls.bottomWall.distance / 10)}" min="0" max="${Math.round((walls.bottomWall.maxDistance) / 10)}" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                            <span>см</span>
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div style="background: #f0f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0;">🔄 Поворот элемента</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="elem-rotation-slider" min="0" max="360" value="${el.rotation || 0}" step="5" style="flex: 1;">
                        <input type="number" id="elem-rotation-input" value="${el.rotation || 0}" min="0" max="360" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                        <span>°</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid #eee; padding-top: 15px;">
                    <button onclick="applyElementResizeWithWalls()" style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 8px;">
                        Применить
                    </button>
                    <button onclick="closeElementResizeModal()" style="background: #eee; border: none; padding: 10px 20px; border-radius: 8px;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старое модальное окно
    const oldModal = document.getElementById('elementResizeModal');
    if (oldModal) oldModal.remove();
    
    // Добавляем новое
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Сохраняем элемент в глобальной переменной
    window.currentResizeElement = el;
    window.currentResizeWalls = walls;
    
    // Добавляем обработчики для слайдеров
    setupResizeEventListeners(el, walls);
}

function findNearestWalls(el, room) {
    const result = {
        leftWall: null,
        rightWall: null,
        topWall: null,
        bottomWall: null
    };
    
    // Находим все стены (отрезки между точками)
    const walls = [];
    for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i];
        const p2 = room.points[(i + 1) % room.points.length];
        
        // Определяем ориентацию стены
        if (Math.abs(p1.x - p2.x) < 1) {
            // Вертикальная стена
            walls.push({
                type: 'vertical',
                x: p1.x,
                yMin: Math.min(p1.y, p2.y),
                yMax: Math.max(p1.y, p2.y),
                p1, p2
            });
        } else if (Math.abs(p1.y - p2.y) < 1) {
            // Горизонтальная стена
            walls.push({
                type: 'horizontal',
                y: p1.y,
                xMin: Math.min(p1.x, p2.x),
                xMax: Math.max(p1.x, p2.x),
                p1, p2
            });
        }
    }
    
    // Ищем ближайшие стены
    let leftDist = Infinity, rightDist = Infinity;
    let topDist = Infinity, bottomDist = Infinity;
    
    walls.forEach(wall => {
        if (wall.type === 'vertical') {
            // Для вертикальных стен проверяем расстояние по X
            if (el.y >= wall.yMin && el.y <= wall.yMax) {
                const dist = Math.abs(el.x - wall.x);
                if (wall.x < el.x && dist < leftDist) {
                    leftDist = dist;
                    result.leftWall = {
                        wall,
                        distance: dist,
                        maxDistance: Math.abs(wall.x - (wall.x < el.x ? 10000 : -10000))
                    };
                } else if (wall.x > el.x && dist < rightDist) {
                    rightDist = dist;
                    result.rightWall = {
                        wall,
                        distance: dist,
                        maxDistance: Math.abs(wall.x - (wall.x > el.x ? -10000 : 10000))
                    };
                }
            }
        } else if (wall.type === 'horizontal') {
            // Для горизонтальных стен проверяем расстояние по Y
            if (el.x >= wall.xMin && el.x <= wall.xMax) {
                const dist = Math.abs(el.y - wall.y);
                if (wall.y < el.y && dist < topDist) {
                    topDist = dist;
                    result.topWall = {
                        wall,
                        distance: dist,
                        maxDistance: Math.abs(wall.y - (wall.y < el.y ? 10000 : -10000))
                    };
                } else if (wall.y > el.y && dist < bottomDist) {
                    bottomDist = dist;
                    result.bottomWall = {
                        wall,
                        distance: dist,
                        maxDistance: Math.abs(wall.y - (wall.y > el.y ? -10000 : 10000))
                    };
                }
            }
        }
    });
    
    return result;
}

function setupResizeEventListeners(el, walls) {
    // Длина элемента
    const lengthSlider = document.getElementById('elem-length-slider');
    const lengthInput = document.getElementById('elem-length-input');
    
    if (lengthSlider && lengthInput) {
        lengthSlider.addEventListener('input', () => {
            lengthInput.value = lengthSlider.value;
        });
        lengthInput.addEventListener('input', () => {
            lengthSlider.value = lengthInput.value;
        });
    }
    
    // Отступ от левой стены
    const leftSlider = document.getElementById('left-wall-slider');
    const leftInput = document.getElementById('left-wall-input');
    if (leftSlider && leftInput && walls.leftWall) {
        leftSlider.addEventListener('input', () => {
            leftInput.value = leftSlider.value;
            document.getElementById('left-wall-distance').textContent = leftSlider.value;
        });
        leftInput.addEventListener('input', () => {
            leftSlider.value = leftInput.value;
            document.getElementById('left-wall-distance').textContent = leftInput.value;
        });
    }
    
    // Отступ от верхней стены
    const topSlider = document.getElementById('top-wall-slider');
    const topInput = document.getElementById('top-wall-input');
    if (topSlider && topInput && walls.topWall) {
        topSlider.addEventListener('input', () => {
            topInput.value = topSlider.value;
            document.getElementById('top-wall-distance').textContent = topSlider.value;
        });
        topInput.addEventListener('input', () => {
            topSlider.value = topInput.value;
            document.getElementById('top-wall-distance').textContent = topInput.value;
        });
    }
    
    // Отступ от правой стены
    const rightSlider = document.getElementById('right-wall-slider');
    const rightInput = document.getElementById('right-wall-input');
    if (rightSlider && rightInput && walls.rightWall) {
        rightSlider.addEventListener('input', () => {
            rightInput.value = rightSlider.value;
            document.getElementById('right-wall-distance').textContent = rightSlider.value;
        });
        rightInput.addEventListener('input', () => {
            rightSlider.value = rightInput.value;
            document.getElementById('right-wall-distance').textContent = rightInput.value;
        });
    }
    
    // Отступ от нижней стены
    const bottomSlider = document.getElementById('bottom-wall-slider');
    const bottomInput = document.getElementById('bottom-wall-input');
    if (bottomSlider && bottomInput && walls.bottomWall) {
        bottomSlider.addEventListener('input', () => {
            bottomInput.value = bottomSlider.value;
            document.getElementById('bottom-wall-distance').textContent = bottomSlider.value;
        });
        bottomInput.addEventListener('input', () => {
            bottomSlider.value = bottomInput.value;
            document.getElementById('bottom-wall-distance').textContent = bottomInput.value;
        });
    }
    
    // Поворот
    const rotSlider = document.getElementById('elem-rotation-slider');
    const rotInput = document.getElementById('elem-rotation-input');
    if (rotSlider && rotInput) {
        rotSlider.addEventListener('input', () => {
            rotInput.value = rotSlider.value;
        });
        rotInput.addEventListener('input', () => {
            rotSlider.value = rotInput.value;
        });
    }
}

function applyElementResizeWithWalls() {
    const el = window.currentResizeElement;
    const walls = window.currentResizeWalls;
    if (!el) return;
    
    saveState();
    
    // Применяем новую длину
    const lengthInput = document.getElementById('elem-length-input');
    if (lengthInput) {
        el.width = parseFloat(lengthInput.value) * 10;
    }
    
    // Применяем новые отступы от стен
    if (walls.leftWall) {
        const leftInput = document.getElementById('left-wall-input');
        if (leftInput) {
            const newDist = parseFloat(leftInput.value) * 10;
            el.x = walls.leftWall.wall.x + (walls.leftWall.wall.x < el.x ? newDist : -newDist);
        }
    }
    
    if (walls.topWall) {
        const topInput = document.getElementById('top-wall-input');
        if (topInput) {
            const newDist = parseFloat(topInput.value) * 10;
            el.y = walls.topWall.wall.y + (walls.topWall.wall.y < el.y ? newDist : -newDist);
        }
    }
    
    if (walls.rightWall) {
        const rightInput = document.getElementById('right-wall-input');
        if (rightInput) {
            const newDist = parseFloat(rightInput.value) * 10;
            el.x = walls.rightWall.wall.x - (walls.rightWall.wall.x > el.x ? newDist : -newDist);
        }
    }
    
    if (walls.bottomWall) {
        const bottomInput = document.getElementById('bottom-wall-input');
        if (bottomInput) {
            const newDist = parseFloat(bottomInput.value) * 10;
            el.y = walls.bottomWall.wall.y - (walls.bottomWall.wall.y > el.y ? newDist : -newDist);
        }
    }
    
    // Применяем поворот
    const rotInput = document.getElementById('elem-rotation-input');
    if (rotInput) {
        el.rotation = parseFloat(rotInput.value) % 360;
    }
    
    closeElementResizeModal();
    draw();
    
    if (typeof showNotification === 'function') {
        showNotification('✅ Элемент обновлен');
    }
}

function closeElementResizeModal() {
    const modal = document.getElementById('elementResizeModal');
    if (modal) modal.remove();
    window.currentResizeElement = null;
    window.currentResizeWalls = null;
}
function drawSmartGuides(currentX, currentY, excludeId) {
    let r = rooms[activeRoom];
    if (!r) return;
    
    r.points.forEach(p => {
        if (p.id === excludeId) return;
        
        if (Math.abs(p.x - currentX) < 20) {
            svg.appendChild(createLine(
                mmToPx(p.x, 'x'), 0,
                mmToPx(p.x, 'x'), svg.clientHeight,
                "rgba(0, 188, 212, 0.4)", 1, "5,5"
            ));
        }
        
        if (Math.abs(p.y - currentY) < 20) {
            svg.appendChild(createLine(
                0, mmToPx(p.y, 'y'),
                svg.clientWidth, mmToPx(p.y, 'y'),
                "rgba(0, 188, 212, 0.4)", 1, "5,5"
            ));
        }
    });
}

function updatePlanDisplay() {
    const headerPlan = document.getElementById('header-plan');
    if (!headerPlan || !window.currentUser) return;
    
    if (window.currentUser.plan === 'pro') {
        headerPlan.innerText = "План: PRO";
        headerPlan.style.background = 'var(--gold)';
        headerPlan.style.color = 'var(--dark)';
    } else {
        headerPlan.innerText = "План: FREE";
        headerPlan.style.background = '';
        headerPlan.style.color = '';
    }
}

function completeAuth() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('header-user').innerText = window.currentUser.name;
    document.getElementById('header-plan').innerText = "План: " + window.currentUser.plan.toUpperCase();
    
    if(window.currentUser.plan === 'pro') {
        document.getElementById('header-plan').style.background = 'var(--gold)';
        document.getElementById('header-plan').style.color = 'var(--dark)';
    }

    loadAllSettings();
    
    if (window.currentUser && window.currentUser.uid && window.db) {
        loadCustomElementsFromFirestore(window.currentUser.uid).then(() => initSelectors());
    } else {
        initSelectors();
    }
    
    if(window.currentUser.plan === 'free' && rooms.length > 1) {
        rooms = rooms.slice(0, 1);
        renderTabs();
    } else if (rooms.length === 0) {
    // При первом запуске показываем окно выбора типа
    setTimeout(() => {
        showRoomTypeModal();
    }, 500); // Небольшая задержка, чтобы интерфейс успел загрузиться
}

    updatePlanDisplay();
    
    // ВАЖНО: показываем админ-панель если пользователь админ
    if (typeof updateAdminPanelVisibility === 'function') {
        console.log("👑 Вызов updateAdminPanelVisibility из completeAuth");
        updateAdminPanelVisibility();
    } else {
        console.warn("⚠️ updateAdminPanelVisibility не найдена в completeAuth");
    }

    setScaleFor5x5();
    draw();

    if (typeof initMobileHandlers === 'function') {
        initMobileHandlers();
    }
}
// ========== ФУНКЦИИ ДЛЯ СОЗДАНИЯ НОВЫХ ПОМЕЩЕНИЙ ==========

// Флаг, чтобы не показывать окно при загрузке проектов
let skipRoomTypeModal = false;

// Открыть модальное окно выбора типа полотна
// В функции showRoomTypeModal добавьте:
function showRoomTypeModal() {
    if (skipRoomTypeModal) {
        skipRoomTypeModal = false;
        createEmptyRoom();
        return;
    }
    
    // Проверка лимита FREE плана
    if(window.currentUser && window.currentUser.plan === 'free' && rooms.length >= 1) {
        alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
        return;
    }
    
    // Загружаем актуальные цены
    loadMaterialPrices();
    
    document.getElementById('roomTypeModal').style.display = 'block';
}

// Закрыть модальное окно выбора типа
function closeRoomTypeModal() {
    document.getElementById('roomTypeModal').style.display = 'none';
}

// Выбор типа полотна
function selectRoomType(type) {
    closeRoomTypeModal();
    
    if (type === 'rectangle') {
        // Показываем окно ввода размеров
        document.getElementById('rectangleSizeModal').style.display = 'block';
    } else {
        // Многоугольное - создаем пустую комнату
        createEmptyRoom();
    }
}

// Закрыть окно ввода размеров
function closeRectangleModal() {
    document.getElementById('rectangleSizeModal').style.display = 'none';
}

// Построить прямоугольное помещение (размеры в сантиметрах)
function buildRectangleRoom() {
    const lengthCm = parseInt(document.getElementById('rect-length').value);
    const widthCm = parseInt(document.getElementById('rect-width').value);
    
    if (isNaN(lengthCm) || isNaN(widthCm) || lengthCm < 50 || widthCm < 50) {
        alert("Введите корректные размеры (минимум 50 см)");
        return;
    }
    
    closeRectangleModal();
    
    const lengthMm = lengthCm * 10;
    const widthMm = widthCm * 10;
    
    saveState();
    
    const centerX = 0;
    const centerY = 0;
    const halfLength = lengthMm / 2;
    const halfWidth = widthMm / 2;
    
    // Загружаем материалы по умолчанию
    loadMaterialPrices();
    
    const newRoom = {
        name: "Полотно " + (rooms.length + 1),
        points: [
            { id: Date.now() + 1, x: centerX - halfLength, y: centerY - halfWidth },
            { id: Date.now() + 2, x: centerX + halfLength, y: centerY - halfWidth },
            { id: Date.now() + 3, x: centerX + halfLength, y: centerY + halfWidth },
            { id: Date.now() + 4, x: centerX - halfLength, y: centerY + halfWidth }
        ],
        id: Date.now(),
        closed: true,
        elements: [],
        // Добавляем материалы по умолчанию
        materials: {
            canvasType: 'pvc_matte',
            wallProfiles: {
                0: 'wall_standard',
                1: 'wall_standard',
                2: 'wall_standard',
                3: 'wall_standard'
            }
        }
    };
    
    rooms.push(newRoom);
    activeRoom = rooms.length - 1;
    renderTabs();
    
    // Сразу предлагаем выбрать материалы
    setTimeout(() => {
        showMaterialSelectionModal(activeRoom);
    }, 200);
    
    draw();
}
// Функция для быстрой установки размеров (в сантиметрах)
function setRectSize(lengthCm, widthCm) {
    document.getElementById('rect-length').value = lengthCm;
    document.getElementById('rect-width').value = widthCm;
}
// В файле core.js - обновим функцию createEmptyRoom

function createEmptyRoom() {
    saveState();
    
    // Загружаем актуальные цены материалов
    if (typeof loadMaterialPrices === 'function') {
        loadMaterialPrices();
    }
    
    rooms.push({
        name: "Полотно " + (rooms.length + 1),
        points: [],
        id: Date.now(),
        closed: false,
        elements: [],
        materials: {
            canvasType: 'pvc_matte',
            wallProfiles: {}
        }
    });
    
    activeRoom = rooms.length - 1;
    renderTabs();
    draw();
    
    console.log("✅ Создано пустое помещение для ручного рисования");
}
// Переопределяем существующую функцию addRoom
function addRoom() {
    showRoomTypeModal();
}

// Функция для загрузки проекта (чтобы не показывать окно)
function loadProjectWithSkip(projectId) {
    skipRoomTypeModal = true;
    loadProject(projectId);
}
// Добавьте в core.js

function editElementPosition(el) {
    if (!el) return;
    
    const currentX = Math.round(el.x / 10); // в см
    const currentY = Math.round(el.y / 10); // в см
    
    const newX = prompt(`Введите координату X (см):`, currentX);
    if (newX === null) return;
    
    const newY = prompt(`Введите координату Y (см):`, currentY);
    if (newY === null) return;
    
    if (!isNaN(newX) && !isNaN(newY) && parseFloat(newX) >= 0 && parseFloat(newY) >= 0) {
        saveState();
        el.x = parseFloat(newX) * 10;
        el.y = parseFloat(newY) * 10;
        draw();
        
        if (typeof showNotification === 'function') {
            showNotification(`✅ Позиция изменена: X=${newX} см, Y=${newY} см`);
        }
    } else {
        alert('Введите корректные значения');
    }
}
function selectElementForEdit(el) {
    // Снимаем выделение с предыдущего элемента
    if (selectedElementForEdit) {
        // Можно добавить визуальное снятие выделения
    }
    
    // Выделяем новый элемент
    selectedElementForEdit = el;
    
    // Показываем уведомление
    if (typeof showNotification === 'function') {
        showNotification(`✅ Выбран элемент: ${getElementDef(el.subtype)?.label || el.subtype}`);
    } else {
        alert(`Выбран элемент: ${getElementDef(el.subtype)?.label || el.subtype}`);
    }
    
    // Перерисовываем, чтобы показать выделение
    draw();
}
function openElementOffsetEditor() {
    if (!selectedElementForEdit) {
        alert('Сначала выберите элемент (кликните с зажатым Ctrl)');
        return;
    }
    
    const el = selectedElementForEdit;
    const r = rooms[activeRoom];
    
    if (!r || !r.closed) {
        alert('Помещение должно быть замкнуто');
        return;
    }
    
    // Находим правую и нижнюю стены
    const walls = findRightAndBottomWalls(el, r);
    
    if (!walls.rightWall || !walls.bottomWall) {
        alert('Не удалось найти правую или нижнюю стену');
        return;
    }
    
    // Текущие отступы в см
    const rightOffset = Math.round(walls.rightWall.distance / 10);
    const bottomOffset = Math.round(walls.bottomWall.distance / 10);
    
    // Максимальные отступы в см
    const maxRight = Math.round(walls.rightWall.maxDistance / 10);
    const maxBottom = Math.round(walls.bottomWall.maxDistance / 10);
    
    const modalHtml = `
        <div id="elementOffsetModal" class="modal" style="display: block; z-index: 7000;">
            <div class="modal-content" style="width: 400px; max-width: 95%;">
                <h3 style="margin-top: 0; color: var(--dark);">📏 Позиция элемента</h3>
                
                <div style="margin-bottom: 20px; padding: 10px; background: #f0f7fa; border-radius: 8px;">
                    <p><strong>Элемент:</strong> ${getElementDef(el.subtype)?.label || el.subtype}</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">➡️ Отступ от правой стены</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="right-offset-slider" min="0" max="${maxRight}" value="${rightOffset}" step="1" style="flex: 1;">
                        <input type="number" id="right-offset-input" value="${rightOffset}" min="0" max="${maxRight}" style="width: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                        <span>см</span>
                    </div>
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">
                        Максимум: ${maxRight} см
                    </p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px;">⬇️ Отступ от нижней стены</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="range" id="bottom-offset-slider" min="0" max="${maxBottom}" value="${bottomOffset}" step="1" style="flex: 1;">
                        <input type="number" id="bottom-offset-input" value="${bottomOffset}" min="0" max="${maxBottom}" style="width: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
                        <span>см</span>
                    </div>
                    <p style="font-size: 12px; color: #666; margin-top: 5px;">
                        Максимум: ${maxBottom} см
                    </p>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid #eee; padding-top: 15px;">
                    <button onclick="applyElementOffsets()" style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 8px;">
                        Применить
                    </button>
                    <button onclick="closeElementOffsetModal()" style="background: #eee; border: none; padding: 10px 20px; border-radius: 8px;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старое модальное окно
    const oldModal = document.getElementById('elementOffsetModal');
    if (oldModal) oldModal.remove();
    
    // Добавляем новое
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Добавляем обработчики
    const rightSlider = document.getElementById('right-offset-slider');
    const rightInput = document.getElementById('right-offset-input');
    
    rightSlider.addEventListener('input', () => {
        rightInput.value = rightSlider.value;
    });
    
    rightInput.addEventListener('input', () => {
        let val = parseInt(rightInput.value);
        if (val < 0) val = 0;
        if (val > maxRight) val = maxRight;
        rightInput.value = val;
        rightSlider.value = val;
    });
    
    const bottomSlider = document.getElementById('bottom-offset-slider');
    const bottomInput = document.getElementById('bottom-offset-input');
    
    bottomSlider.addEventListener('input', () => {
        bottomInput.value = bottomSlider.value;
    });
    
    bottomInput.addEventListener('input', () => {
        let val = parseInt(bottomInput.value);
        if (val < 0) val = 0;
        if (val > maxBottom) val = maxBottom;
        bottomInput.value = val;
        bottomSlider.value = val;
    });
}

function findRightAndBottomWalls(el, room) {
    const result = {
        rightWall: null,
        bottomWall: null
    };
    
    // Находим все стены
    const walls = [];
    for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i];
        const p2 = room.points[(i + 1) % room.points.length];
        
        // Вертикальные стены (по X)
        if (Math.abs(p1.x - p2.x) < 1) {
            walls.push({
                type: 'vertical',
                x: p1.x,
                yMin: Math.min(p1.y, p2.y),
                yMax: Math.max(p1.y, p2.y),
                p1, p2
            });
        }
        // Горизонтальные стены (по Y)
        else if (Math.abs(p1.y - p2.y) < 1) {
            walls.push({
                type: 'horizontal',
                y: p1.y,
                xMin: Math.min(p1.x, p2.x),
                xMax: Math.max(p1.x, p2.x),
                p1, p2
            });
        }
    }
    
    // Ищем правую стену (максимальный X, который больше X элемента)
    let rightDist = Infinity;
    walls.forEach(wall => {
        if (wall.type === 'vertical' && wall.x > el.x) {
            // Проверяем, что элемент находится в пределах стены по Y
            if (el.y >= wall.yMin && el.y <= wall.yMax) {
                const dist = wall.x - el.x;
                if (dist < rightDist) {
                    rightDist = dist;
                    result.rightWall = {
                        wall,
                        distance: dist,
                        maxDistance: wall.x - getMinX(room)
                    };
                }
            }
        }
    });
    
    // Ищем нижнюю стену (максимальный Y, который больше Y элемента)
    let bottomDist = Infinity;
    walls.forEach(wall => {
        if (wall.type === 'horizontal' && wall.y > el.y) {
            // Проверяем, что элемент находится в пределах стены по X
            if (el.x >= wall.xMin && el.x <= wall.xMax) {
                const dist = wall.y - el.y;
                if (dist < bottomDist) {
                    bottomDist = dist;
                    result.bottomWall = {
                        wall,
                        distance: dist,
                        maxDistance: wall.y - getMinY(room)
                    };
                }
            }
        }
    });
    
    return result;
}

function getMinX(room) {
    return Math.min(...room.points.map(p => p.x));
}

function getMinY(room) {
    return Math.min(...room.points.map(p => p.y));
}

function applyElementOffsets() {
    if (!selectedElementForEdit) {
        closeElementOffsetModal();
        return;
    }
    
    const el = selectedElementForEdit;
    const r = rooms[activeRoom];
    
    const rightInput = document.getElementById('right-offset-input');
    const bottomInput = document.getElementById('bottom-offset-input');
    
    if (!rightInput || !bottomInput) return;
    
    const newRightOffset = parseFloat(rightInput.value) * 10; // в мм
    const newBottomOffset = parseFloat(bottomInput.value) * 10; // в мм
    
    // Находим стены заново для точного позиционирования
    const walls = findRightAndBottomWalls(el, r);
    
    if (walls.rightWall) {
        saveState();
        // Устанавливаем новую позицию X
        el.x = walls.rightWall.wall.x - newRightOffset;
    }
    
    if (walls.bottomWall) {
        saveState();
        // Устанавливаем новую позицию Y
        el.y = walls.bottomWall.wall.y - newBottomOffset;
    }
    
    closeElementOffsetModal();
    draw();
    
    if (typeof showNotification === 'function') {
        showNotification('✅ Позиция элемента обновлена');
    }
}

function closeElementOffsetModal() {
    const modal = document.getElementById('elementOffsetModal');
    if (modal) modal.remove();
}

function clearSelectedElement() {
    selectedElementForEdit = null;
    draw();
}

// При загрузке из projects.js, нужно использовать loadProjectWithSkip
// Но чтобы не ломать существующий код, переопределим функцию в projects.js позже
// ========== ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ==========

window.scale = scale;
window.offsetX = offsetX;
window.offsetY = offsetY;
window.rooms = rooms;
window.activeRoom = activeRoom;
window.currentTool = currentTool;
window.showDiagonals = showDiagonals;
window.showMeasures = showMeasures;
window.history = history;

window.saveState = saveState;
window.undo = undo;
window.setTool = setTool;
window.toggleDiagonals = toggleDiagonals;
window.toggleMeasures = toggleMeasures;
window.renameRoom = renameRoom;
window.mmToPx = mmToPx;
window.pxToMm = pxToMm;
window.snap = snap;
window.getSnappedPos = getSnappedPos;
window.draw = draw;
window.addRoom = addRoom;
window.removeRoom = removeRoom;
window.renderTabs = renderTabs;
window.updateZoomLevel = updateZoomLevel;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetView = resetView;
window.updateStats = updateStats;
window.mirrorRoom = mirrorRoom;
window.exportImage = exportImage;
window.setScaleFor5x5 = setScaleFor5x5;
window.centerView = centerView;
window.generateFullEstimate = generateFullEstimate;
window.completeAuth = completeAuth;
window.resizeWall = resizeWall;
// Добавьте эти строки к существующему экспорту
window.showRoomTypeModal = showRoomTypeModal;
window.selectRoomType = selectRoomType;
window.buildRectangleRoom = buildRectangleRoom;
window.closeRoomTypeModal = closeRoomTypeModal;
window.closeRectangleModal = closeRectangleModal;
window.skipRoomTypeModal = skipRoomTypeModal;
// Добавьте эту строку к существующему экспорту
window.setRectSize = setRectSize;
// В конце core.js добавьте экспорт новых функций

window.openElementResizeWithWalls = openElementResizeWithWalls;
window.findNearestWalls = findNearestWalls;
window.applyElementResizeWithWalls = applyElementResizeWithWalls;
window.closeElementResizeModal = closeElementResizeModal;
// В конце core.js добавьте

window.editElementPosition = editElementPosition;
window.selectedElementForEdit = selectedElementForEdit;
window.selectElementForEdit = selectElementForEdit;
window.openElementOffsetEditor = openElementOffsetEditor;
window.applyElementOffsets = applyElementOffsets;
window.closeElementOffsetModal = closeElementOffsetModal;
window.clearSelectedElement = clearSelectedElement;







