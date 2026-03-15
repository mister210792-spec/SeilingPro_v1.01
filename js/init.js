// js/init.js

// Глобальные переменные
let currentUser = null;
let selectedRegPlan = 'free';
let db = null;
let auth = null;

// Функция инициализации Firebase
function initializeFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            // СОХРАНЯЕМ В ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
            window.auth = firebase.auth();
            window.db = firebase.firestore();
            
            // ТАКЖЕ СОХРАНЯЕМ В ЛОКАЛЬНЫЕ ДЛЯ ЭТОГО ФАЙЛА
            auth = window.auth;
            db = window.db;
            
            console.log("✅ Firebase сервисы готовы");
            console.log("🔑 auth доступен:", auth !== null);
            
            return true;
        } catch (error) {
            console.error("❌ Ошибка инициализации Firebase:", error);
            return false;
        }
    } else {
        console.error("❌ Firebase не загружен");
        return false;
    }
}
// Функция для обновления currentUser в глобальной области
function updateCurrentUser(userData) {
    window.currentUser = userData;
    // Также обновляем локальную переменную для этого файла
    currentUser = userData;
    console.log("👤 currentUser обновлен:", currentUser.email, "план:", currentUser.plan);
}
// init.js - добавьте после функции updateCurrentUser

// ========== АВТОСОХРАНЕНИЕ ==========
let autoSaveTimer = null;

function enableAutoSave() {
    // Очищаем предыдущий таймер если есть
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
    
    // Запускаем новый таймер только если пользователь авторизован
    if (window.currentUser && window.currentUser.uid) {
        console.log("💾 Автосохранение включено (интервал 30 сек)");
        
        autoSaveTimer = setInterval(() => {
            // Проверяем, что есть комнаты для сохранения
            if (window.rooms && window.rooms.length > 0) {
                try {
                    // Сохраняем в localStorage как резервную копию
                    localStorage.setItem('cp_autosave_' + window.currentUser.uid, JSON.stringify({
                        timestamp: Date.now(),
                        rooms: window.rooms,
                        activeRoom: window.activeRoom,
                        scale: window.scale,
                        offsetX: window.offsetX,
                        offsetY: window.offsetY
                    }));
                    console.log('💾 Автосохранение в localStorage', new Date().toLocaleTimeString());
                    
                    // Показываем индикатор сохранения (опционально)
                    showSaveIndicator();
                } catch (e) {
                    console.error("❌ Ошибка автосохранения:", e);
                }
            }
        }, 30000); // Каждые 30 секунд
    }
}

function disableAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
        console.log("💾 Автосохранение отключено");
    }
}

function checkAutoSave() {
    if (!window.currentUser || !window.currentUser.uid) return;
    
    try {
        const autoSave = localStorage.getItem('cp_autosave_' + window.currentUser.uid);
        if (autoSave) {
            const data = JSON.parse(autoSave);
            const timeDiff = Date.now() - data.timestamp;
            
            // Если прошло меньше 24 часов
            if (timeDiff < 24 * 60 * 60 * 1000) {
                // Форматируем время для показа
                const saveTime = new Date(data.timestamp).toLocaleString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                });
                
                // Создаем кастомное уведомление вместо стандартного confirm
                showAutoSaveDialog(data, saveTime);
            } else {
                // Удаляем устаревшее автосохранение
                localStorage.removeItem('cp_autosave_' + window.currentUser.uid);
            }
        }
    } catch (e) {
        console.error("❌ Ошибка проверки автосохранения:", e);
    }
}

