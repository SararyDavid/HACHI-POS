#!/usr/bin/env bash
# ==============================================================================
# Hachi Tech POS - Automated Linux Ubuntu Cloud VM Deployment Script
# Tested on Ubuntu 20.04, 22.04, 24.04 LTS
# ==============================================================================

set -e

echo "=========================================================="
echo "  🚀 Starting Hachi Tech POS Ubuntu VM Setup & Deployment "
echo "=========================================================="

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 LTS, Git, and Nginx
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "📦 Installing build tools, Git, and Nginx..."
sudo apt install -y git nginx curl build-essential

# 3. Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 process manager..."
    sudo npm install -g pm2
fi

# 4. Install dependencies and build project
echo "🛠️ Installing Frontend dependencies and building..."
cd frontend
npm install
npm run build
cd ..

echo "🛠️ Installing Backend dependencies..."
cd backend
npm install
cd ..

# 5. Create logs directory for PM2
mkdir -p backend/logs

# 6. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx reverse proxy..."
if [ -f "nginx.conf.example" ]; then
    sudo cp nginx.conf.example /etc/nginx/sites-available/hachi-pos
    sudo ln -sf /etc/nginx/sites-available/hachi-pos /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl restart nginx
    echo "✓ Nginx configured and restarted."
fi

# 7. Start Backend with PM2
echo "🚀 Starting POS backend with PM2..."
pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save

echo ""
echo "=========================================================="
echo "  ✅ Hachi Tech POS Successfully Deployed on Linux Cloud! "
echo "=========================================================="
echo "  Visit your server's public IP: http://$(curl -s ifconfig.me)"
echo "  Check PM2 logs with: pm2 logs hachi-pos"
echo "  Monitor PM2 status:  pm2 status"
echo "=========================================================="
