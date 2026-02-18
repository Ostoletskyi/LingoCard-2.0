cd C:\Labor\LingoCard2\LingoCard-2.0

# 1) Остановить процессы, которые часто держат esbuild
taskkill /F /IM node.exe 2>$null
taskkill /F /IM esbuild.exe 2>$null

# 2) Снять read-only (если проставился) и удалить node_modules
attrib -R /S /D node_modules\* 2>$null
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 3) Восстановить потенциально поврежденный smoke
git restore _tools\smoke.js package.json package-lock.json

# 4) Подтянуть актуальный код
git pull --rebase

# 5) Чистая установка зависимостей
npm cache verify
npm ci

# 6) Проверка smoke-файла и прогон smoke
Select-String -Path _tools\smoke.js -Pattern "runRuntimeContracts"
npm run tools:smoke