function showAutoSaveDialog(data, saveTime) {
    // Создаем модальное окно для автосохранения
    const modalHtml = `
        <div id="autosaveModal" class="modal" style="display: block; z-index: 10000;">
            <div class="modal-content" style="width: 350px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 15px;">💾</div>
                <h3 style="margin-top: 0; color: var(--dark);">Найдено автосохранение</h3>
                <p style="margin: 15px 0; color: #666;">
                    От ${saveTime}<br>
                    <span style="font-size: 12px;">Комнат: ${data.rooms?.length || 0}</span>
                </p>
                <div style="display: flex; gap: 10px;">
                    <button onclick="restoreAutoSave()" style="flex: 1; background: var(--success); color: white; border: none; padding: 12px; border-radius: 8px;">
                        Восстановить
                    </button>
                    <button onclick="closeAutoSaveModal()" style="flex: 1; background: #eee; border: none; padding: 12px; border-radius: 8px;">
                        Пропустить
                    </button>
                </div>
                <p style="font-size: 11px; color: #999; margin-top: 15px;">
                    Автосохранение удалится через 24 часа
                </p>
            </div>
        </div>
    `;
    
    // Удаляем старое окно если есть
    const oldModal = document.getElementById('autosaveModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function restoreAutoSave() {
    if (!window.currentUser || !window.currentUser.uid) return;
    
    try {
        const autoSave = localStorage.getItem('cp_autosave_' + window.currentUser.uid);
        if (autoSave) {
            const data = JSON.parse(autoSave);
            
            if (data.rooms && data.rooms.length > 0) {
                // Восстанавливаем данные
                window.rooms = data.rooms;
                window.activeRoom = data.activeRoom || 0;
                
                if (data.scale) window.scale = data.scale;
                if (data.offsetX) window.offsetX = data.offsetX;
                if (data.offsetY) window.offsetY = data.offsetY;
                
                // Обновляем интерфейс
                if (typeof renderTabs === 'function') renderTabs();
                if (typeof draw === 'function') draw();
                if (typeof updateStats === 'function') updateStats();
                
                // Показываем уведомление
                showNotification('✅ Проект восстановлен из автосохранения');
                
                // Удаляем автосохранение после восстановления
                localStorage.removeItem('cp_autosave_' + window.currentUser.uid);
            }
        }
    } catch (e) {
        console.error("❌ Ошибка восстановления:", e);
        alert('Ошибка при восстановлении');
    }
    
    closeAutoSaveModal();
}

function closeAutoSaveModal() {
    const modal = document.getElementById('autosaveModal');
    if (modal) modal.remove();
    
    // Удаляем автосохранение если пользователь отказался
    if (window.currentUser && window.currentUser.uid) {
        localStorage.removeItem('cp_autosave_' + window.currentUser.uid);
    }
}

function showSaveIndicator() {
    // Показываем индикатор сохранения
    let indicator = document.getElementById('saveIndicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'saveIndicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(76, 175, 80, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: opacity 0.3s;
            pointer-events: none;
        `;
        document.body.appendChild(indicator);
    }
    
    indicator.textContent = '💾 Сохранено ' + new Date().toLocaleTimeString().slice(0,5);
    indicator.style.opacity = '1';
    
    // Прячем через 2 секунды
    clearTimeout(window.indicatorTimeout);
    window.indicatorTimeout = setTimeout(() => {
        if (indicator) indicator.style.opacity = '0';
    }, 2000);
}

// Экспортируем функции
window.enableAutoSave = enableAutoSave;
window.disableAutoSave = disableAutoSave;
window.checkAutoSave = checkAutoSave;
window.restoreAutoSave = restoreAutoSave;
window.closeAutoSaveModal = closeAutoSaveModal;
// Добавить в init.js или отдельный файл migration.js

function migrateOldPrices() {
    // Удаляем старые ключи из prices
    delete prices['Полотно (м2)'];
    delete prices['Профиль (м.п.)'];
    
    // Удаляем из localStorage
    const savedPrices = localStorage.getItem('cp_prices_15');
    if (savedPrices) {
        const oldPrices = JSON.parse(savedPrices);
        delete oldPrices['Полотно (м2)'];
        delete oldPrices['Профиль (м.п.)'];
        localStorage.setItem('cp_prices_15', JSON.stringify(oldPrices));
    }
    
    console.log("✅ Миграция цен выполнена");
}
function manualAutoSave() {
    if (!window.currentUser || !window.currentUser.uid) {
        alert('Войдите в систему');
        return;
    }
    
    if (window.rooms && window.rooms.length > 0) {
        localStorage.setItem('cp_autosave_' + window.currentUser.uid, JSON.stringify({
            timestamp: Date.now(),
            rooms: window.rooms,
            activeRoom: window.activeRoom,
            scale: window.scale,
            offsetX: window.offsetX,
            offsetY: window.offsetY
        }));
        
        showSaveIndicator();
        alert('✅ Проект сохранен в localStorage');
    } else {
        alert('Нет данных для сохранения');
    }
}

window.manualAutoSave = manualAutoSave;

// Вызвать при загрузке приложения
window.migrateOldPrices = migrateOldPrices;

// Экспортируем
window.updateCurrentUser = updateCurrentUser;

// Экспортируем
window.currentUser = currentUser;
window.selectedRegPlan = selectedRegPlan;
window.initializeFirebase = initializeFirebase;


