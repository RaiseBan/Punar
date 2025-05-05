import {
    getAccount,
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddress
} from "@solana/spl-token";
import { retrieveDASAssetFields } from "./heliusDasApi";
import {
    Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram,
    SendTransactionError, SystemProgram, AddressLookupTableProgram
} from "@solana/web3.js";
import * as bs58 from "bs58";
import { saveLookupTables, getLookupTables } from "./fsHelper";
import { sendJitoTransaction } from "../services/jito_api";

// Интерфейсы и типы
interface DASAssetGroup {
    group_value: string;
    [key: string]: any;
}

interface DASAssetResult {
    id: string;
    grouping?: DASAssetGroup[];
    [key: string]: any;
}

interface TokenAccount {
    address: string;
    mint: string;
    amount: string;
}

interface SortedPair {
    pair: string;
    value: number;
}

interface VolumeFilter {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
}

interface PriceChangeFilter {
    h1?: number;
    h6?: number;
    h24?: number;
}

interface LiquidityFilter {
    usd?: number;
    base?: number;
    quote?: number;
}

interface DexScreenerFilter {
    volume?: VolumeFilter;
    priceChange?: PriceChangeFilter;
    liquidity?: LiquidityFilter;
}

interface SortConfig {
    parameter: 'volume' | 'priceChange' | 'liquidity';
    timeFrame?: 'h24' | 'h6' | 'h1' | 'm5';
    liquidityType?: 'usd' | 'base' | 'quote';
    order: 'asc' | 'desc';
}

interface SimulationResult {
    simulation: boolean;
    result: any;
}

/**
 * Получает адрес коллекции по миту NFT
 */
export async function getCollectionAddress(mint: string): Promise<string | undefined> {
    const asset = await retrieveDASAssetFields(mint);
    let groups = asset.grouping;
    if (!groups) {
        console.error(`no collection address found!`);
        return undefined;
    }

    let collectionAddress: string | undefined;
    for (const group of groups) {
        let collectionId = group.group_value;
        if (!collectionId) {
            continue;
        }
        collectionAddress = collectionId;
    }

    if (!collectionAddress) {
        console.error("No collection address found!");
        return undefined;
    }
    return collectionAddress;
}

/**
 * Создает таблицу поиска адресов
 * @returns адрес таблицы поиска в кодировке base58
 */
export async function createLookupTable(rpcUrl: string, privateKey: string): Promise<string | undefined> {
    const USER = Keypair.fromSecretKey(new Uint8Array(bs58.default.decode(privateKey)));
    // connect to a cluster and get the current `slot`
    const connection = new Connection(rpcUrl);
    const slot = await connection.getSlot();
    // Assumption:
    // `payer` is a valid `Keypair` with enough SOL to pay for the execution

    const [lookupTableInst, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
            authority: USER.publicKey,
            payer: USER.publicKey,
            recentSlot: slot,
        });

    const sig = await sendTx(connection, [lookupTableInst], USER);
    if (!sig) {
        console.error(`Transaction on create ALT failed`);
        return undefined;
    }
    console.log("🚀Lookup table created", sig, `\nTable address: ${lookupTableAddress.toBase58()}`);

    const tables = await getLookupTables();
    console.log(`Current tables:`, tables);

    // Преобразуем tables в массив, если это строка
    const tablesArray = Array.isArray(tables) ? tables : (tables ? [tables] : []);

    // Добавляем новый адрес в массив
    const newTables = [...tablesArray, lookupTableAddress.toBase58()];
    console.log(`New tables array:`, newTables);

    if (await saveLookupTables(newTables) === false) {
        console.error(`Failed to save lookup tables`);
        return undefined;
    }
    return lookupTableAddress.toBase58();
}

/**
 * Adds accounts to a lookup table with size checking
 * @param accounts - Array of account addresses to add
 * @param rpcUrl - RPC URL for Solana connection
 * @param privateKey - Private key in base58 format
 * @param lookupTableAddress - Address of the lookup table
 * @returns - The address of the lookup table used
 */
