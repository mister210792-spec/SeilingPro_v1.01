// js/projects.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ДАННЫМИ КЛИЕНТА

// Структура данных проекта теперь включает информацию о клиенте
function saveProject() {
    if (!currentUser || !currentUser.uid) {
        alert("Пожалуйста, войдите в систему для сохранения проектов.");
        return;
    }

    if (!db) {
        alert("База данных не доступна");
        return;
    }

    // Показываем модальное окно с деталями клиента
    showClientInfoModal();
}

// Модальное окно для ввода данных клиента
function showClientInfoModal() {
    const modalHtml = `
        <div id="clientInfoModal" class="modal" style="display: block; z-index: 6000;">
            <div class="modal-content" style="width: 450px; max-width: 95%;">
                <h3 style="margin-top: 0; color: var(--primary); display: flex; align-items: center; gap: 10px;">
                    <span>📋</span> Информация о клиенте
                </h3>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Название проекта *</label>
                    <input type="text" id="projectNameInput" class="auth-input" 
                           value="Проект от ${new Date().toLocaleDateString()}"
                           placeholder="Например: Квартира на Ленина, 15">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">ФИО клиента</label>
                    <input type="text" id="clientNameInput" class="auth-input" 
                           placeholder="Иванов Иван Иванович">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Адрес объекта</label>
                    <input type="text" id="clientAddressInput" class="auth-input" 
                           placeholder="г. Москва, ул. Ленина, д. 15, кв. 123">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Телефон клиента</label>
                    <input type="tel" id="clientPhoneInput" class="auth-input" 
                           placeholder="+7 (999) 123-45-67">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Дополнительная информация</label>
                    <textarea id="clientNotesInput" class="auth-input" rows="3" 
                              placeholder="Особые пожелания, сроки, условия..."></textarea>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="saveProjectWithClientInfo()" class="auth-btn" style="background: var(--success);">
                        ✅ Сохранить проект
                    </button>
                    <button onclick="closeClientInfoModal()" class="auth-btn" style="background: #eee; color: #333;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('clientInfoModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Устанавливаем фокус на поле названия
    setTimeout(() => {
        document.getElementById('projectNameInput').focus();
    }, 100);
}

function closeClientInfoModal() {
    const modal = document.getElementById('clientInfoModal');
    if (modal) modal.remove();
}

function saveProjectWithClientInfo() {
    const projectName = document.getElementById('projectNameInput').value.trim();
    if (!projectName) {
        alert('Введите название проекта');
        return;
    }
    
    const clientName = document.getElementById('clientNameInput').value.trim();
    const clientAddress = document.getElementById('clientAddressInput').value.trim();
    const clientPhone = document.getElementById('clientPhoneInput').value.trim();
    const clientNotes = document.getElementById('clientNotesInput').value.trim();
    
    closeClientInfoModal();
    
    showSaveLoader();
    
    // Подготавливаем данные проекта
    const projectData = JSON.parse(JSON.stringify(rooms));
    
    const project = {
        name: projectName,
        client: {
            name: clientName || 'Не указано',
            address: clientAddress || 'Не указано',
            phone: clientPhone || 'Не указано',
            notes: clientNotes || ''
        },
        date: new Date().toISOString(),
        dateLocale: new Date().toLocaleString('ru-RU'),
        data: projectData,
        stats: calculateProjectStats(),
        createdBy: {
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentUser.name
        }
    };

    // Сохраняем в Firestore
    db.collection('users').doc(currentUser.uid).collection('projects').add(project)
        .then((docRef) => {
            console.log("✅ Проект сохранен с ID:", docRef.id);
            
            // ===== НОВЫЙ КОД: СОХРАНЯЕМ ID ПРОЕКТА =====
            window.currentProjectId = docRef.id;
            
            // ===== НОВЫЙ КОД: ЕСЛИ ЕСТЬ ФОТО, СОХРАНЯЕМ ИХ =====
            if (typeof galleryImages !== 'undefined' && galleryImages.length > 0) {
                console.log("📸 Сохраняем фотографии:", galleryImages.length);
                
                db.collection('users').doc(currentUser.uid).collection('projects').doc(docRef.id)
                    .update({
                        gallery: galleryImages.map(img => ({
                            data: img.data,
                            timestamp: img.timestamp,
                            roomId: img.roomId,
                            roomName: img.roomName,
                            fileName: img.fileName
                        }))
                    })
                    .then(() => {
                        console.log("✅ Фотографии сохранены");
                    })
                    .catch((error) => {
                        console.error("❌ Ошибка сохранения фото:", error);
                    });
            }
            // ===== КОНЕЦ НОВОГО КОДА =====
            
            hideSaveLoader();
            showSuccessNotification('Проект успешно сохранен!');
            
            if (document.getElementById('projectsModal').style.display === 'flex') {
                openProjectsModal();
            }
        })
        .catch((error) => {
            console.error("❌ Ошибка сохранения проекта:", error);
            hideSaveLoader();
            alert("Ошибка при сохранении: " + error.message);
        });
}

// Расчет статистики проекта для быстрого просмотра
function calculateProjectStats() {
    let totalArea = 0;
    let totalRooms = rooms.length;
    let elementsCount = 0;
    
    rooms.forEach(room => {
        // Площадь комнаты
        if (room.closed && room.points.length >= 3) {
            let area = 0;
            for(let i = 0; i < room.points.length; i++) {
                let j = (i + 1) % room.points.length;
                area += room.points[i].x * room.points[j].y - room.points[j].x * room.points[i].y;
            }
            totalArea += Math.abs(area / 2) / 1000000;
        }
        
        // Количество элементов
        if (room.elements) {
            elementsCount += room.elements.length;
        }
    });
    
    return {
        totalArea: totalArea.toFixed(2),
        totalRooms: totalRooms,
        elementsCount: elementsCount,
        date: new Date().toISOString()
    };
}

// Индикатор сохранения
function showSaveLoader() {
    const loader = document.createElement('div');
    loader.id = 'saveLoader';
    loader.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 20px 30px; border-radius: 15px; z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 15px;
    `;
    loader.innerHTML = `
        <div style="width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid var(--success); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div style="font-size: 16px;">Сохранение проекта...</div>
    `;
    document.body.appendChild(loader);
}

