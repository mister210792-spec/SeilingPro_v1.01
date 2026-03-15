// js/version.js
// Система управления версиями и уведомлений об обновлениях

// ТЕКУЩАЯ ВЕРСИЯ ПРИЛОЖЕНИЯ (меняй при каждом обновлении)
const APP_VERSION = '1.5.0';
const APP_VERSION_CODE = 151; // увеличивай на 1 при каждом обновлении

// ИСТОРИЯ ИЗМЕНЕНИЙ (последние 5)
const VERSION_HISTORY = [
    {
        version: '1.5.0',
        date: '15.03.2026',
        changes: [
            '✨ ИИ-ассистент по освещению',
            '👤 Добавлены данные клиента в проекты',
            '🎨 Улучшена расстановка светильников',
            '🐛 Исправлены ошибки мобильной версии'
        ]
    },
   
];

// Проверка обновлений при запуске
function checkForUpdates() {
    // Получаем сохраненную версию из localStorage
    const savedVersion = localStorage.getItem('app_version');
    const savedVersionCode = parseInt(localStorage.getItem('app_version_code') || '0');
    
    console.log(`📱 Текущая версия: ${APP_VERSION} (${APP_VERSION_CODE})`);
    console.log(`💾 Сохраненная версия: ${savedVersion || 'не найдена'} (${savedVersionCode})`);
    
    // Если версии не совпадают или это первый запуск
    if (!savedVersion || savedVersionCode < APP_VERSION_CODE) {
        console.log('🔄 Обнаружено обновление!');
        
        // Показываем уведомление об обновлении
        showUpdateNotification(savedVersion, savedVersionCode);
        
        // Сохраняем новую версию
        localStorage.setItem('app_version', APP_VERSION);
        localStorage.setItem('app_version_code', APP_VERSION_CODE.toString());
        localStorage.setItem('app_update_date', new Date().toISOString());
    } else {
        console.log('✅ Приложение актуально');
    }
}

// Показать уведомление об обновлении
function showUpdateNotification(oldVersion, oldVersionCode) {
    // Находим изменения с прошлой версии
    const newFeatures = getChangesSince(oldVersion);
    
    // Создаем модальное окно
    const updateModal = document.createElement('div');
    updateModal.id = 'updateModal';
    updateModal.className = 'modal';
    updateModal.style.display = 'block';
    updateModal.style.zIndex = '10000';
    
    // Формируем HTML
    let changesHTML = '';
    if (newFeatures.length > 0) {
        changesHTML = newFeatures.map(feature => 
            `<li style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--primary); font-size: 18px;">✨</span>
                <span>${feature}</span>
            </li>`
        ).join('');
    } else {
        changesHTML = '<li style="margin-bottom: 8px;">🚀 Улучшена производительность и исправлены ошибки</li>';
    }
    
    updateModal.innerHTML = `
        <div class="modal-content" style="width: 450px; max-width: 95%; border-radius: 24px; padding: 30px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 10px; animation: bounce 1s;">🎉</div>
            <h2 style="color: var(--dark); margin: 0 0 5px 0;">Доступно обновление!</h2>
            <p style="color: #666; margin-bottom: 20px;">Версия ${APP_VERSION} · ${getCurrentDate()}</p>
            
            <div style="background: #f8f9fa; border-radius: 16px; padding: 20px; margin-bottom: 20px; text-align: left;">
                <h3 style="margin: 0 0 15px 0; color: var(--primary); font-size: 16px;">📋 Что нового:</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${changesHTML}
                </ul>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button onclick="refreshApp()" class="update-btn" style="flex: 2; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer;">
                    🔄 Обновить сейчас
                </button>
                <button onclick="remindLater()" class="update-btn" style="flex: 1; background: #eee; color: #666; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer;">
                    Позже
                </button>
            </div>
            
            <p style="font-size: 12px; color: #999; margin-top: 15px;">
                Обновление займет несколько секунд
            </p>
        </div>
    `;
    
    document.body.appendChild(updateModal);
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        .update-btn {
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .update-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .update-btn:active {
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
}

// Получить изменения начиная с определенной версии
function getChangesSince(oldVersion) {
    if (!oldVersion) {
        // Если нет старой версии - показываем все изменения
        return VERSION_HISTORY.slice(0, 3).flatMap(v => v.changes);
    }
    
    // Находим индекс старой версии
    const oldIndex = VERSION_HISTORY.findIndex(v => v.version === oldVersion);
    if (oldIndex === -1) {
        // Если версия не найдена - показываем последние 3
        return VERSION_HISTORY.slice(0, 3).flatMap(v => v.changes);
    }
    
    // Показываем изменения с версий новее старой
    const newVersions = VERSION_HISTORY.slice(0, oldIndex);
    return newVersions.flatMap(v => v.changes);
}

// Обновить приложение
function refreshApp() {
    // Показываем индикатор загрузки
    const loader = document.createElement('div');
    loader.id = 'updateLoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 30px; border-radius: 20px; z-index: 10001;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;
    `;
    loader.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 15px; animation: spin 1s linear infinite;">🔄</div>
        <div style="font-size: 18px; font-weight: bold;">Обновление...</div>
        <div style="color: #666; margin-top: 10px;">Пожалуйста, подождите</div>
    `;
    document.body.appendChild(loader);
    
    // Очищаем кэш и перезагружаем
    setTimeout(() => {
        // Очищаем старый кэш service worker если есть
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) {
                    caches.delete(name);
                }
            });
        }
        
        // Перезагружаем страницу с жесткой перезагрузкой
        window.location.reload(true);
    }, 1500);
}

