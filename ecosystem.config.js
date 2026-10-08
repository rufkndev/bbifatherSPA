// PM2: backend (gunicorn, 1 worker) + polling-бот.
// Пути считаются от расположения этого файла, логи — в ~/logs.
// Запуск/обновление: ./deploy.sh
const path = require('path');
const os = require('os');

const root = __dirname;
const logs = path.join(os.homedir(), 'logs');

module.exports = {
  apps: [
    {
      name: 'bbifather-backend',
      script: 'start.sh',
      cwd: path.join(root, 'backend'),
      interpreter: '/bin/bash',
      env: { ENVIRONMENT: 'production' },
      error_file: path.join(logs, 'backend-error.log'),
      out_file: path.join(logs, 'backend-out.log'),
      time: true,
      instances: 1, // не увеличивать: очередь Telegram живёт в памяти процесса
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'bbifather-bot',
      script: 'bot.py',
      cwd: root,
      interpreter: path.join(root, 'backend', 'venv', 'bin', 'python'),
      error_file: path.join(logs, 'bot-error.log'),
      out_file: path.join(logs, 'bot-out.log'),
      time: true,
      instances: 1, // два polling-процесса с одним токеном дают Conflict
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
  ],
};
