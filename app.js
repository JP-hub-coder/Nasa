/**
 * CONFIGURACIÓN Y ESTADO
 */
const API_KEY = "API KEY"; // Clave de API de la NASA
const BASE_URL = "https://api.nasa.gov/planetary/apod";
const gallery = document.getElementById("gallery");
const statusContainer = document.getElementById("statusContainer");

// Restringir fecha máxima a hoy
const todayStr = new Date().toISOString().split("T")[0];
document.getElementById("start").max = todayStr;
document.getElementById("end").max = todayStr;

/**
 * SERVICIOS (LÓGICA DE DATOS)
 */
async function apiCall(params = "") {
    showLoading(true);
    try {
        const response = await fetch(`${BASE_URL}?api_key=${API_KEY}${params}`);
        if (!response.ok) throw new Error("Error en la respuesta de la NASA");
        const data = await response.json();
        return Array.isArray(data) ? data : [data];
    } catch (error) {
        showToast("🚀 Error de conexión");
        console.error(error);
        return [];
    } finally {
        showLoading(false);
    }
}

/**
 * UI HELPERS
 */
function showToast(msg) {
    const t = document.getElementById("toast");
    t.innerText = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
}

function showLoading(isLoading) {
    statusContainer.innerHTML = isLoading ? '<div class="loader">Sincronizando con satélites...</div>' : '';
}

function renderGallery(items) {
    gallery.innerHTML = "";
    if (items.length === 0) {
        gallery.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>No se encontraron imágenes en este sector.</p>";
        return;
    }
    items.filter(item => item.media_type === "image").forEach(createCard);
}

/**
 * COMPONENTES
 */
function createCard(data) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="card-img-container">
            <img src="${data.url}" alt="${data.title}" loading="lazy">
        </div>
        <div class="card-content">
            <small>${data.date}</small>
            <h3>${data.title}</h3>
        </div>
    `;
    card.onclick = () => openModal(data);
    gallery.appendChild(card);
}

function openModal(data) {
    const isFavorite = checkIfFavorite(data.date);
    document.getElementById("modalBody").innerHTML = `
        <small style="color:var(--primary)">${data.date}</small>
        <h2 style="margin:10px 0">${data.title}</h2>
        <img src="${data.hdurl || data.url}">
        <p style="line-height:1.6; color:#cbd5e1; margin-bottom:20px">${data.explanation}</p>
        
        <div style="display:flex; gap:10px">
            <button class="btn" style="background:${isFavorite ? '#ef4444':'#22c55e'}; color:white" 
                onclick='toggleFavorite(${JSON.stringify(data).replace(/'/g, "&apos;")})'>
                ${isFavorite ? '🗑️ Eliminar de Favoritos' : '❤️ Guardar en Favoritos'}
            </button>
            <a href="${data.hdurl || data.url}" target="_blank" class="btn" style="background:#334155; color:white; text-decoration:none">
                📥 Descargar HD
            </a>
        </div>
    `;
    document.getElementById("modal").classList.add("active");
}

function closeModal() {
    document.getElementById("modal").classList.remove("active");
}

/**
 * GESTIÓN DE FAVORITOS (LOCALSTORAGE)
 */
function getFavorites() {
    return JSON.parse(localStorage.getItem("nasa_favs")) || [];
}

function checkIfFavorite(date) {
    return getFavorites().some(f => f.date === date);
}

function toggleFavorite(data) {
    let favs = getFavorites();
    const index = favs.findIndex(f => f.date === data.date);

    if (index === -1) {
        favs.push(data);
        showToast("Guardado en favoritos 🚀");
    } else {
        favs.splice(index, 1);
        showToast("Eliminado de favoritos");
    }

    localStorage.setItem("nasa_favs", JSON.stringify(favs));
    closeModal();
    // Si estábamos viendo favoritos, refrescar la vista
    if (gallery.dataset.view === "favorites") showFavorites();
}

function showFavorites() {
    gallery.dataset.view = "favorites";
    const favs = getFavorites();
    renderGallery(favs);
}

/**
 * ACCIONES PRINCIPALES
 */
async function loadToday() {
    gallery.dataset.view = "all";
    const data = await apiCall();
    renderGallery(data);
}

async function loadRange() {
    const start = document.getElementById("start").value;
    const end = document.getElementById("end").value;
    
    if (!start || !end) return showToast("Faltan fechas");
    if (start > end) return showToast("Fecha inicio mayor a fin");

    gallery.dataset.view = "all";
    const data = await apiCall(`&start_date=${start}&end_date=${end}`);
    renderGallery(data.reverse());
}

// FUNCIÓN PARA VISUALIZAR ASTEROIDES
async function loadAsteroids() {
    gallery.dataset.view = "asteroids";
    showLoading(true);

    try {
        let start = document.getElementById("start").value;
        let end = document.getElementById("end").value;

        // Si no hay fechas, usar hoy
        if (!start || !end) {
            const today = new Date().toISOString().split("T")[0];
            start = today;
            end = today;
        }

        // Validar que no sea mayor a 7 días
        const timeDifference = new Date(end) - new Date(start);
        const dayDifference = timeDifference / (1000 * 60 * 60 * 24);

        if (dayDifference > 7) {
            showToast("Máximo 7 días para ver los asteroides ☄️");
            showLoading(false);
            return;
        }

        if (start > end) {
            showToast("Fecha inicio mayor a fin");
            showLoading(false);
            return;
        }

        const response = await fetch(
            `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${API_KEY}`
        );

        if (!response.ok) { 
            throw new Error("Error cargando asteroides");
        }

        const data = await response.json();

        // Aquí juntamos todos los días en un solo array
        let allAsteroids = [];

        Object.values(data.near_earth_objects).forEach(dayArray => {
            allAsteroids = allAsteroids.concat(dayArray);
        });

        renderAsteroids(allAsteroids);

    } catch (error) {
        showToast("Error cargando asteroides ☄️");
        console.error(error);
    } finally {
        showLoading(false);
    }
}

//Renderizar asteroides 
function renderAsteroids(asteroids) {
    gallery.innerHTML = "";

    if (!asteroids || asteroids.length === 0) {
        gallery.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>No hay asteroides cercanos en esta fecha.</p>";
        return;
    }

    asteroids.forEach(asteroid => {
        const card = document.createElement("div");
        card.className = "card";

        const diameter = asteroid.estimated_diameter.meters.estimated_diameter_max.toFixed(2);
        const distance = parseFloat(
            asteroid.close_approach_data[0].miss_distance.kilometers
        ).toLocaleString();

        card.innerHTML = `
            <div class="card-content">
            <small>☄️ Asteroide</small>
            <p>Fecha: ${asteroid.close_approach_data[0].close_approach_date}</p>
            <h3>${asteroid.name}</h3>
            <p>Diámetro aprox: ${diameter} m</p>
            <p>Distancia a la Tierra: ${distance} km</p>
            <p style="color:${asteroid.is_potentially_hazardous_asteroid ? 'red':'#22c55e'}">
                    ${asteroid.is_potentially_hazardous_asteroid ? '⚠️ Potencialmente peligroso' : 'Seguro'}
                </p>
            </div>
        `;

        gallery.appendChild(card);
    });
}

// Carga inicial
loadToday();
