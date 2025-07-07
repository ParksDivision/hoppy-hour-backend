#!/bin/bash
# Install and configure Redis on Ubuntu
echo "Installing Redis on this server..."
sudo apt update
sudo apt install -y redis-server

# Configure Redis for remote connections (if needed)
sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Allow Redis port through firewall
sudo ufw allow 6379/tcp

echo "✅ Redis installed and running!"
echo "Connection: redis://localhost:6379"
