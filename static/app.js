const tg = window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

if (tg) {
    tg.ready();
    tg.expand();
}


// ===============================
// ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
// ===============================

let telegramUser = null;

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    telegramUser = tg.initDataUnsafe.user;
}

const telegramId = telegramUser
    ? telegramUser.id
    : 0;

const userName = telegramUser
    ? (telegramUser.first_name || "Пользователь")
    : "Пользователь";


// ===============================
// СОСТОЯНИЕ
// ===============================

let products = [];
let shopping = [];


// ===============================
// ЗАГРУЗКА
// ===============================

async function loadState() {

    try {

        const response = await fetch(
            `/api/state?telegram_id=${telegramId}`
        );

        if (!response.ok) {
            throw new Error("Не удалось загрузить данные");
        }

        const data = await response.json();

        products = data.products || [];
        shopping = data.shopping || [];

        renderProducts();
        renderShopping();
        updateStats();

    } catch (error) {

        console.error(error);

        document.getElementById("productsList").innerHTML = `
            <div class="empty">
                <div class="empty-icon">😕</div>
                <h3>Не удалось загрузить данные</h3>
                <p>Попробуйте закрыть приложение и открыть его снова.</p>
            </div>
        `;
    }
}


// ===============================
// ВКЛАДКИ
// ===============================

function showSection(section) {

    const homeSection = document.getElementById("homeSection");
    const shoppingSection = document.getElementById("shoppingSection");

    const homeTab = document.getElementById("homeTab");
    const shoppingTab = document.getElementById("shoppingTab");

    if (section === "home") {

        homeSection.classList.remove("hidden");
        shoppingSection.classList.add("hidden");

        homeTab.classList.add("active");
        shoppingTab.classList.remove("active");

    } else {

        homeSection.classList.add("hidden");
        shoppingSection.classList.remove("hidden");

        homeTab.classList.remove("active");
        shoppingTab.classList.add("active");
    }
}


// ===============================
// СТАТИСТИКА
// ===============================

function updateStats() {

    document.getElementById("productsCount").textContent =
        products.length;

    const notBought = shopping.filter(
        item => !item.is_bought
    ).length;

    document.getElementById("shoppingCount").textContent =
        notBought;
}


// ===============================
// ТОВАРЫ
// ===============================

async function useProduct(id) {

    const amountText =
        prompt("Сколько потратили?");

    if (amountText === null) {
        return;
    }

    const amount =
        Number(amountText);

    if (!amount || amount <= 0) {

        alert("Введите количество больше нуля.");

        return;
    }


    try {

        const response =
            await fetch(
                `/api/product/${id}/use`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        telegram_id: telegramId,
                        user_name: userName,
                        amount: amount
                    })
                }
            );


        if (!response.ok) {
            throw new Error("Ошибка");
        }


        await loadState();

    } catch (error) {

        console.error(error);

        alert(
            "Не получилось изменить количество."
        );
    }
}


// ===============================
// ПОКУПКИ
// ===============================

function renderShopping() {

    const container =
        document.getElementById("shoppingList");

    if (!shopping.length) {

        container.innerHTML = `
            <div class="empty">

                <div class="empty-icon">🛒</div>

                <h3>Список покупок пуст</h3>

                <p>
                    Добавьте то, что нужно купить.
                </p>

                <button
                    class="button primary"
                    style="margin-top:18px;padding:0 22px;"
                    onclick="openShoppingModal()"
                >
                    ＋ Добавить покупку
                </button>

            </div>
        `;

        return;
    }


    container.innerHTML = shopping.map(item => {

        const checked =
            item.is_bought ? "checked" : "";

        const bought =
            item.is_bought ? "bought" : "";


        return `
            <div class="shopping-item ${bought}">

                <button
                    class="shopping-check ${checked}"
                    onclick="toggleShopping(
                        ${item.id},
                        ${!item.is_bought}
                    )"
                >
                    ${item.is_bought ? "✓" : ""}
                </button>


                <div class="shopping-content">

                    <div class="shopping-name">
                        ${escapeHtml(item.name)}
                    </div>

                    <div class="shopping-quantity">
                        ${item.quantity || 1}
                        ${escapeHtml(item.unit || "шт.")}
                    </div>

                </div>

            </div>
        `;

    }).join("");
}