function hideSaveLoader() {
    const loader = document.getElementById('saveLoader');
    if (loader) loader.remove();
}

// Уведомление об успехе
function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: var(--success); color: white;
        padding: 15px 25px; border-radius: 10px; z-index: 10001; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// ОБНОВЛЕННАЯ функция открытия списка проектов
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
                
                // Форматируем дату
                const displayDate = project.dateLocale || new Date(project.date).toLocaleString('ru-RU');
                
                // Получаем данные клиента с проверкой
                const clientName = project.client?.name || 'Не указано';
                const clientAddress = project.client?.address || '';
                const clientPhone = project.client?.phone || '';
                
                // Статистика проекта
                const stats = project.stats || { totalArea: '?', totalRooms: '?', elementsCount: '?' };

                // Создаем элемент проекта с детальной информацией
                const item = document.createElement('div');
                item.className = 'project-item';
                item.innerHTML = `
                    <div class="project-info">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <span class="project-name">📁 ${escapeHtml(project.name)}</span>
                            <span class="project-meta">${escapeHtml(displayDate)}</span>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin: 8px 0;">
                            <div style="display: grid; grid-template-columns: 20px 1fr; gap: 5px; font-size: 12px;">
                                <span>👤</span> <span><b>Клиент:</b> ${escapeHtml(clientName)}</span>
                                ${clientAddress ? `<span>📍</span> <span><b>Адрес:</b> ${escapeHtml(clientAddress)}</span>` : ''}
                                ${clientPhone ? `<span>📞</span> <span><b>Тел.:</b> ${escapeHtml(clientPhone)}</span>` : ''}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 15px; font-size: 11px; color: #666;">
                            <span>🏠 Комнат: ${stats.totalRooms}</span>
                            <span>📐 Площадь: ${stats.totalArea} м²</span>
                            <span>💡 Элементов: ${stats.elementsCount}</span>
                        </div>
                    </div>
                    
                    <div class="project-actions">
                        <button class="btn-load" onclick="loadProject('${projectId}')" title="Открыть проект">
                            📂 Открыть
                        </button>
                        <button class="btn-info" onclick="showProjectDetails('${projectId}')" title="Детали проекта">
                            ℹ️
                        </button>
                        <button class="btn-delete" onclick="deleteProject('${projectId}')" title="Удалить">
                            🗑️
                        </button>
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

// Показать детальную информацию о проекте
function showProjectDetails(projectId) {
    if (!currentUser || !currentUser.uid || !db) return;
    
    db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).get()
        .then((doc) => {
            if (doc.exists) {
                const project = doc.data();
                
                const detailsHtml = `
                    <div id="projectDetailsModal" class="modal" style="display: block; z-index: 7000;">
                        <div class="modal-content" style="width: 450px;">
                            <h3 style="margin-top: 0;">📋 Детали проекта</h3>
                            
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; margin: 15px 0;">
                                <p><b>Проект:</b> ${escapeHtml(project.name)}</p>
                                <p><b>Дата:</b> ${project.dateLocale || new Date(project.date).toLocaleString('ru-RU')}</p>
                            </div>
                            
                            <h4>👤 Информация о клиенте</h4>
                            <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin: 10px 0;">
                                <p><b>ФИО:</b> ${escapeHtml(project.client?.name || 'Не указано')}</p>
                                <p><b>Адрес:</b> ${escapeHtml(project.client?.address || 'Не указано')}</p>
                                <p><b>Телефон:</b> ${escapeHtml(project.client?.phone || 'Не указано')}</p>
                                ${project.client?.notes ? `<p><b>Примечания:</b> ${escapeHtml(project.client.notes)}</p>` : ''}
                            </div>
                            
                            <h4>📊 Статистика</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                                <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 20px;">🏠</div>
                                    <div>${project.stats?.totalRooms || '?'} комнат</div>
                                </div>
                                <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 20px;">📐</div>
                                    <div>${project.stats?.totalArea || '?'} м²</div>
                                </div>
                                <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 20px;">💡</div>
                                    <div>${project.stats?.elementsCount || '?'} элементов</div>
                                </div>
                            </div>
                            
                            <div style="display: flex; gap: 10px; margin-top: 20px;">
                                <button onclick="closeProjectDetails()" class="auth-btn" style="background: var(--primary);">
                                    Закрыть
                                </button>
                                <button onclick="printProjectDetails('${projectId}')" class="auth-btn" style="background: #ff9800;">
                                    🖨️ Распечатать
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', detailsHtml);
            }
        })
        .catch(console.error);
}

