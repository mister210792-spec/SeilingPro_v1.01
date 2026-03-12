// 3D визуализация для Ceiling Plan PRO
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let scene, camera, renderer, labelRenderer, controls, room3D;
let is3DMode = false;

// Инициализация 3D сцены
function init3D() {
    // Создаем сцену
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111122);
    
    // Камера
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // Рендерер WebGL
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Рендерер для текста (CSS2D)
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.left = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    
    // Контейнер для 3D
    const container = document.getElementById('canvas-container');
    container.innerHTML = ''; // Очищаем SVG
    container.appendChild(renderer.domElement);
    container.appendChild(labelRenderer.domElement);
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0x404060);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.receiveShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    const d = 10;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 15;
    scene.add(dirLight);
    
    const fillLight = new THREE.PointLight(0x446688, 0.5);
    fillLight.position.set(-3, 4, 5);
    scene.add(fillLight);
    
    // Пол
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.7, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Сетка на полу
    const gridHelper = new THREE.GridHelper(20, 20, 0x88ccff, 0x335588);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
    
    // Контролы
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;
    controls.enableZoom = true;
    controls.target.set(0, 1, 0);
    
    is3DMode = true;
    
    // Запускаем анимацию
    animate3D();
    
    // Создаем 3D модель из текущей комнаты
    createRoom3D();
}

// Создание 3D модели комнаты
function createRoom3D() {
    if (!rooms || rooms.length === 0 || !rooms[activeRoom]) return;
    
    // Удаляем старую модель
    if (room3D) {
        scene.remove(room3D);
    }
    
    room3D = new THREE.Group();
    
    const room = rooms[activeRoom];
    const points = room.points;
    
    if (points.length < 3) return;
    
    // Высота стен (стандартная 2.7 м = 2700 мм, переводим в метры для Three.js)
    const wallHeight = 2.7;
    
    // Материалы
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x88aaff, 
        transparent: true, 
        opacity: 0.6,
        side: THREE.DoubleSide 
    });
    
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    
    // Создаем стены
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        // Переводим из мм в метры
        const x1 = p1.x / 1000;
        const z1 = p1.y / 1000; // Y в 2D становится Z в 3D
        const x2 = p2.x / 1000;
        const z2 = p2.y / 1000;
        
        const length = Math.sqrt((x2 - x1)**2 + (z2 - z1)**2);
        const angle = Math.atan2(z2 - z1, x2 - x1);
        
        // Стена
        const wallGeometry = new THREE.BoxGeometry(length, wallHeight, 0.1);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.castShadow = true;
        wall.receiveShadow = true;
        
        wall.position.x = (x1 + x2) / 2;
        wall.position.y = wallHeight / 2;
        wall.position.z = (z1 + z2) / 2;
        
        wall.rotation.y = -angle;
        
        room3D.add(wall);
        
        // Добавляем размер стены
        const lengthInCm = Math.round(length * 100);
        addLabel(`${lengthInCm} см`, (x1 + x2) / 2, wallHeight / 2, (z1 + z2) / 2);
    }
    
    // Потолок (полотно)
    if (room.closed) {
        // Создаем полигональную геометрию для потолка
        const shape = new THREE.Shape();
        const first = points[0];
        shape.moveTo(first.x / 1000, first.y / 1000);
        
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x / 1000, points[i].y / 1000);
        }
        
        shape.closePath();
        
        const geometry = new THREE.ShapeGeometry(shape);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const ceiling = new THREE.Mesh(geometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.rotation.z = Math.PI;
        ceiling.position.y = wallHeight;
        ceiling.receiveShadow = true;
        
        room3D.add(ceiling);
    }
    
    // Добавляем элементы (светильники и т.д.)
    if (room.elements) {
        room.elements.forEach(el => {
            const x = el.x / 1000;
            const z = el.y / 1000;
            
            let color = 0xffaa00;
            let size = 0.2;
            let type = 'light';
            
            if (el.type === 'pipe') {
                color = 0x888888;
                size = 0.15;
                type = 'pipe';
            } else if (el.type === 'rail') {
                color = 0xcc8800;
                size = 0.1;
                type = 'rail';
            } else if (el.subtype === 'GX53') {
                color = 0xffdd44;
                size = 0.2;
            } else if (el.subtype === 'CHANDELIER') {
                color = 0xffaa44;
                size = 0.3;
            }
            
            // Создаем элемент в 3D
            if (type === 'light') {
                // Светильник
                const sphereGeo = new THREE.SphereGeometry(size, 16, 16);
                const sphereMat = new THREE.MeshStandardMaterial({ color: color, emissive: 0x442200 });
                const sphere = new THREE.Mesh(sphereGeo, sphereMat);
                sphere.position.set(x, wallHeight - 0.1, z);
                sphere.castShadow = true;
                sphere.receiveShadow = true;
                room3D.add(sphere);
                
                // Добавляем свечение
                const light = new THREE.PointLight(0xffaa66, 1, 2);
                light.position.set(x, wallHeight - 0.1, z);
                room3D.add(light);
                
                addLabel('💡', x, wallHeight, z);
            } else if (type === 'pipe') {
                // Обвод трубы
                const cylinderGeo = new THREE.CylinderGeometry(size, size, 2.5, 8);
                const cylinderMat = new THREE.MeshStandardMaterial({ color: color });
                const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
                cylinder.position.set(x, 1.25, z);
                cylinder.castShadow = true;
                cylinder.receiveShadow = true;
                room3D.add(cylinder);
                
                addLabel('🔘', x, 2.6, z);
            } else if (type === 'rail') {
                // Карниз
                const boxGeo = new THREE.BoxGeometry(0.1, 0.1, 2);
                const boxMat = new THREE.MeshStandardMaterial({ color: color });
                const box = new THREE.Mesh(boxGeo, boxMat);
                box.position.set(x, wallHeight - 0.2, z);
                box.castShadow = true;
                box.receiveShadow = true;
                room3D.add(box);
                
                addLabel('📏', x, wallHeight, z);
            }
        });
    }
    
    scene.add(room3D);
}

// Добавление текстовой метки
function addLabel(text, x, y, z) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.color = '#fff';
    div.style.fontSize = '14px';
    div.style.fontWeight = 'bold';
    div.style.textShadow = '1px 1px 2px black';
    div.style.background = 'rgba(0,0,0,0.5)';
    div.style.padding = '2px 6px';
    div.style.borderRadius = '4px';
    div.style.whiteSpace = 'nowrap';
    
    const label = new CSS2DObject(div);
    label.position.set(x, y + 0.2, z);
    scene.add(label);
}

// Анимация
function animate3D() {
    if (!is3DMode) return;
    
    requestAnimationFrame(animate3D);
    
    controls.update();
    
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

// Переключение между 2D и 3D режимами
function toggle3D() {
    if (is3DMode) {
        // Возвращаемся в 2D
        const container = document.getElementById('canvas-container');
        container.innerHTML = '<svg id="canvas" xmlns="http://www.w3.org/2000/svg"></svg>';
        // Переинициализируем SVG
        window.svg = document.getElementById("canvas");
        draw();
        is3DMode = false;
    } else {
        // Переходим в 3D
        init3D();
    }
}

// Обновление 3D при изменении комнаты
function update3D() {
    if (is3DMode) {
        createRoom3D();
    }
}

// Экспорт функций
window.toggle3D = toggle3D;
window.update3D = update3D;

// Следим за изменениями активной комнаты
const originalRenderTabs = window.renderTabs;
window.renderTabs = function() {
    if (originalRenderTabs) originalRenderTabs();
    if (is3DMode) {
        setTimeout(update3D, 100);
    }
};