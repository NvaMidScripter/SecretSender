// ШАГ 1: ВСТАВЬ СЮДА СВОЙ firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyCEqR8Y8WTLUaWigvR-UBMkZRNVvIDduW4",
  authDomain: "telebot-8e973.firebaseapp.com",
  databaseURL: "https://telebot-8e973-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "telebot-8e973",
  storageBucket: "telebot-8e973.firebasestorage.app",
  messagingSenderId: "1002874784964",
  appId: "1:1002874784964:web:35472827e22700f606cd91"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Получаем элементы со страницы
const createSection = document.getElementById('create-section');
const linkSection = document.getElementById('link-section');
const revealSection = document.getElementById('reveal-section');

const secretTextInput = document.getElementById('secret-text');
const createBtn = document.getElementById('create-btn');
const generatedLinkInput = document.getElementById('generated-link');
const copyLinkBtn = document.getElementById('copy-link-btn');
const revealedSecretDiv = document.getElementById('revealed-secret');
const loadingText = document.getElementById('loading-text');
const copySecretBtn = document.getElementById('copy-secret-btn');

// --- ЛОГИКА ШИФРОВАНИЯ ---
// Преобразование ArrayBuffer в строку Base64 и обратно
const bufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuffer = (base64) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

async function encryptData(secretText, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization Vector
    const encodedText = new TextEncoder().encode(secretText);
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedText
    );
    return {
        iv: bufferToBase64(iv),
        encrypted: bufferToBase64(encryptedData)
    };
}

async function decryptData(encryptedPayload, key) {
    const iv = base64ToBuffer(encryptedPayload.iv);
    const encryptedData = base64ToBuffer(encryptedPayload.encrypted);
    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
    );
    return new TextDecoder().decode(decryptedData);
}

// --- ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ ---

// Функция создания секрета
async function handleCreateSecret() {
    const secretText = secretTextInput.value;
    if (!secretText.trim()) {
        alert('Пожалуйста, введите текст секрета.');
        return;
    }

    createBtn.disabled = true;
    createBtn.textContent = 'Создание...';

    try {
        // 1. Генерируем ключ шифрования
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        
        // 2. Шифруем данные
        const encryptedPayload = await encryptData(secretText, key);

        // 3. Сохраняем зашифрованные данные в Firebase
        const secretRef = await database.ref('secrets').push(encryptedPayload);
        const secretId = secretRef.key;

        // 4. Генерируем финальную ссылку с ключом в "якоре" (#)
        const keyExported = await crypto.subtle.exportKey('raw', key);
        const keyBase64 = bufferToBase64(keyExported);
        const currentUrl = window.location.href.split('#')[0];
        const finalUrl = `${currentUrl}?id=${secretId}#${keyBase64}`;

        // 5. Показываем ссылку пользователю
        generatedLinkInput.value = finalUrl;
        createSection.classList.add('hidden');
        linkSection.classList.remove('hidden');

    } catch (error) {
        console.error("Ошибка при создании секрета:", error);
        alert('Произошла ошибка. Попробуйте снова.');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Создать одноразовую ссылку';
    }
}

// Функция отображения секрета
async function handleRevealSecret() {
    const urlParams = new URLSearchParams(window.location.search);
    const secretId = urlParams.get('id');
    const keyBase64 = window.location.hash.substring(1);

    if (!secretId || !keyBase64) return; // Не страница секрета, ничего не делаем

    // Показываем секцию для отображения секрета
    createSection.classList.add('hidden');
    revealSection.classList.remove('hidden');

    try {
        // 1. Получаем зашифрованные данные из Firebase
        const snapshot = await database.ref(`secrets/${secretId}`).get();
        if (!snapshot.exists()) {
            revealedSecretDiv.textContent = 'Этот секрет уже был прочитан или не существует.';
            return;
        }
        const encryptedPayload = snapshot.val();

        // 2. Сразу удаляем секрет из базы данных
        await database.ref(`secrets/${secretId}`).remove();

        // 3. Расшифровываем данные
        const keyBuffer = base64ToBuffer(keyBase64);
        const key = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, true, ['decrypt']);
        const decryptedText = await decryptData(encryptedPayload, key);

        // 4. Показываем секрет
        loadingText.classList.add('hidden');
        revealedSecretDiv.textContent = decryptedText;
        copySecretBtn.classList.remove('hidden');

    } catch (error) {
        console.error("Ошибка при чтении секрета:", error);
        revealedSecretDiv.textContent = 'Ошибка! Не удалось расшифровать или прочитать этот секрет. Возможно, ссылка повреждена.';
    }
}

// Функция копирования в буфер обмена
function copyToClipboard(text, button, originalText) {
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Скопировано!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Не удалось скопировать:', err);
        alert('Не удалось скопировать текст.');
    });
}

// Назначаем обработчики событий
createBtn.addEventListener('click', handleCreateSecret);
copyLinkBtn.addEventListener('click', () => copyToClipboard(generatedLinkInput.value, copyLinkBtn, 'Копировать ссылку'));
copySecretBtn.addEventListener('click', () => copyToClipboard(revealedSecretDiv.textContent, copySecretBtn, 'Копировать секрет'));

// При загрузке страницы проверяем, нужно ли отображать секрет
window.addEventListener('load', handleRevealSecret);
