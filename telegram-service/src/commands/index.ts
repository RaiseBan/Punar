import { botService } from '../services/bot.service';
import { electronClient } from '../services/electron-client.service';

export function registerCommands(): void {
  botService.registerCommand('help', async (chatId) => {
    const message =
      `<b>📋 Доступные команды:</b>\n\n` +
      `<b>Управление задачами:</b>\n` +
      `/tasks - список всех задач\n` +
      `/task_status [id] - статус задачи\n` +
      `/task_start [id] - запустить задачу\n` +
      `/task_stop [id] - остановить задачу\n` +
      `/task_remove [id] - удалить задачу\n` +
      `/task_logs [id] [lines] - логи задачи\n\n`;

    await botService.sendMessage(chatId, message);
  });

  botService.registerCommand('tasks', async (chatId) => {
    try {
      const tasks = await electronClient.getTasks();

      if (tasks.length === 0) {
        await botService.sendMessage(chatId, '📝 Нет активных задач');
        return;
      }

      let message = `📝 <b>Активные задачи (${tasks.length}):</b>\n\n`;
      tasks.forEach((task, index) => {
        message += `${index + 1}. ID: ${task.id}\n`;
        if (task.name) message += `   Название: ${task.name}\n`;
        if (task.status) message += `   Статус: ${task.status}\n`;
        message += '\n';
      });

      await botService.sendMessage(chatId, message);
    } catch (error) {
      await botService.sendMessage(chatId, `❌ Ошибка: ${(error as Error).message}`);
      console.log(error);
    }
  });

  botService.registerCommand('task_status', async (chatId, args) => {
    if (!args || args.length === 0) {
      await botService.sendMessage(chatId, '❌ Укажите ID задачи');
      return;
    }

    const taskId = args[0];
    try {
      const task = await electronClient.getTask(taskId);
      if (!task) {
        await botService.sendMessage(chatId, `❌ Задача ${taskId} не найдена`);
        return;
      }

      let message = `📊 <b>Задача ${taskId}</b>\n\n`;
      if (task.name) message += `Название: ${task.name}\n`;
      if (task.moduleName) message += `Модуль: ${task.moduleName}\n`;
      if (task.status) message += `Статус: ${task.status}\n`;

      await botService.sendMessage(chatId, message);
    } catch (error) {
      await botService.sendMessage(chatId, `❌ Ошибка: ${(error as Error).message}`);
    }
  });

  botService.registerCommand('task_start', async (chatId, args) => {
    if (!args || args.length === 0) {
      await botService.sendMessage(chatId, '❌ Укажите ID задачи');
      return;
    }

    const taskId = args[0];
    try {
      const result = await electronClient.startTask(taskId);
      const message = result.success
        ? `✅ Задача ${taskId} запущена`
        : `❌ Ошибка: ${result.error}`;
      await botService.sendMessage(chatId, message);
    } catch (error) {
      await botService.sendMessage(chatId, `❌ Ошибка: ${(error as Error).message}`);
    }
  });

  botService.registerCommand('task_stop', async (chatId, args) => {
    if (!args || args.length === 0) {
      await botService.sendMessage(chatId, '❌ Укажите ID задачи');
      return;
    }

    const taskId = args[0];
    try {
      const result = await electronClient.stopTask(taskId);
      const message = result.success
        ? `⏹️ Задача ${taskId} остановлена`
        : `❌ Ошибка: ${result.error}`;
      await botService.sendMessage(chatId, message);
    } catch (error) {
      await botService.sendMessage(chatId, `❌ Ошибка: ${(error as Error).message}`);
    }
  });

  botService.registerCommand('task_remove', async (chatId, args) => {
    if (!args || args.length === 0) {
      await botService.sendMessage(chatId, '❌ Укажите ID задачи');
      return;
    }

    const taskId = args[0];
    try {
      const result = await electronClient.removeTask(taskId);
      const message = result.success
        ? `🗑️ Задача ${taskId} удалена`
        : `❌ Ошибка: ${result.error}`;
      await botService.sendMessage(chatId, message);
    } catch (error) {
      await botService.sendMessage(chatId, `❌ Ошибка: ${(error as Error).message}`);
    }
  });

  botService.registerCommand('task_logs', async (chatId, args) => {
    if (!args || args.length === 0) {
      await botService.sendMessage(chatId, '❌ Укажите ID задачи');
      return;
    }

    const taskId = args[0];
    const lines = args[1] ? parseInt(args[1], 10) : 20;

    try {
      const logs = await electronClient.getTaskLogs(taskId, lines);

      if (logs.length === 0) {
        await botService.sendMessage(chatId, `📜 Логи задачи ${taskId} пусты`);
        return;
      }

      let message = `📜 <b>Логи задачи ${taskId}</b> (последние ${logs.length}):\n\n`;
      message += logs.join('\n');

      await botService.sendMessage(chatId, message);
    } catch (error) {
      await botService.sendMessage(chatId, `❌ Ошибка: ${(error as Error).message}`);
    }
  });
}
