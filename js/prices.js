// Цены
let prices = {
    'Полотно (м2)': 500,
    'Профиль (м.п.)': 150,
    'pipe': 250
};

// В файле projects.js - изменим функцию loadAllSettings

function loadAllSettings() {
    // Убираем загрузку старых цен для полотен и профилей
    // Оставляем только загрузку цен элементов
    
    const savedLights = localStorage.getItem('cp_lights_15');
    const savedExtras = localStorage.getItem('cp_extras_15');
    const savedRails = localStorage.getItem('cp_rails_15');
    const savedCustom = localStorage.getItem('cp_custom_15');

    // Загружаем только элементы, но НЕ полотна и профили
    if (savedLights) LIGHT_DATA = JSON.parse(savedLights);
    if (savedExtras) EXTRA_DATA = JSON.parse(savedExtras);
    if (savedRails) RAIL_DATA = JSON.parse(savedRails);
    if (savedCustom) CUSTOM_REGISTRY = JSON.parse(savedCustom);

    // Обновляем цены только для элементов
    [LIGHT_DATA, EXTRA_DATA, RAIL_DATA].forEach(data => {
        for (let key in data) {
            // Проверяем, что это не полотно и не профиль
            if (!key.includes('canvas') && !key.includes('profile')) {
                if (prices[key] === undefined) prices[key] = data[key].price;
                else data[key].price = prices[key];
            }
        }
    });
    
    // Загружаем цены полотен и профилей из materials.js
    if (typeof loadMaterialPrices === 'function') {
        loadMaterialPrices();
    }
}

function saveAllSettings() {
    localStorage.setItem('cp_prices_15', JSON.stringify(prices));
    localStorage.setItem('cp_lights_15', JSON.stringify(LIGHT_DATA));
    localStorage.setItem('cp_extras_15', JSON.stringify(EXTRA_DATA));
    localStorage.setItem('cp_rails_15', JSON.stringify(RAIL_DATA));
    localStorage.setItem('cp_custom_15', JSON.stringify(CUSTOM_REGISTRY));
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

function closePriceModal() { 
    document.getElementById('priceModal').style.display = 'none'; 
}

// В файле projects.js - изменим renderPriceList

function renderPriceList() {
    const container = document.getElementById('priceListContainer');
    let html = `<table class="price-table"><thead><tr><th>Наименование</th><th>Цена (руб)</th><th>Действие</th></tr></thead><tbody>`;
    
    // Убираем строки для полотна и профиля - они теперь в отдельном прайсе
    // Оставляем только 'pipe' и другие элементы
    html += `<tr><td><b>Обвод трубы</b></td><td><input type="number" id="prc_pipe" value="${prices['pipe'] || 250}" onchange="updatePrice('pipe', this.value)"></td><td>-</td></tr>`;

    const renderCategory = (data) => {
        for (let key in data) {
            // Пропускаем ключи, которые могут конфликтовать с материалами
            if (key.includes('canvas') || key.includes('profile')) continue;
            
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

function updatePrice(key, val) { 
    prices[key] = parseFloat(val) || 0; 
}

function updateElementPrice(key, val) {
    let p = parseFloat(val) || 0;
    prices[key] = p;
    if (LIGHT_DATA[key]) LIGHT_DATA[key].price = p;
    if (EXTRA_DATA[key]) EXTRA_DATA[key].price = p;
    if (RAIL_DATA[key]) RAIL_DATA[key].price = p;
}

function savePrices() { 
    // Сохраняем только цены элементов (НЕ полотна и профили)
    saveAllSettings(); 
    
    // Обновляем элементы в облаке
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
    if (typeof updateStats === 'function') updateStats();
    
    // Показываем уведомление
    if (typeof showNotification === 'function') {
        showNotification('✅ Цены элементов сохранены');
    } else {
        alert('✅ Цены элементов сохранены');
    }
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
    if(currentUser && currentUser.plan === 'free') return;
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
    if(currentUser && currentUser.plan === 'free') { 
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

// Экспортируем
window.prices = prices;
window.loadAllSettings = loadAllSettings;
window.saveAllSettings = saveAllSettings;
window.openPriceModal = openPriceModal;
window.closePriceModal = closePriceModal;
window.updatePrice = updatePrice;
window.updateElementPrice = updateElementPrice;
window.savePrices = savePrices;
window.deleteElement = deleteElement;
window.toggleAddForm = toggleAddForm;
window.toggleShapeSelect = toggleShapeSelect;
window.addNewElementConfirm = addNewElementConfirm;

window.loadCustomElementsFromFirestore = loadCustomElementsFromFirestore;

