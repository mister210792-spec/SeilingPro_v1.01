// Цены
let prices = {
    'Полотно (м2)': 500,
    'Профиль (м.п.)': 150,
    'pipe': 250
};

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
    if (typeof updateStats === 'function') updateStats(); 
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