import {
    Transaction,
    Connection,
    Keypair,
    ComputeBudgetProgram,
    SendTransactionError,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitForConfirmation(
    signature: string,
    connection: Connection,
    timeout: number = 30000
): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === "confirmed") {
            return true;
        }
        await sleep(2000);
    }
    return false;
}

export async function sendTransactionWithRetries(
    transaction: Transaction,
    signer: Keypair,
    rpcUrl: string,
    maxRetries: number = 5,
    timeout: number = 30000,
    cuLimit: number,
    fee: number = 20000
): Promise<{ success: boolean; signature?: string; error?: string }> {
    const connection = new Connection(rpcUrl);

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit });
    const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: fee });
    transaction.add(modifyComputeUnits, priorityFee);
    console.log(`added ixs`)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            transaction.feePayer = signer.publicKey;
            transaction.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
            transaction.sign(signer);
            const serializedTransaction = transaction.serialize();
            const signature = await connection.sendRawTransaction(serializedTransaction, {
                skipPreflight: false,
                maxRetries: 5,
                preflightCommitment: "confirmed",
            });
            console.log(`Attempt ${attempt}: Sent transaction, signature: ${signature}`);

            const confirmed = await waitForConfirmation(signature, connection, timeout);
            if (confirmed) {
                console.log(`Transaction confirmed on attempt ${attempt}`);
                return { success: true, signature };
            } else {
                console.warn(`Transaction not confirmed within ${timeout} ms on attempt ${attempt}`);
            }
        } catch (error) {
            if (error instanceof SendTransactionError) {
                console.log(error)
                if (
                    error.message.includes("no record of a prior credit") ||
                    error.message.includes("insufficient lamports"
                    )){
                    return { success: false, error: `check your balance!` };
                }

            }
            console.error(`Error on attempt ${attempt}:`, error);
        }
        await sleep(1000);
    }
    return { success: false, error: "Transaction failed after maximum retries" };
}