export async function appendLookupTable(
    accounts: string[],
    rpcUrl: string,
    privateKey: string,
    lookupTableAddress: string
): Promise<string | undefined> {
    console.log(`appendLookupTable params: ${accounts}, ${rpcUrl}, ${privateKey}, ${lookupTableAddress}`);
    // Check if the accounts can fit in the specified table
    const MAX_ACCOUNTS_PER_TABLE = 256;
    const connection = new Connection(rpcUrl);
    const USER = Keypair.fromSecretKey(new Uint8Array(bs58.default.decode(privateKey)));

    // Функция для получения данных таблицы с повторными попытками
    async function getLookupTableWithRetries(): Promise<any> {
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 5000; // 5 секунд

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const lookupTableAccount = (
                    await connection.getAddressLookupTable(new PublicKey(lookupTableAddress))
                ).value;

                if (lookupTableAccount) {
                    return lookupTableAccount;
                }

                console.log(`Attempt ${attempt}/${MAX_RETRIES}: Lookup table not found yet, waiting ${RETRY_DELAY / 1000} seconds...`);
                await sleep(RETRY_DELAY);
            } catch (error) {
                console.error(`Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
                if (attempt === MAX_RETRIES) {
                    throw error;
                }
                await sleep(RETRY_DELAY);
            }
        }

        throw new Error(`Failed to get lookup table after ${MAX_RETRIES} attempts`);
    }

    let lookupTableAccount: any;
    try {
        lookupTableAccount = await getLookupTableWithRetries();
    } catch (error) {
        console.error("Failed to get lookup table account:", error);
        return undefined;
    }

    if (lookupTableAccount.state.authority.toBase58() !== USER.publicKey.toBase58()) {
        console.error("Lookup table authority does not match");
        return undefined;
    }

    const currentAddressCount = lookupTableAccount.state.addresses.length;
    console.log(`currentAddressCount: ${currentAddressCount}`);

    // Check if adding these accounts would exceed the limit
    if (currentAddressCount + accounts.length > MAX_ACCOUNTS_PER_TABLE) {
        console.log(`Adding these accounts would exceed the maximum capacity of ${MAX_ACCOUNTS_PER_TABLE} addresses.`);

        // Try to find another table with enough space
        const tables = await getLookupTables();
        if (tables) {
            for (const tableAddr of tables) {
                if (tableAddr === lookupTableAddress) continue;

                const otherTableAccount = (
                    await connection.getAddressLookupTable(new PublicKey(tableAddr))
                ).value;

                if (otherTableAccount && otherTableAccount.state.addresses.length + accounts.length <= MAX_ACCOUNTS_PER_TABLE) {
                    console.log(`Found another table with enough space: ${tableAddr}`);
                    return appendLookupTable(accounts, rpcUrl, privateKey, tableAddr);
                }
            }
        }

        // If no table has enough space, create a new one
        console.log("No existing table has enough space. Creating a new one...");
        const newTableAddr = await createLookupTable(rpcUrl, privateKey);
        if (!newTableAddr) {
            console.error("Failed to create a new lookup table");
            return undefined;
        }

        return appendLookupTable(accounts, rpcUrl, privateKey, newTableAddr);
    }

    // If we reach here, there's enough space in the specified table
    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: USER.publicKey,
        authority: USER.publicKey,
        lookupTable: new PublicKey(lookupTableAddress),
        addresses: accounts.map(account => new PublicKey(account)),
    });

    const sig = await sendTx(connection, [extendInstruction], USER);

    if (!sig) {
        console.error(`Transaction on append ALT failed`);
        return undefined;
    }
    console.log(`🚀Append ALT transaction success! signature: ${sig}`);
    return lookupTableAddress;
}

// Функция для преобразования объекта с BigInt в обычный объект
export function convertBigIntToString(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => convertBigIntToString(item));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'bigint') {
            result[key] = value.toString();
        } else if (typeof value === 'object' && value !== null) {
            result[key] = convertBigIntToString(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

// return array of addresses, type string
export async function getAllAddressesFromLookupTable(rpcUrl: string, lookupTableAddress: string): Promise<string[]> {
    const connection = new Connection(rpcUrl);
    console.log(`getAllAddressesFromLookupTable params: ${rpcUrl}, ${lookupTableAddress}`);

    const lookupTableAccount = await connection.getAddressLookupTable(new PublicKey(lookupTableAddress));

    // console.log(`lookupTableAccount: ${JSON.stringify(convertBigIntToString(lookupTableAccount), null, 2)}`);

    if (!lookupTableAccount?.value) {
        console.error("Lookup table not found");
        return [];
    }

    return lookupTableAccount.value.state.addresses.map(address => address.toBase58());
}

/**
 * Checks if accounts exist in lookup tables and updates as needed
 * @param rpcUrl - RPC URL for Solana connection
 * @param accounts - Array of account addresses to check
 * @param private_key - Private key in base58 format
 * @returns - The addresses of the lookup table used
 */
export async function updateIfNotExistsAndGet(
    rpcUrl: string,
    accounts: string[],
    private_key: string
): Promise<string[] | undefined> {
    console.log(`start updateIfNotExistsAndGet`);
    const tables = await getLookupTables();
    console.log(`tables: ${tables}`);

    if (!tables || tables.length === 0) {
        console.log(`No tables found. Creating...`);
        const tableAddress = await createLookupTable(rpcUrl, private_key);
        if (!tableAddress) {
            console.error("Failed to create initial lookup table");
            return undefined;
        }

        // After creating the table, append the accounts
        const result = await appendLookupTable(accounts, rpcUrl, private_key, tableAddress);
        if (!result) {
            console.error("Failed to append accounts to initial table");
            return undefined;
        }
        return [result];
    } else {
        console.log(`Checking if accounts already exist...`);
        let accountsToAppend = [...accounts]; // Create a copy of accounts array
        let existingTableAddresses = new Map<string, string>(); // Map to track which accounts exist in which tables

        // Check all tables for existing accounts
        for (const table of tables) {
            const tableAddresses = await getAllAddressesFromLookupTable(rpcUrl, table);
            // console.log(`Table ${table} addresses:`, tableAddresses);

            // Update accountsToAppend to only include accounts not found in any table
            accountsToAppend = accountsToAppend.filter(account => {
                const exists = tableAddresses.includes(account);
                if (exists) {
                    // Track which table contains this account
                    if (!existingTableAddresses.has(account)) {
                        existingTableAddresses.set(account, table);
                    }
                }
                return !exists;
            });
        }

        // If there are accounts to append
        if (accountsToAppend.length > 0) {
            console.log(`Found ${accountsToAppend.length} accounts to append`);

            // Try to use an existing table that has space
            for (const table of tables) {
                const tableAddresses = await getAllAddressesFromLookupTable(rpcUrl, table);
                const currentCount = tableAddresses.length;
                console.log(`Table ${table} current count: ${currentCount}`);

                if (currentCount + accountsToAppend.length <= 256) {
                    console.log(`Table ${table} has enough space`);
                    const res = await appendLookupTable(accountsToAppend, rpcUrl, private_key, table);
                    if (!res) {
                        console.error(`Failed to append accounts to table ${table}`);
                        continue;
                    }
                    // Добавляем новую таблицу к существующим
                    const allUsedTables = new Set([...existingTableAddresses.values(), res]);
                    return [...allUsedTables];
                }
            }

            // If no existing table has enough space, create a new one
            console.log("No existing table has enough space. Creating a new one...");
            const newTableAddr = await createLookupTable(rpcUrl, private_key);
            if (!newTableAddr) {
                console.error("Failed to create a new lookup table");
                return undefined;
            }

            const res = await appendLookupTable(accountsToAppend, rpcUrl, private_key, newTableAddr);
            if (!res) {
                console.error(`Failed to append accounts to new ALT`);
                return undefined;
            }
            // Добавляем новую таблицу к существующим
            const allUsedTables = new Set([...existingTableAddresses.values(), res]);
            return [...allUsedTables];
        } else {
            console.log(`All accounts already exist in tables`);

            // Check if all accounts are in the same table
            const usedTables = new Set([...existingTableAddresses.values()]);
            if (usedTables.size === 1) {
                // All accounts are in the same table
                return [...usedTables];
            } else {
                console.log(`Accounts are spread across multiple tables: ${[...usedTables].join(', ')}`);
                return [...usedTables];
            }
        }
    }
}

export async function sendTx(
    connection: Connection,
    ixs: any[],
    signer: Keypair,
    simulate: boolean = false
): Promise<string | SimulationResult | undefined> {
    const transaction = new Transaction();
    transaction.add(...ixs);
    transaction.feePayer = signer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(signer);

    for (let i = 0; i < 5; i++) {
        try {
            if (simulate) {
                // Режим симуляции
                console.log(`Simulating transaction...`);
                const result = await connection.simulateTransaction(transaction);

                if (result.value.err) {
                    throw new Error(`Simulation error: ${result.value.err}`);
                }

                console.log(`Simulation successful!`);
                console.log(`Logs: ${result.value.logs}`);
                console.log(`Units consumed: ${result.value.unitsConsumed}`);

                return {
                    simulation: true,
                    result: result.value
                };
            } else {
                // Обычный режим отправки
                let sig = await connection.sendRawTransaction(transaction.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: "confirmed",
                    maxRetries: 5
                });
                console.log(`Waiting for transaction confirmation...`);
                await Promise.race([
                    connection.confirmTransaction(sig, "confirmed"),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Confirmation timeout")), 10000)
                    ),
                ]);
                return sig;
            }
        } catch (e: any) {
            console.error(`Attempt_${i}: error while ${simulate ? 'simulating' : 'sending'} transaction: ${e}}`);
            if (e instanceof SendTransactionError) {
                console.log(`logs: ${await e.getLogs(connection)}`);
            }
        }
    }
    throw new Error("Failed to send transaction after 5 attempts");
}

/**
 * Фильтрует пары по владельцу и дополнительным параметрам из DexScreener
 * @param rpcUrl - URL RPC ноды Solana
 * @param pairs - Массив адресов пар для фильтрации
 * @param filter - Адрес владельца для фильтрации
 * @param dexScreenerFilter - Дополнительные фильтры из DexScreener
 * @returns - Массив отфильтрованных адресов пар
 */
export async function getFilteredPairs(
    rpcUrl: string,
    pairs: string[],
    filter: string,
    dexScreenerFilter: DexScreenerFilter = {}
): Promise<string[]> {
    let filteredPairs: string[] = [];
    const connection = new Connection(rpcUrl);

    // Фильтрация по владельцу
    for (const pair of pairs) {
        const res = await connection.getAccountInfo(new PublicKey(pair));
        if (!res) continue;

        const owner = res.owner;
        if (owner.toString() === filter) {
            filteredPairs.push(pair);
        }
    }

    // Если нет дополнительных фильтров, возвращаем результат
    if (!dexScreenerFilter || Object.keys(dexScreenerFilter).length === 0) {
        return filteredPairs;
    }

    // Фильтрация по DexScreener параметрам
    const finalFilteredPairs: string[] = [];
    for (const pair of filteredPairs) {
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`);
            const data = await response.json();

            if (!data.pair) continue;

            const pairData = data.pair;
            let matchesFilters = true;

            // Проверка фильтров по объему
            if (dexScreenerFilter.volume) {
                const volumeFilters = dexScreenerFilter.volume;
                if (volumeFilters.h24 && pairData.volume.h24 < volumeFilters.h24) matchesFilters = false;
                if (volumeFilters.h6 && pairData.volume.h6 < volumeFilters.h6) matchesFilters = false;
                if (volumeFilters.h1 && pairData.volume.h1 < volumeFilters.h1) matchesFilters = false;
                if (volumeFilters.m5 && pairData.volume.m5 < volumeFilters.m5) matchesFilters = false;
            }

            // Проверка фильтров по изменению цены
            if (dexScreenerFilter.priceChange) {
                const priceChangeFilters = dexScreenerFilter.priceChange;
                if (priceChangeFilters.h1 && pairData.priceChange.h1 < priceChangeFilters.h1) matchesFilters = false;
                if (priceChangeFilters.h6 && pairData.priceChange.h6 < priceChangeFilters.h6) matchesFilters = false;
                if (priceChangeFilters.h24 && pairData.priceChange.h24 < priceChangeFilters.h24) matchesFilters = false;
            }

            // Проверка фильтров по ликвидности
            if (dexScreenerFilter.liquidity) {
                const liquidityFilters = dexScreenerFilter.liquidity;
                if (liquidityFilters.usd && pairData.liquidity.usd < liquidityFilters.usd) matchesFilters = false;
                if (liquidityFilters.base && pairData.liquidity.base < liquidityFilters.base) matchesFilters = false;
                if (liquidityFilters.quote && pairData.liquidity.quote < liquidityFilters.quote) matchesFilters = false;
            }

            if (matchesFilters) {
                finalFilteredPairs.push(pair);
            }
        } catch (error) {
            console.error(`Error fetching data for pair ${pair}:`, error);
            continue;
        }
    }

    return finalFilteredPairs;
}

