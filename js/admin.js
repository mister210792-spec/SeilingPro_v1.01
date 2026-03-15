const ADMIN_EMAILS = [
    'a5mister210792@gmail.com',
    'rustem.khusnutdinov.1992@mail.ru',
    'mister210792@gmail.com'
];

function isAdmin() {
    // Проверяем через window.currentUser
    const user = window.currentUser;
    
    if (!user || !user.email) {
        console.log("👑 Админ-проверка: пользователь не найден");
        return false;
    }
    
    const isAdminUser = ADMIN_EMAILS.includes(user.email);
    console.log(`👑 Админ-проверка для ${user.email}: ${isAdminUser ? 'ДА' : 'НЕТ'}`);
    
    return isAdminUser;
}

function updateAdminPanelVisibility() {
    const adminSection = document.getElementById('admin-section');
    if (!adminSection) {
        console.warn("⚠️ Элемент admin-section не найден");
        return;
    }
    
    const admin = isAdmin();
    console.log("👑 Обновление видимости админ-панели:", admin ? "ПОКАЗАТЬ" : "СКРЫТЬ");
    
    adminSection.style.display = admin ? 'block' : 'none';
    
    // Если админ, добавим визуальное подтверждение
    if (admin) {
        console.log("✅ Админ-панель активирована для", window.currentUser?.email);
    }
}

async function adminFindUser() {
    if (!isAdmin()) {
        alert('❌ Доступ запрещен');
        return;
    }
    
    const email = document.getElementById('admin-user-email').value.trim();
    if (!email) {
        alert('Введите email пользователя');
        return;
    }
    
    const infoDiv = document.getElementById('admin-user-info');
    if (infoDiv) {
        infoDiv.style.display = 'none';
    }
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();
        
        if (snapshot.empty) {
            document.getElementById('admin-user-info').style.display = 'block';
            document.getElementById('admin-user-details').innerHTML = `
                <div style="color: #ff5252;">❌ Пользователь не найден</div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            const uid = doc.id;
            
            document.getElementById('admin-update-btn')?.setAttribute('data-uid', uid);
            
            let endDate = 'Нет';
            if (userData.subscription?.endDate) {
                const date = userData.subscription.endDate.toDate ? 
                    userData.subscription.endDate.toDate() : 
                    new Date(userData.subscription.endDate);
                endDate = date.toLocaleDateString('ru-RU');
            }
            
            let startDate = 'Нет';
            if (userData.subscription?.startDate) {
                const date = userData.subscription.startDate.toDate ? 
                    userData.subscription.startDate.toDate() : 
                    new Date(userData.subscription.startDate);
                startDate = date.toLocaleDateString('ru-RU');
            }
            
            document.getElementById('admin-user-info').style.display = 'block';
            document.getElementById('admin-user-details').innerHTML = `
                <div><b>UID:</b> ${uid.substring(0, 8)}...</div>
                <div><b>Email:</b> ${userData.email}</div>
                <div><b>Имя:</b> ${userData.name || 'Не указано'}</div>
                <div><b>Текущий план:</b> ${userData.plan || 'free'}</div>
                <div><b>Статус подписки:</b> ${userData.subscription?.status || 'Нет'}</div>
                <div><b>Дата начала:</b> ${startDate}</div>
                <div><b>Дата окончания:</b> ${endDate}</div>
            `;
            
            const select = document.getElementById('admin-plan-select');
            if (select) {
                select.value = userData.plan || 'free';
            }
        });
        
    } catch (error) {
        console.error('Ошибка поиска пользователя:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}

async function adminUpdateUserPlan() {
    if (!isAdmin()) {
        alert('❌ Доступ запрещен');
        return;
    }
    
    const email = document.getElementById('admin-user-email').value.trim();
    const newPlan = document.getElementById('admin-plan-select').value;
    
    if (!email) {
        alert('Введите email пользователя');
        return;
    }
    
    if (!confirm(`Изменить тариф пользователя ${email} на ${newPlan.toUpperCase()}?`)) {
        return;
    }
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();
        
        if (snapshot.empty) {
            alert('❌ Пользователь не найден');
            return;
        }
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            const updateData = {
                plan: newPlan,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (newPlan === 'pro') {
                const endDate = new Date();
                endDate.setFullYear(endDate.getFullYear() + 1);
                
                updateData.subscription = {
                    status: 'active',
                    startDate: firebase.firestore.FieldValue.serverTimestamp(),
                    endDate: endDate,
                    autoRenew: false,
                    adminUpdated: true
                };
            }
            
            if (newPlan === 'free') {
                updateData.subscription = {
                    status: 'inactive',
                    endDate: null,
                    adminUpdated: true
                };
            }
            
            if (newPlan === 'pending') {
                updateData.subscription = {
                    status: 'pending',
                    startDate: null,
                    endDate: null,
                    adminUpdated: true
                };
            }
            
            batch.update(doc.ref, updateData);
        });
        
        await batch.commit();
        
        alert(`✅ Тариф пользователя ${email} изменен на ${newPlan.toUpperCase()}`);
        adminFindUser();
        
    } catch (error) {
        console.error('Ошибка обновления:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}

async function adminMakeMePro() {
    if (!currentUser || !currentUser.uid) {
        alert('Сначала войдите в систему');
        return;
    }
    
    if (!isAdmin()) {
        alert('❌ Доступ запрещен');
        return;
    }
    
    if (!confirm('Сделать ваш аккаунт PRO на 1 год?')) {
        return;
    }
    
    try {
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        await db.collection('users').doc(currentUser.uid).update({
            plan: 'pro',
            'subscription.status': 'active',
            'subscription.startDate': firebase.firestore.FieldValue.serverTimestamp(),
            'subscription.endDate': endDate,
            'subscription.autoRenew': false,
            'subscription.adminUpdated': true
        });
        
        alert('✅ Ваш аккаунт обновлен до PRO (действует 1 год)');
        location.reload();
        
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка: ' + error.message);
    }
}

function closeAdminUserInfo() {
    const infoDiv = document.getElementById('admin-user-info');
    if (infoDiv) {
        infoDiv.style.display = 'none';
    }
}

// Экспорт
window.isAdmin = isAdmin;
window.updateAdminPanelVisibility = updateAdminPanelVisibility;
window.adminFindUser = adminFindUser;
window.adminUpdateUserPlan = adminUpdateUserPlan;
window.adminMakeMePro = adminMakeMePro;

window.closeAdminUserInfo = closeAdminUserInfo;
