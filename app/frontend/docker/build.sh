#!/bin/bash

# Clean up any existing containers
docker rm -f hrdao-builder 2>/dev/null || true

# Build the Docker image
docker build -t hrdao-linux-builder -f docker/Dockerfile .

# Create a container and copy the built files
docker create --name hrdao-builder hrdao-linux-builder
docker cp hrdao-builder:/output ./dist/electron-linux
docker rm hrdao-builder

echo "Build completed. Check ./dist/electron-linux for the output files."