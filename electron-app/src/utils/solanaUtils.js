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
    if (await saveLookupTables(...tables, lookupTableAddress.toBase58()) === false){
        console.error(`alt not created!@`)
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
    // Check if the accounts can fit in the specified table
    const MAX_ACCOUNTS_PER_TABLE = 256;
    const connection = new Connection(rpcUrl);

    // Get current addresses in the lookup table
    const lookupTableAccount = (
        await connection.getAddressLookupTable(new PublicKey(lookupTableAddress))
    ).value;

    if (!lookupTableAccount) {
        console.error("Lookup table not found");
        return;
    }

    const currentAddressCount = lookupTableAccount.state.addresses.length;

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
    const USER = Keypair.fromSecretKey(new Uint8Array(bs58.default.decode(privateKey)));

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

// return array of addresses, type string
async function getAllAddressesFromLookupTable(rpcUrl, lookupTableAddress){
    const connection = new Connection(rpcUrl);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(new PublicKey(lookupTableAddress))
    ).value;

    if (!lookupTableAccount) {
        console.error("Lookup table not found");
        return [];
    }

    return lookupTableAccount.state.addresses.map(address => address.toBase58());
}

/**
 * Checks if accounts exist in lookup tables and updates as needed
 * @param {string} rpcUrl - RPC URL for Solana connection
 * @param {string[]} accounts - Array of account addresses to check
 * @param {string} private_key - Private key in base58 format
 * @returns {Promise<string[] | undefined>} - The addresses of the lookup table used
 */
async function updateIfNotExistsAndGet(rpcUrl, accounts, private_key){
    const tables = await getLookupTables();

    if (!tables || tables.length === 0){
        console.log(`No tables found. Creating...`);
        const tableAddress = await createLookupTable(rpcUrl, private_key);
        if (!tableAddress){
            return;
        }

        // After creating the table, append the accounts
        return [await appendLookupTable(accounts, rpcUrl, private_key, tableAddress)];
    } else {
        console.log(`Checking if accounts already exist...`);
        let accountsToAppend = [...accounts]; // Create a copy of accounts array
        let existingTableAddresses = new Map(); // Map to track which accounts exist in which tables

        // Check all tables for existing accounts
        for (const table of tables){
            const addresses = await getAllAddressesFromLookupTable(rpcUrl, table);

            // Update accountsToAppend to only include accounts not found in any table
            accountsToAppend = accountsToAppend.filter(account => {
                const exists = addresses.includes(account);
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
            // Try to use an existing table that has space
            for (const table of tables) {
                const addresses = await getAllAddressesFromLookupTable(rpcUrl, table);
                if (addresses.length + accountsToAppend.length <= 256) {
                    // This table has space for all remaining accounts
                    const res = await appendLookupTable(accountsToAppend, rpcUrl, private_key, table);
                    if (!res) {
                        console.error(`Failed to append accounts to ALT`);
                        return;
                    }
                    return [res];
                }
            }

            // If no existing table has enough space, create a new one
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
            return [res];
        } else {
            console.log(`All accounts already exist in tables`);

            // Check if all accounts are in the same table
            const usedTables = new Set([...existingTableAddresses.values()]);
            if (usedTables.size === 1) {
                // All accounts are in the same table
                return [...usedTables][0];
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
        const owner = (await connection.getAccountInfo(pair)).owner.toBase58();
        if (owner === RAYDIUM_OWNER){
            return owner;
        }
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {getCollectionAddress, sleep, updateIfNotExistsAndGet, getRaydiumPair}