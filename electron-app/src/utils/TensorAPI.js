const { getSettings } = require("../utils/fsHelper");
const { TENSOR_ENDPOINTS } = require("./constants");

class TensorAPI {
    static instance = null;

    constructor(apiKey) {
        if (!apiKey) {
            throw new Error("Ошибка: API-ключ TensorAPI отсутствует в настройках!");
        }
        this.apiKey = apiKey;
        this.reset(); // Инициализируем параметры
    }

    // === Singleton: получаем один объект на все приложение ===
    static getInstance() {
        if (!TensorAPI.instance) {
            const { tensor_api_token: apiKey } = getSettings();
            TensorAPI.instance = new TensorAPI(apiKey);
        }
        return TensorAPI.instance;
    }

    // === Сброс параметров запроса ===
    reset() {
        this.endpoint = null;
        this.params = {};
    }

    // === Поиск ID коллекции по slug ===
    fetchCollectionId(slug) {
        this.reset(); // Очищаем перед новым запросом
        this.endpoint = TENSOR_ENDPOINTS.SEARCH_COLLECTION;
        this.params.query = slug;
        return this;
    }

    // === Получение списка NFT по коллекции ===
    fetchCollectionNfts(collId, limit = 1, onlyListings = false) {
        this.reset();
        this.endpoint = TENSOR_ENDPOINTS.NFTS_BY_COLLECTION;
        this.params = {
            collId,
            sortBy: "ListingPriceAsc",
            limit: String(limit), // Приведение к строке
            onlyListings: String(onlyListings),
        };
        return this;
    }

    // === Выполнение запроса ===
    async send() {
        if (!this.endpoint) {
            throw new Error("Endpoint не установлен! Вызови fetchCollectionId() или fetchCollectionNfts() перед send().");
        }

        const url = new URL(this.endpoint);
        Object.entries(this.params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const options = {
            method: "GET",
            headers: {
                accept: "application/json",
                "x-tensor-api-key": this.apiKey,
            },
        };

        try {
            const response = await fetch(url.toString(), options);
            if (!response.ok) {
                throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(error.message);
            return null;
        } finally {
            this.reset(); // Авто-сброс после запроса
        }
    }
}

module.exports = TensorAPI;
