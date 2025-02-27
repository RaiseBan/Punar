import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stepper,
    Step,
    StepLabel
} from "@mui/material";

// Импортируем шаги:
import StepChooseModule from "./StepChooseModule";
import StepConfigureTensorSdk from "./StepConfigureTensorSdk";
import StepConfigureTensorReprice from "./StepConfigureTensorReprice";
import StepConfigureLaunchMyNft from "./StepConfigureLaunchMyNft";
import StepReview from "./StepReview";

// Типы (скорректируйте пути под свой проект)
import { Wallet, TensorSdkParams, LaunchMyNftParams } from "../../types";

// ------------------------
const STEPS = ["Choose module", "Configure module", "Review & Create"];

// ------------------------
interface CreateTaskWizardProps {
    open: boolean;
    onClose: () => void;
    onCreateTask: (config: any) => void;
}

export default function CreateTaskWizard({
                                             open,
                                             onClose,
                                             onCreateTask,
                                         }: CreateTaskWizardProps) {
    const [step, setStep] = useState(0);
    const [selectedModule, setSelectedModule] = useState<string | null>(null);

    // Общие штуки: имя таска, список кошельков, список сетов и т.п.
    const [taskName, setTaskName] = useState("");
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [walletSets, setWalletSets] = useState<string[]>([]);

    // Файлы-конфиги для reprice / snipe:
    const [repriceConfigs, setRepriceConfigs] = useState<string[]>([]);
    const [snipeConfigs, setSnipeConfigs] = useState<string[]>([]);

    // Параметры Tensor sniper (SDK) + reprice – храним в одном стейте, т.к. часть полей общая
    const [tensorSdkParams, setTensorSdkParams] = useState<TensorSdkParams>({
        collectionId: "",
        priceByName: false,
        priceConfig: "",
        thresholdPrice: 0,
        useJito: false,
        jitoRegion: "",
        jitoTipLamports: 1000,
        useBloxroute: false,
        bloxrouteRegion: "",
        bloxrouteTipLamports: 1000000,
        txToSend: 1,
        delta: 50000,
        walletSource: "existing",
        privateKey: ""
    });

    // Параметры LaunchMyNft
    const [launchMyNftParams, setLaunchMyNftParams] = useState<LaunchMyNftParams>({
        target_url: "",
        total_priority_fee: 70000,
        compute_unit_limit: 1400000,
        useJito: false,
        jito_tip_amount: 1000,
        jito_region: "",
        delay_when_sending: 10,
        delay_before_sending: 800,
        nfts_to_buy_per_account: 1,

        walletApproach: "single",
        singleWalletMethod: "existing",
        selectedWalletPublicKey: "",
        manualPrivateKey: "",
        chosenSetName: "",
    });

    // ------------------------
    // При открытии диалога: грузим кошельки, списки сетов, конфиги и т.д.
    useEffect(() => {
        if (open) {
            window.electronAPI?.getWallets().then((arr: Wallet[]) => {
                setWallets(arr);
            });
            // Список сетов
            window.electronAPI?.getSettings().then((settings: any) => {
                if (settings?.walletsSet) {
                    setWalletSets(Object.keys(settings.walletsSet));
                } else {
                    setWalletSets([]);
                }
            });

            // Файлы конфигов (reprice / snipe)
            window.electronAPI?.getConfigPaths("reprice_config").then((paths: any[]) => {
                setRepriceConfigs(paths.map((p) => p.path));
            });
            window.electronAPI?.getConfigPaths("snipe_config").then((paths: any[]) => {
                setSnipeConfigs(paths.map((p) => p.path));
            });
        }
    }, [open]);

    // ------------------------
    // Кнопки навигации по шагам
    const handleNext = () => setStep((prev) => prev + 1);
    const handleBack = () => setStep((prev) => prev - 1);

    // Закрытие диалога → сбрасываем всё
    const handleClose = () => {
        setStep(0);
        setSelectedModule(null);

        setTaskName("");

        // Сброс Tensor
        setTensorSdkParams({
            collectionId: "",
            priceByName: false,
            priceConfig: "",
            thresholdPrice: 0,
            useJito: false,
            jitoRegion: "",
            jitoTipLamports: 1000,
            useBloxroute: false,
            bloxrouteRegion: "",
            bloxrouteTipLamports: 1000000,
            delta: 50000,
            txToSend: 1,
            walletSource: "existing",
            privateKey: ""
        });

        // Сброс LaunchMyNft
        setLaunchMyNftParams({
            target_url: "",
            total_priority_fee: 70000,
            compute_unit_limit: 1400000,
            useJito: false,
            jito_tip_amount: 1000,
            jito_region: "",
            delay_when_sending: 10,
            delay_before_sending: 800,
            nfts_to_buy_per_account: 1,
            walletApproach: "single",
            singleWalletMethod: "existing",
            selectedWalletPublicKey: "",
            manualPrivateKey: "",
            chosenSetName: "",
        });

        onClose();
    };

    // ------------------------
    // FINISH: пользовтель нажимает "Create"
    const handleCreate = async () => {
        if (!selectedModule) {
            return;
        }

        const settings = await window.electronAPI?.getSettings(); // часто нужно

        if (selectedModule === "tensor_sdk") {
            const p = tensorSdkParams;
            const cfg = {
                module_name: "Tensor sniper (SDK)",
                task_name: taskName || "",
                collection_id: p.collectionId,
                price_by_name: p.priceByName,
                price_config: p.priceConfig || null,
                threshold_price: p.thresholdPrice,
                use_jito: p.useJito,
                jito_region: p.jitoRegion || null,
                jito_tip_lamports: p.jitoTipLamports,
                use_bloxroute: p.useBloxroute,
                bloxroute_region: p.bloxrouteRegion || null,
                bloxroute_tip_lamports: p.bloxrouteTipLamports,
                tx_to_send: p.txToSend,
                privateKey: p.privateKey,
                main_rpc: settings?.mainRpc || "",
                helius_rpcs: settings?.heliusRpcs || [],
            };
            onCreateTask(cfg);
        }
        else if (selectedModule === "tensor_reprice") {
            const p = tensorSdkParams;
            const cfg = {
                module_name: "Tensor reprice",
                task_name: taskName,
                collection_id: p.collectionId,
                delta: p.delta,
                limit_config: p.priceConfig,
                privateKey: p.privateKey,
                main_rpc: settings?.mainRpc || "",
                helius_rpcs: settings?.heliusRpcs || [],
                tensor_api_token: settings?.tensor_api_token || "",
            };
            onCreateTask(cfg);
        }
        else if (selectedModule === "launch_my_nft") {
            const p = launchMyNftParams;
            // Формируем логику, как именно получить кошельки
            let walletSource: "manaully" | "set" = "manaully";
            let singleWalletPk = "";
            let walletSet: Wallet[] = [];

            if (p.walletApproach === "single") {
                // Один кошелёк
                walletSource = "manaully";
                if (p.singleWalletMethod === "existing") {
                    // ищем в массиве wallets
                    const found = wallets.find((w) => w.publicKey === p.selectedWalletPublicKey);
                    if (found) {
                        singleWalletPk = found.privateKey;
                    }
                } else {
                    // manual
                    singleWalletPk = p.manualPrivateKey.trim();
                }
            } else {
                // set
                walletSource = "set";
                if (p.chosenSetName && settings?.walletsSet?.[p.chosenSetName]) {
                    walletSet = settings.walletsSet[p.chosenSetName];
                }
            }

            const cfg = {
                module_name: "LaunchMyNft",
                task_name: taskName,
                target_url: p.target_url,
                total_priority_fee: p.total_priority_fee,
                compute_unit_limit: p.compute_unit_limit,
                use_jito: p.useJito,
                jito_tip_amount: p.jito_tip_amount,
                jito_region: p.jito_region,
                delay_when_sending: p.delay_when_sending,
                delay_before_sending: p.delay_before_sending,
                nfts_to_buy_per_account: p.nfts_to_buy_per_account,
                walletSource,          // "manaully" или "set"
                wallet: singleWalletPk, // если single
                walletSet,             // если set
                main_rpc: settings?.mainRpc || "",
            };
            onCreateTask(cfg);
        }

        handleClose();
    };

    // ------------------------
    // Рендерим шаги
    return (
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
            <DialogTitle>Create Task</DialogTitle>

            <DialogContent dividers>
                <Stepper activeStep={step} sx={{ mb: 3 }}>
                    {STEPS.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {/* Шаг 0: выбрать модуль */}
                {step === 0 && (
                    <StepChooseModule
                        selectedModule={selectedModule}
                        setSelectedModule={setSelectedModule}
                        handleNext={handleNext}
                    />
                )}

                {/* Шаг 1: Конфигурация (в зависимости от selectedModule) */}
                {step === 1 && selectedModule === "tensor_sdk" && (
                    <StepConfigureTensorSdk
                        taskName={taskName}
                        setTaskName={setTaskName}
                        tensorSdkParams={tensorSdkParams}
                        setTensorSdkParams={setTensorSdkParams}
                        wallets={wallets}
                        snipeConfigs={snipeConfigs}
                    />
                )}
                {step === 1 && selectedModule === "tensor_reprice" && (
                    <StepConfigureTensorReprice
                        taskName={taskName}
                        setTaskName={setTaskName}
                        tensorSdkParams={tensorSdkParams}
                        setTensorSdkParams={setTensorSdkParams}
                        wallets={wallets}
                        repriceConfigs={repriceConfigs}
                    />
                )}
                {step === 1 && selectedModule === "launch_my_nft" && (
                    <StepConfigureLaunchMyNft
                        taskName={taskName}
                        setTaskName={setTaskName}
                        launchMyNftParams={launchMyNftParams}
                        setLaunchMyNftParams={setLaunchMyNftParams}
                        wallets={wallets}
                        walletSets={walletSets}
                    />
                )}

                {/* Шаг 2: Review & Create */}
                {step === 2 && (
                    <StepReview
                        selectedModule={selectedModule}
                        taskName={taskName}
                        tensorSdkParams={tensorSdkParams}
                        launchMyNftParams={launchMyNftParams}
                        wallets={wallets}
                    />
                )}
            </DialogContent>

            <DialogActions>
                {step > 0 && (
                    <Button onClick={handleBack} color="inherit">
                        Back
                    </Button>
                )}
                {step < 2 && (
                    <Button onClick={handleNext} variant="contained">
                        Next
                    </Button>
                )}
                {step === 2 && (
                    <Button onClick={handleCreate} variant="contained" color="primary">
                        Create
                    </Button>
                )}
                <Button onClick={handleClose} color="inherit">
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}
