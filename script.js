// --- SAAS LOGIC ---
let currentUser = null;
let selectedRegPlan = 'free';
// --- УСКОРИТЕЛЬ РАБОТЫ ---
let drawRequested = false;

function requestDraw() {
    if (!drawRequested) {
        drawRequested = true;
        requestAnimationFrame(() => {
            draw();
            drawRequested = false;
        });
    }
}
// --- FIREBASE ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (добавь это) ---
let db; // переменная для базы данных
let auth; // переменная для авторизации

// Эта функция достанет нам сервисы Firebase после их загрузки
function initFirebaseServices() {
    if (typeof firebase !== 'undefined') {
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("✅ Firebase сервисы готовы к работе");
    } else {
        console.error("❌ Firebase не загрузился! Проверь скрипты в index.html");
        // Если Firebase не загрузился, можно показать сообщение пользователю
        alert("Ошибка загрузки облачных сервисов. Проверьте интернет-соединение.");
    }
}

// Вызываем функцию сразу после загрузки страницы, но нужно убедиться, что Firebase уже есть.
// В window.onload мы её вызовем.

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

async function handleLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    
    if(!email || !pass) { 
        alert("Введите email и пароль"); 
        return; 
    }
    
    // Получаем кнопку, которая вызвала это действие
    const button = event?.target || document.querySelector('.auth-btn');
    
    await withLoading(button, async () => {
        if (!auth) { 
            throw new Error("Сервис входа временно недоступен."); 
        }
        
        await auth.signInWithEmailAndPassword(email, pass);
        // Остальное сделает onAuthStateChanged
    });
}

function handleRegister() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const plan = selectedRegPlan; // выбранный тариф

    if(!name || !email || !pass) { alert("Заполните все поля"); return; }

    if (!auth) { alert("Сервис регистрации временно недоступен."); return; }

    // Показываем, что идет загрузка (можно добавить крутилку на кнопку)
    console.log("Пытаемся зарегистрировать...");

    // Создаем пользователя в Firebase Authentication
    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            // Успешно создан
            const user = userCredential.user;
            console.log("✅ Пользователь создан в Auth:", user.uid);

            // Обновляем профиль - добавляем имя
            return user.updateProfile({
                displayName: name
            }).then(() => {
                // Теперь создаем запись о пользователе в Firestore (база данных)
                // Сохраняем email, имя и выбранный тариф
                return db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    plan: plan,
                    registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        })
        .then(() => {
            console.log("✅ Данные пользователя сохранены в Firestore");
            // После успеха - выполняем вход (получаем свежие данные)
            // Функция auth.onAuthStateChanged сама подхватит нового пользователя
            // Но нам нужно сразу сказать приложению, что мы зашли.
            // Можно просто вызвать completeAuth, предварительно создав currentUser
            const currentFirebaseUser = auth.currentUser;
            if (currentFirebaseUser) {
                currentUser = {
                    name: name,
                    email: email,
                    uid: currentFirebaseUser.uid,
                    plan: plan
                };
                completeAuth();
            }
        })
        .catch((error) => {
            // Обрабатываем ошибки
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
// НОВАЯ ФУНКЦИЯ: Загружает план пользователя из Firestore
function loadUserPlanFromFirestore(uid) {
    if (!db) return;
    db.collection('users').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                if (currentUser) {
                    currentUser.plan = userData.plan || 'free';
                    console.log("План пользователя загружен:", currentUser.plan);
                    // Обновляем отображение плана в шапке
                    const headerPlan = document.getElementById('header-plan');
                    if (headerPlan) {
                        headerPlan.innerText = "План: " + currentUser.plan.toUpperCase();
                        if(currentUser.plan === 'pro') {
                            headerPlan.style.background = 'var(--gold)';
                            headerPlan.style.color = 'var(--dark)';
                        } else {
                            headerPlan.style.background = ''; // сбросить
                            headerPlan.style.color = '';
                        }
                    }
                }
            } else {
                console.log("Документ пользователя не найден, создаем...");
                // Если документа нет, создадим его с планом по умолчанию
                db.collection('users').doc(uid).set({
                    plan: 'free',
                    email: currentUser?.email || 'unknown'
                });
            }
        })
        .catch((error) => {
            console.error("Ошибка загрузки плана:", error);
        });
}

function completeAuth() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('header-user').innerText = currentUser.name;
    document.getElementById('header-plan').innerText = "План: " + currentUser.plan.toUpperCase();
    
    if(currentUser.plan === 'pro') {
        document.getElementById('header-plan').style.background = 'var(--gold)';
        document.getElementById('header-plan').style.color = 'var(--dark)';
    }

    // Загрузка данных приложения
    loadAllSettings();
    initSelectors();
    
    // Если в бесплатном плане уже есть комнаты, оставляем только одну (защита)
    if(currentUser.plan === 'free' && rooms.length > 1) {
        rooms = rooms.slice(0, 1);
        renderTabs();
        requestDraw();
    } else if (rooms.length === 0) {
        addRoom();
    }

    // ** ВАЖНО: инициализируем мобильные обработчики после входа **
    initTouchHandlers();
}

function handleLogout() {
    if(confirm("Выйти из системы?")) {
        if (auth) {
            auth.signOut().then(() => {
                console.log("✅ Выход выполнен");
                // После выхода перезагружаем страницу, чтобы вернуться к окну входа
                location.reload();
            }).catch((error) => {
                console.error("Ошибка выхода:", error);
            });
        } else {
            // Запасной вариант
            localStorage.removeItem('saas_last_user');
            location.reload();
        }
    }
}

