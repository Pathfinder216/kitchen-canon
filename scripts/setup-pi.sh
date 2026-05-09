#!/bin/bash
# One-time setup: install Docker on a fresh Raspberry Pi OS installation.
# Run this on the Pi itself (via SSH or directly).
set -e

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"

echo ""
echo "Done! Log out and back in for the Docker group to take effect, then"
echo "run the deploy script from your machine:"
echo "  ./scripts/deploy-to-pi.sh pi@<ip-address>"
