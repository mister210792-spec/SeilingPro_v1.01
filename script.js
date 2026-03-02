// --- SAAS LOGIC ---
let currentUser = null;
let selectedRegPlan = 'free';
let db;
let auth;

function initFirebaseServices() {
    if (typeof firebase !== 'undefined') {
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("✅ Firebase сервисы готовы");
    } else {
        console.error("❌ Firebase не загрузился");
        alert("Ошибка загрузки облачных сервисов. Проверьте интернет-соединение.");
    }
}

function toggleAuthForms() {
    const isLogin = document.getElementById('login-form').style.display !== 'none';
    document.getElementById('login-form').style.display = isLogin ? 'none' : 'block';
    document.getElementById('reg-form').style.display = isLogin ? 'block' : 'none';
}

function selectPlan(plan) {
    selectedRegPlan = plan;
    document.getElementById('p-free').classList.toggle('active', plan === 'free');
    document.getElementById('p-pro').classList.toggle('active', plan === 'pro');
}

function handleLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;

    if(!email || !pass) { alert("Введите email и пароль"); return; }
    if (!auth) { alert("Сервис входа временно недоступен."); return; }

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            console.log("✅ Вход выполнен:", userCredential.user.email);
        })
        .catch((error) => {
            console.error("❌ Ошибка входа:", error);
            let errorMessage = "Ошибка входа: ";
            if (error.code === 'auth/user-not-found') {
                errorMessage += "Пользователь не найден.";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage += "Неверный пароль.";
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage);
        });
}

function handleRegister() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const plan = selectedRegPlan;

    if(!name || !email || !pass) { alert("Заполните все поля"); return; }
    if (!auth) { alert("Сервис регистрации временно недоступен."); return; }

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            const user = userCredential.user;
            return user.updateProfile({ displayName: name }).then(() => {
                return db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    plan: plan,
                    registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        })
        .then(() => {
            console.log("✅ Регистрация успешна");
        })
        .catch((error) => {
            console.error("❌ Ошибка регистрации:", error);
            let errorMessage = "Ошибка регистрации: ";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage += "Этот email уже используется.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage += "Пароль слишком слабый (минимум 6 символов).";
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage);
        });
}

function loadUserPlanFromFirestore(uid) {
    if (!db) return;
    db.collection('users').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                if (currentUser) {
                    currentUser.plan = userData.plan || 'free';
                    const headerPlan = document.getElementById('header-plan');
                    if (headerPlan) {
                        headerPlan.innerText = "План: " + currentUser.plan.toUpperCase();
                        if(currentUser.plan === 'pro') {
                            headerPlan.style.background = 'var(--gold)';
                            headerPlan.style.color = 'var(--dark)';
                        } else {
                            headerPlan.style.background = '';
                            headerPlan.style.color = '';
                        }
                    }
                    loadCustomElementsFromFirestore(uid);
                }
            } else {
                db.collection('users').doc(uid).set({ plan: 'free', email: currentUser?.email || 'unknown' })
                    .then(() => loadCustomElementsFromFirestore(uid));
            }
        })
        .catch((error) => console.error("Ошибка загрузки плана:", error));
}

function loadCustomElementsFromFirestore(uid) {
    if (!db) return Promise.resolve();
    return db.collection('users').doc(uid).collection('customElements').get()
        .then((querySnapshot) => {
            for (let key in CUSTOM_REGISTRY) {
                if (key.startsWith('custom_')) {
                    delete EXTRA_DATA[key];
                    delete prices[key];
                }
            }
            CUSTOM_REGISTRY = {};
            
            querySnapshot.forEach((doc) => {
                const element = doc.data();
                const key = doc.id;
                CUSTOM_REGISTRY[key] = element;
                EXTRA_DATA[key] = element;
                prices[key] = element.price;
            });
            
            console.log(`✅ Загружено ${querySnapshot.size} кастомных элементов`);
            saveAllSettings();
            initSelectors();
        })
        .catch((error) => console.error("❌ Ошибка загрузки кастомных элементов:", error));
}

function completeAuth() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('header-user').innerText = currentUser.name;
    document.getElementById('header-plan').innerText = "План: " + currentUser.plan.toUpperCase();
    
    if(currentUser.plan === 'pro') {
        document.getElementById('header-plan').style.background = 'var(--gold)';
        document.getElementById('header-plan').style.color = 'var(--dark)';
    }

    loadAllSettings();
    
    if (currentUser && currentUser.uid) {
        loadCustomElementsFromFirestore(currentUser.uid).then(() => initSelectors());
    } else {
        initSelectors();
    }
    
  if(currentUser.plan === 'free' && rooms.length > 1) {
    rooms = rooms.slice(0, 1);
    renderTabs();
} else if (rooms.length === 0) {
    // Создаем пустую комнату
    rooms.push({
        name: "Полотно 1",
        points: [],
        id: Date.now(),
        closed: false,
        elements: []
    });
    activeRoom = 0;
    renderTabs();
}