// --- ФУНКЦИЯ ДЛЯ ПОКАЗА ЗАГРУЗКИ ---
async function withLoading(button, action) {
    // Сохраняем оригинальный текст кнопки
    const originalText = button.innerHTML;
    const originalDisabled = button.disabled;
    
    // Меняем на индикатор загрузки
    button.innerHTML = '<span class="loader"></span> Загрузка...';
    button.disabled = true;
    button.classList.add('btn-loading');
    
    try {
        // Выполняем действие (сохранение, вход и т.д.)
        await action();
    } catch (error) {
        console.error("Ошибка:", error);
        alert("Произошла ошибка: " + error.message);
    } finally {
        // Возвращаем кнопку в обычное состояние
        button.innerHTML = originalText;
        button.disabled = originalDisabled;
        button.classList.remove('btn-loading');
    }
}
// Проверка при загрузке страницы - ЗАМЕНИ ЭТУ ФУНКЦИЮ ПОЛНОСТЬЮ
window.onload = () => {
    // Сначала пытаемся инициализировать Firebase сервисы
    initFirebaseServices();

    // Проверяем, может быть, пользователь уже был залогинен ранее (в этом браузере)
    if (auth) { // если Firebase авторизация доступна
        auth.onAuthStateChanged((user) => { // слушаем состояние входа
            if (user) {
                // Пользователь уже вошел!
                console.log("Firebase: найден текущий пользователь", user.email);
                // Создаем объект currentUser в том формате, который ждет твое приложение
                currentUser = {
                    name: user.displayName || user.email.split('@')[0], // берем имя или часть почты
                    email: user.email,
                    uid: user.uid,
                    plan: 'free' // По умолчанию free. Позже будем брать из базы
                };
                // Загружаем его тариф из Firestore
                loadUserPlanFromFirestore(user.uid);
                // Завершаем вход (скрываем окно, показываем интерфейс)
                completeAuth();
            } else {
                // Пользователь не вошел, показываем окно входа
                console.log("Firebase: пользователь не найден, показываем вход");
                document.getElementById('auth-overlay').style.display = 'flex';
            }
        });
    } else {
        // Если Firebase не загрузился, можно включить старую систему как запасной вариант
        console.warn("Firebase не доступен, использую старую локальную систему.");
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


// --- CORE APPLICATION LOGIC (PRESERVED) ---
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
    
    // Блокировка кастомных элементов для Free
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

    const renderCategory = (data, catName) => {
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

    renderCategory(LIGHT_DATA, 'Освещение');
    renderCategory(EXTRA_DATA, 'Инженерные');
    renderCategory(RAIL_DATA, 'Карнизы');

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

function savePrices() { saveAllSettings(); closePriceModal(); updateStats(); }

function deleteElement(key) {
    if(confirm('Удалить этот элемент из списка?')) {
        delete LIGHT_DATA[key]; delete EXTRA_DATA[key]; delete RAIL_DATA[key];
        delete prices[key]; delete CUSTOM_REGISTRY[key];
        saveAllSettings(); initSelectors(); renderPriceList();
    }
}

function toggleAddForm() {
    if(currentUser.plan === 'free') return; // Защита
    const form = document.getElementById('addForm');
    const btn = document.getElementById('btnShowAdd');
    if (form.classList.contains('visible')) {
        form.classList.remove('visible');
        btn.style.display = 'block';
    } else {
        form.classList.add('visible');
        btn.style.display = 'none';
        document.getElementById('newElName').value = '';
        document.getElementById('newElPrice').value = '';
    }
}

function toggleShapeSelect() {
    const type = document.getElementById('newElType').value;
    const shapeSel = document.getElementById('newElShape');
    shapeSel.style.display = (type === 'linear') ? 'none' : 'block';
}

function addNewElementConfirm() {
    if(currentUser.plan === 'free') { alert("Доступно только в PRO"); return; }
    const name = document.getElementById('newElName').value;
    const price = parseFloat(document.getElementById('newElPrice').value);
    const type = document.getElementById('newElType').value;
    const shape = document.getElementById('newElShape').value;
    if (!name || isNaN(price)) { alert("Введите название и цену"); return; }
    const id = 'custom_' + Date.now();
    const newEl = { label: name, price: price, type: type, shape: shape };
    EXTRA_DATA[id] = newEl; prices[id] = price; CUSTOM_REGISTRY[id] = newEl;
    saveAllSettings(); initSelectors(); toggleAddForm(); renderPriceList();
}

const tabs = document.getElementById("tabs");
const GRID_SNAP_MM = 10; 
const LIGHT_SNAP_MM = 50; 
const MM_TO_PX = 3.78;

let scale = 0.18;
let offsetX = 100;
let offsetY = 100;

let dragId = null;
let dragElem = null;
let isPanning = false;
let startPanX, startPanY;
let mousePos = { x: 0, y: 0, shift: false };
let isHoveringFirstPoint = false;
let currentTool = 'draw';
let showDiagonals = true;
let showMeasures = true;
let rooms = [];
let activeRoom = 0;
// --- УМНАЯ ИСТОРИЯ ДЕЙСТВИЙ ---
class HistoryManager {
    constructor(maxSize = 50) {
        this.stack = [];
        this.maxSize = maxSize;
        this.currentIndex = -1;
    }
    
    push(state) {
        if (this.currentIndex < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
        }
        
        this.stack.push(JSON.stringify(state));
        if (this.stack.length > this.maxSize) {
            this.stack.shift();
        }
        this.currentIndex = this.stack.length - 1;
    }
    
    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return JSON.parse(this.stack[this.currentIndex]);
        }
        return null;
    }
    
    redo() {
        if (this.currentIndex < this.stack.length - 1) {
            this.currentIndex++;
            return JSON.parse(this.stack[this.currentIndex]);
        }
        return null;
    }
}

const history = new HistoryManager();
// --- Переменные для мобильного управления ---
let touchState = {
    isPinching: false,
    isPanning: false,
    initialDistance: 0,
    initialScale: 1,
    touchStartX: 0,
    touchStartY: 0,
    lastPanX: 0,
    lastPanY: 0,
    dragId: null,          // для перетаскивания точек
    dragElem: null,        // для перетаскивания элементов
    moved: false,          // был ли сдвиг после касания (чтобы отличить тап от свайпа)
    MOVE_THRESHOLD: 5,      // порог движения в пикселях
    longPressTimer: null,
    isLongPress: false,
    rotationCandidate: null,     // элемент, который будем вращать
    initialAngle: 0,             // начальный угол касания для вращения
    initialRotation: 0           // начальный поворот элемента
};

// Определяем, мобильное ли устройство
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

function mirrorRoom() {
    ;
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
    requestDraw();
}

function drawSmartGuides(currentX, currentY, excludeId) {
    let r = rooms[activeRoom];
    if (!r) return;
    r.points.forEach(p => {
        if (p.id === excludeId) return;
        if (Math.abs(p.x - currentX) < 20) {
            svg.appendChild(createLine(mmToPx(p.x, 'x'), 0, mmToPx(p.x, 'x'), svg.clientHeight, "rgba(0, 188, 212, 0.4)", 1, "5,5"));
        }
        if (Math.abs(p.y - currentY) < 20) {
            svg.appendChild(createLine(0, mmToPx(p.y, 'y'), svg.clientWidth, mmToPx(p.y, 'y'), "rgba(0, 188, 212, 0.4)", 1, "5,5"));
        }
    });
}

function generateFullEstimate() {
    let totalArea = 0; let totalPerim = 0; let globalElements = {}; 
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
    let totalSum = 0; let rowsHTML = "";
    let priceM2 = prices['Полотно (м2)'] || 0; let costArea = totalArea * priceM2; totalSum += costArea;
    rowsHTML += `<tr><td>Полотно (ПВХ)</td><td>${totalArea.toFixed(2)} м²</td><td>${priceM2}</td><td>${costArea.toFixed(0)}</td></tr>`;
    let priceMP = prices['Профиль (м.п.)'] || 0; let costPerim = totalPerim * priceMP; totalSum += costPerim;
    rowsHTML += `<tr><td>Профиль стеновой</td><td>${totalPerim.toFixed(2)} м.п.</td><td>${priceMP}</td><td>${costPerim.toFixed(0)}</td></tr>`;
    for (let key in globalElements) {
        let data = globalElements[key]; let def = getElementDef(key); let price = prices[key] || 0; let sum = 0; let qtyString = "";
        if (key === 'pipe') { sum = data.count * price; qtyString = `${data.count} шт.`; } 
        else if (def.type === 'linear') { sum = data.length * price; qtyString = `${data.length.toFixed(2)} м.п.`; } 
        else { sum = data.count * price; qtyString = `${data.count} шт.`; }
        totalSum += sum;
        let displayName = def.label || (key === 'pipe' ? 'Обвод трубы' : key);
        rowsHTML += `<tr><td>${displayName}</td><td>${qtyString}</td><td>${price}</td><td>${sum.toFixed(0)}</td></tr>`;
    }
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Смета</title><style>body{font-family:sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:12px}.total{margin-top:20px;font-size:24px;background:#2c3e50;color:white;padding:20px;text-align:right}</style></head><body><h1>СМЕТА ПО ОБЪЕКТУ</h1><table><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="total">ИТОГО: ${totalSum.toFixed(0)} руб.</div></body></html>`);
    win.document.close();
}

// --- ЭКСПОРТ В EXCEL ---
function exportEstimateToExcel() {
    // Собираем данные для сметы
    let totalArea = 0, totalPerim = 0;
    let elements = {};
    
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
                if (!elements[key]) elements[key] = { count: 0, length: 0 };
                elements[key].count++;
                if (el.width) elements[key].length += (el.width / 1000);
            });
        }
    });
    
    // Формируем строки для Excel
    let rows = [
        ['Наименование', 'Количество', 'Цена (руб)', 'Сумма (руб)']
    ];
    
    // Полотно
    let priceM2 = prices['Полотно (м2)'] || 0;
    rows.push(['Полотно (ПВХ)', totalArea.toFixed(2) + ' м²', priceM2, (totalArea * priceM2).toFixed(0)]);
    
    // Профиль
    let priceMP = prices['Профиль (м.п.)'] || 0;
    rows.push(['Профиль стеновой', totalPerim.toFixed(2) + ' м.п.', priceMP, (totalPerim * priceMP).toFixed(0)]);
    
    // Элементы
    for (let key in elements) {
        let def = getElementDef(key);
        let price = prices[key] || 0;
        let qty = '';
        let sum = 0;
        
        if (key === 'pipe') {
            qty = elements[key].count + ' шт.';
            sum = elements[key].count * price;
        } else if (def && def.type === 'linear') {
            qty = elements[key].length.toFixed(2) + ' м.п.';
            sum = elements[key].length * price;
        } else {
            qty = elements[key].count + ' шт.';
            sum = elements[key].count * price;
        }
        
        let name = def?.label || (key === 'pipe' ? 'Обвод трубы' : key);
        rows.push([name, qty, price, sum.toFixed(0)]);
    }
    
    // ИТОГО
    let total = rows.slice(2).reduce((acc, row) => acc + parseFloat(row[3] || 0), 0);
    rows.push(['ИТОГО', '', '', total.toFixed(0)]);
    
    // Преобразуем в CSV (формат Excel)
    let csv = rows.map(row => row.join(';')).join('\n');
    
    // Добавляем BOM для правильного отображения русских букв
    let blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    
    // Создаем ссылку для скачивания
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'смета_' + new Date().toLocaleDateString() + '.csv';
    link.click();
}
function saveState() {
    history.push(rooms);
}

