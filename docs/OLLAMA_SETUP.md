# Ollama Setup Guide for AI Chat Functionality

This guide provides comprehensive instructions for setting up Ollama with the Mistral model to enable AI chat functionality in the Qirata application.

## Overview

Ollama is a local AI model runner that allows you to run large language models on your machine. The Qirata application integrates with Ollama to provide real-time AI chat capabilities through LangChain.

## Prerequisites

- **Operating System**: macOS, Linux, or Windows WSL2
- **Memory**: Minimum 8GB RAM (16GB+ recommended for better performance)
- **Storage**: 4-8GB free space for model storage
- **Network**: Internet connection for initial model download

## Installation

### macOS

1. **Download Ollama**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

   Or download from [https://ollama.ai/download](https://ollama.ai/download)

2. **Verify Installation**:
   ```bash
   ollama --version
   ```

### Linux

1. **Install via curl**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Start Ollama service**:
   ```bash
   sudo systemctl start ollama
   sudo systemctl enable ollama
   ```

### Windows (WSL2)

1. **Install in WSL2**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Configure for external access** (if needed):
   ```bash
   export OLLAMA_HOST=0.0.0.0:11434
   ```

## Model Setup

### Download Mistral Model

1. **Pull the Mistral model**:
   ```bash
   ollama pull mistral
   ```

   This will download approximately 4.1GB. The download may take several minutes depending on your internet connection.

2. **Verify model installation**:
   ```bash
   ollama list
   ```

   You should see `mistral` in the list of available models.

3. **Test the model**:
   ```bash
   ollama run mistral "Hello, how are you?"
   ```

### Alternative Models (Optional)

If you prefer different models or need specific capabilities:

```bash
# For code-focused tasks
ollama pull codellama

# For lightweight option (smaller memory footprint)
ollama pull llama2:7b

# For more advanced capabilities (requires more memory)
ollama pull llama2:13b
```

## Configuration

### Default Configuration

Ollama runs on `http://localhost:11434` by default, which matches the application's configuration.

### Custom Configuration

If you need to customize the Ollama configuration:

1. **Change the port**:
   ```bash
   export OLLAMA_HOST=0.0.0.0:11435
   ollama serve
   ```

2. **Update application environment variables**:
   ```env
   # In express-backend/.env
   OLLAMA_URL=http://localhost:11435
   OLLAMA_MODEL=mistral
   ```

### Performance Tuning

1. **Memory Configuration**:
   ```bash
   # Set memory limit (in GB)
   export OLLAMA_MAX_MEMORY=8
   ```

2. **GPU Acceleration** (if available):
   ```bash
   # NVIDIA GPU
   export OLLAMA_GPU=nvidia

   # AMD GPU
   export OLLAMA_GPU=amd
   ```

3. **Thread Configuration**:
   ```bash
   # Set number of threads
   export OLLAMA_NUM_THREAD=8
   ```

## Starting Ollama

### Development Mode

1. **Start Ollama server**:
   ```bash
   ollama serve
   ```

   The server will start on `http://localhost:11434`

2. **Verify server is running**:
   ```bash
   curl http://localhost:11434/api/version
   ```

### Production Mode

1. **Create systemd service** (Linux):
   ```bash
   sudo nano /etc/systemd/system/ollama.service
   ```

   Add the following content:
   ```ini
   [Unit]
   Description=Ollama Service
   After=network-online.target

   [Service]
   ExecStart=/usr/local/bin/ollama serve
   User=ollama
   Group=ollama
   Restart=always
   RestartSec=3
   Environment="OLLAMA_HOST=0.0.0.0:11434"

   [Install]
   WantedBy=default.target
   ```

2. **Enable and start service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable ollama
   sudo systemctl start ollama
   ```

3. **Check service status**:
   ```bash
   sudo systemctl status ollama
   ```

### macOS Service (Optional)

Create a LaunchAgent for automatic startup:

1. **Create plist file**:
   ```bash
   nano ~/Library/LaunchAgents/com.ollama.server.plist
   ```

2. **Add configuration**:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.ollama.server</string>
       <key>ProgramArguments</key>
       <array>
           <string>/usr/local/bin/ollama</string>
           <string>serve</string>
       </array>
       <key>RunAtLoad</key>
       <true/>
       <key>KeepAlive</key>
       <true/>
   </dict>
   </plist>
   ```

3. **Load service**:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.ollama.server.plist
   ```

## Integration Testing

### Basic Connectivity Test

1. **Test API endpoint**:
   ```bash
   curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mistral",
       "prompt": "Hello",
       "stream": false
     }'
   ```

2. **Test streaming**:
   ```bash
   curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{
       "model": "mistral",
       "prompt": "Write a short poem",
       "stream": true
     }'
   ```

### Application Integration Test

1. **Start the Express backend**:
   ```bash
   cd express-backend
   npm run dev
   ```

2. **Test AI endpoint** (if available):
   ```bash
   curl -X POST http://localhost:3000/api/test-ai \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello AI"}'
   ```

3. **Monitor logs** for Ollama connectivity:
   ```bash
   tail -f express-backend/logs/combined.log | grep -i ollama
   ```

## Troubleshooting

### Common Issues

#### 1. Ollama Not Starting

**Symptoms**: `Connection refused` or `Service unavailable`

**Solutions**:
```bash
# Check if process is running
ps aux | grep ollama

