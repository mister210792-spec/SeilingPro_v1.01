// Основные функции рисования
let svg; // Объявляем переменную, но не инициализируем сразу

// Инициализация SVG после загрузки DOM
function initSvg() {
    svg = document.getElementById("canvas");
    if (!svg) {
        console.error("❌ SVG элемент не найден! Проверьте id='canvas' в HTML");
        return false;
    }
    console.log("✅ SVG инициализирован");
    return true;
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РИСОВАНИЯ (ОБЪЯВЛЯЕМ ИХ ПЕРВЫМИ)

// Рисование сетки
function drawGrid() {
    if (!svg) return;
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

// Рисование направляющих
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

// Рисование размеров элемента
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
            svg.appendChild(createLine(
                mmToPx(bX.pt.x, 'x'), mmToPx(bX.pt.y, 'y'),
                mmToPx(bX.val, 'x'), mmToPx(bX.pt.y, 'y'),
                "var(--danger)", 0.8, "2,2"
            ));
            svg.appendChild(renderText(
                mmToPx(bX.pt.x + (bX.val > bX.pt.x ? 100 : -100), 'x'),
                mmToPx(bX.pt.y, 'y') - 5,
                Math.round(bX.d / 10) + " см",
                "measure-label"
            ));
        }
        if (bY) {
            svg.appendChild(createLine(
                mmToPx(bY.pt.x, 'x'), mmToPx(bY.pt.y, 'y'),
                mmToPx(bY.pt.x, 'x'), mmToPx(bY.val, 'y'),
                "var(--danger)", 0.8, "2,2"
            ));
            svg.appendChild(renderText(
                mmToPx(bY.pt.x, 'x') + 15,
                mmToPx(bY.pt.y + (bY.val > bY.pt.y ? 100 : -100), 'y'),
                Math.round(bY.d / 10) + " см",
                "measure-label"
            ));
        }
    });
}