function undo() {
    // ✅ Добавляем защиту от множественных вызовов
    if (window.isUndoing) return;
    window.isUndoing = true;
    
    const prevState = history.undo();
    if (prevState) {
        rooms = prevState;
        if (activeRoom >= rooms.length) activeRoom = Math.max(0, rooms.length - 1);
        renderTabs(); 
        requestDraw();
    }
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
        window.isUndoing = false;
    }, 300);
}

// Добавьте новую функцию для возврата действия (Ctrl+Y или Ctrl+Shift+Z)
function redo() {
    const nextState = history.redo();
    if (nextState) {
        rooms = nextState;
        if (activeRoom >= rooms.length) activeRoom = Math.max(0, rooms.length - 1);
        renderTabs(); requestDraw();
    }
}

function setTool(tool) {
    currentTool = (currentTool === tool) ? 'draw' : tool;
    document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool);
    if (btn && currentTool !== 'draw') btn.classList.add('active');
}

function toggleDiagonals() { showDiagonals = !showDiagonals; document.getElementById("toggleDiags").classList.toggle("btn-toggle-active", showDiagonals); requestDraw(); }

function toggleMeasures() { showMeasures = !showMeasures; document.getElementById("toggleMeasures").classList.toggle("btn-toggle-active", showMeasures); requestDraw(); }

function renameRoom() {
    let r = rooms[activeRoom];
    let newName = prompt("Введите название помещения:", r.name);
    if (newName) { saveState(); r.name = newName; renderTabs(); updateStats(); }
}

function mmToPx(mm, axis) { return axis === 'x' ? (mm * MM_TO_PX * scale) + offsetX : (mm * MM_TO_PX * scale) + offsetY; }
function pxToMm(px, axis) { return axis === 'x' ? (px - offsetX) / (MM_TO_PX * scale) : (px - offsetY) / (MM_TO_PX * scale); }

function snap(mm, firstMm = null, step = GRID_SNAP_MM) {
    if (firstMm !== null && Math.abs(mm - firstMm) < 50) return firstMm;
    return Math.round(mm / step) * step;
}

function getSnappedPos(mx, my, currentEl = null) {
    let r = rooms[activeRoom]; let fx = snap(mx, null, LIGHT_SNAP_MM); let fy = snap(my, null, LIGHT_SNAP_MM);
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
        for (let x = offsetX % s100; x < svg.clientWidth; x += s100) svg.appendChild(createLine(x, 0, x, svg.clientHeight, "#f1f1f1", 0.5));
        for (let y = offsetY % s100; y < svg.clientHeight; y += s100) svg.appendChild(createLine(0, y, svg.clientWidth, y, "#f1f1f1", 0.5));
    }
}

