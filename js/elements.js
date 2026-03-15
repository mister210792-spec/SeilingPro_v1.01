// Данные элементов
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

let CUSTOM_REGISTRY = {};

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

function isCustom(key) { 
    return key.startsWith('custom_'); 
}

// Экспортируем в глобальную область
window.LIGHT_DATA = LIGHT_DATA;
window.EXTRA_DATA = EXTRA_DATA;
window.RAIL_DATA = RAIL_DATA;
window.CUSTOM_REGISTRY = CUSTOM_REGISTRY;
window.initSelectors = initSelectors;
window.getElementDef = getElementDef;
window.isCustom = isCustom;