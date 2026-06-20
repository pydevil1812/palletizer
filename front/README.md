# Pallet Stacking Studio

React + Vite приложение для расчёта укладки коробок на паллету (3D/Top/Side/Table виды, экспорт в PDF/Excel/JSON).

## Запуск

```powershell
cd front
npm install
npm run dev
```

(В Windows PowerShell 5.1 нет оператора `&&` — команды нужно выполнять по очереди, каждую на своей строке, или через `;`: `cd front; npm install; npm run dev`. Оператор `&&` появился только в PowerShell 7+.)

После запуска `npm run dev` сервер выведет адрес вида `http://localhost:5173/` — открой его в браузере.

### Что делает каждая команда

- **`cd front`** — переходит в папку `front/`, где лежит `package.json` приложения (исходники, конфигурация). Все команды `npm ...` ищут `package.json` в текущей папке, поэтому без этого шага npm не поймёт, что устанавливать и запускать.

- **`npm install`** — читает `package.json`, скачивает все зависимости проекта (`react`, `react-dom`, `three`, `xlsx`, `jspdf`, `jspdf-autotable`, а также dev-зависимости `vite`, `@vitejs/plugin-react`) и кладёт их в папку `node_modules/`. Эта папка не хранится в git (см. `.gitignore`), поэтому её нужно пересоздавать командой `npm install` при первом запуске и каждый раз после обновления зависимостей.

- **`npm run dev`** — запускает dev-сервер Vite (скрипт `"dev": "vite"` из `package.json`). Он компилирует JSX на лету, отдаёт страницу в браузер и автоматически обновляет её при изменении файлов в `src/` (Hot Module Replacement).

Первые два шага достаточно выполнить один раз (повторно — только если изменились зависимости), `npm run dev` запускается каждый раз, когда нужно открыть приложение.

### Другие команды

- `npm run build` — production-сборка в `dist/`.
- `npm run preview` — локальный просмотр уже собранной production-версии.

## Архитектура

- `src/domain/` — независимые от React классы: алгоритм укладки (`PalletizerEngine`), модели (`Box`, `Pallet`, `PalletConfig`, ...), валидация и сериализация конфигурации.
- `src/services/` — обёртки над сторонними библиотеками: 3D-сцена (`ThreeSceneController`, Three.js), 2D-отрисовка (`CanvasTopRenderer`, `CanvasSideRenderer`), экспорт (`ExportService`: PDF/Excel/Print).
- `src/hooks/` — мосты между доменной логикой и React (`usePalletConfig`, `useStackResult`, `useThreeScene`).
- `src/components/` — UI-компоненты (Header, Sidebar, Main panel и виды).
