# Telegram Service

Микросервис для Telegram бота на Fastify с TypeScript (strict mode).

## Установка

```bash
npm install
cp .env.example .env
# Отредактировать .env
```

## Запуск

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Docker
docker-compose up -d
```

## API Endpoints

### Bot Management
- `POST /api/bot/config` - настройка бота
- `GET /api/bot/status` - статус бота
- `POST /api/bot/start` - запуск
- `POST /api/bot/stop` - остановка

### Notifications
- `POST /api/notifications/task` - уведомление о задаче
- `POST /api/notifications/task-status` - статус задачи
- `POST /api/notifications/system` - системное уведомление
- `POST /api/notifications/pool-change` - смена пула

### Health
- `GET /health` - проверка здоровья

## Telegram Commands

- `/help` - справка
- `/tasks` - список задач
- `/task_status [id]` - статус задачи
- `/task_start [id]` - запустить задачу
- `/task_stop [id]` - остановить задачу
- `/task_remove [id]` - удалить задачу
- `/task_logs [id] [lines]` - логи задачи
- `/mev_start` - запустить MEV
- `/mev_stop` - остановить MEV
- `/mev_processes` - список процессов
- `/mev_stop_process [id]` - остановить процесс
- `/mev_logs [id] [lines]` - логи процесса

## Аутентификация

Все запросы требуют заголовок `x-api-key`.
