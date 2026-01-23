#!/bin/bash

# ============================================
# Скрипт автоматической замены для исправления типов
# ============================================

echo "🔧 Starting automatic replacements..."

# Переходим в директорию react-app
cd react-app/src || exit 1

# ============================================
# 1. Замена window.electronAPI?. → window.electronAPI.
# ============================================
echo "📝 Replacing window.electronAPI?. with window.electronAPI..."

find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/window\.electronAPI?\./window.electronAPI./g' {} \;

# ============================================
# 2. Замена settings?. → settings.
# ============================================
echo "📝 Replacing settings?. with settings. (preserving settings.walletsSet?.)"

find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.mainRpc/settings.mainRpc/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.heliusRpcs/settings.heliusRpcs/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.tensor_api_token/settings.tensor_api_token/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.thor_streamer_address/settings.thor_streamer_address/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.thor_streamer_token/settings.thor_streamer_token/g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.telegramChatIds/settings.telegramChatIds/g' {} \;

# walletsSet оставляем с опциональной цепочкой в некоторых местах
# Но исправляем settings?.walletsSet → settings.walletsSet
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/settings?\.walletsSet\b/settings.walletsSet/g' {} \;

# ============================================
# 3. Убираем (settings: unknown)
# ============================================
echo "📝 Removing explicit (settings: unknown) type annotations..."

find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/(settings: unknown)/(settings)/g' {} \;

echo "✅ Automatic replacements completed!"
echo ""
echo "⚠️  IMPORTANT: Manual fixes still needed:"
echo "   1. Replace react-app/src/global.d.ts with the new version"
echo "   2. Fix useTaskTelegram.ts - remove if (window.electronAPI) checks"
echo "   3. Fix Settings.tsx - handleBlur and handleSave type casting"
echo "   4. Fix useToolsTransaction.ts - remove SettingsWithWalletsSet interface"
echo "   5. Add NFTItem interface in Statistic.tsx"