# Kill existing processes
pkill ollama

# Restart with verbose logging
ollama serve --verbose
```

#### 2. Model Not Found

**Symptoms**: `Model 'mistral' not found`

**Solutions**:
```bash
# Re-download model
ollama pull mistral

# List available models
ollama list

# Check model path
ollama show mistral
```

#### 3. Memory Issues

**Symptoms**: Model loading fails or system becomes unresponsive

**Solutions**:
```bash
# Use smaller model
ollama pull llama2:7b

# Limit memory usage
export OLLAMA_MAX_MEMORY=4

# Monitor memory usage
htop
```

#### 4. Port Conflicts

**Symptoms**: `Address already in use`

**Solutions**:
```bash
# Check what's using port 11434
lsof -i :11434

# Use different port
export OLLAMA_HOST=0.0.0.0:11435
ollama serve

# Update application config
# OLLAMA_URL=http://localhost:11435
```

#### 5. Slow Performance

**Symptoms**: Slow response times or timeouts

**Solutions**:
```bash
# Enable GPU acceleration (if available)
export OLLAMA_GPU=nvidia

# Increase thread count
export OLLAMA_NUM_THREAD=8

# Use faster model
ollama pull codellama:7b
```

### Network Issues

#### Firewall Configuration

```bash
# Allow Ollama port through firewall (Linux)
sudo ufw allow 11434

# macOS
sudo pfctl -f /etc/pf.conf
```

#### Docker Integration (Optional)

If you prefer running Ollama in Docker:

```bash
# Pull Ollama Docker image
docker pull ollama/ollama

# Run Ollama container
docker run -d \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  ollama/ollama

# Pull model in container
docker exec -it ollama ollama pull mistral
```

### Debugging Commands

```bash
# Check Ollama version and build info
ollama --version

# View detailed model information
ollama show mistral --verbose

# Test model performance
time ollama run mistral "Count from 1 to 10"

# Monitor system resources
top -p $(pgrep ollama)

# Check Ollama logs
journalctl -u ollama -f  # Linux with systemd
```

## Performance Optimization

### Hardware Recommendations

- **CPU**: Multi-core processor (8+ cores recommended)
- **RAM**: 16GB+ for optimal performance
- **Storage**: SSD for faster model loading
- **GPU**: NVIDIA RTX series or AMD Radeon for acceleration

### Memory Optimization

```bash
# Preload model to avoid cold starts
ollama run mistral ""

# Use memory-mapped files
export OLLAMA_MMAP=true

# Limit context window for lower memory usage
export OLLAMA_MAX_CONTEXT=2048
```

### Model Selection Guidelines

| Model | Size | Memory | Use Case |
|-------|------|--------|----------|
| `llama2:7b` | 3.8GB | 8GB+ | Lightweight, fast responses |
| `mistral` | 4.1GB | 8GB+ | Balanced performance (recommended) |
| `codellama` | 3.8GB | 8GB+ | Code generation and analysis |
| `llama2:13b` | 7.3GB | 16GB+ | Higher quality, more capabilities |

## Security Considerations

### Network Security

```bash
# Bind to localhost only (default)
export OLLAMA_HOST=127.0.0.1:11434

# Enable HTTPS (if needed)
export OLLAMA_TLS_CERT=/path/to/cert.pem
export OLLAMA_TLS_KEY=/path/to/key.pem
```

### Access Control

```bash
# Run Ollama as non-root user
sudo useradd -r -s /bin/false ollama
sudo -u ollama ollama serve
```

## Next Steps

After successfully setting up Ollama:

1. **Start the application stack**:
   ```bash
   # Terminal 1: Start Ollama
   ollama serve

   # Terminal 2: Start Express backend
   cd express-backend && npm run dev

   # Terminal 3: Start React frontend
   cd frontend && npm run dev
   ```

2. **Test AI chat functionality** in the web interface

3. **Configure user preferences** using the Style Wizard

4. **Monitor performance** and adjust settings as needed

For integration testing and advanced configuration, see:
- [`AI_TESTING.md`](./AI_TESTING.md) - AI integration testing guide
- [`AI_CHAT_STREAMING.md`](./AI_CHAT_STREAMING.md) - Technical implementation details
- [`../README.md`](../../README.md) - Main application documentation

## Support

For additional help:
- [Ollama Documentation](https://ollama.ai/docs)
- [Ollama GitHub Issues](https://github.com/jmorganca/ollama/issues)
- [LangChain Ollama Integration](https://python.langchain.com/docs/integrations/llms/ollama)