// Устанавливаем масштаб под размер 5x5 метров
setScaleFor5x5();
draw();

initMobileHandlers();
}
function handleLogout() {
    if(confirm("Выйти из системы?")) {
        if (auth) {
            auth.signOut().then(() => location.reload()).catch(console.error);
        } else {
            localStorage.removeItem('saas_last_user');
            location.reload();
        }
    }
}

window.onload = () => {
    initFirebaseServices();

   if (auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                uid: user.uid,
                plan: 'free'
            };
            loadUserPlanFromFirestore(user.uid);
            completeAuth(); // setScaleFor5x5() уже вызывается внутри completeAuth
        } else {
            document.getElementById('auth-overlay').style.display = 'flex';
        }
    });
} 
else {
        console.warn("Firebase не доступен, использую локальную систему.");
        const lastUserEmail = localStorage.getItem('saas_last_user');
        if (lastUserEmail) {
            const saved = localStorage.getItem('saas_user_' + lastUserEmail);
            if (saved) {
                currentUser = JSON.parse(saved);
                completeAuth();
                return;
            }
        }
        document.getElementById('auth-overlay').style.display = 'flex';
    }
};

// --- CORE APPLICATION LOGIC ---
const svg = document.getElementById("canvas");

let LIGHT_DATA = {
    'GX53': { label: 'Светильник GX53', price: 350, type: 'static', shape: 'circle' },
    'LED_PANEL': { label: 'LED Панель', price: 800, type: 'static', shape: 'square' },
    'CHANDELIER': { label: 'Люстра', price: 1000, type: 'static', shape: 'diamond' },
    'SURFACE': { label: 'Накладной светильник', price: 450, type: 'static', shape: 'circle' },
    'PENDANT': { label: 'Подвесной светильник', price: 500, type: 'static', shape: 'circle' },
    'TRACK': { label: 'Трек', price: 1200, type: 'linear' },
    'LIGHT_LINE': { label: 'Световая линия', price: 1500, type: 'linear' }
};

let EXTRA_DATA = {
    'FIRE_ALARM': { label: 'Пожарный датчик', price: 300, type: 'static', shape: 'circle' },
    'DIFFUSER': { label: 'Диффузор', price: 600, type: 'static', shape: 'square' },
    'HOLE': { label: 'Внутренний вырез', price: 500, type: 'static', shape: 'circle' }
};

let RAIL_DATA = {
    'ПК-5': { label: 'ПК-5 (2-х рядный)', price: 1200, type: 'linear' },
    'ПК-15': { label: 'ПК-15 (Скрытый)', price: 1400, type: 'linear' },
    'ПК-14': { label: 'ПК-14 (Гардина)', price: 1100, type: 'linear' },
    'Стандарт': { label: 'Обычный карниз', price: 600, type: 'linear' }
};

let prices = {
    'Полотно (м2)': 500,
    'Профиль (м.п.)': 150,
    'pipe': 250
};

let CUSTOM_REGISTRY = {};

function loadAllSettings() {
    const savedPrices = localStorage.getItem('cp_prices_15');
    const savedLights = localStorage.getItem('cp_lights_15');
    const savedExtras = localStorage.getItem('cp_extras_15');
    const savedRails = localStorage.getItem('cp_rails_15');
    const savedCustom = localStorage.getItem('cp_custom_15');

    if (savedPrices) prices = JSON.parse(savedPrices);
    if (savedLights) LIGHT_DATA = JSON.parse(savedLights);
    if (savedExtras) EXTRA_DATA = JSON.parse(savedExtras);
    if (savedRails) RAIL_DATA = JSON.parse(savedRails);
    if (savedCustom) CUSTOM_REGISTRY = JSON.parse(savedCustom);

    [LIGHT_DATA, EXTRA_DATA, RAIL_DATA].forEach(data => {
        for (let key in data) {
            if (prices[key] === undefined) prices[key] = data[key].price;
            else data[key].price = prices[key];
        }
    });
}

function saveAllSettings() {
    localStorage.setItem('cp_prices_15', JSON.stringify(prices));
    localStorage.setItem('cp_lights_15', JSON.stringify(LIGHT_DATA));
    localStorage.setItem('cp_extras_15', JSON.stringify(EXTRA_DATA));
    localStorage.setItem('cp_rails_15', JSON.stringify(RAIL_DATA));
    localStorage.setItem('cp_custom_15', JSON.stringify(CUSTOM_REGISTRY));
}

