#!/bin/bash

# Configuration
SERVER_IP="153.75.90.105"
DOMAIN="joblessdevs.space"
REPO_URL="git@github.com:akiistaken/LifeInvaderAds.git"
APP_DIR="/var/www/LifeInvaderAds"

echo "Updating system and installing dependencies..."
sudo apt update
sudo apt install -y curl git nginx certbot python3-certbot-nginx

echo "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Installing PM2 globally..."
sudo npm install -g pm2

echo "Cloning repository..."
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
if [ -d "LifeInvaderAds" ]; then
    echo "Directory exists, pulling latest changes..."
    cd LifeInvaderAds
    git pull
else
    git clone $REPO_URL
    cd LifeInvaderAds
fi

echo "Configuring Backend (auth-server)..."
cd auth-server
# Set environment variables for the backend
echo "ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN,http://$DOMAIN,http://localhost:3000" > .env
npm install
pm2 start server.js --name "li-auth-api"

echo "Configuring Frontend (web)..."
cd ../web
# Set environment variables for the frontend
echo "NEXT_PUBLIC_API_URL=https://$DOMAIN/auth-api" > .env.production
npm install
npm run build
pm2 start npm --name "li-web" -- start

echo "Saving PM2 processes to auto-start on reboot..."
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

echo "Configuring Nginx Reverse Proxy..."
cat <<EOF | sudo tee /etc/nginx/sites-available/lifeinvader
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /auth-api/ {
        proxy_pass http://127.0.0.1:4032/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/lifeinvader /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "Setting up SSL with Certbot..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect

echo "============================================="
echo "Setup Complete!"
echo "Your app is now running at https://$DOMAIN"
echo "Your API is running at https://$DOMAIN/auth-api"
echo "============================================="
