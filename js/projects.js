function saveProject() {
    if (!currentUser || !currentUser.uid) {
        alert("Пожалуйста, войдите в систему для сохранения проектов.");
        return;
    }

    if (!db) {
        alert("База данных не доступна");
        return;
    }

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
                    if (typeof draw === 'function') draw();

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

// Экспорт
window.saveProject = saveProject;
window.openProjectsModal = openProjectsModal;
window.loadProject = loadProject;
window.deleteProject = deleteProject;
window.closeProjectsModal = closeProjectsModal;