function draw(isExport = false) {
    svg.innerHTML = ""; if (!isExport) drawGrid();
    let r = rooms[activeRoom]; if (!r) return;
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
    if (r.points.length > 0 && !r.closed && !dragId && !dragElem && !isExport && currentTool === 'draw' && !isMobile) {
        let last = r.points[r.points.length - 1]; let first = r.points[0];
        let rawX = pxToMm(mousePos.x, 'x'); let rawY = pxToMm(mousePos.y, 'y');
        let sX = snap(rawX, first.x); let sY = snap(rawY, first.y);
        if (!mousePos.shift) { if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) sY = last.y; else sX = last.x; }
        isHoveringFirstPoint = (r.points.length >= 3 && Math.sqrt((mousePos.x - mmToPx(first.x, 'x'))**2 + (mousePos.y - mmToPx(first.y, 'y'))**2) < 25);
        if (Math.abs(sX - first.x) < 2 || Math.abs(sY - first.y) < 2) { svg.appendChild(createLine(mmToPx(first.x, 'x'), mmToPx(first.y, 'y'), mmToPx(sX, 'x'), mmToPx(sY, 'y'), "#bbb", 1, "4,4")); }
        svg.appendChild(createLine(mmToPx(last.x, 'x'), mmToPx(last.y, 'y'), mmToPx(sX, 'x'), mmToPx(sY, 'y'), isHoveringFirstPoint ? "var(--success)" : "var(--primary)", 2, "6,4"));
        let dist = Math.round(Math.sqrt((sX - last.x)**2 + (sY - last.y)**2) / 10);
        if (dist > 0) renderText(mmToPx((last.x + sX)/2, 'x'), mmToPx((last.y + sY)/2, 'y') - 10, dist + " см", "live-label");
    }
    if (r.points.length > 0) {
        let pts = r.points.map(p => `${mmToPx(p.x, 'x')},${mmToPx(p.y, 'y')}`).join(" ");
        let poly = document.createElementNS("http://www.w3.org/2000/svg", r.closed ? "polygon" : "polyline");
        poly.setAttribute("points", pts); poly.setAttribute("fill", r.closed ? "rgba(0,188,212,0.05)" : "none");
        poly.setAttribute("stroke", "#2c3e50"); poly.setAttribute("stroke-width", 2.5); svg.appendChild(poly);
        r.points.forEach((p, i) => {
            if (!r.closed && i === r.points.length - 1) return;
            let pNext = r.points[(i + 1) % r.points.length];
            let d = Math.round(Math.sqrt((pNext.x-p.x)**2 + (pNext.y-p.y)**2)/10);
            if (d > 0) {
                let txt = renderText(mmToPx((p.x+pNext.x)/2, 'x'), mmToPx((p.y+pNext.y)/2, 'y'), d + " см", "length-label");
                if (!isExport) txt.onclick = () => resizeWall(i);
            }
        });
    }
    if (r.elements) {
        r.elements.forEach((el, idx) => {
            let def = getElementDef(el.subtype);
            let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("transform", `rotate(${el.rotation || 0}, ${mmToPx(el.x, 'x')}, ${mmToPx(el.y, 'y')})`);
            const isLinear = def.type === 'linear' || el.type === 'rail';
            if (r.closed && showMeasures) drawElementMeasures(el, r);
            if (isLinear) {
                let w = el.width || 2000; let color = el.type === 'rail' ? "#fb8c00" : (el.subtype === 'TRACK' ? "#333" : "var(--light)");
                let line = createLine(mmToPx(el.x - w/2, 'x'), mmToPx(el.y, 'y'), mmToPx(el.x + w/2, 'x'), mmToPx(el.y, 'y'), color, 5);
                line.setAttribute("stroke-linecap", "round"); g.appendChild(line);
                let label = renderText(mmToPx(el.x, 'x'), mmToPx(el.y, 'y') - 10, `${w/10} см`, el.type === 'rail' ? "rail-label" : "light-label");
                if (!isExport) label.onclick = (e) => { e.stopPropagation(); let nl = prompt("Длина (см):", w/10); if (nl && !isNaN(nl)) { saveState(); el.width = nl * 10; requestDraw(); } };
            } else { g.appendChild(drawSymbol(el, def)); }
            if (!isExport) {
                g.onmousedown = (e) => { e.stopPropagation(); if (e.altKey) { saveState(); let copy = JSON.parse(JSON.stringify(el)); r.elements.push(copy); dragElem = copy; } else { saveState(); dragElem = el; } };
                g.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); saveState(); r.elements.splice(idx, 1); requestDraw(); };
            }
            svg.appendChild(g);
        });
    }
    if (!isExport) {
        r.points.forEach((p, i) => {
            let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", mmToPx(p.x, 'x')); c.setAttribute("cy", mmToPx(p.y, 'y')); c.setAttribute("r", 5);
            c.setAttribute("fill", "white"); c.setAttribute("stroke", "#e74c3c"); c.setAttribute("stroke-width", 2);
            c.onmousedown = (e) => { e.stopPropagation(); if (currentTool === 'draw') { saveState(); dragId = p.id; } };
            c.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); saveState(); r.points.splice(i, 1); if (r.points.length < 3) r.closed = false; requestDraw(); };
            svg.appendChild(c);
        });
    }
    updateStats();
}

function drawSymbol(el, def) {
    let cx = mmToPx(el.x, 'x'), cy = mmToPx(el.y, 'y');
    let s = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const colors = { light: "var(--light)", extra: "#2c3e50", danger: "#ff5252" };
    if (el.subtype === 'GX53') { s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="black" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="black"/>`; return s; }
    if (el.subtype === 'CHANDELIER') { s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="10" fill="white" stroke="black" stroke-width="1.5"/><path d="M${cx-7} ${cy} L${cx+7} ${cy} M${cx} ${cy-7} L${cx} ${cy+7} M${cx-5} ${cy-5} L${cx+5} ${cy+5} M${cx+5} ${cy-5} L${cx-5} ${cy+5}" stroke="black" stroke-width="1"/>`; return s; }
    if (el.subtype === 'FIRE_ALARM') { s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="${colors.danger}" stroke-width="2"/><path d="M${cx-4} ${cy-4} L${cx+4} ${cy+4} M${cx+4} ${cy-4} L${cx-4} ${cy+4}" stroke="${colors.danger}" stroke-width="1.5"/>`; return s; }
    if (el.type === 'pipe') { s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="6" fill="#9e9e9e" stroke="black" stroke-width="1"/><path d="M${cx-3} ${cy-3} L${cx+3} ${cy+3}" stroke="white" stroke-width="1"/>`; return s; }
    let shape = def.shape || 'circle'; let fill = def.type === 'service' ? '#e0f7fa' : 'white'; let stroke = '#2c3e50';
    if (def.type === 'service') { s.innerHTML = `<path d="M${cx} ${cy-10} L${cx+2} ${cy-3} L${cx+9} ${cy-3} L${cx+3} ${cy+2} L${cx+5} ${cy+9} L${cx} ${cy+5} L${cx-5} ${cy+9} L${cx-3} ${cy+2} L${cx-9} ${cy-3} L${cx-2} ${cy-3} Z" fill="#ffd700" stroke="#f57f17" stroke-width="1"/>`; return s; }
    if (shape === 'square') s.innerHTML = `<rect x="${cx-9}" y="${cy-9}" width="18" height="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    else if (shape === 'triangle') s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+9},${cy+8} ${cx-9},${cy+8}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    else if (shape === 'diamond') s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+10},${cy} ${cx},${cy+10} ${cx-10},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    else s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2" fill="${stroke}"/>`;
    return s;
}

