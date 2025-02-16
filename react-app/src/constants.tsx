// src/constants.ts
import React from "react";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ApiIcon from "@mui/icons-material/Api";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import CloudIcon from "@mui/icons-material/Cloud";

/** Наш интерфейс: иконка может быть JSX.Element */
export interface ModuleItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    isDisabled?: boolean;
}


export const MODULES: ModuleItem[] = [
    {
        id: "launch_my_nft",
        label: "LaunchMyNft",
        icon: <RocketLaunchIcon />,
        isDisabled: true,
    },
    {
        id: "tensor_api",
        label: "Tensor sniper (API)",
        icon: <ApiIcon />,
        isDisabled: true,
    },
    {
        id: "tensor_sdk",
        label: "Tensor sniper (SDK)",
        icon: <DeviceHubIcon />,
        isDisabled: false,
    },
    {
        id: "tensor_reprice",
        label: "Tensor reprice",
        icon: <SettingsEthernetIcon />,
        isDisabled: true,
    },
    {
        id: "pump_fun",
        label: "Pump.fun",
        icon: <AutoGraphIcon />,
        isDisabled: true,
    },
    {
        id: "meteora_dlmm",
        label: "Meteora DLMM",
        icon: <CloudIcon />,
        isDisabled: true,
    },
];

export const COLS_NAMES: Map<string, string[]> = new Map([
    ["Tensor sniper (SDK)", ["NFT name", "price", "seller", "buyer"]],
    ["users", ["ID", "Имя", "Роль"]]
]);