// ===============================
// ДОБАВЛЕНИЕ ТОВАРА
// ===============================

function openAddModal() {

    document
        .getElementById("productModal")
        .classList.remove("hidden");

    setTimeout(() => {

        document
            .getElementById("productName")
            .focus();

    }, 100);
}


function closeAddModal() {

    document
        .getElementById("productModal")
        .classList.add("hidden");
}


async function saveProduct() {

    const name =
        document
            .getElementById("productName")
            .value
            .trim();

    if (!name) {

        alert("Введите название товара");

        return;
    }


    const data = {

        telegram_id: telegramId,

        user_name: userName,

        name: name,

        quantity:
            Number(
                document
                    .getElementById("productQuantity")
                    .value
            ) || 1,

        unit:
            document
                .getElementById("productUnit")
                .value,

        category:
            document
                .getElementById("productCategory")
                .value,

        min_quantity:
            Number(
                document
                    .getElementById("productMinQuantity")
                    .value
            ) || 0,

        expiration_date:
            document
                .getElementById("productExpiration")
                .value || null
    };


    try {

        const response =
            await fetch("/api/product", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(data)
            });


        if (!response.ok) {
            throw new Error("Ошибка сохранения");
        }


        closeAddModal();

        clearProductForm();

        await loadState();

    } catch (error) {

        console.error(error);

        alert(
            "Не получилось сохранить товар."
        );
    }
}


// ===============================
// ОЧИСТКА ФОРМЫ
// ===============================

function clearProductForm() {

    document
        .getElementById("productName")
        .value = "";

    document
        .getElementById("productQuantity")
        .value = "1";

    document
        .getElementById("productMinQuantity")
        .value = "0";

    document
        .getElementById("productExpiration")
        .value = "";
}


// ===============================
// ПОКУПКИ
// ===============================

function openShoppingModal() {

    document
        .getElementById("shoppingModal")
        .classList.remove("hidden");

    setTimeout(() => {

        document
            .getElementById("shoppingName")
            .focus();

    }, 100);
}


function closeShoppingModal() {

    document
        .getElementById("shoppingModal")
        .classList.add("hidden");
}


async function saveShopping() {

    const name =
        document
            .getElementById("shoppingName")
            .value
            .trim();

    if (!name) {

        alert("Введите название покупки");

        return;
    }


    const data = {

        telegram_id: telegramId,

        user_name: userName,

        name: name,

        quantity:
            Number(
                document
                    .getElementById("shoppingQuantity")
                    .value
            ) || 1,

        unit:
            document
                .getElementById("shoppingUnit")
                .value
    };


    try {

        const response =
            await fetch("/api/shopping", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(data)
            });


        if (!response.ok) {
            throw new Error("Ошибка");
        }


        closeShoppingModal();

        document
            .getElementById("shoppingName")
            .value = "";

        await loadState();

        showSection("shopping");

    } catch (error) {

        console.error(error);

        alert(
            "Не получилось добавить покупку."
        );
    }
}


// ===============================
// ОТМЕТИТЬ ПОКУПКУ
// ===============================

async function toggleShopping(id, bought) {

    try {

        const response =
            await fetch(
                `/api/shopping/${id}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        is_bought: bought
                    })
                }
            );


        if (!response.ok) {
            throw new Error("Ошибка");
        }


        await loadState();

    } catch (error) {

        console.error(error);

        alert(
            "Не получилось изменить покупку."
        );
    }
}


// ===============================
// ДАТА
// ===============================

function formatDate(value) {

    const parts =
        value.split("-");

    if (parts.length !== 3) {
        return value;
    }

    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}


// ===============================
// БЕЗОПАСНЫЙ ТЕКСТ
// ===============================

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ===============================
// ЗАПУСК
// ===============================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadState();

    }
);