// Напомнить позже
function remindLater() {
    const modal = document.getElementById('updateModal');
    if (modal) modal.remove();
    
    // Запоминаем, что пользователь отложил обновление
    localStorage.setItem('update_reminded', new Date().toISOString());
    
    // Покажем снова через 3 дня
    setTimeout(() => {
        checkForUpdates();
    }, 3 * 24 * 60 * 60 * 1000);
}

// Получить текущую дату
function getCurrentDate() {
    const date = new Date();
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Показать информацию о версии (для меню "О программе")
function showVersionInfo() {
    const versionModal = document.createElement('div');
    versionModal.id = 'versionModal';
    versionModal.className = 'modal';
    versionModal.style.display = 'block';
    versionModal.style.zIndex = '10000';
    
    versionModal.innerHTML = `
        <div class="modal-content" style="width: 450px; max-width: 95%; border-radius: 24px; padding: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: var(--dark); margin: 0;">ℹ️ О программе</h2>
                <button onclick="closeVersionModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            </div>
            
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="icon-192.png" alt="Logo" style="width: 80px; height: 80px; border-radius: 20px; margin-bottom: 10px;">
                <h3 style="margin: 0;">Ceiling Plan PRO</h3>
                <p style="color: #666;">Версия ${APP_VERSION}</p>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--primary);">📋 История изменений:</h4>
                ${VERSION_HISTORY.map(v => `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; font-weight: bold;">
                            <span>Версия ${v.version}</span>
                            <span style="color: #999;">${v.date}</span>
                        </div>
                        <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #666;">
                            ${v.changes.map(c => `<li style="font-size: 12px;">${c}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
            
            <button onclick="checkForUpdates()" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer;">
                🔍 Проверить обновления
            </button>
        </div>
    `;
    
    document.body.appendChild(versionModal);
}

function closeVersionModal() {
    const modal = document.getElementById('versionModal');
    if (modal) modal.remove();
}

// Экспорт
window.APP_VERSION = APP_VERSION;
window.checkForUpdates = checkForUpdates;
window.refreshApp = refreshApp;
window.remindLater = remindLater;
window.showVersionInfo = showVersionInfo;
window.closeVersionModal = closeVersionModal;