function initSelectors() {
    const fill = (id, data) => {
        const el = document.getElementById(id);
        el.innerHTML = "";
        for (let key in data) {
            let opt = document.createElement("option");
            opt.value = key;
            opt.innerText = data[key].label;
            el.appendChild(opt);
        }
    };
    fill('lightTypeSelector', LIGHT_DATA);
    fill('extraTypeSelector', EXTRA_DATA);
    fill('railTypeSelector', RAIL_DATA);
}

function getElementDef(key) {
    return LIGHT_DATA[key] || EXTRA_DATA[key] || RAIL_DATA[key] || { type: 'static', shape: 'circle' };
}

function openPriceModal() {
    renderPriceList();
    document.getElementById('addForm').classList.remove('visible');
    document.getElementById('btnShowAdd').style.display = 'block';
    
    if(currentUser && currentUser.plan === 'free') {
        document.getElementById('price-lock').classList.add('active');
    } else {
        document.getElementById('price-lock').classList.remove('active');
    }

    document.getElementById('priceModal').style.display = 'block';
}

function closePriceModal() { document.getElementById('priceModal').style.display = 'none'; }

function renderPriceList() {
    const container = document.getElementById('priceListContainer');
    let html = `<table class="price-table"><thead><tr><th>Наименование</th><th>Цена (руб)</th><th>Действие</th></tr></thead><tbody>`;
    
    ['Полотно (м2)', 'Профиль (м.п.)', 'pipe'].forEach(key => {
        let label = key === 'pipe' ? 'Обвод трубы' : key;
        html += `<tr><td><b>${label}</b></td><td><input type="number" id="prc_${key}" value="${prices[key]}" onchange="updatePrice('${key}', this.value)"></td><td>-</td></tr>`;
    });

    const renderCategory = (data) => {
        for (let key in data) {
            let el = data[key];
            let typeLabel = el.type === 'linear' ? '(м.п.)' : '(шт)';
            html += `<tr>
                <td>${el.label} <small style="color:#999">${typeLabel}</small></td>
                <td><input type="number" value="${el.price}" onchange="updateElementPrice('${key}', this.value)"></td>
                <td>${isCustom(key) ? `<button class="btn-del" onclick="deleteElement('${key}')">×</button>` : '-'}</td>
            </tr>`;
        }
    };

    renderCategory(LIGHT_DATA);
    renderCategory(EXTRA_DATA);
    renderCategory(RAIL_DATA);

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function isCustom(key) { return key.startsWith('custom_'); }

function updatePrice(key, val) { prices[key] = parseFloat(val) || 0; }

function updateElementPrice(key, val) {
    let p = parseFloat(val) || 0;
    prices[key] = p;
    if (LIGHT_DATA[key]) LIGHT_DATA[key].price = p;
    if (EXTRA_DATA[key]) EXTRA_DATA[key].price = p;
    if (RAIL_DATA[key]) RAIL_DATA[key].price = p;
}

function savePrices() { 
    saveAllSettings(); 
    
    if (currentUser && currentUser.uid && db) {
        const batch = db.batch();
        const userCustomRef = db.collection('users').doc(currentUser.uid).collection('customElements');
        
        for (let key in CUSTOM_REGISTRY) {
            if (key.startsWith('custom_')) {
                const docRef = userCustomRef.doc(key);
                batch.update(docRef, { price: prices[key] });
            }
        }
        
        batch.commit().catch(console.error);
    }
    
    closePriceModal(); 
    updateStats(); 
}

function deleteElement(key) {
    if(confirm('Удалить этот элемент из списка?')) {
        delete LIGHT_DATA[key]; 
        delete EXTRA_DATA[key]; 
        delete RAIL_DATA[key];
        delete prices[key]; 
        delete CUSTOM_REGISTRY[key];
        
        if (key.startsWith('custom_') && currentUser && currentUser.uid && db) {
            db.collection('users').doc(currentUser.uid).collection('customElements').doc(key).delete().catch(console.error);
        }
        
        saveAllSettings(); 
        initSelectors(); 
        renderPriceList();
    }
}

function toggleAddForm() {
    if(currentUser.plan === 'free') return;
    const form = document.getElementById('addForm');
    const btn = document.getElementById('btnShowAdd');
    form.classList.toggle('visible');
    btn.style.display = form.classList.contains('visible') ? 'none' : 'block';
    if (form.classList.contains('visible')) {
        document.getElementById('newElName').value = '';
        document.getElementById('newElPrice').value = '';
    }
}

function toggleShapeSelect() {
    const type = document.getElementById('newElType').value;
    document.getElementById('newElShape').style.display = type === 'linear' ? 'none' : 'block';
}

function addNewElementConfirm() {
    if(currentUser.plan === 'free') { 
        alert("Доступно только в PRO"); 
        return; 
    }
    
    const name = document.getElementById('newElName').value;
    const price = parseFloat(document.getElementById('newElPrice').value);
    const type = document.getElementById('newElType').value;
    const shape = document.getElementById('newElShape').value;
    
    if (!name || isNaN(price)) { 
        alert("Введите название и цену"); 
        return; 
    }
    
    const id = 'custom_' + Date.now();
    const newEl = { 
        label: name, 
        price: price, 
        type: type, 
        shape: shape,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    EXTRA_DATA[id] = newEl; 
    prices[id] = price; 
    CUSTOM_REGISTRY[id] = newEl;
    
    if (currentUser && currentUser.uid && db) {
        db.collection('users').doc(currentUser.uid).collection('customElements').doc(id).set(newEl)
            .then(() => console.log("✅ Элемент сохранен в облако"))
            .catch((error) => {
                console.error("❌ Ошибка сохранения:", error);
                alert("Элемент сохранен локально, но не синхронизирован с облаком.");
            });
    }
    
    saveAllSettings(); 
    initSelectors(); 
    toggleAddForm(); 
    renderPriceList();
}

const tabs = document.getElementById("tabs");
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
// Функция для центрирования помещения на экране
function centerView() {
    const r = rooms[activeRoom];
    if (!r || r.points.length === 0) return;
    
    // Находим границы помещения
    let minX = Math.min(...r.points.map(p => p.x));
    let maxX = Math.max(...r.points.map(p => p.x));
    let minY = Math.min(...r.points.map(p => p.y));
    let maxY = Math.max(...r.points.map(p => p.y));
    
    // Добавляем отступы
    const padding = 500; // 500 мм = 50 см
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    const container = document.getElementById('canvas-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Рассчитываем масштаб, чтобы поместилось с запасом
    const scaleX = (containerWidth * 0.9) / (width * MM_TO_PX);
    const scaleY = (containerHeight * 0.9) / (height * MM_TO_PX);
    scale = Math.min(scaleX, scaleY);
    
    // Центрируем
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    offsetX = containerWidth / 2 - centerX * MM_TO_PX * scale;
    offsetY = containerHeight / 2 - centerY * MM_TO_PX * scale;
    
    updateZoomLevel();
    draw();
}
// Функция для установки масштаба под размер 5x5 метров
function setScaleFor5x5() {
    // Размер помещения в мм (5м = 5000мм)
    const roomWidth = 5000;
    const roomHeight = 5000;
    
    // Получаем размеры canvas контейнера
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Проверяем, что контейнер имеет ненулевые размеры
    if (containerWidth === 0 || containerHeight === 0) {
        console.log("⚠️ Контейнер еще не загружен, пробуем позже");
        setTimeout(() => setScaleFor5x5(), 50);
        return;
    }
    
    // Переводим мм в пиксели (коэффициент MM_TO_PX = 3.78)
    const roomWidthPx = roomWidth * MM_TO_PX;
    const roomHeightPx = roomHeight * MM_TO_PX;
    
    // Рассчитываем масштаб с запасом 20%
    const scaleX = (containerWidth * 0.8) / roomWidthPx;
    const scaleY = (containerHeight * 0.8) / roomHeightPx;
    
    // Берем меньший масштаб, чтобы поместилось по ширине и высоте
    let newScale = Math.min(scaleX, scaleY);
    
    // Ограничиваем масштаб разумными пределами
    scale = Math.max(0.1, Math.min(1.0, newScale));
    
    // Центрируем пустой холст
    offsetX = containerWidth / 2;
    offsetY = containerHeight / 2;
    
    updateZoomLevel();
    console.log("📐 Масштаб установлен для 5x5 метров:", scale.toFixed(3), 
                "Размер контейнера:", containerWidth, "x", containerHeight);
}
// --- Мобильные переменные ---
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

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

// Добавьте это где-нибудь в начале файла, после объявления переменных
document.addEventListener('DOMContentLoaded', function() {
    // Принудительно привязываем обработчики к пунктам меню
    const rotateMenuItem = document.getElementById('menu-rotate');
    if (rotateMenuItem) {
        // Удаляем старый onclick и добавляем новый
        rotateMenuItem.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("🖱️ Клик по пункту Повернуть");
            menuRotate();
            return false;
        };
    }
    
    const deleteMenuItem = document.getElementById('menu-delete');
    if (deleteMenuItem) {
        deleteMenuItem.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            menuDelete();
            return false;
        };
    }
    
    const editLengthMenuItem = document.getElementById('menu-edit-length');
    if (editLengthMenuItem) {
        editLengthMenuItem.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            menuEditLength();
            return false;
        };
    }
});