// Изменение длины стены
function resizeWall(i) {
    let r = rooms[activeRoom];
    let p1 = r.points[i], p2 = r.points[(i + 1) % r.points.length];
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

// ОСНОВНАЯ ФУНКЦИЯ РИСОВАНИЯ
function draw(isExport = false) {
    if (!svg) return;
    svg.innerHTML = "";
    if (!isExport) drawGrid();
    
    let r = rooms[activeRoom];
    if (!r) return;
    
    // Рисование диагоналей
    if (r.closed && r.points.length > 3 && showDiagonals) {
        for (let i = 0; i < r.points.length; i++) {
            for (let j = i + 2; j < r.points.length; j++) {
                if (i === 0 && j === r.points.length - 1) continue;
                let p1 = r.points[i], p2 = r.points[j];
                svg.appendChild(createLine(
                    mmToPx(p1.x, 'x'), mmToPx(p1.y, 'y'),
                    mmToPx(p2.x, 'x'), mmToPx(p2.y, 'y'),
                    "rgba(142, 68, 173, 0.15)", 1, "4,4"
                ));
                let d = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
                svg.appendChild(renderText(
                    mmToPx((p1.x+p2.x)/2, 'x'),
                    mmToPx((p1.y+p2.y)/2, 'y'),
                    d,
                    "diag-label"
                ));
            }
        }
    }
    
    // Предпросмотр линии рисования
if (r.points.length > 0 && !r.closed && !window.dragId && !window.dragElem && !isExport && currentTool === 'draw') {
    let last = r.points[r.points.length - 1];
    let first = r.points[0];
    let rawX = pxToMm(mousePos.x, 'x');
    let rawY = pxToMm(mousePos.y, 'y');
    
    // Сначала применяем обычный снаппинг к сетке
    let sX = snap(rawX, first ? first.x : null);
    let sY = snap(rawY, first ? first.y : null);
    
    // УМНЫЙ ЛУЧ К ПЕРВОЙ ТОЧКЕ - для замыкания полигона
    let snapToFirst = false;
    let snapXtoFirst = false;
    let snapYtoFirst = false;
    
    if (first && r.points.length >= 2) { // Минимум 2 точки для предпросмотра замыкания
        // Проверяем, находится ли мышь близко к горизонтальной линии от первой точки
        if (Math.abs(rawY - first.y) < 50) { // Порог чувствительности по Y
            sY = first.y;
            snapYtoFirst = true;
        }
        
        // Проверяем, находится ли мышь близко к вертикальной линии от первой точки
        if (Math.abs(rawX - first.x) < 50) { // Порог чувствительности по X
            sX = first.x;
            snapXtoFirst = true;
        }
        
        // Проверяем, находится ли мышь близко к самой первой точке
        if (Math.sqrt((rawX - first.x)**2 + (rawY - first.y)**2) < 100) { // 100мм = 10см
            sX = first.x;
            sY = first.y;
            snapToFirst = true;
        }
    }
    
    // Обычный умный луч (ортогональное выравнивание) - применяем только если не сработал снаппинг к первой точке
    if (!snapToFirst && !mousePos.shift && last) {
        // Вычисляем разницы
        let dx = Math.abs(sX - last.x);
        let dy = Math.abs(sY - last.y);
        
        // Если одна из разниц значительно меньше другой, фиксируем соответствующую координату
        if (dx < dy * 1.2) { // Горизонтальное преобладание
            sX = last.x; // Фиксируем X для вертикальной линии
        } 
        if (dy < dx * 1.2) { // Вертикальное преобладание
            sY = last.y; // Фиксируем Y для горизонтальной линии
        }
    }
    
    // Проверка на замыкание полигона (подсветка первой точки)
    if (first) {
        isHoveringFirstPoint = (r.points.length >= 3 && 
            Math.sqrt((mousePos.x - mmToPx(first.x, 'x'))**2 + (mousePos.y - mmToPx(first.y, 'y'))**2) < 25);
    }
    
    // Рисуем линию предпросмотра
    if (last) {
        // Определяем цвет линии
        let lineColor = "var(--primary)";
        let lineDash = "6,4"; // Обычный пунктир
        
        if (snapToFirst) {
            lineColor = "var(--success)"; // Зеленый для замыкания
            lineDash = "2,2"; // Мелкий пунктир для замыкания
        } else if (snapXtoFirst || snapYtoFirst) {
            lineColor = "#ff9900"; // Оранжевый для выравнивания по первой точке
            lineDash = "4,4";
        }
        
        svg.appendChild(createLine(
            mmToPx(last.x, 'x'), mmToPx(last.y, 'y'),
            mmToPx(sX, 'x'), mmToPx(sY, 'y'),
            lineColor,
            2, 
            lineDash
        ));
        
        // Показываем длину линии
        let dist = Math.round(Math.sqrt((sX - last.x)**2 + (sY - last.y)**2) / 10);
        if (dist > 0) {
            svg.appendChild(renderText(
                mmToPx((last.x + sX)/2, 'x'),
                mmToPx((last.y + sY)/2, 'y') - 10,
                dist + " см",
                "live-label"
            ));
        }
        
        // Визуальные подсказки для осей первой точки
        if (first && !snapToFirst) {
            // Пунктирная линия к первой точке по горизонтали
            if (snapYtoFirst && !snapXtoFirst) {
                svg.appendChild(createLine(
                    mmToPx(last.x, 'x'), mmToPx(first.y, 'y'),
                    mmToPx(sX, 'x'), mmToPx(first.y, 'y'),
                    "rgba(255, 153, 0, 0.3)",
                    1, 
                    "5,5"
                ));
            }
            
            // Пунктирная линия к первой точке по вертикали
            if (snapXtoFirst && !snapYtoFirst) {
                svg.appendChild(createLine(
                    mmToPx(first.x, 'x'), mmToPx(last.y, 'y'),
                    mmToPx(first.x, 'x'), mmToPx(sY, 'y'),
                    "rgba(255, 153, 0, 0.3)",
                    1, 
                    "5,5"
                ));
            }
            
            // Подсвечиваем первую точку
            let firstPointHighlight = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            firstPointHighlight.setAttribute("cx", mmToPx(first.x, 'x'));
            firstPointHighlight.setAttribute("cy", mmToPx(first.y, 'y'));
            firstPointHighlight.setAttribute("r", snapToFirst ? 10 : 7);
            firstPointHighlight.setAttribute("fill", "none");
            firstPointHighlight.setAttribute("stroke", snapToFirst ? "var(--success)" : "#ff9900");
            firstPointHighlight.setAttribute("stroke-width", snapToFirst ? 3 : 2);
            firstPointHighlight.setAttribute("stroke-dasharray", snapToFirst ? "none" : "4,4");
            firstPointHighlight.setAttribute("opacity", "0.8");
            svg.appendChild(firstPointHighlight);
        }
    }
}
    
    // Рисование полигона
    if (r.points.length > 0) {
        let pts = r.points.map(p => `${mmToPx(p.x, 'x')},${mmToPx(p.y, 'y')}`).join(" ");
        let poly = document.createElementNS("http://www.w3.org/2000/svg", r.closed ? "polygon" : "polyline");
        poly.setAttribute("points", pts);
        poly.setAttribute("fill", r.closed ? "rgba(0,188,212,0.05)" : "none");
        poly.setAttribute("stroke", "#2c3e50");
        poly.setAttribute("stroke-width", 2.5);
        svg.appendChild(poly);
        
        // Размеры стен
        r.points.forEach((p, i) => {
            if (!r.closed && i === r.points.length - 1) return;
            let pNext = r.points[(i + 1) % r.points.length];
            let d = Math.round(Math.sqrt((pNext.x-p.x)**2 + (pNext.y-p.y)**2)/10);
            if (d > 0) {
                let txt = renderText(
                    mmToPx((p.x+pNext.x)/2, 'x'),
                    mmToPx((p.y+pNext.y)/2, 'y'),
                    d + " см",
                    "length-label"
                );
                if (!isExport) {
                    txt.onclick = () => {
                        if (typeof resizeWall === 'function') resizeWall(i);
                    };
                }
            }
        });
    }
    
    // Рисование элементов
    if (r.elements) {
        r.elements.forEach((el, idx) => {
            let def = getElementDef(el.subtype);
            let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `rotate(${el.rotation || 0}, ${mmToPx(el.x, 'x')}, ${mmToPx(el.y, 'y')})`);
            
            const isLinear = def.type === 'linear' || el.type === 'rail';
            
            if (r.closed && showMeasures) {
                drawElementMeasures(el, r);
            }
            
            if (isLinear) {
                let w = el.width || 2000;
                let color = el.type === 'rail' ? "#fb8c00" : (el.subtype === 'TRACK' ? "#333" : "var(--light)");
                let line = createLine(
                    mmToPx(el.x - w/2, 'x'), mmToPx(el.y, 'y'),
                    mmToPx(el.x + w/2, 'x'), mmToPx(el.y, 'y'),
                    color, 5
                );
                line.setAttribute("stroke-linecap", "round");
                g.appendChild(line);
                
                let label = renderText(
                    mmToPx(el.x, 'x'), mmToPx(el.y, 'y') - 10,
                    `${w/10} см`,
                    el.type === 'rail' ? "rail-label" : "light-label"
                );
                if (!isExport) {
                    label.onclick = (e) => {
                        e.stopPropagation();
                        let nl = prompt("Длина (см):", w/10);
                        if (nl && !isNaN(nl)) {
                            saveState();
                            el.width = nl * 10;
                            draw();
                        }
                    };
                }
                svg.appendChild(label);
            } else {
                g.appendChild(drawSymbol(el, def));
            }
            
            if (!isExport) {
                g.onmousedown = (e) => {
                    e.stopPropagation();
                    if (e.altKey) {
                        saveState();
                        let copy = JSON.parse(JSON.stringify(el));
                        r.elements.push(copy);
                        window.dragElem = copy;
                    } else {
                        saveState();
                        window.dragElem = el;
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
            
            svg.appendChild(g);
        });
    }
    
    // Точки вершин
    if (!isExport) {
        r.points.forEach((p, i) => {
            let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", mmToPx(p.x, 'x'));
            c.setAttribute("cy", mmToPx(p.y, 'y'));
            c.setAttribute("r", 5);
            c.setAttribute("fill", "white");
            c.setAttribute("stroke", "#e74c3c");
            c.setAttribute("stroke-width", 2);
            
            c.onmousedown = (e) => {
                e.stopPropagation();
                if (currentTool === 'draw') {
                    saveState();
                    window.dragId = p.id;
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
            
            svg.appendChild(c);
        });
    }
    
    if (typeof updateStats === 'function') updateStats();
}

// НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ (ВЫЗЫВАЕМ ПОСЛЕ ТОГО, КАК ВСЕ ФУНКЦИИ ОПРЕДЕЛЕНЫ)
function initSvgHandlers() {
    if (!svg) return;
    
    svg.onmousemove = (e) => {
        const rect = svg.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        mousePos.shift = e.shiftKey;
        
        if (window.isPanning) {
            offsetX = e.clientX - window.startPanX;
            offsetY = e.clientY - window.startPanY;
            draw();
            return;
        }
        
        if (window.dragId) {
            let p = rooms[activeRoom]?.points.find(pt => pt.id === window.dragId);
            if (p) {
                p.x = snap(pxToMm(mousePos.x, 'x'));
                p.y = snap(pxToMm(mousePos.y, 'y'));
                draw();
                drawSmartGuides(p.x, p.y, window.dragId);
            }
            return;
        }
        
        if (window.dragElem) {
            let s = getSnappedPos(pxToMm(mousePos.x, 'x'), pxToMm(mousePos.y, 'y'), window.dragElem);
            window.dragElem.x = s.x;
            window.dragElem.y = s.y;
            draw();
            drawSmartGuides(window.dragElem.x, window.dragElem.y, null);
            return;
        }
        
        draw();
    };

    svg.onmousedown = (e) => {
        if (e.target === svg && currentTool === 'draw') {
            window.isPanning = true;
            window.startPanX = e.clientX - offsetX;
            window.startPanY = e.clientY - offsetY;
        }
    };

    svg.onclick = (e) => {
        if (window.isPanning) return;
        
        let r = rooms[activeRoom];
        if (!r) return;
        
        let rect = svg.getBoundingClientRect();
        let mmX = pxToMm(e.clientX - rect.left, 'x');
        let mmY = pxToMm(e.clientY - rect.top, 'y');
        
        // Добавление элемента
        if (currentTool !== 'draw') {
            saveState();
            if (!r.elements) r.elements = [];
            
            let sub = '';
            if (currentTool === 'light') {
                sub = document.getElementById("lightTypeSelector")?.value;
            } else if (currentTool === 'rail') {
                sub = document.getElementById("railTypeSelector")?.value;
            } else {
                sub = document.getElementById("extraTypeSelector")?.value;
            }
            
            if (!sub) return;
            
            let s = getSnappedPos(mmX, mmY);
            let def = getElementDef(sub);
            let newEl = { type: currentTool, subtype: sub, x: s.x, y: s.y, rotation: 0 };
            
            const isLinear = def.type === 'linear' || currentTool === 'rail';
            if (isLinear) {
                let dl = prompt("Длина (см):", "200");
                newEl.width = (parseFloat(dl) * 10) || 2000;
            }
            
            r.elements.push(newEl);
            draw();
            return;
        }
        
        // Закрытие полигона
        if (r.closed || window.dragId) return;
        
        let first = r.points[0];
        if (r.points.length >= 3 && first && 
            Math.sqrt((e.clientX - rect.left - mmToPx(first.x, 'x'))**2 + 
                      (e.clientY - rect.top - mmToPx(first.y, 'y'))**2) < 25) {
            saveState();
            r.closed = true;
            draw();
            return;
        }
        
        // Добавление точки
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
        
        r.points.push({ id: Date.now(), x: sX, y: sY });
        draw();
    };

    // Обработка колесика мыши
    svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        
        if (e.shiftKey) {
            let r = rooms[activeRoom];
            if (r) {
                let mmX = pxToMm(mousePos.x, 'x');
                let mmY = pxToMm(mousePos.y, 'y');
                let target = r.elements?.find(el => Math.sqrt((el.x-mmX)**2 + (el.y-mmY)**2) < 200);
                if (target) {
                    target.rotation = (target.rotation || 0) + (e.deltaY > 0 ? 1 : -1);
                    draw();
                    return;
                }
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

    console.log("✅ Обработчики SVG назначены");
}

window.onmouseup = () => {
    window.isPanning = false;
    window.dragId = null;
    window.dragElem = null;
};