/**
 * Сортирует массив пар по указанному параметру
 * @param rpcUrl - URL RPC ноды Solana
 * @param pairs - Массив адресов пар для сортировки
 * @param sortConfig - Конфигурация сортировки
 * @returns - Отсортированный массив пар с их значениями
 */
export async function sortPairsByParameter(
    rpcUrl: string,
    pairs: string[],
    sortConfig: SortConfig
): Promise<SortedPair[]> {
    const pairsWithValues: SortedPair[] = [];

    for (const pair of pairs) {
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`);
            const data = await response.json();

            if (!data.pair) continue;

            const pairData = data.pair;
            let value: number | undefined;

            switch (sortConfig.parameter) {
                case 'volume':
                    value = pairData.volume[sortConfig.timeFrame || 'h24'];
                    break;
                case 'priceChange':
                    value = pairData.priceChange[sortConfig.timeFrame || 'h24'];
                    break;
                case 'liquidity':
                    value = pairData.liquidity[sortConfig.liquidityType || 'usd'];
                    break;
                default:
                    throw new Error(`Неизвестный параметр сортировки: ${sortConfig.parameter}`);
            }

            pairsWithValues.push({
                pair,
                value: value || 0
            });
        } catch (error) {
            console.error(`Ошибка при получении данных для пары ${pair}:`, error);
            continue;
        }
    }

    // Сортировка массива
    pairsWithValues.sort((a, b) => {
        if (sortConfig.order === 'desc') {
            return b.value - a.value;
        } else {
            return a.value - b.value;
        }
    });

    return pairsWithValues;
}

export async function getDetailedTokenAccounts(
    ownerPubkey: string,
    rpcUrl: string,
    maxRetries: number = 3
): Promise<TokenAccount[]> {
    const connection = new Connection(rpcUrl, "confirmed");
    const tokenProgramId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    // Функция для повторного запроса с задержкой при ошибке 429
    const fetchWithRetry = async <T>(fn: () => Promise<T>, retriesLeft: number = maxRetries): Promise<T> => {
        try {
            return await fn();
        } catch (error: any) {
            if (error.message.includes('429') && retriesLeft > 0) {
                console.log(`Rate limited (429). Retrying in 2 seconds... (${retriesLeft} retries left)`);
                await sleep(2000); // Ждём 2 секунды
                return fetchWithRetry(fn, retriesLeft - 1);
            }
            throw error; // Если не 429 или кончились попытки — прокидываем ошибку дальше
        }
    };

    // Получаем токен-аккаунты с обработкой 429
    const response = await fetchWithRetry(() =>
        connection.getTokenAccountsByOwner(new PublicKey(ownerPubkey), {
                programId: tokenProgramId,
            }
        ));

    // Обрабатываем каждый аккаунт с ретраями
    const detailedAccounts = await Promise.all(
        response.value.map(async ({pubkey}) => {
            await sleep(100);
            const accountInfo = await getAccount(connection, pubkey);

            return {
                address: pubkey.toBase58(),
                mint: accountInfo.mint.toBase58(),
                amount: accountInfo.amount.toString(),
            };
        })
    );

    console.log(JSON.stringify(detailedAccounts, null, 2));
    return detailedAccounts;
}

export async function hasTokenAccount(
    rpc: string,
    publicKey: string,
    mintAddress: string,
    tokens: Set<string>
): Promise<boolean | undefined> {
    if (!rpc) {
        console.log(`RPC not specified. set it in settings!`);
        return undefined;
    }

    if (tokens.has(mintAddress.trim())) {
        return true;
    }

    const tokenObjectsByUser = await getDetailedTokenAccounts(publicKey, rpc);
    for (const token of tokenObjectsByUser) {
        if (token.mint === mintAddress) {
            return true;
        }
    }
    return false;
}

export async function createTokenAccount(
    rpc: string,
    mint: string,
    USER: Keypair,
    tokens: Map<string, string>
): Promise<string | undefined> {
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 30_000,
    });

    // const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    //     microLamports: 30_000,
    // });
    const tipIx = getTipIx(2000, "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL", USER);

    const ata = await getAssociatedTokenAddress(new PublicKey(mint), USER.publicKey);
    const idempotentInstruction = createAssociatedTokenAccountIdempotentInstruction(
        USER.publicKey,
        ata,
        USER.publicKey,
        new PublicKey(mint)
    );

    const connection = new Connection(rpc);
    const transaction = new Transaction();
    transaction.add(idempotentInstruction, modifyComputeUnits, tipIx);
    transaction.feePayer = USER.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(USER);
    // for (const region of JITO_REGIONS)
    console.log(`before buffer`);
    const bs64Tx: string = Buffer.from(transaction.serialize()).toString("base64");
    console.log(`after buffer`);
    for (let i = 0; i < 3; i++) {
        try {
            console.log(`JITO Attempt: ${i}`);
            await sendJitoTransaction(bs64Tx);
            await sleep(500);
        } catch(err: any) {
            console.log(`CAUSED ERROR: ${err.message}`);
            if (tokens.has(mint)) {
                console.log(`token exist ! RETURN`);
                return undefined;
            }
        }
    }

    // await sendTx(connection, [idempotentInstruction, priorityFee, modifyComputeUnits], USER);

    return ata.toBase58();
}

export function getTipIx(tipAmount: number, tipAccount: string, sender: Keypair): any {
    return SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: new PublicKey(tipAccount),
        lamports: tipAmount,
    });
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// (async () => {
//     const res = await getDetailedTokenAccounts("DkU5wMFvq2jMTYgQ4yMFFWJtT9J177BPVSKYY8BAHJxo", "https://mainnet.helius-rpc.com/?api-key=f20cc51e-8516-4603-b26d-d27d7b49d49f");
//
// })()