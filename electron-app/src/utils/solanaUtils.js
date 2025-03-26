const {retrieveDASAssetFields} = require("./heliusDasApi");
const {Connection, clusterApiUrl, AddressLookupTableProgram, Keypair, PublicKey, Transaction, ComputeBudgetProgram,
    SendTransactionError
} = require("@solana/web3.js");
const bs58 = require("bs58");
const {saveLookupTables, getLookupTables} = require("./fsHelper");
const {RAYDIUM_OWNER} = require("./constants");


async function getCollectionAddress(mint){
    const asset = await retrieveDASAssetFields(mint);
    let groups = asset.grouping;
    if (!groups) {
        console.error(`no collection address found!`)
        return;
    }
    let collectionAddress;
    for (const group of groups) {
        let collectionId = group.group_value
        if (!collectionId) {
            continue
        }
        collectionAddress = collectionId;
    }

    if (!collectionAddress) {
        console.error("No collection address found!")
        return;
    }
    return collectionAddress;
}

// returns lookup table address in base58 encoding
async function createLookupTable(rpcUrl, privateKey) {
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
    if (!sig){
        console.error(`Transaction on create ALT failed`);
        return;
    }
    console.log("🚀Lookup table created", sig, `\nTable address: ${lookupTableAddress.toBase58()}`);

    const tables = await getLookupTables();
    console.log(`Current tables:`, tables);
    
    // Преобразуем tables в массив, если это строка
    const tablesArray = Array.isArray(tables) ? tables : (tables ? [tables] : []);
    
    // Добавляем новый адрес в массив
    const newTables = [...tablesArray, lookupTableAddress.toBase58()];
    console.log(`New tables array:`, newTables);
    
    if (await saveLookupTables(newTables) === false){
        console.error(`Failed to save lookup tables`);
        return;
    }
    return lookupTableAddress.toBase58();
}

/**
 * Adds accounts to a lookup table with size checking
 * @param {string[]} accounts - Array of account addresses to add
 * @param {string} rpcUrl - RPC URL for Solana connection
 * @param {string} privateKey - Private key in base58 format
 * @param {string} lookupTableAddress - Address of the lookup table
 * @returns {Promise<string>} - The address of the lookup table used
 */
