import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';

// Импортируем шаги:
import StepChooseModule from './StepChooseModule';
import StepConfigureTensorSdk from './StepConfigureTensorSdk';
import StepConfigureTensorReprice from './StepConfigureTensorReprice';
import StepConfigureLaunchMyNft from './StepConfigureLaunchMyNft';
import StepReview from './StepReview';

// Типы (скорректируйте пути под свой проект)
import { Wallet, TensorSdkParams, LaunchMyNftParams, MeteoraParams } from '../../types';
import StepConfigureMeteora from './StepConfigureMeteora';

// ------------------------
const STEPS = ['Choose module', 'Configure module', 'Review & Create'];

// ------------------------
interface CreateTaskWizardProps {
  open: boolean;
  onClose: () => void;
  onCreateTask: (config: unknown) => void;
}

export default function CreateTaskWizard({ open, onClose, onCreateTask }: CreateTaskWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Общие штуки: имя таска, список кошельков, список сетов и т.п.
  const [taskName, setTaskName] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletSets, setWalletSets] = useState<string[]>([]);

  // Файлы-конфиги для reprice / snipe:
  const [repriceConfigs, setRepriceConfigs] = useState<string[]>([]);
  const [snipeConfigs, setSnipeConfigs] = useState<string[]>([]);

  // Параметры Tensor sniper (SDK) + reprice – храним в одном стейте, т.к. часть полей общая
  const [tensorSdkParams, setTensorSdkParams] = useState<TensorSdkParams>({
    collectionId: '',
    priceByName: false,
    priceConfig: '',
    thresholdPrice: 0,
    useJito: false,
    jitoRegion: '',
    jitoTipLamports: 1000,
    useBloxroute: false,
    bloxrouteRegion: '',
    bloxrouteTipLamports: 1000000,
    txToSend: 1,
    delta: 50000,
    walletSource: 'existing',
    privateKey: '',
  });

  // Параметры LaunchMyNft
  const [launchMyNftParams, setLaunchMyNftParams] = useState<LaunchMyNftParams>({
    target_url: '',
    total_priority_fee: 70000,
    compute_unit_limit: 1400000,
    useJito: false,
    jito_tip_amount: 1000,
    jito_region: '',
    delay_when_sending: 10,
    delay_before_sending: 800,
    nfts_to_buy_per_account: 1,

    walletApproach: 'single',
    singleWalletMethod: 'existing',
    selectedWalletPublicKey: '',
    manualPrivateKey: '',
    chosenSetName: '',
  });

  const [meteoraParams, setMeteoraParams] = useState<MeteoraParams>({
    accounts: [],
    useJito: false,
    jitoRegion: '',
    jitoTipAmount: 1000,
    walletSource: 'existing',
    privateKey: '',
    strategy: '',
    additionalParams: {
      CONFIRMATION_TIMEOUT: 6000,
      MAX_TX_ATTEMPTS: 10,
      SLIPPAGE: 7,
      ADDITIONAL_FEE_ON_FAILED: 100000,
      FEE_ADD_LIQUIDITY: 500000,
      FEE_CLAIM_FEE: 180000,
      FEE_REMOVE_LIQUIDITY: 500000,
      FEE_CREATE_POSITION: 500000,
    },
  });

  // ------------------------
  // При открытии диалога: грузим кошельки, списки сетов, конфиги и т.д.
  useEffect(() => {
    if (open) {
      window.electronAPI?.getWallets().then((arr: Wallet[]) => {
        setWallets(arr);
      });
      // Список сетов
      window.electronAPI?.getSettings().then((settings: unknown) => {
        if (settings?.walletsSet) {
          setWalletSets(Object.keys(settings.walletsSet));
        } else {
          setWalletSets([]);
        }
      });

      // Файлы конфигов (reprice / snipe)
      window.electronAPI
        ?.getConfigPaths('reprice_config')
        .then((paths: { name: string; path: string }[]) => {
          setRepriceConfigs(paths.map((p) => p.path));
        });
      window.electronAPI
        ?.getConfigPaths('snipe_config')
        .then((paths: { name: string; path: string }[]) => {
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

    setTaskName('');

    // Сброс Tensor
    setTensorSdkParams({
      collectionId: '',
      priceByName: false,
      priceConfig: '',
      thresholdPrice: 0,
      useJito: false,
      jitoRegion: '',
      jitoTipLamports: 1000,
      useBloxroute: false,
      bloxrouteRegion: '',
      bloxrouteTipLamports: 1000000,
      delta: 50000,
      txToSend: 1,
      walletSource: 'existing',
      privateKey: '',
    });

    // Сброс LaunchMyNft
    setLaunchMyNftParams({
      target_url: '',
      total_priority_fee: 70000,
      compute_unit_limit: 1400000,
      useJito: false,
      jito_tip_amount: 1000,
      jito_region: '',
      delay_when_sending: 10,
      delay_before_sending: 800,
      nfts_to_buy_per_account: 1,
      walletApproach: 'single',
      singleWalletMethod: 'existing',
      selectedWalletPublicKey: '',
      manualPrivateKey: '',
      chosenSetName: '',
    });

    setMeteoraParams({
      accounts: [],
      useJito: false,
      jitoRegion: '',
      jitoTipAmount: 1000,
      walletSource: 'existing',
      privateKey: '',
      strategy: '',
      additionalParams: {
        CONFIRMATION_TIMEOUT: 6000,
        MAX_TX_ATTEMPTS: 10,
        SLIPPAGE: 7,
        ADDITIONAL_FEE_ON_FAILED: 100000,
        FEE_ADD_LIQUIDITY: 500000,
        FEE_CLAIM_FEE: 180000,
        FEE_REMOVE_LIQUIDITY: 500000,
        FEE_CREATE_POSITION: 500000,
      },
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

    if (selectedModule === 'tensor_sdk') {
      const p = tensorSdkParams;
      const cfg = {
        module_name: 'Tensor sniper (SDK)',
        task_name: taskName || '',
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
        main_rpc: settings?.mainRpc || '',
        helius_rpcs: settings?.heliusRpcs || [],
        thor_streamer_address: settings?.thor_streamer_address,
        thor_streamer_token: settings?.thor_streamer_token,
      };
      onCreateTask(cfg);
    } else if (selectedModule === 'tensor_reprice') {
      const p = tensorSdkParams;
      const cfg = {
        module_name: 'Tensor reprice',
        task_name: taskName,
        collection_id: p.collectionId,
        delta: p.delta,
        limit_config: p.priceConfig,
        privateKey: p.privateKey,
        main_rpc: settings?.mainRpc || '',
        helius_rpcs: settings?.heliusRpcs || [],
        tensor_api_token: settings?.tensor_api_token || '',
      };
      onCreateTask(cfg);
    } else if (selectedModule === 'launch_my_nft') {
      const p = launchMyNftParams;
      // Формируем логику, как именно получить кошельки
      let walletSource: 'manaully' | 'set' = 'manaully';
      let singleWalletPk = '';
      let walletSet: Wallet[] = [];

      if (p.walletApproach === 'single') {
        walletSource = 'manaully';
        if (p.singleWalletMethod === 'existing') {
          // ✅ ДОБАВЬ ПРОВЕРКУ:
          if (Array.isArray(wallets)) {
            const found = wallets.find((w) => w.publicKey === p.selectedWalletPublicKey);
            if (found) {
              singleWalletPk = found.privateKey;
            }
          }
        } else {
          singleWalletPk = p.manualPrivateKey.trim();
        }
      } else {
        walletSource = 'set';
        // ✅ ДОБАВЬ ПРОВЕРКУ:
        if (
          p.chosenSetName &&
          settings?.walletsSet?.[p.chosenSetName] &&
          Array.isArray(settings.walletsSet[p.chosenSetName])
        ) {
          walletSet = settings.walletsSet[p.chosenSetName];
        }
      }

      const cfg = {
        module_name: 'LaunchMyNft',
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
        walletSource, // "manaully" или "set"
        wallet: singleWalletPk, // если single
        walletSet, // если set
        main_rpc: settings?.mainRpc || '',
      };
      onCreateTask(cfg);
    } else if (selectedModule === 'meteora_dlmm') {
      const settings = await window.electronAPI?.getSettings();
      const cfg = {
        module_name: 'Meteora DLMM',
        task_name: taskName,
        accounts: meteoraParams.accounts.filter((a) => a.trim() !== ''),
        use_jito: meteoraParams.useJito,
        jito_region: meteoraParams.jitoRegion,
        jito_tip_amount: meteoraParams.jitoTipAmount,
        strategy: meteoraParams.strategy,
        private_key: meteoraParams.privateKey,
        ...meteoraParams.additionalParams,
        main_rpc: settings?.mainRpc || '',
        thor_streamer_address: settings?.thor_streamer_address,
        thor_streamer_token: settings?.thor_streamer_token,
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
        {step === 1 && selectedModule === 'tensor_sdk' && (
          <StepConfigureTensorSdk
            taskName={taskName}
            setTaskName={setTaskName}
            tensorSdkParams={tensorSdkParams}
            setTensorSdkParams={setTensorSdkParams}
            wallets={wallets}
            snipeConfigs={snipeConfigs}
          />
        )}
        {step === 1 && selectedModule === 'tensor_reprice' && (
          <StepConfigureTensorReprice
            taskName={taskName}
            setTaskName={setTaskName}
            tensorSdkParams={tensorSdkParams}
            setTensorSdkParams={setTensorSdkParams}
            wallets={wallets}
            repriceConfigs={repriceConfigs}
          />
        )}
        {step === 1 && selectedModule === 'launch_my_nft' && (
          <StepConfigureLaunchMyNft
            taskName={taskName}
            setTaskName={setTaskName}
            launchMyNftParams={launchMyNftParams}
            setLaunchMyNftParams={setLaunchMyNftParams}
            wallets={wallets}
            walletSets={walletSets}
          />
        )}
        {step === 1 && selectedModule === 'meteora_dlmm' && (
          <StepConfigureMeteora
            taskName={taskName}
            setTaskName={setTaskName}
            meteoraParams={meteoraParams}
            setMeteoraParams={setMeteoraParams}
            wallets={wallets}
          />
        )}

        {/* Шаг 2: Review & Create */}
        {step === 2 && (
          <StepReview
            selectedModule={selectedModule}
            taskName={taskName}
            tensorSdkParams={tensorSdkParams}
            launchMyNftParams={launchMyNftParams}
            meteoraParams={meteoraParams}
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
