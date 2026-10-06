module.exports = {
  apps: [
    {
      name: "power-automate-backend",
      script: "src/server.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    }
  ]
};