function closeProjectDetails() {
    const modal = document.getElementById('projectDetailsModal');
    if (modal) modal.remove();
}

// Печать деталей проекта
function printProjectDetails(projectId) {
    if (!currentUser || !currentUser.uid || !db) return;
    
    db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).get()
        .then((doc) => {
            if (doc.exists) {
                const project = doc.data();
                
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>${project.name}</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 30px; }
                                h1 { color: #2c3e50; border-bottom: 2px solid #00bcd4; padding-bottom: 10px; }
                                .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
                                .label { font-weight: bold; color: #666; }
                                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                th { background: #f0f0f0; }
                            </style>
                        </head>
                        <body>
                            <h1>🏠 Детали проекта</h1>
                            
                            <div class="section">
                                <h2>${project.name}</h2>
                                <p>Дата: ${project.dateLocale || new Date(project.date).toLocaleString('ru-RU')}</p>
                            </div>
                            
                            <div class="section">
                                <h3>👤 Информация о клиенте</h3>
                                <table>
                                    <tr><td class="label">ФИО:</td><td>${project.client?.name || 'Не указано'}</td></tr>
                                    <tr><td class="label">Адрес:</td><td>${project.client?.address || 'Не указано'}</td></tr>
                                    <tr><td class="label">Телефон:</td><td>${project.client?.phone || 'Не указано'}</td></tr>
                                    ${project.client?.notes ? `<tr><td class="label">Примечания:</td><td>${project.client.notes}</td></tr>` : ''}
                                </table>
                            </div>
                            
                            <div class="section">
                                <h3>📊 Статистика</h3>
                                <table>
                                    <tr><td>Количество комнат:</td><td>${project.stats?.totalRooms || '?'}</td></tr>
                                    <tr><td>Общая площадь:</td><td>${project.stats?.totalArea || '?'} м²</td></tr>
                                    <tr><td>Элементов:</td><td>${project.stats?.elementsCount || '?'} шт.</td></tr>
                                </table>
                            </div>
                            
                            <p style="margin-top: 50px; color: #999; font-size: 12px;">
                                Создано в Ceiling Plan PRO • ${new Date().toLocaleString()}
                            </p>
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            }
        })
        .catch(console.error);
}

// ОБНОВЛЕННАЯ функция загрузки проекта
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

                    // ===== НОВЫЙ КОД: ЗАГРУЖАЕМ ГАЛЕРЕЮ =====
                    if (project.gallery && project.gallery.length > 0) {
                        console.log("📸 Загружаем фотографии:", project.gallery.length);
                        
                        // Проверяем, существует ли переменная galleryImages
                        if (typeof galleryImages !== 'undefined') {
                            galleryImages = project.gallery;
                        } else {
                            // Если нет, создаем глобальную переменную
                            window.galleryImages = project.gallery;
                        }
                        
                        // Сохраняем ID проекта
                        window.currentProjectId = projectId;
                        
                        console.log("✅ Галерея загружена");
                    } else {
                        if (typeof galleryImages !== 'undefined') {
                            galleryImages = [];
                        } else {
                            window.galleryImages = [];
                        }
                    }
                    // ===== КОНЕЦ НОВОГО КОДА =====

                    closeProjectsModal();
                    showSuccessNotification(`Проект "${project.name}" загружен`);
                    
                    // Если есть информация о клиенте, показываем её в консоли
                    if (project.client) {
                        console.log("📋 Данные клиента:", project.client);
                    }
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

// Функция удаления проекта
function deleteProject(projectId) {
    if (!currentUser || !currentUser.uid || !db) return;

    if (confirm("Вы уверены, что хотите удалить этот проект?")) {
        db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId).delete()
            .then(() => {
                console.log("Проект удален");
                showSuccessNotification('Проект удален');
                openProjectsModal(); // Обновляем список
            })
            .catch((error) => {
                console.error("Ошибка удаления:", error);
                alert("Ошибка удаления: " + error.message);
            });
    }
}

function closeProjectsModal() {
    document.getElementById('projectsModal').style.display = 'none';
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

// Добавляем CSS-анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .btn-info {
        background: #e3f2fd;
        color: #1976d2;
        border: 1px solid #bbdefb;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .btn-info:hover {
        background: #bbdefb;
        transform: scale(1.1);
    }
`;
document.head.appendChild(style);

// Экспорт
window.saveProject = saveProject;
window.openProjectsModal = openProjectsModal;
window.loadProject = loadProject;
window.deleteProject = deleteProject;
window.closeProjectsModal = closeProjectsModal;
window.showProjectDetails = showProjectDetails;
window.closeProjectDetails = closeProjectDetails;
window.printProjectDetails = printProjectDetails;
window.saveProjectWithClientInfo = saveProjectWithClientInfo;
window.closeClientInfoModal = closeClientInfoModal;