async function appendLookupTable(accounts, rpcUrl, privateKey, lookupTableAddress){
    console.log(`appendLookupTable params: ${accounts}, ${rpcUrl}, ${privateKey}, ${lookupTableAddress}`);
    // Check if the accounts can fit in the specified table
    const MAX_ACCOUNTS_PER_TABLE = 256;
    const connection = new Connection(rpcUrl);
    const USER = Keypair.fromSecretKey(new Uint8Array(bs58.default.decode(privateKey)));

    // Функция для получения данных таблицы с повторными попытками
    async function getLookupTableWithRetries() {
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

                console.log(`Attempt ${attempt}/${MAX_RETRIES}: Lookup table not found yet, waiting ${RETRY_DELAY/1000} seconds...`);
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

    let lookupTableAccount;
    try {
        lookupTableAccount = await getLookupTableWithRetries();
    } catch (error) {
        console.error("Failed to get lookup table account:", error);
        return;
    }

    if (lookupTableAccount.state.authority.toBase58() !== USER.publicKey.toBase58()){
        console.error("Lookup table authority does not match");
        return;
    }

    const currentAddressCount = lookupTableAccount.state.addresses.length;
    console.log(`currentAddressCount: ${currentAddressCount}`);

    // Check if adding these accounts would exceed the limit
    if (currentAddressCount + accounts.length > MAX_ACCOUNTS_PER_TABLE) {
        console.log(`Adding these accounts would exceed the maximum capacity of ${MAX_ACCOUNTS_PER_TABLE} addresses.`);

        // Try to find another table with enough space
        const tables = await getLookupTables();
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

        // If no table has enough space, create a new one
        console.log("No existing table has enough space. Creating a new one...");
        const newTableAddr = await createLookupTable(rpcUrl, privateKey);
        if (!newTableAddr) {
            console.error("Failed to create a new lookup table");
            return;
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

    if (!sig){
        console.error(`Transaction on append ALT failed`);
        return;
    }
    console.log(`🚀Append ALT transaction success! signature: ${sig}`)
    return lookupTableAddress;
}

// Функция для преобразования объекта с BigInt в обычный объект
function convertBigIntToString(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(item => convertBigIntToString(item));
    }
    
    const result = {};
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
async function getAllAddressesFromLookupTable(rpcUrl, lookupTableAddress){
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
 * @param {string} rpcUrl - RPC URL for Solana connection
 * @param {string[]} accounts - Array of account addresses to check
 * @param {string} private_key - Private key in base58 format
 * @returns {Promise<string[] | undefined>} - The addresses of the lookup table used
 */
async function updateIfNotExistsAndGet(rpcUrl, accounts, private_key){
    console.log(`start updateIfNotExistsAndGet`)
    const tables = await getLookupTables();
    console.log(`tables: ${tables}`);
    
    if (!tables || tables.length === 0){
        console.log(`No tables found. Creating...`);
        const tableAddress = await createLookupTable(rpcUrl, private_key);
        if (!tableAddress){
            console.error("Failed to create initial lookup table");
            return;
        }

        // After creating the table, append the accounts
        const result = await appendLookupTable(accounts, rpcUrl, private_key, tableAddress);
        if (!result) {
            console.error("Failed to append accounts to initial table");
            return;
        }
        return [result];
    } else {
        console.log(`Checking if accounts already exist...`);
        let accountsToAppend = [...accounts]; // Create a copy of accounts array
        let existingTableAddresses = new Map(); // Map to track which accounts exist in which tables

        // Check all tables for existing accounts
        for (const table of tables){
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
                return;
            }

            const res = await appendLookupTable(accountsToAppend, rpcUrl, private_key, newTableAddr);
            if (!res) {
                console.error(`Failed to append accounts to new ALT`);
                return;
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

async function sendTx(connection, ixs, signer){
    const transaction = new Transaction();
    transaction.add(...ixs);
    transaction.feePayer = signer.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(signer);
    for (let i = 0; i < 5; i++){
        try {
            let sig = await connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: "confirmed",
                maxRetries: 5
            });
            console.log(`Waiting for transaction confirmation...`)
            await Promise.race([
                connection.confirmTransaction(sig, "confirmed"),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Confirmation timeout")), 10000)
                ),
            ]);
            return sig;
        }catch (e){
            console.error(`Attempt_${i}: error while sending transaction: ${e}}`);
            if (e instanceof SendTransactionError){
                console.log(`logs: ${await e.getLogs(connection)}`);
            }
        }
    }
}

async function getRaydiumPair(rpcUrl, pairs){
    const connection = new Connection(rpcUrl);
    for (const pair of pairs){
        const res = await connection.getAccountInfo(new PublicKey(pair));
        // console.log(JSON.stringify(res, null, 2));
        const owner = res.owner;
        console.log(owner);
        if (owner.toString() === RAYDIUM_OWNER){
            return owner.toString();
        }
    }
}

// async function getPumpPair(rpcUrl, pairs){
//     const connection = new Connection(rpcUrl);
//     for (const pair of pairs){
//         const res = await connection.getAccountInfo(new PublicKey(pair));
//         // console.log(JSON.stringify(res, null, 2));
//         const owner = res.owner;
//         console.log(owner);
//         if (owner.toString() === RAYDIUM_OWNER){
//             return owner.toString();
//         }
//     }
// }



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// (async() => {
//     const res = await updateIfNotExistsAndGet(
//         clusterApiUrl("mainnet-beta"),
//     [
//         "85vNnKPMM4aHCJ9a6ebMFjqgzNL9jFXF7zW22vjeXziT",
//         "6qDWicht82dYXj7ModFfdti9f8pfWFDTKt9itvnvCoDH",
//         "3yLApRRweajdW5U1xtzoRvJrqC5mWCcBkFHccSATgMLG",
//         "7qt1qBnQ5CNNpMH1no6jYAzuyazP5QWXsUZB7dot5kga"
//     ],
//      "7wXu1a3WDJ8fCM69YzQzW4hnaoU6HCTA1WCHMUCmu4D4Qcksvc6jPDu8VWzkomN9GwpSQ26Nuy2GRXfR42Bb9iN");
//     console.log(res);
// })()


module.exports = {getCollectionAddress, sleep, updateIfNotExistsAndGet, getRaydiumPair}