function drawElementMeasures(el, room) {
    let def = getElementDef(el.subtype);
    const isLinear = def.type === 'linear' || el.type === 'rail';
    let anchorPoints = [];
    if (isLinear) {
        let w = (el.width || 2000) / 2; let rad = (el.rotation || 0) * Math.PI / 180;
        anchorPoints.push({ x: el.x - w * Math.cos(rad), y: el.y - w * Math.sin(rad) });
        anchorPoints.push({ x: el.x + w * Math.cos(rad), y: el.y + w * Math.sin(rad) });
    } else anchorPoints.push({ x: el.x, y: el.y });
    anchorPoints.forEach(pt => {
        let dists = [];
        for (let i = 0; i < room.points.length; i++) {
            let p1 = room.points[i]; let p2 = room.points[(i + 1) % room.points.length];
            if (Math.abs(p1.x - p2.x) < 1 && pt.y >= Math.min(p1.y, p2.y) && pt.y <= Math.max(p1.y, p2.y)) dists.push({ axis: 'x', val: p1.x, d: Math.abs(pt.x - p1.x), pt: pt });
            else if (Math.abs(p1.y - p2.y) < 1 && pt.x >= Math.min(p1.x, p2.x) && pt.x <= Math.max(p1.x, p2.x)) dists.push({ axis: 'y', val: p1.y, d: Math.abs(pt.y - p1.y), pt: pt });
        }
        let bX = dists.filter(d => d.axis === 'x').sort((a, b) => a.d - b.d)[0];
        let bY = dists.filter(d => d.axis === 'y').sort((a, b) => a.d - b.d)[0];
        if (bX) { svg.appendChild(createLine(mmToPx(bX.pt.x, 'x'), mmToPx(bX.pt.y, 'y'), mmToPx(bX.val, 'x'), mmToPx(bX.pt.y, 'y'), "var(--danger)", 0.8, "2,2")); renderText(mmToPx(bX.pt.x + (bX.val > bX.pt.x ? 100 : -100), 'x'), mmToPx(bX.pt.y, 'y') - 5, Math.round(bX.d / 10) + " см", "measure-label"); }
        if (bY) { svg.appendChild(createLine(mmToPx(bY.pt.x, 'x'), mmToPx(bY.pt.y, 'y'), mmToPx(bY.pt.x, 'x'), mmToPx(bY.val, 'y'), "var(--danger)", 0.8, "2,2")); renderText(mmToPx(bY.pt.x, 'x') + 15, mmToPx(bY.pt.y + (bY.val > bY.pt.y ? 100 : -100), 'y'), Math.round(bY.d / 10) + " см", "measure-label"); }
    });
}

svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect(); mousePos.x = e.clientX - rect.left; mousePos.y = e.clientY - rect.top; mousePos.shift = e.shiftKey;
    if (isPanning) { offsetX = e.clientX - startPanX; offsetY = e.clientY - startPanY; requestDraw(); return; }
    if (dragId) { let p = rooms[activeRoom].points.find(pt => pt.id === dragId); p.x = snap(pxToMm(mousePos.x, 'x')); p.y = snap(pxToMm(mousePos.y, 'y')); requestDraw(); drawSmartGuides(p.x, p.y, dragId); return; }
    if (dragElem) { let s = getSnappedPos(pxToMm(mousePos.x, 'x'), pxToMm(mousePos.y, 'y'), dragElem); dragElem.x = s.x; dragElem.y = s.y; requestDraw(); drawSmartGuides(dragElem.x, dragElem.y, null); return; }
    requestDraw();
};

svg.onmousedown = (e) => { if (e.target === svg && currentTool === 'draw') { isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY; } };
window.onmouseup = () => { isPanning = false; dragId = null; dragElem = null; };

svg.onclick = (e) => {
    if (isPanning) return; let r = rooms[activeRoom]; if (!r) return; let rect = svg.getBoundingClientRect();
    let mmX = pxToMm(e.clientX - rect.left, 'x'), mmY = pxToMm(e.clientY - rect.top, 'y');
    if (currentTool !== 'draw') {
        saveState(); if (!r.elements) r.elements = [];
        let sub = (currentTool === 'light') ? document.getElementById("lightTypeSelector").value : (currentTool === 'rail' ? document.getElementById("railTypeSelector").value : document.getElementById("extraTypeSelector").value);
        let s = getSnappedPos(mmX, mmY); let def = getElementDef(sub);
        let newEl = { type: currentTool, subtype: sub, x: s.x, y: s.y, rotation: 0 };
        const isLinear = def.type === 'linear' || currentTool === 'rail';
        if (isLinear) { let dl = prompt("Длина (см):", "200"); newEl.width = (parseFloat(dl) * 10) || 2000; }
        r.elements.push(newEl); requestDraw(); return;
    }
    if (r.closed || dragId) return;
    let first = r.points[0];
    if (r.points.length >= 3 && Math.sqrt((e.clientX - rect.left - mmToPx(first.x, 'x'))**2 + (e.clientY - rect.top - mmToPx(first.y, 'y'))**2) < 25) { saveState(); r.closed = true; requestDraw(); return; }
    saveState(); let sX = snap(mmX, first ? first.x : null); let sY = snap(mmY, first ? first.y : null);
    let last = r.points[r.points.length - 1];
    if (last && !e.shiftKey) { if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) sY = last.y; else sX = last.x; }
    r.points.push({ id: Date.now(), x: sX, y: sY }); requestDraw();
};

svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.shiftKey) {
        let r = rooms[activeRoom]; let mmX = pxToMm(mousePos.x, 'x'), mmY = pxToMm(mousePos.y, 'y');
        let target = r.elements?.find(el => Math.sqrt((el.x-mmX)**2 + (el.y-mmY)**2) < 200);
        if (target) { target.rotation = (target.rotation || 0) + (e.deltaY > 0 ? 1 : -1); requestDraw(); return; }
    }
    const delta = e.deltaY > 0 ? 0.9 : 1.1; const rect = svg.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    offsetX = x - (x - offsetX) * delta; offsetY = y - (y - offsetY) * delta; scale *= delta; requestDraw();
}, { passive: false });