function setMobileTool(tool) {
    mobileTool = tool;
    document.querySelectorAll('.mobile-tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`mobile-tool-${tool}`).classList.add('active');
    selectedElement = null;
    selectedPointId = null;
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

function generateFullEstimate() {
    let totalArea = 0, totalPerim = 0, globalElements = {}; 
    rooms.forEach(r => {
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length;
            p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        totalArea += r.closed ? Math.abs(a/2)/1000000 : 0;
        totalPerim += (p/1000);
        if (r.elements) {
            r.elements.forEach(el => {
                let key = el.type === 'pipe' ? 'pipe' : el.subtype;
                if (!globalElements[key]) globalElements[key] = { count: 0, length: 0 };
                globalElements[key].count++;
                if (el.width) globalElements[key].length += (el.width / 1000);
            });
        }
    });
    
    let totalSum = 0, rowsHTML = "";
    let priceM2 = prices['Полотно (м2)'] || 0;
    let costArea = totalArea * priceM2;
    totalSum += costArea;
    rowsHTML += `<tr><td>Полотно (ПВХ)</td><td>${totalArea.toFixed(2)} м²</td><td>${priceM2}</td><td>${costArea.toFixed(0)}</td></tr>`;
    
    let priceMP = prices['Профиль (м.п.)'] || 0;
    let costPerim = totalPerim * priceMP;
    totalSum += costPerim;
    rowsHTML += `<tr><td>Профиль стеновой</td><td>${totalPerim.toFixed(2)} м.п.</td><td>${priceMP}</td><td>${costPerim.toFixed(0)}</td></tr>`;
    
    for (let key in globalElements) {
        let data = globalElements[key];
        let def = getElementDef(key);
        let price = prices[key] || 0;
        let sum = 0;
        let qtyString = "";
        if (key === 'pipe') {
            sum = data.count * price;
            qtyString = `${data.count} шт.`;
        } else if (def.type === 'linear') {
            sum = data.length * price;
            qtyString = `${data.length.toFixed(2)} м.п.`;
        } else {
            sum = data.count * price;
            qtyString = `${data.count} шт.`;
        }
        totalSum += sum;
        let displayName = def.label || (key === 'pipe' ? 'Обвод трубы' : key);
        rowsHTML += `<tr><td>${displayName}</td><td>${qtyString}</td><td>${price}</td><td>${sum.toFixed(0)}</td></tr>`;
    }
    
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Смета</title><style>body{font-family:sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:12px}.total{margin-top:20px;font-size:24px;background:#2c3e50;color:white;padding:20px;text-align:right}</style></head><body><h1>СМЕТА ПО ОБЪЕКТУ</h1><table><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="total">ИТОГО: ${totalSum.toFixed(0)} руб.</div></body></html>`);
    win.document.close();
}

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
                if (!isExport && isMobile) {
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
    if (r.points.length > 0 && !r.closed && !dragId && !dragElem && !isExport && currentTool === 'draw' && !isMobile) {
        let last = r.points[r.points.length - 1];
        let first = r.points[0];
        let rawX = pxToMm(mousePos.x, 'x');
        let rawY = pxToMm(mousePos.y, 'y');
        let sX = snap(rawX, first ? first.x : null);
        let sY = snap(rawY, first ? first.y : null);
        
        // Умный луч - привязка к горизонтали/вертикали
        if (!mousePos.shift) {
            if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
                sY = last.y;
            } else {
                sX = last.x;
            }
        }
        
        // Проверка наведения на первую точку
        isHoveringFirstPoint = (r.points.length >= 3 && first && 
            Math.sqrt((mousePos.x - mmToPx(first.x, 'x'))**2 + 
                      (mousePos.y - mmToPx(first.y, 'y'))**2) < 25);
        
        // Рисуем пунктирную линию от последней точки до курсора
        svg.appendChild(createLine(
            mmToPx(last.x, 'x'), mmToPx(last.y, 'y'),
            mmToPx(sX, 'x'), mmToPx(sY, 'y'),
            isHoveringFirstPoint ? "var(--success)" : "var(--primary)",
            2, "6,4"
        ));
        
        // Если рядом с первой точкой - показываем пунктир до неё
        if (first && (Math.abs(sX - first.x) < 2 || Math.abs(sY - first.y) < 2)) {
            svg.appendChild(createLine(
                mmToPx(first.x, 'x'), mmToPx(first.y, 'y'),
                mmToPx(sX, 'x'), mmToPx(sY, 'y'),
                "#bbb", 1, "4,4"
            ));
        }
        
        // Отображаем текущий размер
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
            g.setAttribute("transform", `rotate(${el.rotation || 0}, ${mmToPx(el.x, 'x')}, ${mmToPx(el.y, 'y')})`);
            
            const isLinear = def.type === 'linear' || el.type === 'rail';
            
            if (r.closed && showMeasures) drawElementMeasures(el, r);
            
            if (isLinear) {
                let w = el.width || 2000;
                let color = el.type === 'rail' ? "#fb8c00" : (el.subtype === 'TRACK' ? "#333" : "var(--light)");
                let line = createLine(mmToPx(el.x - w/2, 'x'), mmToPx(el.y, 'y'), mmToPx(el.x + w/2, 'x'), mmToPx(el.y, 'y'), color, 5);
                line.setAttribute("stroke-linecap", "round");
                g.appendChild(line);
                
                let label = renderText(mmToPx(el.x, 'x'), mmToPx(el.y, 'y') - 10, `${w/10} см`, el.type === 'rail' ? "rail-label" : "light-label");
                
                if (!isExport && isMobile) {
                    label.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openElementResize(el);
                    }, { passive: false });
                } else if (!isExport) {
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
            } else {
                g.appendChild(drawSymbol(el, def));
            }
            
            if (!isExport) {
                if (isMobile) {
                    g.addEventListener('touchstart', (e) => handleElementTouchStart(el, idx, e), { passive: false });
                    g.addEventListener('touchend', (e) => handleElementTouchEnd(el, idx, e), { passive: false });
                    g.addEventListener('touchmove', handleElementTouchMove, { passive: false });
                    g.addEventListener('touchcancel', cancelLongPress, { passive: false });
                } else {
                    g.onmousedown = (e) => {
                        e.stopPropagation();
                        if (e.altKey) {
                            saveState();
                            let copy = JSON.parse(JSON.stringify(el));
                            r.elements.push(copy);
                            dragElem = copy;
                        } else {
                            saveState();
                            dragElem = el;
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
            
            if (isMobile) {
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

svg.onmousemove = (e) => {
    if (isMobile) return;
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
    if (isMobile) return;
    if (e.target === svg && currentTool === 'draw') {
        isPanning = true;
        startPanX = e.clientX - offsetX;
        startPanY = e.clientY - offsetY;
    }
};

window.onmouseup = () => {
    if (isMobile) return;
    isPanning = false;
    dragId = null;
    dragElem = null;
};

svg.onclick = (e) => {
    if (isMobile) return;
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
                    let name = el.type === 'pipe' ? 'Обвод трубы' : (LIGHT_DATA[el.subtype]?.label || EXTRA_DATA[el.subtype]?.label || RAIL_DATA[el.subtype]?.label || el.subtype);
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
            let name = el.type === 'pipe' ? 'Обвод трубы' : (LIGHT_DATA[el.subtype]?.label || EXTRA_DATA[el.subtype]?.label || RAIL_DATA[el.subtype]?.label || el.subtype);
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

function updateZoomLevel() {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = Math.round(scale * 100) + '%';
    }
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

// --- Мобильные функции ---
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
            // В любом другом режиме показываем контекстное меню
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
    
    // Если это было короткое нажатие без движения
    if (!touchState.moved) {
        console.log("👆 Короткое нажатие на элемент, idx:", idx);
        
        if (mobileTool === 'delete') {
            // В режиме удаления - удаляем
            if (confirm('Удалить этот элемент?')) {
                saveState();
                rooms[activeRoom].elements.splice(idx, 1);
                draw();
            }
        } else {
            // В любом другом режиме показываем контекстное меню
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

function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
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

function showElementContextMenu(el) {
    const menu = document.getElementById('elementContextMenu');
    if (!menu) {
        console.error("❌ Контекстное меню не найдено");
        return;
    }
    
    // СОХРАНЯЕМ В ГЛОБАЛЬНУЮ ПЕРЕМЕННУЮ И В DATA-АТРИБУТ
    selectedElement = el;
    window.currentContextElement = el; // Дополнительное сохранение
    
    console.log("✅ Открыто меню для элемента:", el);
    console.log("  - Тип:", el.type);
    console.log("  - Подтип:", el.subtype);
    console.log("  - Координаты:", el.x, el.y);
    
    const hasLength = el.width !== undefined;
    const lengthItem = document.getElementById('menu-edit-length');
    if (lengthItem) {
        lengthItem.style.display = hasLength ? 'block' : 'none';
    }
    
    // Пункт "Повернуть" показываем для всех элементов
    const rotateItem = document.getElementById('menu-rotate');
    if (rotateItem) {
        rotateItem.style.display = 'block';
    }
    
    menu.style.display = 'flex';
    
    // Сохраняем индекс элемента для надежности
    const r = rooms[activeRoom];
    if (r && r.elements) {
        const index = r.elements.findIndex(e => e === el);
        if (index !== -1) {
            window.currentContextElementIndex = index;
            console.log("  - Индекс в массиве:", index);
        }
    }
}

function closeElementContextMenu() {
    document.getElementById('elementContextMenu').style.display = 'none';
    // НЕ очищаем selectedElement сразу, чтобы можно было использовать в меню
    // Очистим через небольшой таймаут
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
    
    // Пробуем получить элемент из разных мест
    let el = selectedElement || window.currentContextElement;
    
    if (!el) {
        console.error("❌ Нет выбранного элемента");
        // Попробуем найти элемент по сохраненному индексу
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

function drawSmartGuides(currentX, currentY, excludeId) {
    let r = rooms[activeRoom];
    if (!r) return;
    
    // Рисуем направляющие от текущей позиции до ближайших точек
    r.points.forEach(p => {
        if (p.id === excludeId) return;
        
        // Вертикальная направляющая
        if (Math.abs(p.x - currentX) < 20) {
            svg.appendChild(createLine(
                mmToPx(p.x, 'x'), 0,
                mmToPx(p.x, 'x'), svg.clientHeight,
                "rgba(0, 188, 212, 0.4)", 1, "5,5"
            ));
        }
        
        // Горизонтальная направляющая
        if (Math.abs(p.y - currentY) < 20) {
            svg.appendChild(createLine(
                0, mmToPx(p.y, 'y'),
                svg.clientWidth, mmToPx(p.y, 'y'),
                "rgba(0, 188, 212, 0.4)", 1, "5,5"
            ));
        }
    });
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

function addRoom() {
    if(currentUser && currentUser.plan === 'free' && rooms.length >= 1) {
        alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
        return;
    }
    saveState();
    
    // Создаем пустую комнату без точек
    rooms.push({
        name: "Полотно " + (rooms.length + 1),
        points: [],           // пустой массив точек
        id: Date.now(),
        closed: false,
        elements: []
    });
    
    activeRoom = rooms.length - 1;
    renderTabs();
    draw();
}function removeRoom(idx, e) {
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

function printPDF() {
    const printCont = document.getElementById("print-container");
    printCont.innerHTML = "";
    const savedActive = activeRoom;
    
    rooms.forEach((r, idx) => {
        activeRoom = idx;
        draw(true);
        
        const page = document.createElement("div");
        page.className = "print-page";
        
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length;
            p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        
        const svgClone = svg.cloneNode(true);
        page.innerHTML = `
            <div class="print-header">
                <h1>${r.name}</h1>
                <p>Площадь: <b>${r.closed ? (Math.abs(a/2)/1000000).toFixed(2) : "0.00"} м²</b> | Периметр: <b>${(p/1000).toFixed(2)} м</b></p>
            </div>
            <div class="print-canvas"></div>
            <table class="print-estimate">
                <thead><tr><th>Наименование</th><th>Кол-во</th></tr></thead>
                <tbody>${generateEstimateRows(r)}</tbody>
            </table>
        `;
        page.querySelector('.print-canvas').appendChild(svgClone);
        printCont.appendChild(page);
    });
    
    activeRoom = savedActive;
    draw();
    setTimeout(() => { window.print(); }, 600);
}

function generateEstimateRows(room) {
    if (!room.elements?.length) return '<tr><td colspan="2" style="text-align:center;">Элементы не добавлены</td></tr>';
    
    let counts = {};
    room.elements.forEach(el => {
        let name = el.type === 'pipe' ? 'Обвод трубы' : (LIGHT_DATA[el.subtype]?.label || EXTRA_DATA[el.subtype]?.label || RAIL_DATA[el.subtype]?.label || el.subtype);
        let key = el.width ? `${name} (${el.width/10} см)` : name;
        counts[key] = (counts[key] || 0) + 1;
    });
    
    return Object.entries(counts).map(([n, c]) => `<tr><td>${n}</td><td>${c} шт.</td></tr>`).join('');
}

// --- Функции управления проектами ---
function saveProject() {
    if (!currentUser || !currentUser.uid) {
        alert("Пожалуйста, войдите в систему для сохранения проектов.");
        return;
    }

    if (!db) {
        alert("База данных не доступна");
        return;
    }

    const projectName = prompt("Введите название проекта:", `Проект от ${new Date().toLocaleDateString()}`);
    if (!projectName || projectName.trim() === "") return;

    const projectData = JSON.parse(JSON.stringify(rooms));

    const project = {
        name: projectName.trim(),
        date: new Date().toISOString(),
        dateLocale: new Date().toLocaleString('ru-RU'),
        data: projectData
    };

    db.collection('users').doc(currentUser.uid).collection('projects').add(project)
        .then((docRef) => {
            console.log("✅ Проект сохранен с ID:", docRef.id);
            alert("✅ Проект успешно сохранен в облаке!");
        })
        .catch((error) => {
            console.error("❌ Ошибка сохранения проекта:", error);
            alert("Ошибка при сохранении в облако: " + error.message);
        });
}

function openProjectsModal() {
    if (!currentUser || !currentUser.uid) {
        alert("Войдите в систему для просмотра ваших проектов.");
        return;
    }
    if (!db) {
        alert("База данных не доступна");
        return;
    }

    const container = document.getElementById('projectsListContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px;">⏳ Загрузка проектов...</div>';

    document.getElementById('projectsModal').style.display = 'flex';

    db.collection('users').doc(currentUser.uid).collection('projects')
        .orderBy('date', 'desc')
        .get()
        .then((querySnapshot) => {
            container.innerHTML = "";

            if (querySnapshot.empty) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
                        <div style="font-size: 40px; margin-bottom: 10px;">📭</div>
                        <p>У вас пока нет сохраненных проектов.</p>
                    </div>`;
                return;
            }

            querySnapshot.forEach((doc) => {
                const project = doc.data();
                const projectId = doc.id;
                const displayDate = project.dateLocale || new Date(project.date).toLocaleString('ru-RU');

                const item = document.createElement('div');
                item.className = 'project-item';
                item.innerHTML = `
                    <div class="project-info">
                        <span class="project-name">${escapeHtml(project.name)}</span>
                        <span class="project-meta">${escapeHtml(displayDate)}</span>
                    </div>
                    <div class="project-actions">
                        <button class="btn-load" onclick="loadProject('${projectId}')">Открыть</button>
                        <button class="btn-delete" onclick="deleteProject('${projectId}')">❌</button>
                    </div>
                `;
                container.appendChild(item);
            });
        })
        .catch((error) => {
            console.error("Ошибка загрузки проектов:", error);
            container.innerHTML = `<div style="color: red; padding: 20px;">Ошибка загрузки: ${error.message}</div>`;
        });
}

function loadProject(projectId) {
    if (!currentUser || !currentUser.uid || !db) return;

    if (confirm("Загрузить этот проект? Текущая работа будет заменена.")) {
        db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).get()
            .then((doc) => {
                if (doc.exists) {
                    const project = doc.data();
                    rooms = JSON.parse(JSON.stringify(project.data));
                    activeRoom = 0;

                    if (typeof renderTabs === 'function') renderTabs();
                    if (typeof draw === 'function') draw();

                    closeProjectsModal();
                    alert(`Проект "${project.name}" загружен.`);
                } else {
                    alert("Проект не найден.");
                }
            })
            .catch((error) => {
                console.error("Ошибка загрузки проекта:", error);
                alert("Ошибка загрузки: " + error.message);
            });
    }
}

function deleteProject(projectId) {
    if (!currentUser || !currentUser.uid || !db) return;

    if (confirm("Вы уверены, что хотите удалить этот проект?")) {
        db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).delete()
            .then(() => {
                console.log("Проект удален");
                openProjectsModal();
            })
            .catch((error) => {
                console.error("Ошибка удаления:", error);
                alert("Ошибка удаления: " + error.message);
            });
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function closeProjectsModal() {
    document.getElementById('projectsModal').style.display = 'none';
}

// Функция для обновления масштаба при изменении размера окна
let resizeTimeout;
window.addEventListener('resize', function() {
    // Отменяем предыдущий таймаут
    clearTimeout(resizeTimeout);
    // Устанавливаем новый таймаут для предотвращения частых вызовов
    resizeTimeout = setTimeout(() => {
        setScaleFor5x5();
        draw();
    }, 100);
});

window.onclick = function(event) {
    const modal = document.getElementById('projectsModal');
    if (event.target == modal) {
        closeProjectsModal();
    }
    
    const addMenu = document.getElementById('addElementMenu');
    if (event.target == addMenu || (addMenu && !addMenu.contains(event.target) && addMenu.style.display === 'flex')) {
        addMenu.style.display = 'none';
    }
    
    const contextMenu = document.getElementById('elementContextMenu');
    if (event.target == contextMenu || (contextMenu && !contextMenu.contains(event.target) && contextMenu.style.display === 'flex')) {
        contextMenu.style.display = 'none';
    }
};