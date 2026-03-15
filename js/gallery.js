// js/gallery.js
// Галерея изображений для проектов

// Структура данных для фотографий
let galleryImages = [];

// Открыть галерею
function openGallery() {
    const modalHtml = `
        <div id="galleryModal" class="modal" style="display: block; z-index: 6000;">
            <div class="modal-content" style="width: 800px; max-width: 95%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: var(--primary);">📸 Галерея объекта</h3>
                    <button onclick="closeGallery()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <!-- Кнопки управления -->
                <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button onclick="takePhoto()" class="gallery-btn" style="background: #4caf50;">
                        📸 Сделать фото
                    </button>
                    <button onclick="uploadPhoto()" class="gallery-btn" style="background: #2196f3;">
                        📁 Загрузить фото
                    </button>
                    <button onclick="startSlideshow()" class="gallery-btn" style="background: #ff9800;">
                        🎬 Слайд-шоу
                    </button>
                    <button onclick="clearAllPhotos()" class="gallery-btn" style="background: #f44336;">
                        🗑️ Очистить все
                    </button>
                </div>
                
                <!-- Сетка фотографий -->
                <div id="galleryGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
                    ${renderGalleryGrid()}
                </div>
                
                <!-- Если нет фото -->
                ${galleryImages.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📷</div>
                        <div>Нет фотографий</div>
                        <div style="font-size: 13px; margin-top: 10px;">Сделайте фото или загрузите существующие</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    const oldModal = document.getElementById('galleryModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Рендер сетки фотографий
function renderGalleryGrid() {
    if (galleryImages.length === 0) return '';
    
    return galleryImages.map((img, index) => `
        <div class="gallery-item" style="position: relative; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <img src="${img.data}" style="width: 100%; height: 150px; object-fit: cover; cursor: pointer;" 
                 onclick="viewPhoto(${index})">
            
            <!-- Информация о фото -->
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); color: white; padding: 10px; font-size: 11px;">
                <div>${img.roomName || 'Общее фото'}</div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span>${new Date(img.timestamp).toLocaleDateString()}</span>
                    <span style="cursor: pointer;" onclick="deletePhoto(${index})">🗑️</span>
                </div>
            </div>
            
            <!-- Индикатор привязки к комнате -->
            ${img.roomId !== undefined ? `
                <div style="position: absolute; top: 5px; right: 5px; background: var(--primary); color: white; border-radius: 20px; padding: 2px 8px; font-size: 10px;">
                    🏠 Комната ${img.roomId + 1}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Сделать фото (только на мобильных с камерой)
function takePhoto() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Ваше устройство не поддерживает доступ к камере');
        return;
    }
    
    // Создаем видео элемент для предпросмотра
    const videoHtml = `
        <div id="cameraModal" class="modal" style="display: block; z-index: 7000;">
            <div class="modal-content" style="width: 90%; max-width: 500px;">
                <h3 style="margin-top: 0;">📸 Сделать фото</h3>
                <video id="cameraPreview" style="width: 100%; border-radius: 10px; margin-bottom: 15px;" autoplay></video>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="capturePhoto()" style="flex: 2; background: #4caf50; color: white; padding: 12px;">
                        📸 Сфотографировать
                    </button>
                    <button onclick="closeCamera()" style="flex: 1; background: #eee; padding: 12px;">
                        Отмена
                    </button>
                </div>
                
                <div style="margin-top: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Привязать к комнате:</label>
                    <select id="photoRoomSelect" style="width: 100%; padding: 10px;">
                        <option value="-1">Общее фото объекта</option>
                        ${rooms.map((room, idx) => `<option value="${idx}">${room.name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', videoHtml);
    
    // Запускаем камеру
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            const video = document.getElementById('cameraPreview');
            video.srcObject = stream;
            window.currentStream = stream;
        })
        .catch(err => {
            console.error('Ошибка доступа к камере:', err);
            alert('Не удалось получить доступ к камере');
            closeCamera();
        });
}

// Сделать снимок
function capturePhoto() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const roomSelect = document.getElementById('photoRoomSelect');
    const roomId = roomSelect.value !== '-1' ? parseInt(roomSelect.value) : undefined;
    const roomName = roomSelect.value !== '-1' ? rooms[roomId].name : undefined;
    
    // Добавляем в галерею
    galleryImages.push({
        id: Date.now(),
        data: imageData,
        timestamp: Date.now(),
        roomId: roomId,
        roomName: roomName,
        type: 'photo'
    });
    
    // Сохраняем в проект
    saveGalleryToProject();
    
    // Закрываем камеру
    closeCamera();
    
    // Обновляем отображение
    if (document.getElementById('galleryModal')) {
        document.getElementById('galleryGrid').innerHTML = renderGalleryGrid();
    }
    
    showNotification('✅ Фото добавлено в галерею');
}

function closeCamera() {
    if (window.currentStream) {
        window.currentStream.getTracks().forEach(track => track.stop());
        window.currentStream = null;
    }
    const modal = document.getElementById('cameraModal');
    if (modal) modal.remove();
}

// Загрузить существующее фото
function uploadPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    
    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                galleryImages.push({
                    id: Date.now() + Math.random(),
                    data: event.target.result,
                    timestamp: Date.now(),
                    fileName: file.name,
                    type: 'upload'
                });
                
                // Обновляем отображение
                if (document.getElementById('galleryModal')) {
                    document.getElementById('galleryGrid').innerHTML = renderGalleryGrid();
                }
                
                saveGalleryToProject();
            };
            reader.readAsDataURL(file);
        });
        
        showNotification(`✅ Загружено ${files.length} фото`);
    };
    
    input.click();
}

// Просмотр фото
function viewPhoto(index) {
    const img = galleryImages[index];
    
    const viewHtml = `
        <div id="viewPhotoModal" class="modal" style="display: block; z-index: 7000;">
            <div class="modal-content" style="width: 90%; max-width: 800px; background: black; padding: 0; overflow: hidden;">
                <div style="position: relative;">
                    <img src="${img.data}" style="width: 100%; max-height: 80vh; object-fit: contain;">
                    
                    <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 10px;">
                        <button onclick="deletePhoto(${index})" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 20px;">🗑️</button>
                        <button onclick="closeViewPhoto()" style="background: #333; color: white; border: none; padding: 8px 15px; border-radius: 20px;">✕</button>
                    </div>
                    
                    <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 8px 15px; border-radius: 20px; font-size: 12px;">
                        ${img.roomName ? `🏠 ${img.roomName}` : '📷 Общее фото'} • ${new Date(img.timestamp).toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', viewHtml);
}

function closeViewPhoto() {
    const modal = document.getElementById('viewPhotoModal');
    if (modal) modal.remove();
}

// Удалить фото
function deletePhoto(index) {
    if (confirm('Удалить это фото?')) {
        galleryImages.splice(index, 1);
        saveGalleryToProject();
        
        // Обновляем отображение
        if (document.getElementById('galleryModal')) {
            document.getElementById('galleryGrid').innerHTML = renderGalleryGrid();
        }
        
        // Закрываем просмотр если открыт
        closeViewPhoto();
        
        showNotification('🗑️ Фото удалено');
    }
}

// Очистить все фото
function clearAllPhotos() {
    if (confirm('Удалить все фотографии из галереи?')) {
        galleryImages = [];
        saveGalleryToProject();
        
        if (document.getElementById('galleryModal')) {
            closeGallery();
        }
        
        showNotification('🗑️ Галерея очищена');
    }
}

// Слайд-шоу
function startSlideshow() {
    if (galleryImages.length === 0) {
        alert('Нет фотографий для показа');
        return;
    }
    
    let currentIndex = 0;
    
    const slideshowHtml = `
        <div id="slideshowModal" class="modal" style="display: block; z-index: 7000; background: black;">
            <div style="position: relative; width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center;">
                <img id="slideshowImage" src="${galleryImages[0].data}" style="max-width: 100%; max-height: 100vh; object-fit: contain;">
                
                <button onclick="stopSlideshow()" style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white; border: none; padding: 10px 20px; border-radius: 30px; cursor: pointer;">✕ Закрыть</button>
                
                <button onclick="prevSlide()" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; width: 50px; height: 50px; border-radius: 50%; font-size: 24px; cursor: pointer;">←</button>
                
                <button onclick="nextSlide()" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5); color: white; border: none; width: 50px; height: 50px; border-radius: 50%; font-size: 24px; cursor: pointer;">→</button>
                
                <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: white; padding: 8px 20px; border-radius: 30px;">
                    ${currentIndex + 1} / ${galleryImages.length}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', slideshowHtml);
    
    // Функции для слайд-шоу
    window.prevSlide = () => {
        currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
        document.getElementById('slideshowImage').src = galleryImages[currentIndex].data;
        updateSlideCounter();
    };
    
    window.nextSlide = () => {
        currentIndex = (currentIndex + 1) % galleryImages.length;
        document.getElementById('slideshowImage').src = galleryImages[currentIndex].data;
        updateSlideCounter();
    };
    
    window.stopSlideshow = () => {
        const modal = document.getElementById('slideshowModal');
        if (modal) modal.remove();
        delete window.prevSlide;
        delete window.nextSlide;
        delete window.stopSlideshow;
    };
    
    function updateSlideCounter() {
        const counter = document.querySelector('#slideshowModal div:last-child');
        if (counter) {
            counter.textContent = `${currentIndex + 1} / ${galleryImages.length}`;
        }
    }
}

// Сохранить галерею в проект
function saveGalleryToProject() {
    if (currentUser && currentUser.uid && window.db) {
        const projectId = window.currentProjectId;
        if (projectId) {
            db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId)
                .update({
                    gallery: galleryImages.map(img => ({
                        data: img.data,
                        timestamp: img.timestamp,
                        roomId: img.roomId,
                        roomName: img.roomName
                    }))
                })
                .catch(console.error);
        }
    }
    
    // Также сохраняем локально
    localStorage.setItem('cp_gallery_' + activeRoom, JSON.stringify(galleryImages));
}

// Загрузить галерею из проекта
function loadGalleryFromProject(projectId) {
    if (currentUser && currentUser.uid && window.db) {
        db.collection('users').doc(currentUser.uid).collection('projects').doc(projectId)
            .get()
            .then(doc => {
                if (doc.exists && doc.data().gallery) {
                    galleryImages = doc.data().gallery;
                }
            })
            .catch(console.error);
    } else {
        // Загружаем из localStorage
        const saved = localStorage.getItem('cp_gallery_' + activeRoom);
        if (saved) {
            galleryImages = JSON.parse(saved);
        }
    }
}

// Закрыть галерею
function closeGallery() {
    const modal = document.getElementById('galleryModal');
    if (modal) modal.remove();
}

// Уведомление
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
        padding: 12px 24px; border-radius: 30px; z-index: 10000; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Экспорт
window.openGallery = openGallery;
window.closeGallery = closeGallery;
window.takePhoto = takePhoto;
window.uploadPhoto = uploadPhoto;
window.startSlideshow = startSlideshow;
window.clearAllPhotos = clearAllPhotos;
window.viewPhoto = viewPhoto;
window.deletePhoto = deletePhoto;
window.capturePhoto = capturePhoto;
window.closeCamera = closeCamera;
window.closeViewPhoto = closeViewPhoto;