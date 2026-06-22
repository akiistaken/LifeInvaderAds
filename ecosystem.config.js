module.exports = {
  apps: [
    {
      name: "li-web",
      script: "npm",
      args: "run start",
      cwd: "./web",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "li-auth",
      script: "server.js",
      cwd: "./auth-server",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
