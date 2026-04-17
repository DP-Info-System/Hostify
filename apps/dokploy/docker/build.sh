#!/bin/bash

# Determine the type of build based on the first script argument
BUILD_TYPE=${1:-production}

if [ "$BUILD_TYPE" == "canary" ]; then
    TAG="canary"
else
    VERSION=$(node -p "require('./package.json').version")
    TAG="$VERSION"
fi

BUILDER=$(docker buildx create --use)

# Build only for x86_64 (amd64) for faster deployment on VPS
docker buildx build --platform linux/amd64 --pull --rm -t "dokploy/dokploy:${TAG}" -f 'Dockerfile' .

docker buildx rm $BUILDER
