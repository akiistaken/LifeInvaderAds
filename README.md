# LifeInvader Ads Manager

A full-stack web application designed to streamline the creation, management, and formatting of manual advertisements for the LifeInvader platform.

## 🚀 Features

### Core Application
- **Automated Ad Formatting**: Intelligent generation of ad copy with automatic pluralization, prefix/suffix matching, and clean formatting.
- **Transaction Preview**: Real-time preview of the advertisement before copying.
- **Quick Copy**: One-click "Copy AD" functionality to quickly paste into the game/platform.
- **Data Syncing**: Built-in scripts (`npm run sync`, `npm run refresh`) to pull and parse item data from CSV/Excel sources.

### User & Session Management
- **Pin-Based Authentication**: Secure login system using PIN codes.
- **Role-Based Access**: Support for different user roles and permissions.
- **Persistent Sessions**: Secure session management with local storage and cookie support.
- **IP Rate Limiting**: Built-in 6-hour cooldowns for registration to prevent abuse.

### Productivity Tools
- **Cloud Notes**: A built-in scratchpad for recurring ads, notes, and reminders that auto-saves as you type and syncs across devices per account.
- **User Preferences**: Customizable preferences including a sleek Dark Mode UI.
- **PDF Generation**: Support for generating PDF reports or exports directly from the web app.

### Deployment & Infrastructure
- **Automated Server Setup**: Includes a `setup_ubuntu.sh` script to automatically configure an Ubuntu VPS with Nginx, PM2, and SSL (Certbot).
- **CI/CD Integration**: Fully configured GitHub Actions workflow (`deploy.yml`) for automated deployment on `git push`.
- **Discord Integration**: Webhook integration to log important server events directly to a Discord channel.

## 🛠️ Tech Stack

**Frontend (Web)**
- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Fira Sans & Fira Code typography

**Backend (Auth API)**
- Node.js
- JSON-based lightweight storage (`users.json`, `sessions.json`, `notes.json`, etc.)
- PM2 Process Manager

## 📖 Deployment Instructions

To deploy this application to an Ubuntu server:
1. Ensure your domain's DNS A Record points to your server's IP address.
2. Clone the repository on your server.
3. Run the setup script: `sudo bash setup_ubuntu.sh`.
4. The script will automatically install dependencies, build the Next.js app, configure Nginx, and secure it with Let's Encrypt SSL.
5. Future updates can be deployed simply by pushing to the `main` branch on GitHub.
