import { getSettings } from "./fsHelper";
import { TENSOR_ENDPOINTS } from "./constants";
import { sleep } from "./solanaUtils";

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
    private params: Record<string, unknown>;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Ошибка: API-ключ TensorAPI отсутствует в настройках!");
        }
        this.apiKey = apiKey;
        this.endpoint = null;
        this.params = {};
    }

    static getInstance(): TensorAPI {
        if (!TensorAPI.instance) {
            const settings = getSettings();
            const apiKey = settings.tensor_api_token as string;
            TensorAPI.instance = new TensorAPI(apiKey);
        }
        return TensorAPI.instance;
    }

    reset(): void {
        this.endpoint = null;
        this.params = {};
    }

    fetchCollections(slug: string): TensorAPI {
        this.reset();
        this.endpoint = TENSOR_ENDPOINTS.SEARCH_COLLECTION;
        this.params.query = slug;
        return this;
    }

    fetchCollectionNfts(collId: string, limit: number = 1, onlyListings: boolean = false): TensorAPI {
        this.reset();
        this.endpoint = TENSOR_ENDPOINTS.NFTS_BY_COLLECTION;
        this.params = {
            collId,
            sortBy: "ListingPriceAsc",
            limit: String(limit),
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

        this.params = {
            collId,
            limit,
            ...(txTypes?.length && {txTypes}),
            ...(minPrice !== undefined && {minPrice}),
            ...(maxPrice !== undefined && {maxPrice}),
            ...(traits && {traits: JSON.stringify(traits)}),
            ...(wallet && {wallet}),
            ...(cursor && {cursor})
        };
        console.log(JSON.stringify(this.params, null, 2));

        return this;
    }

    async send(): Promise<unknown> {
        if (!this.endpoint) {
            throw new Error("Endpoint не установлен! Вызови fetchCollectionId() или fetchCollectionNfts() перед send().");
        }

        const url = new URL(this.endpoint);

        Object.entries(this.params).forEach(([key, value]) => {
            if (value === undefined) return;

            if (Array.isArray(value)) {
                value.forEach(item => url.searchParams.append(key, item as string));
            } else {
                url.searchParams.append(key, value as string);
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

        return null;
    }
}

export default TensorAPI;