function updateStats() {
    let listHTML = ""; let totalArea = 0; let totalPerim = 0; let totalElemCounts = {};
    rooms.forEach((r, idx) => {
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length; p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        let ra = r.closed ? Math.abs(a/2)/1000000 : 0; totalArea += ra; totalPerim += (p/1000);
        if (idx === activeRoom) {
            document.getElementById("roomTitle").innerText = r.name; document.getElementById("currentArea").innerText = ra.toFixed(2) + " м²"; document.getElementById("currentPerim").innerText = (p/1000).toFixed(2) + " м";
            if (r.elements?.length > 0) {
                let counts = {};
                r.elements.forEach(el => {
                    let name = el.type === 'pipe' ? 'Обвод трубы' : (LIGHT_DATA[el.subtype]?.label || EXTRA_DATA[el.subtype]?.label || RAIL_DATA[el.subtype]?.label || el.subtype);
                    let key = el.width ? `${name} (${el.width/10} см)` : name; counts[key] = (counts[key] || 0) + 1;
                });
                for (let k in counts) listHTML += `<div class="estimate-item"><span>${k}</span> <span class="estimate-qty">${counts[k]} шт.</span></div>`;
            } else listHTML = "Нет элементов";
        }
        r.elements?.forEach(el => {
            let name = el.type === 'pipe' ? 'Обвод трубы' : (LIGHT_DATA[el.subtype]?.label || EXTRA_DATA[el.subtype]?.label || RAIL_DATA[el.subtype]?.label || el.subtype);
            let key = el.width ? `${name} (${el.width/10} см)` : name; totalElemCounts[key] = (totalElemCounts[key] || 0) + 1;
        });
    });
    document.getElementById("elementsList").innerHTML = listHTML; document.getElementById("totalArea").innerText = totalArea.toFixed(2) + " м²"; document.getElementById("totalPerim").innerText = totalPerim.toFixed(2) + " м";
    let teH = ""; for (let n in totalElemCounts) teH += `${n}: ${totalElemCounts[n]} шт. | `; document.getElementById("totalElements").innerText = teH || "Нет элементов";
    return totalElemCounts;
}

function resizeWall(i) {
    let r = rooms[activeRoom]; 
    let p1 = r.points[i], p2 = r.points[(i + 1) % r.points.length];
    let curLen = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
    
    let n = prompt("Новая длина стены (см):", curLen);
    
    // Проверяем, что ввели число и оно больше 0
    if (n && !isNaN(n) && parseFloat(n) > 0) {
        saveState(); 
        let nl = parseFloat(n) * 10; 
        let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let dx = Math.cos(ang) * nl - (p2.x - p1.x); 
        let dy = Math.sin(ang) * nl - (p2.y - p1.y);
        
        for (let k = (i + 1) % r.points.length; k < r.points.length; k++) { 
            if (k === 0 && r.closed) continue; 
            r.points[k].x += dx; 
            r.points[k].y += dy; 
            if (k === 0) break; 
        }
        requestDraw();
    } else if (n) {
        alert("Пожалуйста, введите положительное число");
    }
}

function createLine(x1, y1, x2, y2, c, w, d) {
    let l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); l.setAttribute("stroke", c); l.setAttribute("stroke-width", w); if (d) l.setAttribute("stroke-dasharray", d);
    return l;
}

function renderText(x, y, txt, cls) {
    let t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("class", cls); t.textContent = txt; svg.appendChild(t); return t;
}

function addRoom() { 
    // SAAS Check
    if(currentUser && currentUser.plan === 'free' && rooms.length >= 1) {
        alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
        return;
    }
    saveState(); rooms.push({ name: "Полотно " + (rooms.length + 1), points: [], id: Date.now(), closed: false, elements: [] }); activeRoom = rooms.length - 1; renderTabs(); requestDraw(); 
}

function removeRoom(idx, e) { e.stopPropagation(); if (confirm("Удалить это помещение?")) { saveState(); rooms.splice(idx, 1); activeRoom = Math.max(0, activeRoom - 1); if (rooms.length === 0) addRoom(); renderTabs(); requestDraw(); } }

function renderTabs() {
    // Добавьте эту проверку
    if (!rooms || !Array.isArray(rooms)) {
        console.error("rooms не является массивом!", rooms);
        rooms = []; // Сбрасываем в пустой массив
    }
    tabs.innerHTML = "";
    rooms.forEach((r, i) => {
        let t = document.createElement("div"); t.className = "tab" + (i === activeRoom ? " active" : "");
        t.innerHTML = `${r.name} <span class="close-tab" onclick="removeRoom(${i}, event)">×</span>`;
        t.onclick = () => { activeRoom = i; renderTabs(); requestDraw(); }; tabs.appendChild(t);
    });
}

