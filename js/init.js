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

// Экспортируем
window.updateCurrentUser = updateCurrentUser;

// Экспортируем
window.currentUser = currentUser;
window.selectedRegPlan = selectedRegPlan;
window.initializeFirebase = initializeFirebase;

