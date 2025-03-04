import React from "react";
import { Box, Typography } from "@mui/material";

// Импорты типов (скорректируйте под себя)
import {Wallet, TensorSdkParams, LaunchMyNftParams, MeteoraParams} from "../../types";

interface StepReviewProps {
    selectedModule: string | null;
    taskName: string;
    tensorSdkParams: TensorSdkParams;
    launchMyNftParams: LaunchMyNftParams;
    meteoraParams: MeteoraParams; // Добавлен новый параметр
    wallets: Wallet[];
}

export default function StepReview({
                                       selectedModule,
                                       taskName,
                                       tensorSdkParams,
                                       launchMyNftParams,
                                       meteoraParams,
                                       wallets,
                                   }: StepReviewProps) {
    // Можем отрендерить разные данные в зависимости от модуля:
    if (selectedModule === "tensor_sdk") {
        const {
            collectionId,
            priceByName,
            priceConfig,
            thresholdPrice,
            walletSource,
            privateKey,
            useJito,
            jitoRegion,
            jitoTipLamports,
            useBloxroute,
            bloxrouteRegion,
            bloxrouteTipLamports,
            txToSend,
        } = tensorSdkParams;

        const publicKeyIfExisting =
            wallets.find((w) => w.privateKey === privateKey)?.publicKey || "Not found";

        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="h6">Review your parameters (Tensor SDK)</Typography>
                <Typography><b>Task Name:</b> {taskName}</Typography>
                <Typography><b>collectionId:</b> {collectionId}</Typography>
                <Typography><b>priceByName:</b> {priceByName ? "Yes" : "No"}</Typography>
                {priceByName ? (
                    <Typography><b>priceConfig:</b> {priceConfig}</Typography>
                ) : (
                    <Typography><b>thresholdPrice:</b> {thresholdPrice}</Typography>
                )}
                <Typography><b>Wallet Source:</b> {walletSource}</Typography>
                <Typography>
                    <b>Wallet:</b>{" "}
                    {walletSource === "existing" ? publicKeyIfExisting : "Manual (hidden)"}
                </Typography>

                <Typography><b>useJito:</b> {useJito ? "Yes" : "No"}</Typography>
                {useJito && (
                    <>
                        <Typography><b>jitoRegion:</b> {jitoRegion}</Typography>
                        <Typography><b>jitoTipLamports:</b> {jitoTipLamports}</Typography>
                    </>
                )}

                <Typography><b>useBloxroute:</b> {useBloxroute ? "Yes" : "No"}</Typography>
                {useBloxroute && (
                    <>
                        <Typography><b>bloxrouteRegion:</b> {bloxrouteRegion}</Typography>
                        <Typography><b>bloxrouteTipLamports:</b> {bloxrouteTipLamports}</Typography>
                    </>
                )}

                <Typography><b>txToSend:</b> {txToSend}</Typography>
            </Box>
        );
    } else if (selectedModule === "tensor_reprice") {
        const {
            collectionId,
            walletSource,
            privateKey,
            delta,
            priceConfig,
        } = tensorSdkParams;

        const publicKeyIfExisting =
            wallets.find((w) => w.privateKey === privateKey)?.publicKey || "Not found";

        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="h6">Review your parameters (Tensor Reprice)</Typography>
                <Typography><b>Task Name:</b> {taskName}</Typography>
                <Typography><b>Collection ID:</b> {collectionId}</Typography>
                <Typography><b>Wallet Source:</b> {walletSource}</Typography>
                <Typography>
                    <b>Wallet:</b>{" "}
                    {walletSource === "existing" ? publicKeyIfExisting : "Manual (hidden)"}
                </Typography>
                <Typography><b>Delta:</b> {delta}</Typography>
                <Typography><b>Limit Config:</b> {priceConfig}</Typography>
            </Box>
        );
    } else if (selectedModule === "launch_my_nft") {
        const {
            target_url,
            total_priority_fee,
            compute_unit_limit,
            useJito,
            jito_tip_amount,
            jito_region,
            delay_when_sending,
            delay_before_sending,
            nfts_to_buy_per_account,
            walletApproach,
            singleWalletMethod,
            selectedWalletPublicKey,
            manualPrivateKey,
            chosenSetName,
        } = launchMyNftParams;

        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="h6">Review your parameters (LaunchMyNft)</Typography>
                <Typography><b>Task Name:</b> {taskName}</Typography>
                <Typography><b>Target URL:</b> {target_url}</Typography>
                <Typography><b>Total Priority Fee:</b> {total_priority_fee}</Typography>
                <Typography><b>Compute Unit Limit:</b> {compute_unit_limit}</Typography>
                <Typography><b>useJito:</b> {useJito ? "Yes" : "No"}</Typography>
                {useJito && (
                    <>
                        <Typography><b>jito_tip_amount:</b> {jito_tip_amount}</Typography>
                        <Typography><b>jito_region:</b> {jito_region}</Typography>
                    </>
                )}
                <Typography><b>delay_when_sending:</b> {delay_when_sending}</Typography>
                <Typography><b>delay_before_sending:</b> {delay_before_sending}</Typography>
                <Typography><b>nfts_to_buy_per_account:</b> {nfts_to_buy_per_account}</Typography>

                <Typography>
                    <b>Wallet Approach:</b> {walletApproach === "single" ? "Single" : "Set"}
                </Typography>

                {walletApproach === "single" ? (
                    <>
                        <Typography><b>singleWalletMethod:</b> {singleWalletMethod}</Typography>
                        {singleWalletMethod === "existing" ? (
                            <Typography>
                                <b>Selected Wallet (pubkey):</b> {selectedWalletPublicKey}
                            </Typography>
                        ) : (
                            <Typography>
                                <b>Manual Private Key:</b> Hidden
                            </Typography>
                        )}
                    </>
                ) : (
                    <Typography>
                        <b>Chosen Set Name:</b> {chosenSetName}
                    </Typography>
                )}
            </Box>
        );
    }else if (selectedModule === "meteora_dlmm"){
        const {
            accounts,
            useJito,
            jitoRegion,
            jitoTipAmount,
            additionalParams
        } = meteoraParams;

        const filteredAccounts = accounts.filter((acc: string) => acc.trim() !== "");

        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="h6">Review your parameters (Meteora DLMM)</Typography>
                <Typography><b>Task Name:</b> {taskName}</Typography>

                <Typography><b>Accounts:</b> {filteredAccounts.length} added</Typography>

                <Typography><b>Use Jito:</b> {useJito ? "Yes" : "No"}</Typography>
                {useJito && (
                    <>
                        <Typography><b>Jito Region:</b> {jitoRegion || 'Not selected'}</Typography>
                        <Typography><b>Jito Tip Amount:</b> {jitoTipAmount} lamports</Typography>
                    </>
                )}

                <Typography variant="subtitle1" sx={{ mt: 1 }}>Advanced Parameters:</Typography>
                <Typography><b>Confirmation Timeout:</b> {additionalParams.CONFIRMATION_TIMEOUT}ms</Typography>
                <Typography><b>Max TX Attempts:</b> {additionalParams.MAX_TX_ATTEMPTS}</Typography>
                <Typography><b>Slippage:</b> {additionalParams.SLIPPAGE}%</Typography>
                <Typography><b>Additional Fee on Failed:</b> {additionalParams.ADDITIONAL_FEE_ON_FAILED}</Typography>
                <Typography><b>Fee Add Liquidity:</b> {additionalParams.FEE_ADD_LIQUIDITY}</Typography>
                <Typography><b>Fee Claim Fee:</b> {additionalParams.FEE_CLAIM_FEE}</Typography>
                <Typography><b>Fee Remove Liquidity:</b> {additionalParams.FEE_REMOVE_LIQUIDITY}</Typography>
                <Typography><b>Fee Create Position:</b> {additionalParams.FEE_CREATE_POSITION}</Typography>
            </Box>
        );
    }

    return (
        <Typography color="error">
            No module selected or unknown module.
        </Typography>
    );
}
