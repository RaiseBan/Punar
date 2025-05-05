import { getSettings } from "./fsHelper";
import { TENSOR_ENDPOINTS } from "./constants";
import { sleep } from "./solanaUtils";

// Интерфейсы для параметров
interface CollectionNftsParams {
    collId: string;
    limit?: number;
    onlyListings?: boolean;
}

interface TxHistoryParams {
    collId: string;
    limit?: number;
    txTypes?: string[];
    minPrice?: number;
    maxPrice?: number;
    traits?: string[];
    wallet?: string;
    cursor?: string;
}

class TensorAPI {
    private static instance: TensorAPI | null = null;
    private apiKey: string;
    private endpoint: string | null;
    private params: Record<string, any>;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Ошибка: API-ключ TensorAPI отсутствует в настройках!");
        }
        this.apiKey = apiKey;
        this.endpoint = null;
        this.params = {};
    }

    // === Singleton: получаем один объект на все приложение ===
    static getInstance(): TensorAPI {
        if (!TensorAPI.instance) {
            const settings = getSettings();
            const apiKey = settings.tensor_api_token as string;
            TensorAPI.instance = new TensorAPI(apiKey);
        }
        return TensorAPI.instance;
    }

    // === Сброс параметров запроса ===
    reset(): void {
        this.endpoint = null;
        this.params = {};
    }

    // === Поиск ID коллекции по slug ===
    fetchCollections(slug: string): TensorAPI {
        this.reset(); // Очищаем перед новым запросом
        this.endpoint = TENSOR_ENDPOINTS.SEARCH_COLLECTION;
        this.params.query = slug;
        return this;
    }

    // === Получение списка NFT по коллекции ===
    fetchCollectionNfts(collId: string, limit: number = 1, onlyListings: boolean = false): TensorAPI {
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

    fetchTxHistory({
                       collId,
                       limit = 1,
                       txTypes,
                       minPrice,
                       maxPrice,
                       traits,
                       wallet,
                       cursor
                   }: TxHistoryParams): TensorAPI {
        this.reset();
        this.endpoint = TENSOR_ENDPOINTS.TX_HISTORY;

        // Формируем объект параметров
        this.params = {
            collId,
            limit,
            // Особые случаи:
            ...(txTypes?.length && {txTypes}), // Добавляем только если массив не пустой
            ...(minPrice !== undefined && {minPrice}),
            ...(maxPrice !== undefined && {maxPrice}),
            ...(traits && {traits: JSON.stringify(traits)}),
            ...(wallet && {wallet}),
            ...(cursor && {cursor})
        };
        console.log(JSON.stringify(this.params, null, 2));

        return this;
    }

    // Метод send() (обновленная обработка параметров)
    async send(): Promise<any | null> {
        if (!this.endpoint) {
            throw new Error("Endpoint не установлен! Вызови fetchCollectionId() или fetchCollectionNfts() перед send().");
        }

        const url = new URL(this.endpoint);

        // Обрабатываем параметры с поддержкой массивов
        Object.entries(this.params).forEach(([key, value]) => {
            if (value === undefined) return;

            if (Array.isArray(value)) {
                // Добавляем каждый элемент массива отдельно
                value.forEach(item => url.searchParams.append(key, item));
            } else {
                url.searchParams.append(key, value);
            }
        });

        const options: RequestInit = {
            method: "GET",
            headers: {
                accept: "application/json",
                "x-tensor-api-key": this.apiKey,
            },
        };

        let attempt = 0;
        const maxAttempts = 5;
        while (attempt < maxAttempts) {
            try {
                await sleep(200);
                const response = await fetch(url.toString(), options);
                if (!response.ok) {
                    throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
                } else {
                    this.reset();
                    return await response.json();
                }
            } catch (error) {
                console.error((error as Error).message);
                if ((error as Error).message.includes("429 Too Many Requests")){
                    console.log(`sleep...`);
                    await sleep(1000);
                } else {
                    this.reset();
                    return null;
                }
            }
            attempt++;
        }

        // Если все попытки исчерпаны, возвращаем null
        return null;
    }
}

export default TensorAPI;