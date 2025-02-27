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

export const collections: Map<string, string> = new Map([
    ["Jupiter", "a2e9e503-b8d5-4024-8837-538c5b879ec4"],
    ["chill", "a2e9e503-b8d5-4024-8837-538c5b879ec3"]
]);


export const MODULES: ModuleItem[] = [
    {
        id: "launch_my_nft",
        label: "LaunchMyNft",
        icon: <RocketLaunchIcon />,
        isDisabled: false,
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
        isDisabled: false,
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
    ["Tensor reprice", ["ACTION", "NFT", "PRICE", "LIMIT"]]
]);