function exportImage() {
    draw(true); let svgData = new XMLSerializer().serializeToString(svg);
    let canvas = document.createElement("canvas"); canvas.width = svg.clientWidth * 2; canvas.height = svg.clientHeight * 2;
    let ctx = canvas.getContext("2d"); let img = new Image();
    img.onload = () => { ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.scale(2, 2); ctx.drawImage(img, 0, 0); let a = document.createElement("a"); a.download = "plan.png"; a.href = canvas.toDataURL(); a.click(); requestDraw(); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
}

function printPDF() {
    const printCont = document.getElementById("print-container"); printCont.innerHTML = "";
    const savedActive = activeRoom;
    rooms.forEach((r, idx) => {
        activeRoom = idx; draw(true); const page = document.createElement("div"); page.className = "print-page";
        let p = 0, a = 0;
        for(let i=0; i<r.points.length; i++) {
            let j = (i+1)%r.points.length; p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
            if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
        }
        const svgClone = svg.cloneNode(true);
        page.innerHTML = `<div class="print-header"><h1>${r.name}</h1><p>Площадь: <b>${r.closed ? (Math.abs(a/2)/1000000).toFixed(2) : "0.00"} м²</b> | Периметр: <b>${(p/1000).toFixed(2)} м</b></p></div><div class="print-canvas"></div><table class="print-estimate"><thead><tr><th>Наименование</th><th>Кол-во</th></tr></thead><tbody>${generateEstimateRows(r)}</tbody></table>`;
        page.querySelector('.print-canvas').appendChild(svgClone); printCont.appendChild(page);
    });
    activeRoom = savedActive; requestDraw(); setTimeout(() => { window.print(); }, 600);
}

function generateEstimateRows(room) {
    if (!room.elements?.length) return '<tr><td colspan="2" style="text-align:center;">Элементы не добавлены</td></tr>';
    let counts = {};
    room.elements.forEach(el => {
        let name = el.type === 'pipe' ? 'Обвод трубы' : (LIGHT_DATA[el.subtype]?.label || EXTRA_DATA[el.subtype]?.label || RAIL_DATA[el.subtype]?.label || el.subtype);
        let key = el.width ? `${name} (${el.width/10} см)` : name; counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([n, c]) => `<tr><td>${n}</td><td>${c} шт.</td></tr>`).join('');
}
// --- МОБИЛЬНЫЕ ОБРАБОТЧИКИ (улучшенная версия) ---
function initTouchHandlers() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    // Вспомогательная функция: расстояние между двумя пальцами
    function getTouchDistance(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Вспомогательная функция: угол между двумя пальцами
    function getTouchAngle(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    // Начало касания
    canvas.addEventListener('touchstart', (e) => {
        if (document.getElementById('auth-overlay').style.display !== 'none') return;
        e.preventDefault();
        
        const touches = e.touches;
        const rect = canvas.getBoundingClientRect();

        // Сброс предыдущих состояний
        clearTimeout(touchState.longPressTimer);
        touchState.isLongPress = false;
        touchState.moved = false;
        touchState.isPinching = false;
        touchState.isRotating = false;
        touchState.dragId = null;
        touchState.dragElem = null;
        touchState.rotationElem = null;

        // Два пальца - зум или поворот
        if (touches.length === 2) {
            touchState.isPinching = true;
            touchState.initialDistance = getTouchDistance(touches);
            touchState.initialAngle = getTouchAngle(touches);
            touchState.initialScale = scale;
            touchState.initialOffsetX = offsetX;
            touchState.initialOffsetY = offsetY;
            
            // Центр между пальцами
            const centerX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
            const centerY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
            touchState.pinchCenterMM_X = (centerX - offsetX) / (MM_TO_PX * scale);
            touchState.pinchCenterMM_Y = (centerY - offsetY) / (MM_TO_PX * scale);
            
            // Проверяем, есть ли линейный элемент под центром касания для поворота
            const mmX = pxToMm(centerX, 'x');
            const mmY = pxToMm(centerY, 'y');
            const r = rooms[activeRoom];
            
            if (r && r.elements) {
                // Ищем линейный элемент (карниз, световую линию и т.д.)
                const linearElem = r.elements.find(el => {
                    const def = getElementDef(el.subtype);
                    const isLinear = def.type === 'linear' || el.type === 'rail';
                    if (!isLinear) return false;
                    
                    // Проверяем, попадает ли центр между пальцами в область элемента
                    const dx = mmX - el.x;
                    const dy = mmY - el.y;
                    const distance = Math.sqrt(dx*dx + dy*dy);
                    return distance < 200; // Радиус захвата для поворота
                });
                
                if (linearElem) {
                    touchState.isRotating = true;
                    touchState.rotationElem = linearElem;
                    touchState.initialElemRotation = linearElem.rotation || 0;
                    console.log("Режим поворота для:", linearElem);
                }
            }
            return;
        }

        // Один палец - проверяем, что под пальцем
        if (touches.length === 1) {
            const touch = touches[0];
            const clientX = touch.clientX - rect.left;
            const clientY = touch.clientY - rect.top;
            
            // Сохраняем начальные координаты
            touchState.touchStartX = clientX;
            touchState.touchStartY = clientY;
            touchState.startMM_X = pxToMm(clientX, 'x');
            touchState.startMM_Y = pxToMm(clientY, 'y');

            // Проверяем, не попали ли мы в метку длины
            const elemUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
            if (elemUnderTouch && elemUnderTouch.classList && 
                (elemUnderTouch.classList.contains('length-label') || 
                 elemUnderTouch.classList.contains('rail-label') ||
                 elemUnderTouch.classList.contains('light-label'))) {
                touchState.targetLabel = elemUnderTouch;
                return;
            }

            const r = rooms[activeRoom];
            if (r) {
                // Проверяем, не попали ли в точку (вершину)
                for (let pt of r.points) {
                    const cx = mmToPx(pt.x, 'x');
                    const cy = mmToPx(pt.y, 'y');
                    if (Math.hypot(clientX - cx, clientY - cy) < 20) {
                        touchState.potentialDragId = pt.id;
                        touchState.potentialDragType = 'point';
                        break;
                    }
                }
                
                // Если не нашли точку, проверяем элементы
                if (!touchState.potentialDragId && r.elements) {
                    for (let el of r.elements) {
                        const cx = mmToPx(el.x, 'x');
                        const cy = mmToPx(el.y, 'y');
                        if (Math.hypot(clientX - cx, clientY - cy) < 30) {
                            touchState.potentialDragElem = el;
                            touchState.potentialDragType = 'element';
                            break;
                        }
                    }
                }
            }

            // Запускаем таймер долгого нажатия (500ms)
            touchState.longPressTimer = setTimeout(() => {
                if (!touchState.moved) {
                    touchState.isLongPress = true;
                    
                    // Активируем перемещение если есть что перемещать
                    if (touchState.potentialDragId) {
                        touchState.dragId = touchState.potentialDragId;
                        saveState();
                        console.log("Долгое нажатие: перемещение точки");
                    } else if (touchState.potentialDragElem) {
                        touchState.dragElem = touchState.potentialDragElem;
                        saveState();
                        console.log("Долгое нажатие: перемещение элемента");
                    }
                    
                    // Визуальная обратная связь (вибрация если поддерживается)
                    if (window.navigator && window.navigator.vibrate) {
                        window.navigator.vibrate(20);
                    }
                }
            }, 500);
        }
    }, { passive: false });

    // Движение пальца
    canvas.addEventListener('touchmove', (e) => {
        if (document.getElementById('auth-overlay').style.display !== 'none') return;
        e.preventDefault();

        const touches = e.touches;
        const rect = canvas.getBoundingClientRect();

        // --- Два пальца: зум или поворот ---
        if (touches.length === 2) {
            // Если мы в режиме поворота и есть элемент для поворота
            if (touchState.isRotating && touchState.rotationElem) {
                const currentAngle = getTouchAngle(touches);
                const angleDiff = currentAngle - touchState.initialAngle;
                
                // Поворачиваем элемент
                touchState.rotationElem.rotation = (touchState.initialElemRotation + angleDiff) % 360;
                requestDraw();
                return;
            }
            
            // Иначе обычный зум
            if (touchState.isPinching) {
                const currentDistance = getTouchDistance(touches);
                if (currentDistance === 0) return;

                const newScale = touchState.initialScale * (currentDistance / touchState.initialDistance);
               // Убираем ограничение или делаем его больше
scale = Math.max(0.01, Math.min(5, newScale)); // Можно сильнее уменьшать и увеличивать
// Или вообще без ограничений:
// scale = newScale;

                // Текущий центр между пальцами
                const centerX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
                const centerY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;

                // Обновляем offset
                offsetX = centerX - touchState.pinchCenterMM_X * (MM_TO_PX * scale);
                offsetY = centerY - touchState.pinchCenterMM_Y * (MM_TO_PX * scale);

                requestDraw();
            }
            return;
        }

    // --- Один палец ---
if (touches.length === 1) {
    const touch = touches[0];
    const clientX = touch.clientX - rect.left;
    const clientY = touch.clientY - rect.top;

    // Вычисляем перемещение от начальной точки
    const dx = clientX - touchState.touchStartX;
    const dy = clientY - touchState.touchStartY;
    const distance = Math.hypot(dx, dy);

    // ✅ ИСПРАВЛЕНО: Если у нас есть активное перемещение (точка или элемент)
    if (touchState.dragId || touchState.dragElem) {
        // Перетаскивание точки
        if (touchState.dragId) {
            const r = rooms[activeRoom];
            const point = r.points.find(p => p.id === touchState.dragId);
            if (point) {
                // Используем абсолютные координаты, а не относительные
                const mmX = pxToMm(clientX, 'x');
                const mmY = pxToMm(clientY, 'y');
                point.x = mmX;
                point.y = mmY;
                requestDraw();
            }
        }
        // Перетаскивание элемента
        else if (touchState.dragElem) {
            // Используем абсолютные координаты, а не относительные
            const mmX = pxToMm(clientX, 'x');
            const mmY = pxToMm(clientY, 'y');
            touchState.dragElem.x = mmX;
            touchState.dragElem.y = mmY;
            requestDraw();
        }
        return; // Выходим, чтобы не обрабатывать pan
    }

    // Если перемещение превысило порог
    if (distance > touchState.MOVE_THRESHOLD) {
        clearTimeout(touchState.longPressTimer);
        touchState.moved = true;
        
        // Если было долгое нажатие, активируем перемещение
        if (touchState.isLongPress) {
            if (touchState.potentialDragId) {
                touchState.dragId = touchState.potentialDragId;
                saveState();
                console.log("Активировано перемещение точки");
            } else if (touchState.potentialDragElem) {
                touchState.dragElem = touchState.potentialDragElem;
                saveState();
                console.log("Активировано перемещение элемента");
            }
        } 
        // Если не было долгого нажатия и нет активного перемещения - перемещаем холст (pan)
        else if (!touchState.dragId && !touchState.dragElem) {
            touchState.isPanning = true;
            touchState.lastPanX = offsetX;
            touchState.lastPanY = offsetY;
            console.log("Активирован pan");
        }
    }

    // Перемещение по холсту (pan)
    if (touchState.isPanning) {
        // При pan используем относительное перемещение
        offsetX = touchState.lastPanX + dx;
        offsetY = touchState.lastPanY + dy;
        requestDraw();
    }
}

    // Конец касания
    canvas.addEventListener('touchend', (e) => {
        if (document.getElementById('auth-overlay').style.display !== 'none') return;
        e.preventDefault();

        // Отменяем таймер долгого нажатия
        clearTimeout(touchState.longPressTimer);

        // Если это был тап (короткое нажатие без перемещения)
        if (!touchState.moved && !touchState.dragId && !touchState.dragElem && 
            !touchState.isPinching && !touchState.isRotating) {
            
            if (touchState.targetLabel) {
                // Эмулируем клик по метке длины
                const clickEvent = new MouseEvent('click', {
                    clientX: touchState.touchStartX + canvas.getBoundingClientRect().left,
                    clientY: touchState.touchStartY + canvas.getBoundingClientRect().top
                });
                touchState.targetLabel.dispatchEvent(clickEvent);
            } else {
                // Эмулируем клик по canvas для добавления точки
                const clickEvent = new MouseEvent('click', {
                    clientX: touchState.touchStartX + canvas.getBoundingClientRect().left,
                    clientY: touchState.touchStartY + canvas.getBoundingClientRect().top
                });
                canvas.dispatchEvent(clickEvent);
            }
        }

        // Сброс всех состояний
        touchState.isPinching = false;
        touchState.isRotating = false;
        touchState.isPanning = false;
        touchState.dragId = null;
        touchState.dragElem = null;
        touchState.rotationElem = null;
        touchState.potentialDragId = null;
        touchState.potentialDragElem = null;
        touchState.targetLabel = null;
        touchState.moved = false;
        touchState.isLongPress = false;
    }, { passive: false });

  // Отмена касания
    canvas.addEventListener('touchcancel', (e) => {
        if (document.getElementById('auth-overlay').style.display !== 'none') return;
        e.preventDefault();
        
        clearTimeout(touchState.longPressTimer);
        
        touchState.isPinching = false;
        touchState.isRotating = false;
        touchState.isPanning = false;
        touchState.dragId = null;
        touchState.dragElem = null;
        touchState.rotationElem = null;
        touchState.potentialDragId = null;
        touchState.potentialDragElem = null;
        touchState.targetLabel = null;
        touchState.moved = false;
        touchState.isLongPress = false;
    }, { passive: false });
});
//--- ФУНКЦИИ УПРАВЛЕНИЯ ПРОЕКТАМИ ---

function saveProject() {
    if (!currentUser || !currentUser.uid) {
        alert("Пожалуйста, войдите в систему для сохранения проектов.");
        return;
    }

    if (!db) { alert("База данных не доступна"); return; }

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
    if (!db) { alert("База данных не доступна"); return; }

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
                    if (typeof draw === 'function') requestDraw();

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

// Закрытие модалки по клику на фон
window.onclick = function(event) {
    const modal = document.getElementById('projectsModal');
    if (event.target == modal) {
        closeProjectsModal();
    }
};

// --- ГОРЯЧИЕ КЛАВИШИ ---
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
    }
    
    if (e.key === 'Delete' && window.selectedElement) {
        e.preventDefault();
    }
    
    if (e.key === 'Escape') {
        dragId = null;
        dragElem = null;
        requestDraw();
    }
    
    if (!e.ctrlKey && !e.altKey && !e.metaKey && !isNaN(parseInt(e.key))) {
        const num = parseInt(e.key);
        switch(num) {
            case 1: setTool('draw'); break;
            case 2: setTool('light'); break;
            case 3: setTool('extra'); break;
            case 4: setTool('rail'); break;
        }
    }
});

// --- ЗАЩИТА ОТ ЗАВИСАНИЯ НА МОБИЛЬНЫХ ---
document.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        dragId = null;
        dragElem = null;
        isPanning = false;
        touchState.isPanning = false;
        touchState.dragId = null;
        touchState.dragElem = null;
    }
}, { passive: true });

// Глобальный обработчик для разблокировки интерфейса
document.addEventListener('touchcancel', () => {
    dragId = null;
    dragElem = null;
    isPanning = false;
    touchState.isPinching = false;
    touchState.isPanning = false;
    touchState.dragId = null;
    touchState.dragElem = null;
    touchState.moved = false;
});





