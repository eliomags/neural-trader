#!/bin/bash

echo "🧠 Neural Trader v2.5.0 - Starting..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your API keys before starting in live mode"
fi

# Create necessary directories
mkdir -p logs data models config

# Check if TypeScript is built
if [ ! -d "dist" ]; then
    echo "🔨 Building TypeScript..."
    npm run build
fi

# Start the application
echo "🚀 Starting Neural Trader..."
echo "📊 Dashboard will be available at http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm start